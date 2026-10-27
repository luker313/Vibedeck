import asyncio
import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, Mock, patch

from lib.moonlightproxy import MoonlightProxy, missing_client_features, stream_arguments
from lib.networkprofile import _route_interface, classify_interface, detect_host_network
from lib.plugin.settings import (HostSettings, StreamingOptions, UserSettings,
                                 UserSettingsManager, empty_streaming_profile,
                                 empty_transport_profiles)
from lib.runner.envparser import RunnerType
from lib.runner.settingsparser import parse_cmd_options
from lib.runnerresult import RunnerError
from lib.streamingprofile import resolve_streaming_profile, selected_dimension
from lib.utils import from_dict


def host_fixture():
    return {
        **{key: None for key in StreamingOptions.__annotations__},
        "hostInfoPort": 47989, "address": "192.0.2.1", "staticAddress": True,
        "hostName": "Vibepollo", "mac": "00:11:22:33:44:55", "os": "Linux",
        "resolution": {
            "automatic": True, "appResolutionOverride": "CustomResolution",
            "appResolutionOverrideForInternalDisplay": False,
            "useCustomDimensions": False, "useLinkedDisplays": True,
            "selectedDimensionIndex": -1, "defaultBitrate": 100000,
            "defaultFps": 120, "defaultHdr": True, "dimensions": [],
        },
        "audio": {"defaultOption": None, "useLinkedAudio": True, "linkedAudio": {}},
        "runnerTimeouts": {
            "buddyRequests": 5, "servicePing": 5, "initialConditions": 30,
            "streamReadiness": 30, "steamReadiness": 60, "userSwitch": 60,
            "appLaunch": 30, "appLaunchStability": 15, "streamEnd": 15,
            "wakeOnLan": 60, "steamLaunch": 5,
        },
        "passToMoonlight": True, "showPerformanceStats": None,
        "networkSettings": {"mode": "Auto", **empty_transport_profiles()},
        "buddy": {
            "bigPictureMode": True, "port": 59999, "closeSteam": None,
            "hostApp": {"selectedAppIndex": -1, "apps": []}, "hibernateHost": False,
        },
        "gameStreamApps": {"showQuickAccessButton": False},
        "nonSteamApps": {"showQuickAccessButton": False},
        "wolSettings": {"useCustomWolExec": False, "sendOnce": False,
                        "customWolExecPath": "", "port": 9},
    }


def display_fixture(identifier="TV"):
    return {**empty_streaming_profile(), "width": 3840, "height": 2160,
            "label": identifier, "linkedDisplays": [identifier],
            "networkOverrides": empty_transport_profiles()}


def environment(display="TV", runner=RunnerType.MoonDeck):
    return {"linked_display": display, "linked_audio": None,
            "auto_resolution": {"width": 1280, "height": 800}, "runner_type": runner}


class ProfileTests(unittest.TestCase):
    def setUp(self):
        self.host = host_fixture()
        self.display = display_fixture()
        self.host["resolution"]["dimensions"] = [self.display]

    def test_display_network_beats_host_network_and_preserves_explicit_false(self):
        self.host["videoCodec"] = "AV1"
        self.display.update(videoCodec="HEVC", enableVrr=True, hdr=True)
        self.host["networkSettings"]["ethernet"].update(videoCodec="PyroWave", bitrate=400000)
        self.display["networkOverrides"]["ethernet"].update(bitrate=300000, yuv444=True)
        self.display["networkOverrides"]["wifi"].update(videoCodec="AV1", bitrate=60000,
                                                       yuv444=False, enableVrr=False, hdr=False)
        wired = parse_cmd_options(True, self.host, environment(), "ethernet")
        self.assertEqual(wired["video_codec"], "PyroWave")
        self.assertEqual(wired["resolution"]["bitrate"], 300000)
        self.assertTrue(wired["enable_vrr"])
        self.assertTrue(wired["yuv444"])
        wifi = parse_cmd_options(True, self.host, environment(), "wifi")
        self.assertEqual(wifi["video_codec"], "AV1")
        self.assertEqual(wifi["resolution"]["bitrate"], 60000)
        for key in ("enable_vrr", "yuv444"):
            self.assertIs(wifi[key], False)
        self.assertIs(wifi["resolution"]["hdr"], False)
        self.assertIn("--no-yuv444", stream_arguments(wifi))
        self.assertIn("--no-vrr", stream_arguments(wifi))
        self.assertIn("--no-hdr", stream_arguments(wifi))

    def test_unknown_network_does_not_select_ethernet(self):
        self.host["videoCodec"] = "AV1"
        self.host["networkSettings"]["ethernet"]["videoCodec"] = "PyroWave"
        self.assertEqual(resolve_streaming_profile(self.host, self.display, "unknown")["videoCodec"], "AV1")

    def test_linked_display_beats_selected_fallback_and_does_not_mutate(self):
        other = display_fixture("Deck")
        other.update(width=1280, height=800)
        self.host["resolution"]["dimensions"].append(other)
        self.host["resolution"].update(useCustomDimensions=True, selectedDimensionIndex=1)
        original = copy.deepcopy(self.host)
        self.assertIs(selected_dimension(self.host, "TV"), self.display)
        self.assertIs(selected_dimension(self.host, "missing"), other)
        resolve_streaming_profile(self.host, other, "wifi")
        self.assertEqual(self.host, original)
        self.host["resolution"]["useLinkedDisplays"] = False
        self.assertIs(selected_dimension(self.host, "TV"), other)

    def test_inheritance_and_invalid_selection_use_automatic_resolution(self):
        self.host["resolution"].update(selectedDimensionIndex=99, useCustomDimensions=True)
        options = parse_cmd_options(True, self.host, environment("missing"), "wifi")
        self.assertEqual(options["resolution"]["size"], {"width": 1280, "height": 800})
        self.assertEqual(options["resolution"]["bitrate"], 100000)

    def test_pass_to_moonlight_off_keeps_required_no_quit_only(self):
        self.display.update(videoCodec="PyroWave", enableVrr=True)
        options = parse_cmd_options(False, self.host, environment(), "ethernet")
        self.assertEqual(stream_arguments(options), ["--no-quit-after"])
        standalone = parse_cmd_options(False, self.host, environment(runner=RunnerType.MoonlightOnly))
        self.assertEqual(stream_arguments(standalone), [])

    def test_performance_stats_override_is_independent_of_streaming_profiles(self):
        self.display.update(videoCodec="PyroWave", enableVrr=True)
        for pass_options in (True, False):
            for runner in (RunnerType.MoonDeck, RunnerType.MoonlightOnly):
                for transport in ("ethernet", "wifi"):
                    for stats in (None, True, False):
                        with self.subTest(pass_options=pass_options, runner=runner,
                                          transport=transport, stats=stats):
                            self.host["showPerformanceStats"] = stats
                            options = parse_cmd_options(pass_options, self.host,
                                                        environment(runner=runner), transport)
                            self.assertIs(options["show_performance_stats"], stats)
                            args = stream_arguments(options)
                            expected = ([] if stats is None else
                                        ["--performance-overlay" if stats else "--no-performance-overlay"])
                            actual = [arg for arg in args if "performance-overlay" in arg]
                            self.assertEqual(actual, expected)
                            if not pass_options:
                                required = ["--no-quit-after"] if runner == RunnerType.MoonDeck else []
                                self.assertEqual(args, required + expected)

    def test_nonary_cli_arguments_and_feature_checks(self):
        self.display.update(videoCodec="PyroWave", yuv444=True, enableVrr=True,
                            smoothVrrFrameTiming=True, absorbVrrMicrostutter=False)
        options = parse_cmd_options(True, self.host, environment(), "ethernet")
        args = stream_arguments(options)
        self.assertEqual(args[args.index("--video-codec") + 1], "PyroWave")
        for flag in ("--yuv444", "--vrr", "--vrr-smooth-frame-timing", "--no-vrr-absorb-microstutter"):
            self.assertIn(flag, args)
        self.assertIn("--vrr", missing_client_features("--vrr-smooth-frame-timing --yuv444", options))
        complete_help = "PyroWave --yuv444 --vrr --vrr-smooth-frame-timing --no-vrr-absorb-microstutter"
        self.assertEqual(missing_client_features(complete_help, options), [])
        self.assertIn("PyroWave codec", missing_client_features("stock Moonlight", options))


class NetworkTests(unittest.IsolatedAsyncioTestCase):
    def test_sysfs_classification_excludes_virtual_devices(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in ("enp4s0", "wlan0", "wg0", "veth0"):
                (root / name).mkdir()
                (root / name / "type").write_text("1\n")
            (root / "enp4s0" / "device").mkdir()
            (root / "wlan0" / "wireless").mkdir()
            self.assertEqual(classify_interface("enp4s0", root), "ethernet")
            self.assertEqual(classify_interface("wlan0", root), "wifi")
            self.assertEqual(classify_interface("wg0", root), "unknown")
            self.assertEqual(classify_interface("veth0", root), "unknown")
            self.assertEqual(classify_interface("../secret", root), "unknown")

    async def test_route_device_wins_over_other_connected_links(self):
        with patch("lib.networkprofile._route_interface", AsyncMock(return_value="wlan0")), \
             patch("lib.networkprofile.classify_interface", return_value="wifi"):
            result = await detect_host_network("192.0.2.1")
        self.assertEqual(result["transport"], "wifi")
        self.assertEqual(result["interface"], "wlan0")

    async def test_manual_mode_does_not_probe(self):
        with patch("lib.networkprofile._route_interface", AsyncMock()) as route:
            self.assertEqual((await detect_host_network("host", "Ethernet"))["transport"], "ethernet")
            self.assertEqual((await detect_host_network("host", "WiFi"))["transport"], "wifi")
            route.assert_not_called()

    async def test_no_route_inherits_and_ipv6_uses_correct_family(self):
        with patch("lib.networkprofile._route_interface", AsyncMock(return_value=None)):
            self.assertEqual((await detect_host_network("192.0.2.1"))["transport"], "unknown")
        process = Mock(returncode=0, communicate=AsyncMock(return_value=(b'[{"dev":"enp4s0"}]', b"")))
        with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=process)) as launch:
            self.assertEqual(await _route_interface("2001:db8::1"), "enp4s0")
            self.assertEqual(launch.call_args.args[:6], ("ip", "-j", "-6", "route", "get", "2001:db8::1"))

    async def test_route_timeout_reaps_child(self):
        process = Mock(returncode=None, communicate=AsyncMock(side_effect=asyncio.TimeoutError), wait=AsyncMock())
        with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=process)):
            self.assertIsNone(await _route_interface("192.0.2.1"))
        process.kill.assert_called_once()
        process.wait.assert_awaited_once()


class SettingsAndClientTests(unittest.IsolatedAsyncioTestCase):
    async def test_forced_stats_reach_the_selected_moonlight_executable(self):
        host = host_fixture()
        host["showPerformanceStats"] = True
        options = parse_cmd_options(False, host, environment())
        for executable in (None, "/tmp/Nonary Moonlight.AppImage"):
            with self.subTest(executable=executable):
                process = Mock(pid=1234)
                with patch("lib.utils.create_subprocess_exec", AsyncMock(return_value=process)) as launch, \
                     patch("lib.utils.ProcessReaper"), \
                     patch.object(MoonlightProxy, "_MoonlightProxy__get_flatpak_exec", return_value="/usr/bin/flatpak"):
                    proxy = MoonlightProxy(executable)
                    await proxy.start("Vibepollo", "MoonDeckStream", options)
                    prefix = (["/usr/bin/flatpak", "run", "--branch=master", MoonlightProxy.flatpak_moonlight]
                              if executable is None else [executable])
                    self.assertEqual(launch.call_args.args,
                                     tuple(prefix + ["--no-quit-after", "--performance-overlay",
                                                     "stream", "Vibepollo", "MoonDeckStream"]))

    async def test_v43_migration_preserves_pairing_and_display_links(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "settings.json"
            manager = UserSettingsManager(path)
            settings = manager._default_settings()
            settings.update(version=43, currentHostId="host", clientId="existing-pairing")
            host = host_fixture()
            display = display_fixture()
            for key in StreamingOptions.__annotations__:
                if key not in ("videoCodec", "enableVSync", "enableFramePacing"):
                    del host[key]
                del display[key]
            del host["networkSettings"]
            del display["networkOverrides"]
            del display["label"]
            display["bitrate"] = 125000
            host["resolution"]["dimensions"] = [display]
            settings["hostSettings"] = {"host": host}
            path.write_text(json.dumps(settings))
            loaded = await manager.read_or_update()
            self.assertEqual(loaded["version"], 44)
            self.assertEqual(loaded["clientId"], "existing-pairing")
            self.assertEqual(loaded["hostSettings"]["host"]["resolution"]["dimensions"][0]["bitrate"], 125000)
            self.assertEqual(loaded["hostSettings"]["host"]["resolution"]["dimensions"][0]["linkedDisplays"], ["TV"])
            self.assertEqual(from_dict(UserSettings, loaded), loaded)

    async def test_import_does_not_overwrite_original_moondeck_settings(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "vibedeck" / "settings.json"
            legacy = Path(directory) / "moondeck" / "settings.json"
            legacy.parent.mkdir()
            original = UserSettingsManager(legacy)._default_settings()
            original["clientId"] = "paired-client"
            legacy.write_text(json.dumps(original))
            original_bytes = legacy.read_bytes()
            with patch("lib.constants.get_config_file_path", return_value=target):
                loaded = await UserSettingsManager(target).read_or_update()
            self.assertEqual(loaded["clientId"], "paired-client")
            self.assertEqual(legacy.read_bytes(), original_bytes)
            self.assertTrue(target.is_file())

    async def test_capability_check_rejects_stock_client_before_launch(self):
        options = parse_cmd_options(True, host_fixture(), environment())
        options.update(video_codec="PyroWave", enable_vrr=True)
        process = Mock(returncode=0, communicate=AsyncMock(return_value=(b"--video-codec AV1", None)))
        with patch("lib.utils.create_subprocess_exec", AsyncMock(return_value=process)) as launch:
            proxy = MoonlightProxy("/tmp/VRR Moonlight.AppImage")
            with self.assertRaises(RunnerError):
                await proxy.validate_options(options)
            self.assertEqual(launch.call_args.args, ("/tmp/VRR Moonlight.AppImage", "stream", "--help"))
            self.assertIsNone(proxy.process)

    def test_host_fixture_passes_real_settings_validator(self):
        self.assertEqual(from_dict(HostSettings, host_fixture()), host_fixture())


if __name__ == "__main__":
    unittest.main()
