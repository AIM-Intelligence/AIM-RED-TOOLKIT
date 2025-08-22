"""
LSP Debug and Health API endpoints
"""

from fastapi import APIRouter, Query, HTTPException
from typing import Optional, List
from ..core.lsp_manager import lsp_manager, LspType
from ..core.logging import read_ring, get_stdio_logs, get_logger

router = APIRouter()
logger = get_logger(__name__)

@router.get("/health")
async def lsp_health(
    project_id: str = Query(..., description="Project ID"),
    lsp_type: Optional[LspType] = Query(None, description="LSP type (pyright or ruff)")
):
    """Get health status of LSP processes for a project"""
    try:
        if lsp_type:
            # Get health for specific LSP
            health = lsp_manager.health(project_id, lsp_type)
            return {
                "project_id": project_id,
                "lsp_type": lsp_type,
                **health
            }
        else:
            # Get health for all LSP types
            return {
                "project_id": project_id,
                "pyright": lsp_manager.health(project_id, "pyright"),
                "ruff": lsp_manager.health(project_id, "ruff")
            }
    except Exception as e:
        logger.error(f"Error getting LSP health", extra={
            "project_id": project_id,
            "lsp_type": lsp_type,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/restart/{lsp_type}")
async def restart_lsp_debug(
    lsp_type: LspType,
    project_id: str = Query(..., description="Project ID")
):
    """Manually restart an LSP process with detailed response"""
    try:
        # Get current health before restart
        before_health = lsp_manager.health(project_id, lsp_type)
        
        # Perform restart
        success = await lsp_manager.restart(project_id, lsp_type)
        
        # Get health after restart
        after_health = lsp_manager.health(project_id, lsp_type)
        
        return {
            "success": success,
            "project_id": project_id,
            "lsp_type": lsp_type,
            "before": before_health,
            "after": after_health,
            "message": f"{'Successfully restarted' if success else 'Failed to restart'} {lsp_type} LSP"
        }
    except Exception as e:
        logger.error(f"Error restarting LSP", extra={
            "project_id": project_id,
            "lsp_type": lsp_type,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/logs")
async def lsp_logs(
    n: int = Query(200, description="Number of recent events to return", ge=1, le=2000)
):
    """Get recent LSP events from ring buffer"""
    try:
        events = read_ring(n)
        return {
            "count": len(events),
            "events": events
        }
    except Exception as e:
        logger.error(f"Error reading LSP logs", extra={"error": str(e)})
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stdio")
async def lsp_stdio_logs(
    project_id: str = Query(..., description="Project ID"),
    lsp_type: LspType = Query(..., description="LSP type"),
    stream: str = Query("stdout", description="Stream type (stdout or stderr)"),
    lines: int = Query(100, description="Number of lines to return", ge=1, le=1000)
):
    """Get recent stdio logs for a specific LSP process"""
    try:
        if stream not in ["stdout", "stderr"]:
            raise ValueError("Stream must be 'stdout' or 'stderr'")
        
        log_lines = get_stdio_logs(project_id, lsp_type, stream, lines)
        
        return {
            "project_id": project_id,
            "lsp_type": lsp_type,
            "stream": stream,
            "lines": log_lines,
            "count": len(log_lines)
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error reading stdio logs", extra={
            "project_id": project_id,
            "lsp_type": lsp_type,
            "stream": stream,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status")
async def lsp_global_status():
    """Get global LSP manager status"""
    try:
        # Get all active processes
        active_processes = []
        
        # Check common project IDs (this would ideally come from projects registry)
        from pathlib import Path
        projects_dir = Path("/app/projects")
        
        if projects_dir.exists():
            for project_dir in projects_dir.iterdir():
                if project_dir.is_dir():
                    project_id = project_dir.name
                    for lsp_type in ["pyright", "ruff"]:
                        health = lsp_manager.health(project_id, lsp_type)
                        if health.get("running"):
                            active_processes.append({
                                "project_id": project_id,
                                "lsp_type": lsp_type,
                                **health
                            })
        
        return {
            "active_processes": active_processes,
            "count": len(active_processes),
            "config": {
                "idle_ttl_ms": lsp_manager.IDLE_TTL_MS,
                "max_restarts": lsp_manager.MAX_RESTARTS,
                "restart_window_ms": lsp_manager.RESTART_WINDOW_MS,
                "log_level": lsp_manager.LOG_LEVEL
            }
        }
    except Exception as e:
        logger.error(f"Error getting global LSP status", extra={"error": str(e)})
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/stop/{lsp_type}")
async def stop_lsp(
    lsp_type: LspType,
    project_id: str = Query(..., description="Project ID")
):
    """Manually stop an LSP process"""
    try:
        await lsp_manager.stop(project_id, lsp_type, reason="manual_stop_api")
        
        return {
            "success": True,
            "project_id": project_id,
            "lsp_type": lsp_type,
            "message": f"Successfully stopped {lsp_type} LSP"
        }
    except Exception as e:
        logger.error(f"Error stopping LSP", extra={
            "project_id": project_id,
            "lsp_type": lsp_type,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=str(e))