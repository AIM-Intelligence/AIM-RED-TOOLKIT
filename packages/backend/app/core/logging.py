"""
Structured logging for LSP and application
"""

import logging
import os
import json
import time
import pathlib
from collections import deque
from typing import Literal, Optional, Dict, Any
from datetime import datetime

LOG_LEVEL = os.getenv("LSP_LOG_LEVEL", "INFO").upper()
STDIO_DIR = pathlib.Path(os.getenv("LSP_STDIO_LOG_DIR", "/var/log/aim-red/lsp"))
STDIO_DIR.mkdir(parents=True, exist_ok=True)

# Recent events memory buffer for debug endpoint
_RING = deque(maxlen=2000)

def get_logger(name: str) -> logging.Logger:
    """Get a structured JSON logger"""
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(_JsonFormatter())
        logger.addHandler(handler)
        logger.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))
    return logger

class _JsonFormatter(logging.Formatter):
    """JSON formatter for structured logging"""
    
    def format(self, record: logging.LogRecord) -> str:
        base = {
            "ts": int(time.time() * 1000),
            "level": record.levelname,
            "msg": record.getMessage(),
            "logger": record.name,
        }
        
        # Add extra fields if provided
        if hasattr(record, 'extra') and isinstance(record.extra, dict):
            base.update(record.extra)
        
        return json.dumps(base, ensure_ascii=False)

def lsp_stdio_logger(
    project_id: str, 
    lsp_type: str, 
    stream: str, 
    line: str
) -> None:
    """Log LSP stdio output to file and structured log"""
    # Write to file for persistence
    filename = STDIO_DIR / f"{project_id}.{lsp_type}.{stream}.log"
    try:
        with filename.open("a", encoding="utf-8") as f:
            timestamp = datetime.now().isoformat()
            f.write(f"[{timestamp}] {line}\n")
    except Exception as e:
        get_logger("lsp.stdio").error(f"Failed to write stdio log: {e}")
    
    # Sample structured log (avoid flooding)
    if LOG_LEVEL in ["DEBUG", "TRACE"]:
        get_logger("lsp.stdio").debug(
            "stdio",
            extra={
                "project_id": project_id,
                "lsp": lsp_type,
                "stream": stream,
                "preview": line[:200] if len(line) > 200 else line
            }
        )

def log_lsp_frame(
    direction: Literal["in", "out"],
    lsp_type: str,
    project_id: str,
    payload: bytes
) -> None:
    """Log LSP JSON-RPC frames for debugging"""
    try:
        # Parse JSON-RPC payload
        obj = json.loads(payload.decode("utf-8"))
        method = obj.get("method")
        msg_id = obj.get("id")
        size = len(payload)
        
        # Create log record
        record = {
            "direction": direction,
            "method": method,
            "id": msg_id,
            "bytes": size,
            "project_id": project_id,
            "lsp": lsp_type,
            "ts": int(time.time() * 1000)
        }
        
        # Add to ring buffer
        _RING.append(record)
        
        # Log metadata only by default
        logger = get_logger("lsp.frame")
        logger.debug("frame", extra=record)
        
        # Log full payload only in TRACE mode
        if LOG_LEVEL == "TRACE":
            logger.debug("payload", extra={**record, "payload": obj})
            
    except json.JSONDecodeError:
        # Not JSON, might be binary or malformed
        pass
    except Exception as e:
        get_logger("lsp.frame").error(f"Error logging LSP frame: {e}")

def log_lsp_lifecycle(
    event: str,
    project_id: str,
    lsp_type: str,
    **kwargs
) -> None:
    """Log LSP lifecycle events"""
    logger = get_logger("lsp.lifecycle")
    extra = {
        "event": event,
        "project_id": project_id,
        "lsp": lsp_type,
        **kwargs
    }
    
    if event in ["start", "stop", "restart"]:
        logger.info(event, extra=extra)
    elif event in ["error", "crash"]:
        logger.error(event, extra=extra)
    else:
        logger.debug(event, extra=extra)

def read_ring(n: int = 200) -> list:
    """Read recent events from ring buffer"""
    return list(_RING)[-n:]

def get_stdio_logs(
    project_id: str,
    lsp_type: str,
    stream: str = "stdout",
    lines: int = 100
) -> list[str]:
    """Read recent stdio logs for a specific LSP process"""
    filename = STDIO_DIR / f"{project_id}.{lsp_type}.{stream}.log"
    if not filename.exists():
        return []
    
    try:
        with filename.open("r", encoding="utf-8") as f:
            all_lines = f.readlines()
            return all_lines[-lines:]
    except Exception as e:
        get_logger("lsp.stdio").error(f"Failed to read stdio log: {e}")
        return []