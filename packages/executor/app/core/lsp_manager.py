"""
Enhanced LSP Manager with auto-restart and exponential backoff
"""

from __future__ import annotations
import asyncio
import os
import time
import random
import signal
from dataclasses import dataclass, field
from typing import Dict, Optional, Literal, Tuple
from pathlib import Path
from .logging import get_logger, lsp_stdio_logger, log_lsp_lifecycle

LspType = Literal["pyright", "ruff"]

@dataclass
class LspProcess:
    """Manages a single LSP process with restart capability"""
    project_id: str
    lsp_type: LspType
    cwd: str
    proc: Optional[asyncio.subprocess.Process] = None
    started_at: float = 0.0
    restarts: int = 0
    last_started_ts: float = 0.0
    last_activity_ts: float = field(default_factory=lambda: time.time())
    is_starting: bool = False
    is_stopping: bool = False
    last_exit: Optional[int] = None
    restart_attempts_in_window: int = 0
    window_start_ts: float = field(default_factory=lambda: time.time())

class LspManager:
    """Enhanced LSP Manager with auto-restart and lifecycle management"""
    
    def __init__(self) -> None:
        self.log = get_logger(__name__)
        self._procs: Dict[Tuple[str, LspType], LspProcess] = {}
        self._lock = asyncio.Lock()
        
        # Configuration from environment
        self.LOG_LEVEL = os.getenv("LSP_LOG_LEVEL", "INFO")
        self.IDLE_TTL_MS = int(os.getenv("LSP_IDLE_TTL_MS", "600000"))  # 10 minutes
        self.MAX_RESTARTS = int(os.getenv("LSP_MAX_RESTARTS", "5"))
        self.RESTART_WINDOW_MS = int(os.getenv("LSP_RESTART_WINDOW_MS", "60000"))  # 1 minute
        
        self.log.info("LSP Manager initialized", extra={
            "idle_ttl_ms": self.IDLE_TTL_MS,
            "max_restarts": self.MAX_RESTARTS,
            "restart_window_ms": self.RESTART_WINDOW_MS
        })
    
    def _cmd_for(self, lsp_type: LspType) -> Tuple[str, ...]:
        """Get command for LSP type"""
        if lsp_type == "pyright":
            # When installed via npm globally in Docker, use pyright-langserver
            # When installed via pip in venv, use pyright --langserver --stdio
            import shutil
            if shutil.which("pyright-langserver"):
                return ("pyright-langserver", "--stdio")
            else:
                return ("pyright", "--langserver", "--stdio")
        elif lsp_type == "ruff":
            # Ruff server mode
            return ("ruff", "server")
        raise ValueError(f"Unknown LSP type: {lsp_type}")
    
    async def get_or_start(
        self, 
        project_id: str, 
        lsp_type: LspType, 
        cwd: Optional[str] = None
    ) -> LspProcess:
        """Get existing process or start a new one"""
        key = (project_id, lsp_type)
        
        # Use project directory if cwd not specified
        if not cwd:
            cwd = f"/app/projects/{project_id}"
        
        # Ensure project directory exists
        import os
        os.makedirs(cwd, exist_ok=True)
        
        async with self._lock:
            lp = self._procs.get(key)
            
            # Check if process exists and is alive
            if lp and lp.proc and lp.proc.returncode is None:
                lp.last_activity_ts = time.time()
                return lp
            
            # Create new process entry if needed
            if not lp:
                lp = LspProcess(
                    project_id=project_id,
                    lsp_type=lsp_type,
                    cwd=cwd
                )
                self._procs[key] = lp
            
            # Start or restart the process
            await self._start_process(lp)
            return lp
    
    async def _start_process(self, lp: LspProcess) -> None:
        """Start LSP process with exponential backoff on restart"""
        if lp.is_starting:
            return
        
        lp.is_starting = True
        try:
            # Check restart window
            now = time.time()
            if (now - lp.window_start_ts) * 1000 > self.RESTART_WINDOW_MS:
                # Reset window
                lp.restart_attempts_in_window = 0
                lp.window_start_ts = now
            
            # Apply exponential backoff if restarting
            if lp.restart_attempts_in_window > 0:
                if lp.restart_attempts_in_window > self.MAX_RESTARTS:
                    log_lsp_lifecycle(
                        "giveup",
                        lp.project_id,
                        lp.lsp_type,
                        restarts=lp.restart_attempts_in_window
                    )
                    raise RuntimeError(f"Max restarts ({self.MAX_RESTARTS}) exceeded")
                
                # Exponential backoff with jitter
                backoff = min(2 ** lp.restart_attempts_in_window, 30)  # Max 30 seconds
                jitter = random.random() * 0.5
                wait_time = backoff + jitter
                
                self.log.info(
                    "Waiting before restart",
                    extra={
                        "project_id": lp.project_id,
                        "lsp": lp.lsp_type,
                        "wait_seconds": wait_time,
                        "attempt": lp.restart_attempts_in_window
                    }
                )
                await asyncio.sleep(wait_time)
            
            # Get command - use project venv if available
            venv_path = Path(lp.cwd) / "venv"
            cmd = None
            
            if venv_path.exists():
                # Use pyright and ruff from project venv
                if os.name == 'nt':
                    bin_dir = venv_path / "Scripts"
                    pyright_exe = bin_dir / "pyright.exe"
                    ruff_exe = bin_dir / "ruff.exe"
                else:
                    bin_dir = venv_path / "bin"
                    pyright_exe = bin_dir / "pyright"
                    ruff_exe = bin_dir / "ruff"
                
                # Check if executable exists
                if lp.lsp_type == "pyright" and pyright_exe.exists():
                    # When installed via pip in venv, pyright provides pyright-langserver
                    pyright_langserver = bin_dir / ("pyright-langserver.exe" if os.name == 'nt' else "pyright-langserver")
                    if pyright_langserver.exists():
                        cmd = (str(pyright_langserver), "--stdio")
                    else:
                        # Fallback to pyright with --langserver --stdio
                        cmd = (str(pyright_exe), "--langserver", "--stdio")
                elif lp.lsp_type == "ruff" and ruff_exe.exists():
                    cmd = (str(ruff_exe), "server")
                else:
                    self.log.warning(f"LSP executable not found in venv for {lp.lsp_type}: {pyright_exe if lp.lsp_type == 'pyright' else ruff_exe}")
            
            # Fallback to system commands if venv doesn't have LSP
            if not cmd:
                cmd = self._cmd_for(lp.lsp_type)
                self.log.info(f"Using system command for {lp.lsp_type}: {cmd}")
                
                # Ensure pyrightconfig.json exists for pyright
                if lp.lsp_type == "pyright":
                    config_path = Path(lp.cwd) / "pyrightconfig.json"
                    if not config_path.exists():
                        self._generate_pyright_config(lp.cwd)
            
            # Build environment with venv activated
            env = os.environ.copy()
            if venv_path.exists():
                env["VIRTUAL_ENV"] = str(venv_path)
                if os.name == 'nt':
                    env["PATH"] = str(venv_path / "Scripts") + os.pathsep + env.get("PATH", "")
                else:
                    env["PATH"] = str(venv_path / "bin") + os.pathsep + env.get("PATH", "")
                env["PYTHONPATH"] = lp.cwd
            
            # Log startup
            log_lsp_lifecycle(
                "start",
                lp.project_id,
                lp.lsp_type,
                cmd=" ".join(cmd) if isinstance(cmd, tuple) else cmd,
                cwd=lp.cwd,
                attempt=lp.restart_attempts_in_window
            )
            
            # Start the process with the project venv environment
            # cmd can be tuple or string, handle both cases
            if isinstance(cmd, tuple):
                cmd_list = list(cmd)
            else:
                cmd_list = [cmd]
            
            # Ensure the working directory exists
            if not Path(lp.cwd).exists():
                self.log.warning(f"Creating missing project directory: {lp.cwd}")
                Path(lp.cwd).mkdir(parents=True, exist_ok=True)
            
            try:
                self.log.info(
                    f"Starting LSP process",
                    extra={
                        "project_id": lp.project_id,
                        "lsp": lp.lsp_type,
                        "command": cmd_list,
                        "cwd": lp.cwd
                    }
                )
                
                lp.proc = await asyncio.create_subprocess_exec(
                    *cmd_list,
                    cwd=lp.cwd,
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    env=env
                )
                
                # Give the process a moment to start
                await asyncio.sleep(0.1)
                
                # Check if process started successfully
                if lp.proc.returncode is not None:
                    # Process already exited
                    stderr_output = await lp.proc.stderr.read()
                    self.log.error(
                        f"LSP process exited immediately",
                        extra={
                            "project_id": lp.project_id,
                            "lsp": lp.lsp_type,
                            "returncode": lp.proc.returncode,
                            "stderr": stderr_output.decode(errors='replace')[:500]
                        }
                    )
                    raise RuntimeError(f"LSP {lp.lsp_type} exited immediately with code {lp.proc.returncode}")
                    
            except FileNotFoundError as e:
                self.log.error(
                    f"LSP executable not found",
                    extra={
                        "project_id": lp.project_id,
                        "lsp": lp.lsp_type,
                        "command": cmd_list[0] if cmd_list else "unknown",
                        "error": str(e)
                    }
                )
                raise RuntimeError(f"LSP executable not found for {lp.lsp_type}: {cmd_list[0] if cmd_list else 'unknown'}")
            except Exception as e:
                self.log.error(
                    f"Failed to start LSP process",
                    extra={
                        "project_id": lp.project_id,
                        "lsp": lp.lsp_type,
                        "command": cmd_list,
                        "error": str(e)
                    }
                )
                raise
            
            lp.started_at = time.time()
            lp.last_started_ts = lp.started_at
            lp.last_activity_ts = lp.started_at
            lp.restarts += 1
            lp.restart_attempts_in_window += 1
            
            # Start background tasks for stdout/stderr draining and process monitoring
            asyncio.create_task(self._drain_stream(lp, lp.proc.stdout, "stdout"))
            asyncio.create_task(self._drain_stream(lp, lp.proc.stderr, "stderr"))
            asyncio.create_task(self._wait_process(lp))
            
        except Exception as e:
            log_lsp_lifecycle(
                "error",
                lp.project_id,
                lp.lsp_type,
                error=str(e)
            )
            raise
        finally:
            lp.is_starting = False
    
    def _generate_pyright_config(self, cwd: str) -> None:
        """Generate pyrightconfig.json for project virtual environment"""
        import json
        venv_path = Path(cwd) / "venv"
        config_path = Path(cwd) / "pyrightconfig.json"
        
        config = {
            "venvPath": str(Path(cwd).absolute()),
            "venv": "venv",
            "pythonVersion": "3.11",
            "include": ["."],
            "exclude": ["venv", "__pycache__", ".git"],
            "reportMissingImports": "warning",
            "reportMissingTypeStubs": "information",
            "reportGeneralTypeIssues": "warning",
            "pythonPlatform": "Linux",
            "typeCheckingMode": "basic"
        }
        
        try:
            with open(config_path, 'w') as f:
                json.dump(config, f, indent=2)
            self.log.info(f"Generated pyrightconfig.json at {config_path}")
        except Exception as e:
            self.log.error(f"Failed to generate pyrightconfig.json: {e}")
    
    async def _drain_stream(
        self, 
        lp: LspProcess, 
        stream: asyncio.StreamReader, 
        name: str
    ) -> None:
        """Drain stdout/stderr and log output"""
        try:
            while lp.proc and lp.proc.returncode is None:
                line = await stream.readline()
                if not line:
                    break
                
                # Decode and log
                txt = line.decode(errors="replace").rstrip("\n")
                if txt:  # Only log non-empty lines
                    lsp_stdio_logger(lp.project_id, lp.lsp_type, name, txt)
                    lp.last_activity_ts = time.time()
        except Exception as e:
            self.log.error(
                f"Error draining {name}",
                extra={
                    "project_id": lp.project_id,
                    "lsp": lp.lsp_type,
                    "error": str(e)
                }
            )
    
    async def _wait_process(self, lp: LspProcess) -> None:
        """Wait for process exit and handle restart"""
        try:
            rc = await lp.proc.wait()
            lp.last_exit = rc
            
            log_lsp_lifecycle(
                "exit",
                lp.project_id,
                lp.lsp_type,
                returncode=rc,
                restarts=lp.restarts
            )
            
            # Auto-restart if not explicitly stopping and within limits
            if not lp.is_stopping and lp.restart_attempts_in_window < self.MAX_RESTARTS:
                self.log.info(
                    "Auto-restarting LSP",
                    extra={
                        "project_id": lp.project_id,
                        "lsp": lp.lsp_type,
                        "exit_code": rc
                    }
                )
                await self._start_process(lp)
            elif lp.restart_attempts_in_window >= self.MAX_RESTARTS:
                log_lsp_lifecycle(
                    "crash",
                    lp.project_id,
                    lp.lsp_type,
                    reason="max_restarts_exceeded"
                )
        except Exception as e:
            self.log.error(
                "Error waiting for process",
                extra={
                    "project_id": lp.project_id,
                    "lsp": lp.lsp_type,
                    "error": str(e)
                }
            )
    
    async def send_raw(
        self, 
        project_id: str, 
        lsp_type: LspType, 
        data: bytes
    ) -> None:
        """Send raw data to LSP stdin"""
        key = (project_id, lsp_type)
        lp = self._procs.get(key)
        
        if not lp or not lp.proc or not lp.proc.stdin or lp.proc.returncode is not None:
            raise RuntimeError(f"LSP {lsp_type} not running for project {project_id}")
        
        lp.proc.stdin.write(data)
        await lp.proc.stdin.drain()
        lp.last_activity_ts = time.time()
    
    async def read_raw(
        self, 
        project_id: str, 
        lsp_type: LspType, 
        size: int = 4096
    ) -> bytes:
        """Read raw data from LSP stdout"""
        key = (project_id, lsp_type)
        lp = self._procs.get(key)
        
        if not lp or not lp.proc or not lp.proc.stdout:
            raise RuntimeError(f"LSP {lsp_type} not running for project {project_id}")
        
        data = await lp.proc.stdout.read(size)
        lp.last_activity_ts = time.time()
        return data
    
    async def idle_collect(self) -> None:
        """Background task to clean up idle processes"""
        while True:
            try:
                await asyncio.sleep(30)  # Check every 30 seconds
                now = time.time()
                ttl = self.IDLE_TTL_MS / 1000.0
                
                kill_list = []
                for key, lp in list(self._procs.items()):
                    if lp.proc and lp.proc.returncode is None:
                        if now - lp.last_activity_ts > ttl:
                            kill_list.append((key, lp))
                
                for key, lp in kill_list:
                    await self.stop(lp.project_id, lp.lsp_type, reason="idle")
                    
            except Exception as e:
                self.log.error(f"Error in idle collection: {e}")
    
    async def stop(
        self, 
        project_id: str, 
        lsp_type: LspType, 
        reason: str = "manual"
    ) -> None:
        """Stop a specific LSP process"""
        key = (project_id, lsp_type)
        lp = self._procs.get(key)
        
        if not lp or not lp.proc or lp.proc.returncode is not None:
            return
        
        lp.is_stopping = True
        
        log_lsp_lifecycle(
            "stop",
            project_id,
            lsp_type,
            reason=reason
        )
        
        try:
            # Try graceful termination first
            lp.proc.send_signal(signal.SIGTERM)
            try:
                await asyncio.wait_for(lp.proc.wait(), timeout=3)
            except asyncio.TimeoutError:
                # Force kill if not responding
                lp.proc.kill()
                await lp.proc.wait()
        except Exception as e:
            self.log.error(
                "Error stopping process",
                extra={
                    "project_id": project_id,
                    "lsp": lsp_type,
                    "error": str(e)
                }
            )
        finally:
            lp.is_stopping = False
            # Remove from process map
            if key in self._procs:
                del self._procs[key]
    
    def health(self, project_id: str, lsp_type: LspType) -> dict:
        """Get health status of LSP process"""
        key = (project_id, lsp_type)
        lp = self._procs.get(key)
        
        if not lp:
            return {
                "running": False,
                "reason": "not_created"
            }
        
        running = lp.proc is not None and lp.proc.returncode is None
        
        return {
            "running": running,
            "pid": lp.proc.pid if lp.proc else None,
            "restarts": lp.restarts,
            "restart_attempts": lp.restart_attempts_in_window,
            "last_exit": lp.last_exit,
            "last_activity_ts": lp.last_activity_ts,
            "started_at": lp.started_at,
            "uptime_seconds": time.time() - lp.started_at if running else 0
        }
    
    async def restart(self, project_id: str, lsp_type: LspType) -> bool:
        """Manually restart an LSP process"""
        await self.stop(project_id, lsp_type, reason="manual_restart")
        
        # Reset restart counter for manual restart
        key = (project_id, lsp_type)
        if key in self._procs:
            self._procs[key].restart_attempts_in_window = 0
        
        lp = await self.get_or_start(project_id, lsp_type)
        return lp.proc is not None and lp.proc.returncode is None

# Global singleton instance
lsp_manager = LspManager()