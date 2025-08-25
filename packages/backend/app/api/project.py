from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
from ..core import (
    project_operations,
    project_structure,
    node_operations,
    edge_operations
)
from pathlib import Path
import os

router = APIRouter()

# Request/Response Models
class CreateProjectRequest(BaseModel):
    project_name: str
    project_description: str
    project_id: str

class DeleteProjectRequest(BaseModel):
    project_name: str
    project_id: str

class CreateNodeRequest(BaseModel):
    project_id: str
    node_id: str
    node_type: str = "custom"
    position: Dict[str, float]
    data: Dict[str, Any]

class DeleteNodeRequest(BaseModel):
    project_id: str
    node_id: str

class UpdateNodePositionRequest(BaseModel):
    project_id: str
    node_id: str
    position: Dict[str, float]

class CreateEdgeRequest(BaseModel):
    project_id: str
    edge_id: str
    edge_type: str = "bezier"
    source: str
    target: str
    marker_end: Optional[Dict[str, Any]] = None

class DeleteEdgeRequest(BaseModel):
    project_id: str
    edge_id: str

class ExecuteFlowRequest(BaseModel):
    project_id: str
    start_node_id: Optional[str] = None
    params: Dict[str, Any] = Field(default_factory=dict)
    max_workers: int = Field(default=4, ge=1, le=10)
    timeout_sec: int = Field(default=30, ge=1, le=300)
    halt_on_error: bool = True





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


@router.get("/{project_id}")
async def get_project(project_id: str):
    """Get a specific project's node-edge structure by project_id"""
    try:
        structure = project_structure.get_project_structure(project_id)
        
        # Ensure the structure has all required fields for ReactFlow
        # Validate and add default values for nodes
        for node in structure.get("nodes", []):
            # Ensure node has required fields
            if "data" not in node:
                node["data"] = {}
            if "title" not in node["data"]:
                node["data"]["title"] = f"Node {node.get('id', 'unknown')}"
            if "description" not in node["data"]:
                node["data"]["description"] = ""
            
            # Ensure position exists with default values
            if "position" not in node:
                node["position"] = {"x": 100, "y": 100}
            elif not isinstance(node["position"], dict):
                node["position"] = {"x": 100, "y": 100}
            elif "x" not in node["position"] or "y" not in node["position"]:
                node["position"]["x"] = node["position"].get("x", 100)
                node["position"]["y"] = node["position"].get("y", 100)
        
        # Validate edges
        for edge in structure.get("edges", []):
            # Ensure edge has minimum required fields
            if "source" not in edge or "target" not in edge:
                continue  # Skip invalid edges
            
            # Add optional fields with null as default
            if "sourceHandle" not in edge:
                edge["sourceHandle"] = None
            if "targetHandle" not in edge:
                edge["targetHandle"] = None
            
            # Ensure markerEnd has correct format for ReactFlow
            if "markerEnd" not in edge:
                edge["markerEnd"] = {"type": "arrowclosed"}
            elif isinstance(edge.get("markerEnd"), dict):
                # Normalize markerEnd type to lowercase for ReactFlow compatibility
                marker_type = edge["markerEnd"].get("type", "arrowclosed")
                if isinstance(marker_type, str):
                    # Convert to lowercase and handle common variations
                    marker_type_lower = marker_type.lower()
                    if marker_type_lower in ["arrowclosed", "arrow"]:
                        edge["markerEnd"]["type"] = marker_type_lower
                    elif marker_type_lower == "arrowclosed" or "closed" in marker_type_lower:
                        edge["markerEnd"]["type"] = "arrowclosed"
                    else:
                        edge["markerEnd"]["type"] = "arrowclosed"  # Default
        
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
    """Create a new project with folder and json file, start async venv creation"""
    try:
        result = await project_operations.create_project(request.project_name, request.project_description, request.project_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project_id}/venv-status")
async def get_venv_status(project_id: str):
    """Check virtual environment status including creation progress"""
    try:
        # Get detailed venv status from operations (now async)
        status = await project_operations.get_venv_status(project_id)
        return status
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))





@router.delete("/delete")
async def delete_project(request: DeleteProjectRequest):
    """Delete entire project folder"""
    try:
        result = await project_operations.delete_project(request.project_name, request.project_id)
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
            request.project_id,
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
        result = node_operations.delete_node(request.project_id, request.node_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/updatenode/position")
async def update_node_position(request: UpdateNodePositionRequest):
    """Update node position in project structure"""
    try:
        result = node_operations.update_node_position(
            request.project_id,
            request.node_id,
            request.position
        )
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
            request.project_id,
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
        result = edge_operations.delete_edge(request.project_id, request.edge_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/execute-flow")
async def execute_flow(request: ExecuteFlowRequest):
    """Execute the node flow starting from start node - proxy to executor"""
    try:
        from ..api.executor_proxy import proxy_to_executor
        
        # Proxy the execution request to executor
        result = await proxy_to_executor(
            "execute/flow",
            json_data={
                "project_id": request.project_id,
                "start_node_id": request.start_node_id,
                "params": request.params,
                "max_workers": request.max_workers,
                "timeout_sec": request.timeout_sec,
                "halt_on_error": request.halt_on_error
            }
        )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Flow execution failed: {str(e)}")


