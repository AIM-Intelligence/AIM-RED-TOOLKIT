from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from ..core.execute_code import execute_python_code
from ..core import node_operations

router = APIRouter()

class CodeExecutionRequest(BaseModel):
    code: str
    language: Optional[str] = "python"
    timeout: Optional[int] = 30

class CodeExecutionResponse(BaseModel):
    output: str
    error: Optional[str] = None
    exit_code: int

class GetNodeCodeRequest(BaseModel):
    project_id: str
    node_id: str
    node_title: Optional[str] = None  # For finding the file if needed

class SaveNodeCodeRequest(BaseModel):
    project_id: str
    node_id: str
    node_title: Optional[str] = None
    code: str

@router.post("/execute", response_model=CodeExecutionResponse)
async def execute_code(request: CodeExecutionRequest):
    """
    Execute Python code in a secure environment
    """
    if request.language != "python":
        raise HTTPException(status_code=400, detail="Only Python is supported")
    
    result = execute_python_code(request.code, request.timeout)
    return CodeExecutionResponse(**result)

@router.post("/getcode")
async def get_node_code(request: GetNodeCodeRequest):
    """Get the code content of a node for Monaco Editor"""
    try:
        code = node_operations.get_node_code(request.project_id, request.node_id)
        
        # Return in format compatible with Monaco Editor
        return {
            "success": True,
            "code": code,
            "language": "python",
            "node_id": request.node_id,
            "node_title": request.node_title
        }
    except ValueError as e:
        # Return default code if node not found or no code exists
        return {
            "success": True,
            "code": "# Write your Python code here\nprint('Hello, World!')",
            "language": "python",
            "node_id": request.node_id,
            "node_title": request.node_title,
            "message": str(e)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/savecode")
async def save_node_code(request: SaveNodeCodeRequest):
    """Save code to a node's python file"""
    try:
        result = node_operations.save_node_code(
            request.project_id,
            request.node_id,
            request.code
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))