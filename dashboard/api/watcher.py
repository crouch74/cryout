import time
import logging
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import os

# 🛡️ Logging setup
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

def log_event(msg): logger.info(f"👀 {msg}")

class SimulationOutputHandler(FileSystemEventHandler):
    def __init__(self, callback):
        self.callback = callback

    def on_modified(self, event):
        if not event.is_directory:
            log_event(f"File modified: {event.src_path}")
            self.callback(event.src_path)

    def on_created(self, event):
        if not event.is_directory:
            log_event(f"New file created: {event.src_path}")
            self.callback(event.src_path)

def start_watcher(path, callback):
    event_handler = SimulationOutputHandler(callback)
    observer = Observer()
    observer.schedule(event_handler, path, recursive=True)
    observer.start()
    log_event(f"Watcher started on {path}")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()

if __name__ == "__main__":
    SIM_DIR = os.getenv("SIMULATION_OUTPUT_DIR", "../../simulation_output")
    def dummy_callback(path): print(f"File changed: {path}")
    start_watcher(SIM_DIR, dummy_callback)
