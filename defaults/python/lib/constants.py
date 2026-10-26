BUDDY_API_VERSION = 9
BACKEND_LOG_FILE = "/tmp/vibedeck-backend.log"
FRONTEND_LOG_FILE = "/tmp/vibedeck-frontend.log"
RUNNER_LOG_FILE = "/tmp/vibedeck-runner.log"
MOONLIGHT_LOG_FILE = "/tmp/vibedeck-runner-moonlight.log"
RUNNER_RESULT_FILE = "/tmp/vibedeck-runner.result"
RUNNER_READY_FILE = "/tmp/vibedeck-runner-ready"
RUNNER_SUSPENDED_FILE = "/tmp/vibedeck-runner-suspended"
RUNNER_PID_FILE = "/tmp/vibedeck-runner-pid"
RUNNER_SUSPEND_CANCEL_MSG = "suspended"

def get_config_file_path():
    # Lazy import to improve CLI performance
    import pathlib

    return pathlib.Path.home() / ".config" / "vibedeck" / "settings.json"
