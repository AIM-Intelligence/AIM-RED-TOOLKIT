from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from ..core import (
    project_operations,
    project_structure,
    node_operations,
    edge_operations
)

router = APIRouter()

# Request/Response Models
class CreateProjectRequest(BaseModel):
    project_name: str
    project_description: str

class DeleteProjectRequest(BaseModel):
    project_name: str

class CreateNodeRequest(BaseModel):
    project_name: str
    node_id: str
    node_type: str = "default"
    position: Dict[str, float]
    data: Dict[str, Any]

class DeleteNodeRequest(BaseModel):
    project_name: str
    node_id: str

class CreateEdgeRequest(BaseModel):
    project_name: str
    edge_id: str
    edge_type: str = "bezier"
    source: str
    target: str
    marker_end: Optional[Dict[str, Any]] = None

class DeleteEdgeRequest(BaseModel):
    project_name: str
    edge_id: str




@router.get("/")
async def get_all_projects():
    """Get all project names from the projects folder"""
    try:
        projects = project_operations.get_all_projects()
        return {
            "success": True,
            "projects": projects
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project_name}")
async def get_project(project_name: str):
    """Get a specific project's node-edge structure"""
    try:
        structure = project_structure.get_project_structure(project_name)
        return {
            "success": True,
            "project": structure
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/make")
async def make_project(request: CreateProjectRequest):
    """Create a new project with folder and json file"""
    try:
        result = project_operations.create_project(request.project_name, request.project_description)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/delete")
async def delete_project(request: DeleteProjectRequest):
    """Delete entire project folder"""
    try:
        result = project_operations.delete_project(request.project_name)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/makenode")
async def make_node(request: CreateNodeRequest):
    """Create a new node with corresponding python file"""
    try:
        result = node_operations.create_node(
            request.project_name,
            request.node_id,
            request.node_type,
            request.position,
            request.data
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/deletenode")
async def delete_node(request: DeleteNodeRequest):
    """Delete a node and its python file"""
    try:
        result = node_operations.delete_node(request.project_name, request.node_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/makeedge")
async def make_edge(request: CreateEdgeRequest):
    """Create a new edge between nodes"""
    try:
        result = edge_operations.create_edge(
            request.project_name,
            request.edge_id,
            request.edge_type,
            request.source,
            request.target,
            request.marker_end
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/deleteedge")
async def delete_edge(request: DeleteEdgeRequest):
    """Delete an edge"""
    try:
        result = edge_operations.delete_edge(request.project_name, request.edge_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
