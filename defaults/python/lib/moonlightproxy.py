import contextlib

from typing import Optional, TypedDict, cast
from .logger import logger
from . import constants


class ResolutionSize(TypedDict):
    width: int
    height: int


class ResolutionDimensions(TypedDict):
    size: Optional[ResolutionSize]
    bitrate: Optional[int]
    fps: Optional[int]
    hdr: Optional[bool]


class CommandLineOptions(TypedDict):
    audio: Optional[str]
    resolution: Optional[ResolutionDimensions]
    quit_after: Optional[bool]
    show_performance_stats: Optional[bool]
    enable_v_sync: Optional[bool]
    enable_frame_pacing: Optional[bool]
    video_codec: Optional[str]
    yuv444: Optional[bool]
    enable_vrr: Optional[bool]
    smooth_vrr_frame_timing: Optional[bool]
    absorb_vrr_microstutter: Optional[bool]


def stream_arguments(options: CommandLineOptions) -> list[str]:
    """Produce argv without a shell, preserving explicit false overrides."""
    args: list[str] = []
    if options.get("audio") is not None:
        args += ["--audio-config", options["audio"]]
    resolution = options.get("resolution")
    if resolution:
        size = resolution["size"]
        if size:
            args += ["--resolution", f"{size['width']}x{size['height']}"]
        for key in ("fps", "bitrate"):
            if resolution[key]:
                args += [f"--{key}", str(resolution[key])]
        if resolution["hdr"] is not None:
            args.append("--hdr" if resolution["hdr"] else "--no-hdr")
    toggles = {
        "quit_after": "quit-after", "show_performance_stats": "performance-overlay",
        "enable_v_sync": "vsync", "enable_frame_pacing": "frame-pacing",
        "yuv444": "yuv444", "enable_vrr": "vrr",
        "smooth_vrr_frame_timing": "vrr-smooth-frame-timing",
        "absorb_vrr_microstutter": "vrr-absorb-microstutter",
    }
    for key, flag in toggles.items():
        if options.get(key) is not None:
            args.append(f"--{flag}" if options[key] else f"--no-{flag}")
    if options.get("video_codec") is not None:
        args += ["--video-codec", options["video_codec"]]
    return args


def missing_client_features(help_text: str, options: CommandLineOptions) -> list[str]:
    import re
    # Match complete flags; --vrr-smooth-frame-timing must not imply --vrr.
    supported = set(re.findall(r"--[a-z0-9-]+", help_text.lower()))
    custom = ("vrr", "vrr-smooth-frame-timing", "vrr-absorb-microstutter", "yuv444")
    required = [arg for arg in stream_arguments(options)
                if arg.startswith("--") and arg.removeprefix("--").removeprefix("no-") in custom]
    missing = [arg for arg in required if arg not in supported]
    if (options.get("video_codec") or "").lower() == "pyrowave" and "pyrowave" not in help_text.lower():
        missing.append("PyroWave codec")
    return missing


class MoonlightProxy(contextlib.AbstractAsyncContextManager):

    flatpak_moonlight = "com.moonlight_stream.Moonlight"
    # Nonary's bundle uses master; Flathub's stock build uses stable.
    flatpak_branch = "master"

    def __init__(self, exec_path: Optional[str]) -> None:
        # Lazy import to improve CLI performance
        from . import utils
        from asyncio.subprocess import Process

        self.exec_path = exec_path
        self.process: Optional[Process] = None
        self.__reaper: Optional[utils.ProcessReaper] = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return await self.terminate()
    
    async def get_apps(self, hostname: str):
        # Lazy import to improve CLI performance
        from . import utils

        assert self.process is None, "Another instance of Moonlight has been started already!"
        exec, args = self.__get_exec_with_args()

        args += ["list", hostname]
        logger.info(f"Executing: {exec} {' '.join(args)}")
        self.process = await utils.create_subprocess_exec(exec, *args, stderr_to_devnull=True)
        self.__reaper = utils.ProcessReaper(self.process.pid)

        output, _ = await self.process.communicate()
        success = self.process.returncode == 0
        self.process = None
        self.__reaper = None

        if success:
            apps: set[str] = set()
            if output:
                output = output.decode()
                output = output.split("\n")
                for app in output:
                    if app:
                        apps.add(app)
            return sorted(list(apps))
        return None     

    async def start(self, hostname: str, host_app: str, cmd_options: Optional[CommandLineOptions] = None):
        # Lazy import to improve CLI performance
        from . import utils
        
        assert self.process is None, "Another instance of Moonlight has been started already!"
        exec, args = self.__get_exec_with_args()

        if cmd_options:
            args += stream_arguments(cmd_options)

        args += ["stream", hostname, host_app]

        logger.info(f"Executing: {exec} {' '.join(args)}")
        self.process = await utils.create_subprocess_exec(exec, *args)
        self.__reaper = utils.ProcessReaper(self.process.pid)

    async def validate_options(self, options: CommandLineOptions):
        import asyncio
        from . import utils
        from .runnerresult import RunnerError, Result

        if not any(options.get(key) is not None for key in (
                "enable_vrr", "smooth_vrr_frame_timing", "absorb_vrr_microstutter", "yuv444")) and (options.get("video_codec") or "").lower() != "pyrowave":
            return
        executable, args = self.__get_exec_with_args()
        process = await utils.create_subprocess_exec(executable, *args, "stream", "--help")
        try:
            output, _ = await asyncio.wait_for(process.communicate(), timeout=8)
            missing = missing_client_features(output.decode(errors="replace"), options)
            if process.returncode != 0 or missing:
                logger.error(f"Moonlight capability check failed; missing: {missing}")
                raise RunnerError(Result.UnsupportedMoonlightOptions)
        except asyncio.TimeoutError as error:
            logger.error("Moonlight capability check timed out; verify the selected Nonary executable")
            raise RunnerError(Result.UnsupportedMoonlightOptions) from error
        finally:
            if process.returncode is None:
                try:
                    process.kill()
                except ProcessLookupError:
                    pass
                await process.wait()

    async def terminate(self):
        # Lazy import to improve CLI performance
        import asyncio

        if self.process is None:
            return

        assert self.__reaper is not None
        try:
            logger.info("Trying to gracefully terminate Moonlight...")
            self.__reaper.send_terminate()
            try:
                await asyncio.wait_for(self.process.wait(), timeout=5.0)
                logger.info("Moonlight terminated gracefully.")
            except asyncio.TimeoutError:
                logger.info("Moonlight did not terminate in time - killing it!")
                self.__reaper.send_kill()
                await self.process.wait()
        except ProcessLookupError:
            pass
        finally:
            self.process = None
            self.__reaper = None

    async def wait(self):
        # Lazy import to improve CLI performance
        import asyncio

        if not self.process:
            return

        async def log_stream(stream: Optional[asyncio.StreamReader]):
            if not stream:
                logger.error("NULL Moonlight stream handle - output will not be saved!")
                return

            logger.info("Starting to save Moonlight output.")
            with open(constants.MOONLIGHT_LOG_FILE, "w", 1) as file:
                while not stream.at_eof():
                    data = await stream.readline()
                    file.write(data.decode())
            logger.info("Finished saving Moonlight output.")

        process_task = asyncio.create_task(self.process.wait())
        log_task = asyncio.create_task(log_stream(self.process.stdout))
        await asyncio.wait([process_task, log_task], return_when=asyncio.ALL_COMPLETED)

    @classmethod
    async def terminate_all_instances(cls):
        await cls.__kill_flatpak_app()
        await cls.__kill_any_moonlight_app()

    async def is_moonlight_installed(self):
        # Lazy import to improve CLI performance
        from . import utils
        import os

        if self.exec_path is None:
            flatpak_exec = self.__get_flatpak_exec()
            if flatpak_exec is None:
                logger.error("flatpak is not installed!")
                return False

            info = await utils.create_subprocess_exec(
                flatpak_exec, "info", f"{self.flatpak_moonlight}//{self.flatpak_branch}",
                stderr_to_devnull=True)
            await info.communicate()
            return info.returncode == 0
        else:
            if os.path.isfile(self.exec_path):
                if os.access(self.exec_path, os.X_OK):
                    return True
                else:
                    logger.info(f"File \"{self.exec_path}\" is not an executable!")
            else:
                logger.info(f"\"{self.exec_path}\" is not a valid file!")

        return False
    
    @staticmethod
    def __get_flatpak_exec():
        import shutil
        return shutil.which("flatpak")
    
    def __get_exec_with_args(self):
        if self.exec_path is None:
            exec = self.__get_flatpak_exec()
            args = ["run", f"--branch={self.flatpak_branch}", self.flatpak_moonlight]

            if exec is None:
                raise Exception("Moonlight is not installed!")
        else:
            exec = self.exec_path
            args = []

        return exec, args
    
    @classmethod
    async def __kill_flatpak_app(cls):
        # Lazy import to improve CLI performance
        from . import utils

        flatpak_exec = cls.__get_flatpak_exec()
        if flatpak_exec is None:
            return

        kill_proc = await utils.create_subprocess_exec(flatpak_exec, "kill", MoonlightProxy.flatpak_moonlight)
        output, _ = await kill_proc.communicate()
        if output:
            newline = "\n"
            logger.info(f"flatpak kill output: {newline}{output.decode().strip(newline)}")

    @staticmethod
    async def __kill_any_moonlight_app():
        # Lazy import to improve CLI performance
        from .utils import ProcessReaper
        ProcessReaper("moonlight").send_terminate()
