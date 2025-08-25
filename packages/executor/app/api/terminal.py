"""
Terminal WebSocket endpoint for in-IDE terminal functionality
Provides interactive shell with per-project virtual environment
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, HTTPException
import os
import sys
import pty
import termios
import fcntl
import struct
import select
import asyncio
import signal
import json
import tty
import time
from pathlib import Path
from typing import Optional, Dict, Any
from ..core.logging import get_logger

router = APIRouter()
log = get_logger(__name__)

# Configuration
IDLE_TIMEOUT_MS = int(os.getenv("TERMINAL_IDLE_TIMEOUT_MS", "600000"))  # 10 minutes
MAX_SESSION_DURATION_MS = int(os.getenv("TERMINAL_MAX_SESSION_MS", "3600000"))  # 1 hour

class TerminalSession:
    """Manages a single terminal session"""
    
    def __init__(self, project_id: str, mode: str = "pkg"):
        self.project_id = project_id
        self.mode = mode
        self.pid: Optional[int] = None
        self.master_fd: Optional[int] = None
        self.last_activity = time.time()
        self.start_time = time.time()
        self.running = False
        
    def is_idle(self) -> bool:
        """Check if session has been idle too long"""
        return (time.time() - self.last_activity) * 1000 > IDLE_TIMEOUT_MS
    
    def is_expired(self) -> bool:
        """Check if session has exceeded maximum duration"""
        return (time.time() - self.start_time) * 1000 > MAX_SESSION_DURATION_MS
    
    def update_activity(self):
        """Update last activity timestamp"""
        self.last_activity = time.time()

def _project_paths(project_id: str) -> tuple[Path, Path]:
    """Get project root and venv paths"""
    root = Path("/app/projects") / project_id
    venv = root / "venv"
    return root, venv

def _build_env(base: dict, venv: Path, project_root: Path) -> dict:
    """Build environment with venv activated"""
    env = dict(base)
    env["VIRTUAL_ENV"] = str(venv)
    
    # Set PATH with venv bin directory first
    if os.name == 'nt':
        bin_dir = str(venv / "Scripts")
    else:
        bin_dir = str(venv / "bin")
    
    env["PATH"] = bin_dir + os.pathsep + base.get("PATH", "")
    env["PWD"] = str(project_root)
    
    # Set a custom prompt to show we're in the project venv
    env["PS1"] = f"(aim-red:{project_root.name})$ "
    
    # Python-specific environment variables
    env["PYTHONPATH"] = str(project_root)
    
    return env

def _set_winsize(fd: int, rows: int, cols: int):
    """Set terminal window size"""
    try:
        fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))
    except Exception as e:
        log.warning(f"Failed to set window size: {e}")

@router.websocket("/terminal")
async def terminal_ws(
    ws: WebSocket, 
    project_id: str = Query(...), 
    mode: str = Query("pkg", regex="^(pkg|shell)$")
):
    """WebSocket endpoint for terminal sessions"""
    await ws.accept()
    session = TerminalSession(project_id, mode)
    
    try:
        # Get project paths
        project_root, venv = _project_paths(project_id)
        
        # Ensure project directory exists (create if not)
        if not project_root.exists():
            project_root.mkdir(parents=True, exist_ok=True)
            
        if not venv.exists():
            # Virtual environment should exist already (created with project)
            await ws.send_text(json.dumps({
                "type": "error",
                "message": f"Virtual environment not found for project {project_id}. Please recreate the project."
            }))
            await ws.close()
            return
        
        # Determine shell to use
        shell = "/bin/bash" if os.path.exists("/bin/bash") else "/bin/sh"
        
        # Build environment with venv activated
        env = _build_env(os.environ.copy(), venv, project_root)
        
        # Fork a PTY
        try:
            pid, master_fd = pty.fork()
        except OSError as e:
            log.error(f"Failed to fork PTY: {e}")
            await ws.send_text(json.dumps({
                "type": "error",
                "message": f"Failed to create terminal: {e}"
            }))
            await ws.close()
            return
        
        if pid == 0:
            # Child process - exec the shell
            try:
                os.chdir(str(project_root))
                os.execve(shell, [shell, "-l"], env)  # -l for login shell
            except Exception as e:
                # Log error and exit
                print(f"Failed to exec shell: {e}", file=sys.stderr)
                os._exit(1)
            # Should never reach here
            os._exit(1)
        
        # Parent process - manage the PTY
        session.pid = pid
        session.master_fd = master_fd
        session.running = True
        
        # Set terminal to raw mode
        try:
            tty.setraw(master_fd, termios.TCSANOW)
        except Exception:
            pass  # Not critical if this fails
        
        # Set initial window size
        _set_winsize(master_fd, 24, 80)
        
        # Send ready message
        await ws.send_text(json.dumps({
            "type": "ready",
            "pid": pid,
            "mode": mode,
            "project_id": project_id
        }))
        
        # Send initial message based on mode
        if mode == "pkg":
            initial_msg = (
                f"\\033[1;32mPackage Console for project: {project_id}\\033[0m\\r\\n"
                f"Virtual environment: {venv}\\r\\n"
                f"Use 'pip install <package>' to install packages\\r\\n"
                f"Use 'pip list' to see installed packages\\r\\n"
                f"Type 'exit' to close the terminal\\r\\n\\r\\n"
            )
            # Write initial message to PTY
            os.write(master_fd, initial_msg.encode('utf-8'))
        
        # Create tasks for bidirectional communication
        async def pty_to_ws():
            """Read from PTY and send to WebSocket"""
            loop = asyncio.get_running_loop()
            
            while session.running:
                try:
                    # Use select with timeout for non-blocking read
                    r, _, _ = await loop.run_in_executor(
                        None, select.select, [master_fd], [], [], 0.1
                    )
                    
                    if master_fd in r:
                        try:
                            data = os.read(master_fd, 65536)
                            if not data:
                                break
                            
                            # Send output to WebSocket
                            await ws.send_text(json.dumps({
                                "type": "stdout",
                                "data": data.decode('utf-8', errors='replace')
                            }))
                            
                            session.update_activity()
                            
                            # Check for package installation/uninstallation patterns
                            data_str = data.decode('utf-8', errors='ignore')
                            if any(pattern in data_str for pattern in [
                                "Successfully installed",
                                "Successfully uninstalled",
                                "Installing collected packages"
                            ]):
                                # Send notification to trigger LSP restart
                                await ws.send_text(json.dumps({
                                    "type": "package_changed",
                                    "project_id": project_id
                                }))
                                
                        except OSError:
                            break
                    
                    # Check for idle timeout or session expiration
                    if session.is_idle() or session.is_expired():
                        reason = "idle_timeout" if session.is_idle() else "session_expired"
                        log.info(f"Terminating session for {project_id}: {reason}")
                        os.kill(pid, signal.SIGTERM)
                        break
                        
                except Exception as e:
                    log.error(f"Error in pty_to_ws: {e}")
                    break
        
        async def ws_to_pty():
            """Read from WebSocket and write to PTY"""
            try:
                while session.running:
                    msg = await ws.receive_text()
                    obj = json.loads(msg)
                    msg_type = obj.get("type")
                    
                    if msg_type == "stdin":
                        data = obj.get("data", "")
                        
                        # In package mode, optionally restrict certain commands
                        if mode == "pkg" and any(forbidden in data for forbidden in []):
                            # Currently no restrictions, but could add some here
                            pass
                        
                        os.write(master_fd, data.encode('utf-8'))
                        session.update_activity()
                        
                    elif msg_type == "resize":
                        rows = int(obj.get("rows", 24))
                        cols = int(obj.get("cols", 80))
                        _set_winsize(master_fd, rows, cols)
                        
                    elif msg_type == "kill":
                        log.info(f"Kill requested for terminal session {project_id}")
                        os.kill(pid, signal.SIGTERM)
                        break
                        
                    elif msg_type == "heartbeat":
                        session.update_activity()
                        
            except WebSocketDisconnect:
                log.info(f"WebSocket disconnected for {project_id}")
            except Exception as e:
                log.error(f"Error in ws_to_pty: {e}")
        
        # Run both tasks concurrently
        p1 = asyncio.create_task(pty_to_ws())
        p2 = asyncio.create_task(ws_to_pty())
        
        # Wait for either task to complete
        done, pending = await asyncio.wait(
            {p1, p2}, 
            return_when=asyncio.FIRST_COMPLETED
        )
        
        # Cancel pending tasks
        for task in pending:
            task.cancel()
        
        # Stop the session
        session.running = False
        
        # Wait for process to exit and get status
        try:
            _, status = await asyncio.get_running_loop().run_in_executor(
                None, os.waitpid, pid, 0
            )
            exit_code = (status >> 8) & 0xFF
        except Exception:
            exit_code = None
        
        # Send exit message
        try:
            await ws.send_text(json.dumps({
                "type": "exit",
                "code": exit_code,
                "signal": None
            }))
        except Exception:
            pass
        
    except Exception as e:
        import traceback
        log.error(f"Terminal session error for {project_id}: {e}\n{traceback.format_exc()}")
        try:
            await ws.send_text(json.dumps({
                "type": "error",
                "message": str(e)
            }))
        except Exception:
            pass
    
    finally:
        # Clean up resources
        if session.master_fd is not None:
            try:
                os.close(session.master_fd)
            except Exception:
                pass
        
        # Ensure process is terminated
        if session.pid is not None:
            try:
                os.kill(session.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass  # Process already dead
            except Exception as e:
                log.error(f"Error killing process: {e}")
        
        # Close WebSocket
        try:
            await ws.close()
        except Exception:
            pass
        
        log.info(f"Terminal session closed for {project_id}")

@router.get("/terminal/ping")
async def terminal_ping():
    """Health check endpoint for terminal service"""
    return {"status": "ok", "service": "terminal"}