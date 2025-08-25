"""
Virtual environment management API
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict
from ..core.venv_manager import AsyncVenvManager
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# Global venv manager instance
venv_manager = AsyncVenvManager("/app/projects")

class CreateVenvRequest(BaseModel):
    project_id: str

class VenvStatusRequest(BaseModel):
    project_id: str


@router.post("/create")
async def create_venv(request: CreateVenvRequest):
    """Create a virtual environment for a project"""
    try:
        # Ensure project directory exists in executor
        import os
        import json
        project_dir = f"/app/projects/{request.project_id}"
        os.makedirs(project_dir, exist_ok=True)
        
        # Create a basic structure.json if it doesn't exist
        structure_file = f"{project_dir}/structure.json"
        if not os.path.exists(structure_file):
            with open(structure_file, 'w') as f:
                json.dump({
                    "project_id": request.project_id,
                    "nodes": [],
                    "edges": []
                }, f)
        
        result = await venv_manager.create_venv_async(request.project_id)
        return result
    except Exception as e:
        logger.error(f"Error creating venv for {request.project_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status")
async def get_venv_status(project_id: str):
    """Get the status of a project's virtual environment"""
    try:
        # Check if venv exists first
        if venv_manager.venv_exists(project_id):
            return {
                "success": True,
                "project_id": project_id,
                "status": "completed",
                "venv_ready": True,
                "message": "Virtual environment is ready"
            }
        
        # Check task status
        status = venv_manager.get_status(project_id)
        if status:
            return {
                "success": True,
                "project_id": project_id,
                "venv_ready": status.get("status") == "completed",
                **status
            }
        
        # No venv and no task
        return {
            "success": True,
            "project_id": project_id,
            "status": "not_started",
            "venv_ready": False,
            "message": "Virtual environment not created yet"
        }
    except Exception as e:
        logger.error(f"Error getting venv status for {project_id}: {e}")
        return {
            "success": False,
            "project_id": project_id,
            "venv_ready": False,
            "error": str(e)
        }

@router.post("/exists")
async def venv_exists(request: VenvStatusRequest):
    """Check if a virtual environment exists for a project"""
    exists = venv_manager.venv_exists(request.project_id)
    return {
        "success": True,
        "project_id": request.project_id,
        "exists": exists
    }


@router.delete("/delete")
async def delete_venv(project_id: str):
    """Delete a project's virtual environment"""
    try:
        venv_manager.delete_venv(project_id)
        return {
            "success": True,
            "project_id": project_id,
            "message": f"Virtual environment for project {project_id} deleted"
        }
    except Exception as e:
        logger.error(f"Error deleting venv for {project_id}: {e}")
        return {
            "success": False,
            "project_id": project_id,
            "error": str(e)
        }