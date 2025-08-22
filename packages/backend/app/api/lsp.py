"""
Enhanced LSP WebSocket Bridge with proper error handling
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
import asyncio
import re
from typing import Optional
from ..core.lsp_manager import lsp_manager, LspType
from ..core.logging import get_logger, log_lsp_frame

router = APIRouter()
logger = get_logger(__name__)

# Regex for parsing LSP Content-Length headers
HEADER_RE = re.compile(rb"Content-Length:\s*(\d+)\r\n\r\n", re.I)

class WebSocketCloseCodes:
    """Custom WebSocket close codes for LSP status"""
    NORMAL = 1000
    LSP_RESTART = 4001  # LSP process restarting
    LSP_ERROR = 4002    # LSP process error
    LSP_CRASHED = 4003  # LSP process crashed

@router.websocket("/python")
async def websocket_pyright_lsp(
    websocket: WebSocket,
    project_id: str = Query(..., description="Project ID")
):
    """WebSocket endpoint for Pyright LSP with enhanced error handling"""
    await _handle_lsp_websocket(websocket, project_id, "pyright")

@router.websocket("/ruff")
async def websocket_ruff_lsp(
    websocket: WebSocket,
    project_id: str = Query(..., description="Project ID")
):
    """WebSocket endpoint for Ruff LSP with enhanced error handling"""
    await _handle_lsp_websocket(websocket, project_id, "ruff")

async def _handle_lsp_websocket(
    websocket: WebSocket,
    project_id: str,
    lsp_type: LspType
):
    """Common handler for LSP WebSocket connections"""
    await websocket.accept()
    logger.info(f"{lsp_type} LSP WebSocket connected", extra={
        "project_id": project_id,
        "lsp": lsp_type
    })
    
    cwd = f"/app/projects/{project_id}"
    
    try:
        # Get or start LSP process
        lp = await lsp_manager.get_or_start(project_id, lsp_type, cwd)
        
        if not lp or not lp.proc:
            await websocket.send_json({
                "jsonrpc": "2.0",
                "error": {
                    "code": -32603,
                    "message": f"Failed to start {lsp_type} LSP"
                }
            })
            await websocket.close(code=WebSocketCloseCodes.LSP_ERROR)
            return
        
        # Create tasks for bidirectional communication
        server_to_client_task = asyncio.create_task(
            _pump_server_to_client(websocket, lp, project_id, lsp_type)
        )
        client_to_server_task = asyncio.create_task(
            _pump_client_to_server(websocket, project_id, lsp_type)
        )
        
        # Wait for either task to complete
        done, pending = await asyncio.wait(
            [server_to_client_task, client_to_server_task],
            return_when=asyncio.FIRST_COMPLETED
        )
        
        # Cancel remaining task
        for task in pending:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
                
    except Exception as e:
        logger.error(f"Error in {lsp_type} WebSocket handler", extra={
            "project_id": project_id,
            "lsp": lsp_type,
            "error": str(e)
        })
        try:
            await websocket.close(code=WebSocketCloseCodes.LSP_ERROR)
        except:
            pass
    finally:
        logger.info(f"{lsp_type} LSP WebSocket disconnected", extra={
            "project_id": project_id,
            "lsp": lsp_type
        })

async def _pump_server_to_client(
    websocket: WebSocket,
    lp,
    project_id: str,
    lsp_type: LspType
):
    """Pump data from LSP server to WebSocket client"""
    buffer = b""
    
    try:
        while True:
            # Check if process is still alive
            if not lp.proc or lp.proc.returncode is not None:
                logger.warning(f"{lsp_type} LSP process died", extra={
                    "project_id": project_id,
                    "exit_code": lp.proc.returncode if lp.proc else None
                })
                # Signal client to reconnect
                await websocket.close(code=WebSocketCloseCodes.LSP_RESTART, reason=f"{lsp_type} restarting")
                break
            
            # Read from LSP stdout
            try:
                chunk = await asyncio.wait_for(
                    lp.proc.stdout.read(4096),
                    timeout=0.1
                )
            except asyncio.TimeoutError:
                continue
            
            if not chunk:
                # EOF from LSP
                logger.warning(f"{lsp_type} LSP EOF", extra={"project_id": project_id})
                await websocket.close(code=WebSocketCloseCodes.LSP_CRASHED, reason=f"{lsp_type} crashed")
                break
            
            buffer += chunk
            
            # Parse LSP frames from buffer
            while True:
                match = HEADER_RE.search(buffer)
                if not match:
                    break
                
                content_length = int(match.group(1))
                header_end = match.end()
                
                # Check if we have the complete message
                if len(buffer) - header_end < content_length:
                    break
                
                # Extract complete frame
                body = buffer[header_end:header_end + content_length]
                frame = buffer[:header_end + content_length]
                buffer = buffer[header_end + content_length:]
                
                # Log frame for debugging
                log_lsp_frame("out", lsp_type, project_id, body)
                
                # Send to client (without Content-Length header for WebSocket)
                try:
                    await websocket.send_bytes(body)
                except Exception as e:
                    logger.error(f"Error sending to WebSocket", extra={
                        "project_id": project_id,
                        "lsp": lsp_type,
                        "error": str(e)
                    })
                    return
                    
    except WebSocketDisconnect:
        logger.info(f"Client disconnected", extra={
            "project_id": project_id,
            "lsp": lsp_type
        })
    except Exception as e:
        logger.error(f"Error in server-to-client pump", extra={
            "project_id": project_id,
            "lsp": lsp_type,
            "error": str(e)
        })
        try:
            await websocket.close(code=WebSocketCloseCodes.LSP_ERROR)
        except:
            pass

async def _pump_client_to_server(
    websocket: WebSocket,
    project_id: str,
    lsp_type: LspType
):
    """Pump data from WebSocket client to LSP server"""
    try:
        while True:
            # Receive from WebSocket
            try:
                data = await websocket.receive_bytes()
            except WebSocketDisconnect:
                logger.info(f"Client disconnected", extra={
                    "project_id": project_id,
                    "lsp": lsp_type
                })
                break
            
            # Log frame for debugging
            log_lsp_frame("in", lsp_type, project_id, data)
            
            # Add Content-Length header for LSP protocol
            header = f"Content-Length: {len(data)}\r\n\r\n".encode("utf-8")
            frame = header + data
            
            # Send to LSP process
            try:
                await lsp_manager.send_raw(project_id, lsp_type, frame)
            except RuntimeError as e:
                logger.error(f"LSP not running", extra={
                    "project_id": project_id,
                    "lsp": lsp_type,
                    "error": str(e)
                })
                await websocket.close(code=WebSocketCloseCodes.LSP_RESTART, reason=f"{lsp_type} not running")
                break
            except Exception as e:
                logger.error(f"Error sending to LSP", extra={
                    "project_id": project_id,
                    "lsp": lsp_type,
                    "error": str(e)
                })
                break
                
    except Exception as e:
        logger.error(f"Error in client-to-server pump", extra={
            "project_id": project_id,
            "lsp": lsp_type,
            "error": str(e)
        })

@router.post("/restart/{lsp_type}")
async def restart_lsp(
    lsp_type: LspType,
    project_id: str = Query(..., description="Project ID")
):
    """Manually restart an LSP process"""
    try:
        success = await lsp_manager.restart(project_id, lsp_type)
        return {
            "success": success,
            "message": f"{'Successfully restarted' if success else 'Failed to restart'} {lsp_type} LSP"
        }
    except Exception as e:
        logger.error(f"Error restarting LSP", extra={
            "project_id": project_id,
            "lsp": lsp_type,
            "error": str(e)
        })
        return {
            "success": False,
            "error": str(e)
        }