"""Identify the transport actually used to reach the streaming host on Linux."""

import asyncio
import ipaddress
import json
import socket
from pathlib import Path
from typing import Literal, Optional, TypedDict

from .logger import logger

Transport = Literal["ethernet", "wifi", "unknown"]


class NetworkRoute(TypedDict):
    transport: Transport
    interface: Optional[str]
    reason: str


def classify_interface(interface: str, sysfs: Path = Path("/sys/class/net")) -> Transport:
    # Interface names come from iproute2. Reject traversal before reading sysfs.
    if not interface or "/" in interface or interface in (".", ".."):
        return "unknown"
    path = sysfs / interface
    if (path / "wireless").exists() or (path / "phy80211").exists():
        return "wifi"
    try:
        # ARPHRD_ETHER plus a hardware device excludes VPNs, bridges and veths.
        # An unrelated Ethernet carrier must never select a wired profile.
        if (path / "type").read_text().strip() == "1" and (path / "device").exists():
            return "ethernet"
    except OSError:
        pass
    return "unknown"


async def _route_interface(address: str) -> Optional[str]:
    process = None
    try:
        version = ipaddress.ip_address(address.split("%", 1)[0]).version
        process = await asyncio.create_subprocess_exec(
            "ip", "-j", f"-{version}", "route", "get", address,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL)
        output, _ = await asyncio.wait_for(process.communicate(), timeout=2)
        routes = json.loads(output)
        if process.returncode == 0 and routes:
            return routes[0].get("dev")
    except (OSError, ValueError, asyncio.TimeoutError):
        pass
    finally:
        if process is not None and process.returncode is None:
            try:
                process.kill()
            except ProcessLookupError:
                pass
            await process.wait()
    return None


async def detect_host_network(host: str, mode: str = "Auto") -> NetworkRoute:
    if mode in ("Ethernet", "WiFi"):
        return {"transport": "ethernet" if mode == "Ethernet" else "wifi",
                "interface": None, "reason": "Manual transport selection"}
    try:
        # Match the address family order used by Moonlight/the system resolver.
        # Numeric addresses also avoid DNS when the host is asleep.
        address = host.strip("[]")
        try:
            ipaddress.ip_address(address.split("%", 1)[0])
            addresses = [address]
        except ValueError:
            records = await asyncio.wait_for(
                asyncio.get_running_loop().getaddrinfo(
                    address, None, type=socket.SOCK_STREAM), timeout=2)
            addresses = list(dict.fromkeys(record[4][0] for record in records))
        for address in addresses[:3]:
            interface = await _route_interface(address)
            if interface:
                transport = classify_interface(interface)
                return {"transport": transport, "interface": interface,
                        "reason": f"Route to host uses {interface}"}
    except (OSError, ValueError, asyncio.TimeoutError):
        logger.warning("Could not resolve the host's streaming route")
    return {"transport": "unknown", "interface": None,
            "reason": "No identifiable Ethernet/Wi-Fi route; network overrides skipped"}
