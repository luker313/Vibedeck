from typing import Literal, Optional, TypedDict, cast
from enum import Enum

from .envparser import EnvSettings, parse_env_settings, RunnerType
from ..runnerresult import RunnerError, Result
from ..plugin.settings import HostSettings, RunnerTimeouts, UserSettingsManager
from ..moonlightproxy import ResolutionDimensions, CommandLineOptions
from ..networkprofile import Transport, detect_host_network
from ..streamingprofile import selected_dimension, resolve_streaming_profile
from ..logger import logger
from .. import constants


class CloseSteam(Enum):
    Client = 0
    BigPictureMode = 1


class SteamUser(TypedDict):
    id: str
    name: str


class MoonDeckAppRunnerSettings(TypedDict):
    cmd_options: CommandLineOptions
    host_app: str
    host_id: str
    hostname: str
    mac: str
    address: str
    host_port: int
    buddy_port: int
    client_id: str
    big_picture_mode: bool
    close_steam: Optional[CloseSteam]
    timeouts: RunnerTimeouts
    moonlight_exec_path: Optional[str]
    send_wol_once: bool
    custom_wol_exec_path: Optional[str]
    wol_port: int
    app_id: str
    steam_user: Optional[SteamUser]
    debug_logs: bool
    close_host_app_on_exit: bool
    runner_type: Literal[RunnerType.MoonDeck]


class MoonlightOnlyRunnerSettings(TypedDict):
    cmd_options: CommandLineOptions
    host_app: str
    host_id: str
    hostname: str
    mac: str
    address: str
    host_port: int
    buddy_port: int
    client_id: str
    timeouts: RunnerTimeouts
    moonlight_exec_path: Optional[str]
    send_wol_once: bool
    custom_wol_exec_path: Optional[str]
    wol_port: int
    debug_logs: bool
    runner_type: Literal[RunnerType.MoonlightOnly]


def parse_audio_settings(host_settings: HostSettings, env_settings: EnvSettings) -> Optional[str]:
    audio_option = host_settings["audio"]["defaultOption"]

    if host_settings["audio"]["useLinkedAudio"]:
        linked_audio_device = env_settings["linked_audio"]
        if linked_audio_device:
            for option, devices in host_settings["audio"]["linkedAudio"].items():
                if linked_audio_device in devices:
                    logger.info(f"Using linked audio device \"{linked_audio_device}\".")
                    audio_option = option

    logger.info(f"Parsed audio option: {audio_option}")
    return audio_option

def parse_resolution_settings(host_settings: HostSettings, env_settings: EnvSettings) -> ResolutionDimensions:
    dimensions: ResolutionDimensions = { 
        "size": None,
        "bitrate": host_settings["resolution"]["defaultBitrate"],
        "fps": host_settings["resolution"]["defaultFps"],
        "hdr": host_settings["resolution"]["defaultHdr"],
    }

    dimension = selected_dimension(host_settings, env_settings["linked_display"])
    if dimension:
        dimensions["size"] = { "width": dimension["width"], "height": dimension["height"] }
        for key in ("bitrate", "fps", "hdr"):
            if dimension[key] is not None:
                dimensions[key] = dimension[key]
    
    if not dimensions["size"] and host_settings["resolution"]["automatic"]:
        auto_resolution = env_settings["auto_resolution"]
            
        logger.info(f"Using auto resolution from MoonDeck: {auto_resolution}")
        if auto_resolution:
            dimensions["size"] = { "width": auto_resolution["width"], "height": auto_resolution["height"] }
        else:
            logger.warning(f"Cannot use automatic resolution! MoonDeck did not pass resolution. Still continuing...")
 
    logger.info(f"Parsed resolution settings: {dimensions}")
    return dimensions

def parse_host_app_name(host_settings: HostSettings) -> str:
    host_app: str = "MoonDeckStream"
    app_list = host_settings["buddy"]["hostApp"]["apps"]
    if len(app_list) > 0:
        index = host_settings["buddy"]["hostApp"]["selectedAppIndex"]
        if index >= 0 and index < len(app_list):
            host_app = app_list[index]
        else:
            logger.warning(f"Host app index ({index}) out of range ([0;{len(app_list)}]). Still continuing...")
    
    logger.info(f"Parsed host app name: {host_app}")
    return host_app

def parse_cmd_options(pass_to_moonlight: bool, host_settings: HostSettings, env_settings: EnvSettings,
                      transport: Transport = "unknown") -> CommandLineOptions:
    profile = resolve_streaming_profile(
        host_settings, selected_dimension(host_settings, env_settings["linked_display"]), transport)
    resolution = parse_resolution_settings(host_settings, env_settings) if pass_to_moonlight else None
    if resolution is not None:
        for key in ("bitrate", "fps", "hdr"):
            resolution[key] = profile[key]
    options = CommandLineOptions({
        "audio": parse_audio_settings(host_settings=host_settings, env_settings=env_settings) if pass_to_moonlight else None,
        "resolution": resolution,
        "show_performance_stats": host_settings["showPerformanceStats"] if pass_to_moonlight else None,
        "enable_v_sync": profile["enableVSync"] if pass_to_moonlight else None,
        "enable_frame_pacing": profile["enableFramePacing"] if pass_to_moonlight else None,
        "video_codec": profile["videoCodec"] if pass_to_moonlight else None,
        "yuv444": profile["yuv444"] if pass_to_moonlight else None,
        "enable_vrr": profile["enableVrr"] if pass_to_moonlight else None,
        "smooth_vrr_frame_timing": profile["smoothVrrFrameTiming"] if pass_to_moonlight else None,
        "absorb_vrr_microstutter": profile["absorbVrrMicrostutter"] if pass_to_moonlight else None,

        # This one is a special case since it is currently hardcoded based on the runner type and is not configurable.
        # The hardcoded non-None value should always be passed regardless of what `pass_to_moonlight` says.
        "quit_after": False if env_settings["runner_type"] == RunnerType.MoonDeck else None
    })
    logger.info(f"Resolved streaming profile ({transport}): {profile if pass_to_moonlight else 'Moonlight defaults'}")
    return options

async def parse_settings() -> MoonDeckAppRunnerSettings | MoonlightOnlyRunnerSettings:
    logger.info("Getting current host settings")
    settings_manager = UserSettingsManager(constants.get_config_file_path())
    user_settings, _ = await settings_manager.read()
    host_settings = None

    if user_settings is None:
        raise RunnerError(Result.NoSettings)

    host_id = user_settings["currentHostId"]
    if host_id is not None and host_id in user_settings["hostSettings"]:
        host_settings = user_settings["hostSettings"][host_id]

    if host_settings is None:
        raise RunnerError(Result.HostNotSelected)

    logger.info("Parsing ENV settings")
    env_settings = parse_env_settings()

    if env_settings["runner_type"] is None:
        raise RunnerError(Result.NoRunnerType)
    
    pass_to_moonlight = host_settings["passToMoonlight"]
    if not pass_to_moonlight:
        logger.info("Settings will NOT be passed to Moonlight")

    route = await detect_host_network(host_settings["address"], host_settings["networkSettings"]["mode"]) if pass_to_moonlight else None
    transport: Transport = route["transport"] if route else "unknown"
    if route:
        logger.info(f"Streaming network: {route}")
    
    if env_settings["runner_type"] == RunnerType.MoonDeck:
        if env_settings["app_id"] is None:
            raise RunnerError(Result.NoAppId)
        
        if env_settings["user_id"] is None:
            raise RunnerError(Result.NoUserId)
        
        if env_settings["username"] is None:
            raise RunnerError(Result.NoUsername)

        return MoonDeckAppRunnerSettings({
            "cmd_options": parse_cmd_options(pass_to_moonlight, host_settings=host_settings, env_settings=env_settings, transport=transport),
            "host_app": parse_host_app_name(host_settings=host_settings),
            "host_id": cast(str, host_id),
            "hostname": host_settings["hostName"],
            "mac": host_settings["mac"],
            "address": host_settings["address"],
            "host_port": host_settings["hostInfoPort"],
            "buddy_port": host_settings["buddy"]["port"],
            "client_id": user_settings["clientId"],
            "big_picture_mode": host_settings["buddy"]["bigPictureMode"],
            "close_steam": CloseSteam[host_settings["buddy"]["closeSteam"]] if host_settings["buddy"]["closeSteam"] else None,
            "timeouts": host_settings["runnerTimeouts"],
            "moonlight_exec_path": user_settings["moonlightExecPath"] if user_settings["useMoonlightExec"] else None,
            "send_wol_once": host_settings["wolSettings"]["sendOnce"],
            "custom_wol_exec_path": host_settings["wolSettings"]["customWolExecPath"] if host_settings["wolSettings"]["useCustomWolExec"] else None,
            "wol_port": host_settings["wolSettings"]["port"],
            "app_id": env_settings["app_id"],
            "steam_user": SteamUser(id=env_settings["user_id"], name=env_settings["username"]),
            "debug_logs": user_settings["runnerDebugLogs"],
            "close_host_app_on_exit": user_settings["gameSession"]["closeHostAppOnExit"],
            "runner_type": RunnerType.MoonDeck
        })
    else:
        if env_settings["app_name"] is None:
            raise RunnerError(Result.NoAppName)

        return MoonlightOnlyRunnerSettings({
            "cmd_options": parse_cmd_options(pass_to_moonlight, host_settings=host_settings, env_settings=env_settings, transport=transport),
            "host_app": env_settings["app_name"],
            "host_id": cast(str, host_id),
            "hostname": host_settings["hostName"],
            "mac": host_settings["mac"],
            "address": host_settings["address"],
            "host_port": host_settings["hostInfoPort"],
            "buddy_port": host_settings["buddy"]["port"],
            "client_id": user_settings["clientId"],
            "timeouts": host_settings["runnerTimeouts"],
            "moonlight_exec_path": user_settings["moonlightExecPath"] if user_settings["useMoonlightExec"] else None,
            "send_wol_once": host_settings["wolSettings"]["sendOnce"],
            "custom_wol_exec_path": host_settings["wolSettings"]["customWolExecPath"] if host_settings["wolSettings"]["useCustomWolExec"] else None,
            "wol_port": host_settings["wolSettings"]["port"],
            "debug_logs": user_settings["runnerDebugLogs"],
            "runner_type": RunnerType.MoonlightOnly
        })
