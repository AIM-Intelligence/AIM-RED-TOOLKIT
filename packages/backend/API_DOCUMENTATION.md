# AIM Red Toolkit Backend API Documentation

## Base Information
- **Base URL**: `http://localhost:8000`
- **API Version**: 1.0.0
- **Authentication**: None (CORS enabled for localhost:5173)

## Table of Contents
1. [Root Endpoint](#root-endpoint)
2. [Health Check APIs](#health-check-apis)
3. [Code Management APIs](#code-management-apis)
4. [Project Management APIs](#project-management-apis)

---

## Root Endpoint

### GET /
Get API information

**Response**
```json
{
  "message": "AIM Red Toolkit Backend API",
  "status": "healthy"
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

### POST /api/code/execute
Execute Python code in a secure environment

**Request Body**
```json
{
  "code": "print('Hello, World!')",
  "language": "python",  // Optional, default: "python"
  "timeout": 30          // Optional, default: 30 seconds
}
```

**Response**
```json
{
  "output": "Hello, World!\n",
  "error": null,
  "exit_code": 0
}
```

**Error Response**
```json
{
  "output": "",
  "error": "Code execution timed out",
  "exit_code": -1
}
```

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
  "code": "# Node: Data Input\n# ID: 1\n\nprint('Hello, World!')",
  "language": "python",
  "node_id": "1",
  "node_title": "Data Input"
}
```

**Response (Node not found)**
```json
{
  "success": true,
  "code": "# Write your Python code here\nprint('Hello, World!')",
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
Create a new project

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
  "message": "Project 'new_project' created successfully"
}
```

**Error Responses**
- `400`: Project already exists (checks both name and ID)

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

---

## File Structure

The backend manages files in the following structure:

```
projects/
├── projects.json              # Registry of all projects
└── {project_id}/              # Project folder (named by project_id)
    ├── structure.json         # Node-edge structure for the project
    └── {node_id}_{node_title}.py  # Python code for each node
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

## Development

### Running the Backend Server
```bash
# Using pnpm (recommended)
pnpm backend:dev

# Or directly with Python
cd packages/backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Server Configuration
- **Host**: 0.0.0.0
- **Port**: 8000
- **Auto-reload**: Enabled in development

### Dependencies
- FastAPI
- Uvicorn
- Pydantic
- Python 3.11+

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
- Volumes are mounted for hot-reload in development

---

## Notes

1. All code execution happens in isolated temporary files
2. File names are sanitized (spaces and slashes replaced with underscores)
3. Projects must have unique IDs (project_id)
4. Node IDs must be unique within a project
5. Edge IDs must be unique within a project
6. Deleting a node automatically removes all connected edges
7. Project folders are created using project_id, not project_name
8. All node/edge operations now use project_id for path resolution