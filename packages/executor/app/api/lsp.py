"""
Enhanced LSP Gateway with single reader per process
Prevents asyncio read conflicts by having one reader per LSP process
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
import asyncio
import re
from typing import Optional, Dict, Set
from dataclasses import dataclass
from ..core.lsp_manager import lsp_manager, LspType, LspProcess
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

@dataclass
class LspConnection:
    """Manages LSP process connection with multiple WebSocket clients"""
    project_id: str
    lsp_type: LspType
    process: LspProcess
    clients: Set[WebSocket]
    reader_task: Optional[asyncio.Task] = None
    writer_lock: asyncio.Lock = None
    
    def __post_init__(self):
        self.clients = set()
        self.writer_lock = asyncio.Lock()

class LspGateway:
    """Manages LSP connections with single reader per process"""
    
    def __init__(self):
        self.connections: Dict[tuple[str, LspType], LspConnection] = {}
        self._lock = asyncio.Lock()
    
    async def add_client(
        self, 
        websocket: WebSocket, 
        project_id: str, 
        lsp_type: LspType
    ) -> LspConnection:
        """Add a WebSocket client to an LSP connection"""
        key = (project_id, lsp_type)
        
        async with self._lock:
            if key not in self.connections:
                # Start new LSP process
                cwd = f"/app/projects/{project_id}"
                process = await lsp_manager.get_or_start(project_id, lsp_type, cwd)
                
                if not process or not process.proc:
                    raise RuntimeError(f"Failed to start {lsp_type} LSP")
                
                # Create new connection
                connection = LspConnection(
                    project_id=project_id,
                    lsp_type=lsp_type,
                    process=process,
                    clients=set()
                )
                
                self.connections[key] = connection
                
                # Start single reader task for this process AFTER adding to connections
                # to prevent race conditions
                if not connection.reader_task or connection.reader_task.done():
                    connection.reader_task = asyncio.create_task(
                        self._read_from_lsp(connection)
                    )
            else:
                connection = self.connections[key]
                
                # Check if the process is still alive
                if not connection.process.proc or connection.process.proc.returncode is not None:
                    # Process died, restart it
                    logger.warning(f"LSP process {lsp_type} for {project_id} is dead, restarting")
                    
                    # Cancel old reader task if exists
                    if connection.reader_task:
                        connection.reader_task.cancel()
                        try:
                            await connection.reader_task
                        except asyncio.CancelledError:
                            pass
                    
                    # Get new process
                    cwd = f"/app/projects/{project_id}"
                    process = await lsp_manager.get_or_start(project_id, lsp_type, cwd)
                    
                    if not process or not process.proc:
                        raise RuntimeError(f"Failed to restart {lsp_type} LSP")
                    
                    connection.process = process
                    
                    # Start new reader task only if not already running
                    if not connection.reader_task or connection.reader_task.done():
                        connection.reader_task = asyncio.create_task(
                            self._read_from_lsp(connection)
                        )
            
            # Add the client to the connection
            connection.clients.add(websocket)
            return connection
    
    async def remove_client(
        self, 
        websocket: WebSocket, 
        project_id: str, 
        lsp_type: LspType
    ):
        """Remove a WebSocket client from an LSP connection"""
        key = (project_id, lsp_type)
        
        async with self._lock:
            if key in self.connections:
                connection = self.connections[key]
                connection.clients.discard(websocket)
                
                # If no more clients, stop the reader task
                if not connection.clients:
                    if connection.reader_task:
                        connection.reader_task.cancel()
                        try:
                            await connection.reader_task
                        except asyncio.CancelledError:
                            pass
                    del self.connections[key]
    
    async def write_to_lsp(
        self, 
        connection: LspConnection, 
        data: bytes
    ):
        """Write data to LSP process (thread-safe)"""
        async with connection.writer_lock:
            if connection.process.proc and connection.process.proc.stdin:
                # The data from client should already have Content-Length header
                # from vscode-ws-jsonrpc, so just pass it through
                try:
                    connection.process.proc.stdin.write(data)
                    await connection.process.proc.stdin.drain()
                except Exception as e:
                    self.log.error(f"Failed to write to LSP stdin: {e}")
    
    async def _read_from_lsp(self, connection: LspConnection):
        """Single reader task for LSP process stdout"""
        buffer = b""
        
        try:
            # Wait a bit for process to be fully initialized
            await asyncio.sleep(0.1)
            
            while True:
                # Check if process is still alive
                if not connection.process.proc:
                    logger.warning(f"{connection.lsp_type} LSP process not initialized", extra={
                        "project_id": connection.project_id
                    })
                    await self._broadcast_close(
                        connection, 
                        WebSocketCloseCodes.LSP_ERROR, 
                        f"{connection.lsp_type} process not initialized"
                    )
                    break
                    
                if connection.process.proc.returncode is not None:
                    logger.warning(f"{connection.lsp_type} LSP process died", extra={
                        "project_id": connection.project_id,
                        "exit_code": connection.process.proc.returncode
                    })
                    await self._broadcast_close(
                        connection, 
                        WebSocketCloseCodes.LSP_RESTART, 
                        f"{connection.lsp_type} restarting"
                    )
                    break
                
                # Check if stdout is available
                if not connection.process.proc.stdout:
                    logger.error(f"{connection.lsp_type} LSP process has no stdout", extra={
                        "project_id": connection.project_id
                    })
                    await self._broadcast_close(
                        connection,
                        WebSocketCloseCodes.LSP_ERROR,
                        f"{connection.lsp_type} no stdout"
                    )
                    break
                
                # Read from LSP stdout (single reader)
                try:
                    chunk = await asyncio.wait_for(
                        connection.process.proc.stdout.read(4096),
                        timeout=0.1
                    )
                except asyncio.TimeoutError:
                    continue
                
                if not chunk:
                    # EOF from LSP
                    if connection.process.proc.returncode is not None:
                        logger.warning(f"{connection.lsp_type} LSP EOF", extra={
                            "project_id": connection.project_id
                        })
                        await self._broadcast_close(
                            connection,
                            WebSocketCloseCodes.LSP_CRASHED,
                            f"{connection.lsp_type} crashed"
                        )
                        break
                    else:
                        await asyncio.sleep(0.01)
                        continue
                
                buffer += chunk
                
                # Parse and broadcast LSP frames
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
                    buffer = buffer[header_end + content_length:]
                    
                    # Log frame
                    try:
                        log_lsp_frame(
                            "s2c",
                            connection.project_id,
                            connection.lsp_type,
                            body.decode('utf-8', errors='replace')
                        )
                    except Exception as e:
                        self.log.debug(f"Failed to log frame: {e}")
                    
                    # Send complete LSP message with Content-Length header to clients
                    # This is what vscode-ws-jsonrpc expects
                    full_message = f"Content-Length: {content_length}\r\n\r\n".encode('utf-8') + body
                    await self._broadcast_data(connection, full_message)
                    
        except Exception as e:
            import traceback
            logger.error(f"Reader error for {connection.lsp_type}: {str(e)}", extra={
                "project_id": connection.project_id,
                "error": str(e),
                "traceback": traceback.format_exc()
            })
            await self._broadcast_close(
                connection,
                WebSocketCloseCodes.LSP_ERROR,
                f"Reader error: {str(e)}"
            )
    
    async def _broadcast_data(self, connection: LspConnection, data: bytes):
        """Broadcast data to all connected clients"""
        disconnected_clients = set()
        
        for client in connection.clients:
            try:
                await client.send_bytes(data)
                # Update activity timestamp
                connection.process.last_activity_ts = asyncio.get_event_loop().time()
            except Exception as e:
                logger.debug(f"Failed to send to client: {e}")
                disconnected_clients.add(client)
        
        # Remove disconnected clients
        connection.clients -= disconnected_clients
    
    async def _broadcast_close(self, connection: LspConnection, code: int, reason: str):
        """Close all connected clients"""
        for client in connection.clients:
            try:
                await client.close(code=code, reason=reason)
            except:
                pass

# Global gateway instance
lsp_gateway = LspGateway()

@router.get("/health")
async def lsp_health(
    project_id: str = Query(..., description="Project ID"),
    lsp_type: str = Query("pyright", description="LSP type (pyright or ruff)")
):
    """Check LSP health for a project"""
    from ..core.lsp_manager import lsp_manager
    try:
        health_status = lsp_manager.health(project_id, lsp_type)
        return {
            "success": True,
            "project_id": project_id,
            "lsp_type": lsp_type,
            **health_status
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "project_id": project_id,
            "lsp_type": lsp_type
        }

@router.websocket("/pyright")
async def websocket_pyright_lsp(
    websocket: WebSocket,
    project_id: str = Query(..., description="Project ID")
):
    """WebSocket endpoint for Pyright LSP"""
    await _handle_lsp_websocket(websocket, project_id, "pyright")

@router.websocket("/ruff")
async def websocket_ruff_lsp(
    websocket: WebSocket,
    project_id: str = Query(..., description="Project ID")
):
    """WebSocket endpoint for Ruff LSP"""
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
    
    connection = None
    
    try:
        # Check if venv exists first
        from ..core.venv_manager import AsyncVenvManager
        venv_manager = AsyncVenvManager("/app/projects")
        
        if not venv_manager.venv_exists(project_id):
            logger.warning(f"Virtual environment not ready for project {project_id}")
            await websocket.send_json({
                "jsonrpc": "2.0",
                "error": {
                    "code": -32603,
                    "message": f"Virtual environment not ready for project {project_id}. Please wait for venv creation to complete."
                }
            })
            await websocket.close(code=WebSocketCloseCodes.LSP_ERROR)
            return
        
        # Add client to LSP connection
        connection = await lsp_gateway.add_client(websocket, project_id, lsp_type)
        
        # Handle client to server messages
        while True:
            try:
                data = await websocket.receive_bytes()
                
                # Log frame (data from client should have Content-Length header)
                try:
                    # Try to extract JSON-RPC body for logging
                    if data.startswith(b"Content-Length:"):
                        header_match = HEADER_RE.match(data)
                        if header_match:
                            header_end = header_match.end()
                            body = data[header_end:]
                            log_lsp_frame(
                                "c2s",
                                project_id,
                                lsp_type,
                                body.decode('utf-8', errors='replace')
                            )
                    else:
                        # Log raw data if no header
                        log_lsp_frame(
                            "c2s",
                            project_id,
                            lsp_type,
                            data.decode('utf-8', errors='replace')
                        )
                except Exception as e:
                    logger.debug(f"Failed to log frame: {e}")
                
                # Write to LSP process
                await lsp_gateway.write_to_lsp(connection, data)
                
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"Error handling client message: {e}")
                break
                
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
        # Remove client from connection
        if connection:
            await lsp_gateway.remove_client(websocket, project_id, lsp_type)
        
        logger.info(f"{lsp_type} LSP WebSocket disconnected", extra={
            "project_id": project_id,
            "lsp": lsp_type
        })