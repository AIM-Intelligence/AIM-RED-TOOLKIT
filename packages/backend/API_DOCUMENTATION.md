# AIM Red Toolkit Backend API Documentation

## Base Information
- **Base URL**: `http://localhost:8000`
- **API Version**: 1.0.0
- **Authentication**: None (CORS enabled for localhost:5173, localhost:3000, frontend:5173, frontend:3000)

## Table of Contents
1. [Root Endpoint](#root-endpoint)
2. [Health Check APIs](#health-check-apis)
3. [Code Management APIs](#code-management-apis)
4. [Project Management APIs](#project-management-apis)
5. [LSP Management APIs](#lsp-management-apis)
6. [WebSocket Endpoints](#websocket-endpoints)
7. [Package Management APIs](#package-management-apis)

---

## Root Endpoint

### GET /
Get API information with feature status

**Response**
```json
{
  "message": "AIM Red Toolkit Backend API",
  "status": "healthy",
  "features": {
    "lsp": "enabled",
    "pyright": "available",
    "ruff": "available"
  }
}
```

---

## Health Check APIs

### GET /api/health
Check backend service health status

**Response**
```json
{
  "status": "healthy",
  "service": "backend"
}
```

### GET /api/version
Get system version information

**Response**
```json
{
  "python_version": "3.x.x ...",
  "api_version": "1.0.0"
}
```

---

## Code Management APIs


### POST /api/code/getcode
Get code content of a specific node

**Request Body**
```json
{
  "project_id": "unique_project_id",
  "node_id": "1",
  "node_title": "Data Input"  // Optional
}
```

**Response**
```json
{
  "success": true,
  "code": "def main(input_data=None):\n    output_data = input_data\n    return output_data",
  "language": "python",
  "node_id": "1",
  "node_title": "Data Input"
}
```

**Response (Node not found)**
```json
{
  "success": true,
  "code": "# Default template code...",
  "language": "python",
  "node_id": "1",
  "node_title": "Data Input",
  "message": "Node with ID '1' not found"
}
```

### POST /api/code/savecode
Save code to a node's Python file

**Request Body**
```json
{
  "project_id": "unique_project_id",
  "node_id": "1",
  "node_title": "Data Input",  // Optional
  "code": "# Updated code\nprint('Updated!')"
}
```

**Response**
```json
{
  "success": true,
  "message": "Code saved for node '1'",
  "file_path": "projects/unique_project_id/1_Data_Input.py"
}
```

**Error Responses**
- `404`: Node not found
- `500`: Server error

### POST /api/code/execute-node
Execute a single node with optional input data

**Request Body**
```json
{
  "project_id": "unique_project_id",
  "node_id": "1",
  "input_data": {"key": "value"}  // Optional
}
```

**Response (Success)**
```json
{
  "success": true,
  "output": {"result": "data"},
  "node_id": "1"
}
```

**Response (Error)**
```json
{
  "success": false,
  "error": "Error message",
  "traceback": "Full traceback...",
  "node_id": "1"
}
```

---

## Project Management APIs

### GET /api/project/
Get all projects list

**Response**
```json
{
  "success": true,
  "projects": [
    {
      "project_name": "project1",
      "project_description": "Description of project1",
      "project_id": "proj_id_1"
    },
    {
      "project_name": "project2",
      "project_description": "Description of project2",
      "project_id": "proj_id_2"
    }
  ]
}
```

### GET /api/project/{project_id}
Get specific project's node-edge structure

**Path Parameters**
- `project_id` (string): Unique identifier of the project

**Response**
```json
{
  "success": true,
  "project": {
    "project_name": "my_project",
    "project_description": "My AI project",
    "project_id": "unique_project_id",
    "nodes": [
      {
        "id": "1",
        "type": "custom",
        "position": {"x": 100, "y": 100},
        "data": {
          "title": "Data Input",
          "description": "Load dataset from CSV",
          "file": "1_Data_Input.py"
        }
      }
    ],
    "edges": [
      {
        "id": "e1",
        "type": "bezier",
        "source": "1",
        "target": "2",
        "sourceHandle": null,
        "targetHandle": null,
        "markerEnd": {"type": "arrowclosed"}
      }
    ]
  }
}
```

**Error Responses**
- `404`: Project not found

### POST /api/project/make
Create a new project with virtual environment

**Request Body**
```json
{
  "project_name": "new_project",
  "project_description": "Description of the new project",
  "project_id": "unique_project_id"
}
```

**Response**
```json
{
  "success": true,
  "message": "Project 'new_project' created successfully",
  "venv_created": true
}
```

**Error Responses**
- `400`: Project already exists (checks both name and ID)

### GET /api/project/{project_id}/venv-status
Check virtual environment status for a project

**Path Parameters**
- `project_id` (string): Project identifier

**Response**
```json
{
  "success": true,
  "project_id": "unique_project_id",
  "venv_ready": true,
  "venv_exists": true,
  "venv_healthy": true
}
```


### DELETE /api/project/delete
Delete an entire project

**Request Body**
```json
{
  "project_name": "project_to_delete",
  "project_id": "project_id_to_delete"
}
```

**Response**
```json
{
  "success": true,
  "message": "Project 'project_to_delete' deleted successfully"
}
```

**Error Responses**
- `404`: Project not found

### POST /api/project/makenode
Create a new node in a project

**Request Body**
```json
{
  "project_id": "unique_project_id",
  "node_id": "2",
  "node_type": "custom",
  "position": {"x": 400, "y": 100},
  "data": {
    "title": "Preprocessing",
    "description": "Clean and normalize data"
  }
}
```

**Response**
```json
{
  "success": true,
  "message": "Node 'Preprocessing' created successfully",
  "node": {
    "id": "2",
    "type": "custom",
    "position": {"x": 400, "y": 100},
    "data": {
      "title": "Preprocessing",
      "description": "Clean and normalize data",
      "file": "2_Preprocessing.py"
    }
  }
}
```

**Error Responses**
- `400`: Node already exists or project not found

### DELETE /api/project/deletenode
Delete a node from a project

**Request Body**
```json
{
  "project_id": "unique_project_id",
  "node_id": "2"
}
```

**Response**
```json
{
  "success": true,
  "message": "Node '2' deleted successfully"
}
```

**Error Responses**
- `404`: Node or project not found

### PUT /api/project/updatenode/position
Update node position in the flow

**Request Body**
```json
{
  "project_id": "unique_project_id",
  "node_id": "1",
  "position": {"x": 200, "y": 150}
}
```

**Response**
```json
{
  "success": true,
  "message": "Node position updated",
  "node_id": "1"
}
```

### POST /api/project/makeedge
Create a new edge between nodes

**Request Body**
```json
{
  "project_id": "unique_project_id",
  "edge_id": "e2",
  "edge_type": "bezier",
  "source": "1",
  "target": "2",
  "marker_end": {"type": "arrowclosed"}
}
```

**Response**
```json
{
  "success": true,
  "message": "Edge 'e2' created successfully",
  "edge": {
    "id": "e2",
    "type": "bezier",
    "source": "1",
    "target": "2",
    "sourceHandle": null,
    "targetHandle": null,
    "markerEnd": {"type": "arrowclosed"}
  }
}
```

**Error Responses**
- `400`: Edge already exists, source/target node not found

### DELETE /api/project/deleteedge
Delete an edge from a project

**Request Body**
```json
{
  "project_id": "unique_project_id",
  "edge_id": "e2"
}
```

**Response**
```json
{
  "success": true,
  "message": "Edge 'e2' deleted successfully"
}
```

**Error Responses**
- `404`: Edge or project not found

### POST /api/project/execute-flow
Execute the entire flow starting from a specific node or all start nodes

**Request Body**
```json
{
  "project_id": "unique_project_id",
  "start_node_id": "1",  // Optional, null executes all start nodes
  "params": {},          // Optional parameters
  "max_workers": 4,      // Optional, default: 4 (1-10)
  "timeout_sec": 30,     // Optional, default: 30 (1-300)
  "halt_on_error": true  // Optional, default: true
}
```

**Response**
```json
{
  "success": true,
  "project_id": "unique_project_id",
  "execution_time": 1.234,
  "nodes_executed": 5,
  "results": {
    "node_1": {
      "success": true,
      "output": {"data": "result"},
      "execution_time": 0.5
    }
  },
  "errors": []
}
```


---

## LSP Management APIs

### GET /api/lsp/health
Check LSP process health status

**Query Parameters**
- `project_id` (string, required): Project ID
- `lsp_type` (string, optional): "pyright" or "ruff"

**Response (Specific LSP)**
```json
{
  "project_id": "unique_project_id",
  "lsp_type": "pyright",
  "running": true,
  "pid": 12345,
  "uptime_sec": 123.45,
  "restart_count": 0,
  "last_activity_sec": 5.2
}
```

**Response (All LSPs)**
```json
{
  "project_id": "unique_project_id",
  "pyright": {
    "running": true,
    "pid": 12345,
    "uptime_sec": 123.45,
    "restart_count": 0,
    "last_activity_sec": 5.2
  },
  "ruff": {
    "running": false,
    "pid": null,
    "uptime_sec": 0,
    "restart_count": 0,
    "last_activity_sec": null
  }
}
```

### POST /api/lsp/restart/{lsp_type}
Manually restart an LSP process

**Path Parameters**
- `lsp_type` (string): "pyright" or "ruff"

**Query Parameters**
- `project_id` (string, required): Project ID

**Response**
```json
{
  "success": true,
  "project_id": "unique_project_id",
  "lsp_type": "pyright",
  "before": {
    "running": true,
    "pid": 12345
  },
  "after": {
    "running": true,
    "pid": 12346
  },
  "message": "Successfully restarted pyright LSP"
}
```

### POST /api/lsp/stop/{lsp_type}
Manually stop an LSP process

**Path Parameters**
- `lsp_type` (string): "pyright" or "ruff"

**Query Parameters**
- `project_id` (string, required): Project ID

**Response**
```json
{
  "success": true,
  "project_id": "unique_project_id",
  "lsp_type": "pyright",
  "message": "Successfully stopped pyright LSP"
}
```

### GET /api/lsp/logs
Get recent LSP event logs

**Query Parameters**
- `n` (integer, optional): Number of events (1-2000, default: 200)

**Response**
```json
{
  "count": 50,
  "events": [
    {
      "time": "2024-01-01T12:00:00.000Z",
      "level": "INFO",
      "message": "LSP started",
      "project_id": "unique_project_id",
      "lsp_type": "pyright"
    }
  ]
}
```

### GET /api/lsp/stdio
Get stdio logs for a specific LSP process

**Query Parameters**
- `project_id` (string, required): Project ID
- `lsp_type` (string, required): "pyright" or "ruff"
- `stream` (string, optional): "stdout" or "stderr" (default: "stdout")
- `lines` (integer, optional): Number of lines (1-1000, default: 100)

**Response**
```json
{
  "project_id": "unique_project_id",
  "lsp_type": "pyright",
  "stream": "stderr",
  "lines": [
    "2024-01-01 12:00:00 - Starting Pyright language server...",
    "2024-01-01 12:00:01 - Server initialized"
  ],
  "count": 2
}
```

### GET /api/lsp/status
Get global LSP manager status

**Response**
```json
{
  "active_processes": [
    {
      "project_id": "project1",
      "lsp_type": "pyright",
      "running": true,
      "pid": 12345,
      "uptime_sec": 100.5
    }
  ],
  "count": 1,
  "config": {
    "idle_ttl_ms": 600000,
    "max_restarts": 5,
    "restart_window_ms": 60000,
    "log_level": "DEBUG"
  }
}
```

---

## WebSocket Endpoints

### WS /api/lsp/python
WebSocket endpoint for Pyright Language Server Protocol

**Query Parameters**
- `project_id` (string, required): Project ID

**Connection Flow**
1. Client connects to WebSocket
2. Server checks virtual environment exists
3. Server starts/connects to Pyright process
4. Bidirectional LSP message exchange
5. Auto-reconnect on process restart (close code 4001)

**Close Codes**
- `1000`: Normal closure
- `4001`: LSP process restarting
- `4002`: LSP process error
- `4003`: LSP process crashed

### WS /api/lsp/ruff
WebSocket endpoint for Ruff Language Server Protocol

**Query Parameters**
- `project_id` (string, required): Project ID

Same behavior as Pyright endpoint but for Ruff linting/formatting.

### WS /api/terminal
WebSocket endpoint for interactive terminal sessions

**Query Parameters**
- `project_id` (string, required): Project ID
- `mode` (string, optional): "pkg" or "shell" (default: "pkg")

**Message Types**

Client to Server:
```json
{
  "type": "input",
  "data": "ls -la\n"
}
```

```json
{
  "type": "resize",
  "rows": 24,
  "cols": 80
}
```

Server to Client:
```json
{
  "type": "output",
  "data": "file1.txt\nfile2.txt\n"
}
```

```json
{
  "type": "error",
  "message": "Terminal session expired"
}
```

```json
{
  "type": "package_changed",
  "action": "install",
  "package": "numpy"
}
```

**Session Management**
- Idle timeout: 10 minutes (configurable)
- Max session duration: 1 hour (configurable)
- Automatic virtual environment activation
- Working directory set to project root

---

## Package Management APIs

### POST /api/code/packages/install
Install a package in the project's virtual environment

**Request Body**
```json
{
  "project_id": "unique_project_id",
  "package": "numpy==1.24.0"
}
```

**Response**
```json
{
  "success": true,
  "message": "Successfully installed numpy==1.24.0",
  "project_id": "unique_project_id",
  "package": "numpy==1.24.0"
}
```

### POST /api/code/packages/uninstall
Uninstall a package from the project's virtual environment

**Request Body**
```json
{
  "project_id": "unique_project_id",
  "package": "numpy"
}
```

**Response**
```json
{
  "success": true,
  "message": "Successfully uninstalled numpy",
  "project_id": "unique_project_id",
  "package": "numpy"
}
```

### POST /api/code/packages/list
Get list of installed packages in the project's virtual environment

**Request Body**
```json
{
  "project_id": "unique_project_id"
}
```

**Response**
```json
{
  "success": true,
  "project_id": "unique_project_id",
  "packages": [
    {"name": "numpy", "version": "1.24.0"},
    {"name": "pandas", "version": "2.0.0"}
  ],
  "python_executable": "/app/projects/unique_project_id/venv/bin/python"
}
```


---

## File Structure

The backend manages files in the following structure:

```
packages/backend/
├── projects/
│   ├── projects.json              # Registry of all projects
│   └── {project_id}/              # Project folder (named by project_id)
│       ├── structure.json         # Node-edge structure for the project
│       ├── venv/                  # Project-specific virtual environment
│       ├── pyrightconfig.json     # Auto-generated Pyright configuration
│       └── {node_id}_{sanitized_title}.py  # Python code for each custom node
```

### projects.json Format
```json
{
  "projects": [
    {
      "project_name": "project1",
      "project_description": "Description",
      "project_id": "unique_id_1"
    }
  ]
}
```

### structure.json Format
```json
{
  "project_name": "my_project",
  "project_description": "Project description",
  "project_id": "unique_project_id",
  "nodes": [
    {
      "id": "1",
      "type": "custom",
      "position": {"x": 100, "y": 100},
      "data": {
        "title": "Node Title",
        "description": "Node description",
        "file": "1_Node_Title.py"
      }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "type": "bezier",
      "source": "1",
      "target": "2",
      "sourceHandle": null,
      "targetHandle": null,
      "markerEnd": {"type": "arrowclosed"}
    }
  ]
}
```

---

## Error Handling

All API endpoints follow a consistent error response format:

```json
{
  "detail": "Error message describing what went wrong"
}
```

Common HTTP status codes:
- `200`: Success
- `400`: Bad Request (invalid input)
- `404`: Not Found (resource doesn't exist)
- `500`: Internal Server Error

---

## Environment Variables

### LSP Configuration
```bash
LSP_LOG_LEVEL=DEBUG          # Log level: DEBUG, INFO, WARNING, ERROR
LSP_IDLE_TTL_MS=600000       # Idle timeout before stopping LSP (10 min)
LSP_MAX_RESTARTS=5           # Max restart attempts
LSP_RESTART_WINDOW_MS=60000  # Time window for restart counting
```

### Terminal Configuration
```bash
TERMINAL_IDLE_TIMEOUT_MS=600000   # Terminal idle timeout (10 min)
TERMINAL_MAX_SESSION_MS=3600000   # Max terminal session duration (1 hour)
```

### Server Configuration
```bash
DISABLE_RELOAD=true  # Disable hot reload to prevent venv-related crashes
```

---

## Development

### Running the Backend Server
```bash
# Using pnpm (recommended)
pnpm backend:dev

# Or directly with Python
cd packages/backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# Or using the development runner (reload disabled by default)
python run_dev.py
```

### Server Configuration
- **Host**: 0.0.0.0
- **Port**: 8000
- **Auto-reload**: DISABLED by default (see DISABLE_RELOAD env var)

### Dependencies
- FastAPI 0.115.5
- Uvicorn 0.32.1
- Pydantic 2.10.3
- Python 3.11+
- Ruff 0.8.6 (includes LSP server)
- Pyright (installed via npm)

---

## Docker Support

### Building and Running with Docker
```bash
# Build and run with docker-compose
docker-compose up --build

# Backend will be available at http://localhost:8000
# Frontend will be available at http://localhost:5173
```

### Docker Configuration
- Backend runs on port 8000
- Frontend runs on port 5173
- Networks are configured for inter-service communication
- Hot reload is disabled for stability
- Projects folder is persisted as volume

---

## Notes

1. All code execution happens in project virtual environments
2. Virtual environments are created automatically when projects are created
3. File names are sanitized (spaces and slashes replaced with underscores)
4. Projects must have unique IDs (project_id)
5. Node IDs must be unique within a project
6. Edge IDs must be unique within a project
7. Deleting a node automatically removes all connected edges
8. Project folders are created using project_id, not project_name
9. LSP processes automatically restart with exponential backoff on failure
10. Terminal sessions have automatic idle and duration timeouts
11. Package installation in terminal triggers LSP restart automatically