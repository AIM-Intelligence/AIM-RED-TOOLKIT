# AIM-RED Toolkit Architecture Documentation

## Overview

AIM-RED Toolkit (AIM-Forge) is a visual flow-based Python IDE built with a microservices architecture. The system separates concerns between the backend API server, executor service, and frontend client, providing complete isolation for code execution and LSP management.

## System Architecture

### Service Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                         Frontend (React)                      │
│  - Monaco Editor with LSP integration                        │
│  - XYFlow for visual programming                             │
│  - Terminal emulator (xterm.js)                              │
└─────────────────────┬────────────────────────────────────────┘
                      │ HTTP/WebSocket
┌─────────────────────▼────────────────────────────────────────┐
│                    Backend API Server                         │
│  - FastAPI (port 8000)                                       │
│  - Project management                                        │
│  - Request routing and proxy                                 │
│  - Static file serving                                       │
└─────────────────────┬────────────────────────────────────────┘
                      │ HTTP (Internal)
┌─────────────────────▼────────────────────────────────────────┐
│                    Executor Service                           │
│  - FastAPI (port 8001)                                       │
│  - Code execution in isolated subprocesses                   │
│  - LSP process management                                    │
│  - Virtual environment management                            │
│  - Terminal PTY sessions                                     │
└──────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Backend API Server (Port 8000)

The backend server acts as the main entry point and coordinator:

#### Responsibilities:
- **Project Management**: CRUD operations for projects, nodes, and edges
- **Request Proxying**: Routes execution and LSP requests to executor service
- **File Management**: Manages project structure and metadata
- **Frontend Serving**: Serves the React application

#### Key Endpoints:
```
GET  /api/project/              # List all projects
POST /api/project/make          # Create new project
GET  /api/project/{id}          # Get project structure
PUT  /api/project/{id}          # Update project
DELETE /api/project/{id}        # Delete project

# Proxied to Executor
POST /api/code/execute-node     # Execute single node
POST /api/project/execute-flow  # Execute entire flow
GET  /api/project/{id}/venv-status  # Check venv status
```

### 2. Executor Service (Port 8001)

The executor service handles all code execution and language server operations in complete isolation:

#### Architecture Principles:
- **Process Isolation**: Each execution runs in a separate subprocess
- **Virtual Environment**: Each project has its own Python virtual environment
- **No Side Effects**: Backend environment remains unaffected by project code
- **Concurrent Execution**: Multiple projects can execute simultaneously

#### Key Components:

##### Code Execution (`/api/execute/*`)
```python
# Execution Flow:
1. Receive execution request with project_id and node_id
2. Load node code from file system
3. Get project's Python executable from venv
4. Create subprocess with venv Python
5. Execute code with input_data parameter
6. Capture and return output/errors
```

##### Virtual Environment Management (`/api/venv/*`)
```python
# Venv Creation Process:
1. Create venv structure asynchronously
2. Install base packages (fastapi, uvicorn, etc.)
3. Install LSP servers (pyright, ruff)
4. Track status: not_started → creating → installing → completed
5. Frontend polls status until ready
```

##### LSP Management (`/api/lsp/*`)
```python
# LSP Architecture:
- Per-project LSP processes (Pyright and Ruff)
- Single reader per process (prevents asyncio conflicts)
- Multiple WebSocket clients per LSP process
- Auto-restart with exponential backoff
- Idle timeout and resource cleanup
```

### 3. LSP Server Implementation

The LSP implementation provides IDE-level code intelligence:

#### LSP Gateway Architecture

```
Frontend Monaco Editor
        ↓
WebSocket Connection
        ↓
LSP Gateway (Executor Service)
        ↓
LSP Connection Manager
        ├── Single Reader Task (per LSP process)
        ├── Writer Lock (thread-safe writes)
        └── Client Broadcasting
              ↓
     LSP Process (Pyright/Ruff)
     Running in Project Venv
```

#### Key Features:

##### Single Reader Pattern
```python
class LspConnection:
    """Manages LSP process with multiple WebSocket clients"""
    project_id: str
    lsp_type: LspType  # "pyright" or "ruff"
    process: LspProcess
    clients: Set[WebSocket]
    reader_task: asyncio.Task  # Single reader
    writer_lock: asyncio.Lock  # Thread-safe writes
```

##### Process Lifecycle Management
```python
# Auto-restart with exponential backoff
- Initial failure: Wait 2 seconds
- Second failure: Wait 4 seconds
- Third failure: Wait 8 seconds
- Maximum wait: 30 seconds
- Maximum restarts: 5 in 1-minute window

# Idle cleanup
- Tracks last_activity_ts for each process
- Kills processes idle > 10 minutes
- Automatic cleanup task runs every 30 seconds
```

##### Content-Length Protocol
```python
# LSP Message Format:
Content-Length: {size}\r\n\r\n
{JSON-RPC message body}

# Handled by:
- Reader: Parses Content-Length headers
- Writer: Preserves headers from client
- Gateway: Broadcasts complete frames
```

## Request Flow Examples

### 1. Code Execution Flow

```
User clicks "Run Node" in Frontend
            ↓
Frontend sends POST /api/code/execute-node
            ↓
Backend proxies to Executor via executor_proxy.py
            ↓
Executor Service:
  1. Validates project venv exists
  2. Loads node code from file
  3. Wraps code with input_data handler
  4. Creates subprocess with project Python
  5. Executes code with 30s timeout
  6. Returns output/error to frontend
```

### 2. LSP Connection Flow

```
IDE Component mounts in Frontend
            ↓
Creates WebSocket to /api/lsp/pyright?project_id={id}
            ↓
Backend proxies WebSocket to Executor
            ↓
Executor LSP Gateway:
  1. Checks if LSP process exists
  2. Starts new process if needed (with venv)
  3. Adds client to connection
  4. Starts single reader task
            ↓
Reader Task:
  - Reads from LSP stdout
  - Parses Content-Length frames
  - Broadcasts to all clients
            ↓
Writer (from clients):
  - Receives LSP requests
  - Writes to LSP stdin (with lock)
```

### 3. Virtual Environment Creation

```
User creates new project
            ↓
Backend creates project structure
            ↓
Backend calls executor_proxy.create_project_venv()
            ↓
Executor starts async venv creation:
  1. Creates venv structure
  2. Upgrades pip
  3. Installs base packages
  4. Installs LSP servers
            ↓
Frontend polls /api/project/{id}/venv-status
            ↓
When status = "completed":
  - IDE connects LSP
  - Terminal becomes available
```

## Data Flow Patterns

### Flow Execution

```python
# Topological execution order:
1. Find start nodes (or use specified start_node_id)
2. Build dependency graph from edges
3. Execute nodes in topological order
4. Pass output as input_data to next nodes
5. Collect results in result nodes

# Each node execution:
def main(input_data):
    # Process input from previous node
    # Return output for next node
    return processed_data
```

### Terminal Integration

```python
# Terminal with venv activation:
1. Create PTY process
2. Set environment variables:
   - VIRTUAL_ENV = project venv path
   - PATH = venv/bin:$PATH
3. Handle package installation:
   - Detect pip install/uninstall
   - Send package_changed event
   - Trigger LSP restart
```

## Security and Isolation

### Process Isolation Layers

1. **Docker Container Isolation**
   - Backend and Executor run in separate containers
   - Network isolation between services
   - Resource limits per container

2. **Subprocess Isolation**
   - Each code execution in new subprocess
   - No shared memory or state
   - Timeout enforcement (default 30s)

3. **Virtual Environment Isolation**
   - Per-project Python environments
   - Independent package installations
   - No cross-project dependencies

4. **LSP Process Isolation**
   - Separate LSP processes per project
   - Independent process lifecycle
   - Resource cleanup on idle

## Configuration

### Environment Variables

```bash
# Executor Service
LSP_LOG_LEVEL=DEBUG              # LSP logging verbosity
LSP_IDLE_TTL_MS=600000          # 10-minute idle timeout
LSP_MAX_RESTARTS=5              # Max restart attempts
LSP_RESTART_WINDOW_MS=60000    # Restart window (1 minute)

TERMINAL_IDLE_TIMEOUT_MS=600000  # Terminal idle timeout
TERMINAL_MAX_SESSION_MS=3600000  # Max terminal session

# Backend Service
EXECUTOR_URL=http://executor:8001  # Executor service URL
DISABLE_RELOAD=true               # Disable hot reload
```

### Docker Compose Services

```yaml
services:
  backend:
    ports: ["8000:8000"]
    volumes:
      - ./packages/backend:/app
      - backend-projects:/app/projects
    environment:
      - EXECUTOR_URL=http://executor:8001
      
  executor:
    ports: ["8001:8001"]  # Internal only
    volumes:
      - backend-projects:/app/projects
    environment:
      - LSP_LOG_LEVEL=INFO
      
  frontend:
    ports: ["5173:5173"]
    depends_on:
      - backend
```

## Performance Optimizations

### LSP Optimizations
- **Single Reader Pattern**: Prevents asyncio read conflicts
- **Connection Pooling**: Reuses LSP processes across reconnects
- **Exponential Backoff**: Reduces restart storms
- **Idle Cleanup**: Frees resources automatically

### Execution Optimizations
- **Subprocess Pooling**: Reuses Python interpreters
- **Async Venv Creation**: Non-blocking project creation
- **Parallel Flow Execution**: Concurrent node execution
- **Result Caching**: Avoids redundant computations

### WebSocket Optimizations
- **Frame Batching**: Combines small messages
- **Binary Protocol**: Reduces message size
- **Client Broadcasting**: Single read, multiple writes
- **Heartbeat/Keepalive**: Maintains connections

## Monitoring and Debugging

### LSP Monitoring
```bash
# Check LSP health
GET /api/lsp/health?project_id={id}

# View LSP logs
GET /api/lsp/logs?n=50

# View LSP stdio
GET /api/lsp/stdio?project_id={id}&lsp_type=pyright&stream=stderr
```

### Execution Monitoring
- Execution timeouts logged
- Process exit codes captured
- Stderr/stdout separated
- Traceback preservation

### System Health
```bash
# Backend health
GET /api/health

# Executor health  
GET /health

# Service status
docker-compose ps
docker-compose logs -f executor
```

## Common Issues and Solutions

### LSP Connection Issues
**Problem**: LSP not connecting or dropping frequently
**Solution**: 
- Verify venv creation completed
- Check LSP process health endpoint
- Review LSP stdio logs for errors
- Ensure pyright/ruff installed in venv

### Execution Failures
**Problem**: Code execution fails or times out
**Solution**:
- Check venv Python executable exists
- Verify code syntax before execution
- Increase timeout for long-running code
- Check subprocess resource limits

### Virtual Environment Issues
**Problem**: Venv creation fails or packages missing
**Solution**:
- Check disk space in Docker volume
- Verify base package URLs accessible
- Review venv creation logs
- Manually trigger venv recreation

## Future Enhancements

### Planned Improvements
1. **Distributed Execution**: Scale executor service horizontally
2. **Result Caching**: Cache node outputs for faster re-execution
3. **Hot Module Reload**: Update code without LSP restart
4. **Multi-Language Support**: Add support for JavaScript, Go, Rust
5. **Collaborative Editing**: Real-time multi-user editing
6. **Cloud Deployment**: Kubernetes deployment manifests
7. **Performance Profiling**: Execution time analysis
8. **Advanced Debugging**: Breakpoint and step-through debugging