"""
Code file management API for nodes
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from pathlib import Path
import json
import os
import re
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

class GetNodeCodeRequest(BaseModel):
    project_id: str
    node_id: str
    node_title: Optional[str] = None

class SaveNodeCodeRequest(BaseModel):
    project_id: str
    node_id: str
    node_title: Optional[str] = None
    code: str

def sanitize_filename(name: str) -> str:
    """Sanitize a string to be used as a filename"""
    # Replace spaces and special characters with underscores
    sanitized = re.sub(r'[^\w\-_]', '_', name)
    # Remove multiple consecutive underscores
    sanitized = re.sub(r'_+', '_', sanitized)
    # Remove leading/trailing underscores
    sanitized = sanitized.strip('_')
    return sanitized or "untitled"

def get_node_file_path(project_id: str, node_id: str, node_title: Optional[str] = None) -> Path:
    """Get the file path for a node's Python code"""
    project_dir = Path(f"/app/projects/{project_id}")
    
    # Always ensure project directory exists
    project_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate filename from node_id and title
    if node_title:
        filename = f"{node_id}_{sanitize_filename(node_title)}.py"
    else:
        filename = f"{node_id}.py"
    
    return project_dir / filename

@router.post("/getcode")
async def get_node_code(request: GetNodeCodeRequest):
    """Get the code content of a node"""
    try:
        file_path = get_node_file_path(request.project_id, request.node_id, request.node_title)
        
        if file_path.exists():
            with open(file_path, 'r', encoding='utf-8') as f:
                code = f.read()
        else:
            # Return default code if file doesn't exist
            code = """# Write your logic in function.
# The function name can be changed arbitrarily,
# but only one function is allowed per node.
# To pass the return value of this function to the next node,
# a return statement must be present.
# The data format and type of input_data should be defined
# at the beginning of the function and used accordingly.
# (Using typing or Pydantic is recommended.)

def main(input_data=None):
    output_data = input_data
    return output_data"""
        
        return {
            "success": True,
            "code": code,
            "language": "python",
            "node_id": request.node_id,
            "node_title": request.node_title
        }
    except Exception as e:
        logger.error(f"Error getting code: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/savecode")
async def save_node_code(request: SaveNodeCodeRequest):
    """Save code to a node's python file"""
    try:
        file_path = get_node_file_path(request.project_id, request.node_id, request.node_title)
        
        # Ensure project directory exists
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Write the code to file
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(request.code)
        
        return {
            "success": True,
            "message": "Code saved successfully",
            "file_path": str(file_path),
            "node_id": request.node_id
        }
    except Exception as e:
        logger.error(f"Error saving code: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/delete")
async def delete_node_code(request: GetNodeCodeRequest):
    """Delete a node's code file"""
    try:
        # Find all files matching the node_id pattern
        project_dir = Path(f"/app/projects/{request.project_id}")
        if project_dir.exists():
            for file_path in project_dir.glob(f"{request.node_id}_*.py"):
                file_path.unlink()
                logger.info(f"Deleted code file: {file_path}")
            
            # Also try exact match
            exact_file = project_dir / f"{request.node_id}.py"
            if exact_file.exists():
                exact_file.unlink()
                logger.info(f"Deleted code file: {exact_file}")
        
        return {
            "success": True,
            "message": "Code file deleted",
            "node_id": request.node_id
        }
    except Exception as e:
        logger.error(f"Error deleting code: {e}")
        raise HTTPException(status_code=500, detail=str(e))