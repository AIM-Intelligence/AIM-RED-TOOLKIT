"""
Code execution API for running Python code in project environments
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from pathlib import Path
import json
import logging
from ..core.executor import execute_python_code, get_project_venv_python
from ..core.venv_manager import AsyncVenvManager

router = APIRouter()
logger = logging.getLogger(__name__)

# Global venv manager instance
venv_manager = AsyncVenvManager("/app/projects")

class ExecuteNodeRequest(BaseModel):
    project_id: str
    node_id: str
    input_data: Optional[Dict[str, Any]] = None

class ExecuteCodeRequest(BaseModel):
    project_id: str
    code: str
    input_data: Optional[Dict[str, Any]] = None
    timeout: int = 30

class ExecuteFlowRequest(BaseModel):
    project_id: str
    start_node_id: Optional[str] = None
    params: Dict[str, Any] = {}
    max_workers: int = 4
    timeout_sec: int = 30
    halt_on_error: bool = True

def get_node_code(project_id: str, node_id: str) -> str:
    """Get the code for a node from its file"""
    project_dir = Path(f"/app/projects/{project_id}")
    
    # Try to find the node file
    for file_path in project_dir.glob(f"{node_id}_*.py"):
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    
    # Try exact match
    exact_file = project_dir / f"{node_id}.py"
    if exact_file.exists():
        with open(exact_file, 'r', encoding='utf-8') as f:
            return f.read()
    
    raise ValueError(f"Code file not found for node {node_id}")

@router.post("/node")
async def execute_node(request: ExecuteNodeRequest):
    """Execute a single node and return its output"""
    try:
        # Check if venv exists
        if not venv_manager.venv_exists(request.project_id):
            return {
                "success": False,
                "error": f"Virtual environment not found for project {request.project_id}",
                "node_id": request.node_id
            }
        
        # Get the node's code
        code = get_node_code(request.project_id, request.node_id)
        
        # Create wrapper to execute the node with input data
        input_json_str = json.dumps(request.input_data) if request.input_data else 'null'
        
        wrapper_code = f"""
import json
import sys

# Node code
{code}

# Execute with input
try:
    input_json = '''{input_json_str}'''
    if input_json != 'null':
        input_data = json.loads(input_json)
    else:
        input_data = None
    
    # Find and execute main function
    if 'main' in locals() and callable(main):
        result = main(input_data) if input_data is not None else main()
    else:
        # Find first callable
        result = None
        for name, obj in list(locals().items()):
            if callable(obj) and not name.startswith('_') and name not in ['json', 'sys']:
                result = obj(input_data) if input_data is not None else obj()
                break
    
    print(json.dumps({{'success': True, 'output': result}}))
except Exception as e:
    import traceback
    print(json.dumps({{
        'success': False,
        'error': str(e),
        'traceback': traceback.format_exc()
    }}))
"""
        
        # Execute using project's virtual environment
        python_exe = venv_manager.get_python_executable(request.project_id)
        project_dir = f"/app/projects/{request.project_id}"
        
        execution_result = execute_python_code(
            wrapper_code, 
            timeout=30, 
            python_executable=python_exe, 
            working_dir=project_dir
        )
        
        if execution_result['exit_code'] == 0:
            try:
                output = json.loads(execution_result['output'])
                if output.get('success'):
                    return {
                        "success": True,
                        "output": output.get('output'),
                        "node_id": request.node_id
                    }
                else:
                    return {
                        "success": False,
                        "error": output.get('error', 'Unknown error'),
                        "traceback": output.get('traceback', ''),
                        "node_id": request.node_id
                    }
            except json.JSONDecodeError:
                return {
                    "success": False,
                    "error": "Failed to parse output",
                    "output_raw": execution_result['output'],
                    "node_id": request.node_id
                }
        else:
            return {
                "success": False,
                "error": execution_result.get('error', 'Execution failed'),
                "output_raw": execution_result.get('output', ''),
                "node_id": request.node_id
            }
            
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error executing node: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/code")
async def execute_code(request: ExecuteCodeRequest):
    """Execute arbitrary Python code in a project's environment"""
    try:
        # Check if venv exists
        if not venv_manager.venv_exists(request.project_id):
            return {
                "success": False,
                "error": f"Virtual environment not found for project {request.project_id}"
            }
        
        # Get project Python executable
        python_exe = venv_manager.get_python_executable(request.project_id)
        project_dir = f"/app/projects/{request.project_id}"
        
        # Execute the code
        result = execute_python_code(
            request.code,
            timeout=request.timeout,
            python_executable=python_exe,
            working_dir=project_dir
        )
        
        return {
            "success": result['exit_code'] == 0,
            "output": result['output'],
            "error": result['error'],
            "exit_code": result['exit_code']
        }
        
    except Exception as e:
        logger.error(f"Error executing code: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/flow")
async def execute_flow(request: ExecuteFlowRequest):
    """Execute a flow of nodes starting from the start node"""
    try:
        from ..core.flow_executor import FlowExecutor
        
        # Create flow executor with projects root
        executor = FlowExecutor("/app/projects")
        
        # Execute the flow
        result = await executor.execute_flow(
            project_id=request.project_id,
            start_node_id=request.start_node_id,
            params=request.params,
            max_workers=request.max_workers,
            timeout_sec=request.timeout_sec,
            halt_on_error=request.halt_on_error
        )
        
        return result
        
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Flow execution failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))