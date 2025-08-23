from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Any, Dict, List
from ..core.execute_code import execute_python_code
from ..core import node_operations
from ..core.venv_manager import VenvManager
import os

router = APIRouter()

# Initialize VenvManager with projects root
PROJECTS_ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "projects")
venv_manager = VenvManager(PROJECTS_ROOT)

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

class ExecuteNodeRequest(BaseModel):
    project_id: str
    node_id: str
    input_data: Optional[Dict[str, Any]] = None

class PackageInstallRequest(BaseModel):
    project_id: str
    package: str

class PackageUninstallRequest(BaseModel):
    project_id: str
    package: str

class GetPackagesRequest(BaseModel):
    project_id: str

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
            "code": """
            # Write your logic in function.
            # The function name can be changed arbitrarily,
            # but only one function is allowed per node.
            # To pass the return value of this function to the next node,
            # a return statement must be present.
            # The data format and type of input_data should be defined
            # at the beginning of the function and used accordingly.
            # (Using typing or Pydantic is recommended.)

            def main(input_data=None):
                output_data = input_data
                return output_data
            """,
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

@router.post("/execute-node")
async def execute_single_node(request: ExecuteNodeRequest):
    """Execute a single node and return its output"""
    try:
        # Get the node's code
        code = node_operations.get_node_code(request.project_id, request.node_id)
        
        # Create wrapper to execute the node with input data
        import json
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
        
        # Execute the code using project's virtual environment
        # Virtual environment should already exist (created with project)
        if not venv_manager.venv_exists(request.project_id):
            return {
                "success": False,
                "error": f"Virtual environment not found for project {request.project_id}. Please recreate the project.",
                "node_id": request.node_id
            }
        
        python_exe = venv_manager.get_python_executable(request.project_id)
        project_dir = os.path.join(PROJECTS_ROOT, request.project_id)
        execution_result = execute_python_code(wrapper_code, timeout=30, python_executable=python_exe, working_dir=project_dir)
        
        if execution_result['exit_code'] == 0:
            try:
                import json
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
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/packages/install")
async def install_package(request: PackageInstallRequest):
    """Install a package in the project's virtual environment"""
    try:
        success, message = venv_manager.install_package(request.project_id, request.package)
        return {
            "success": success,
            "message": message,
            "project_id": request.project_id,
            "package": request.package
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/packages/uninstall")
async def uninstall_package(request: PackageUninstallRequest):
    """Uninstall a package from the project's virtual environment"""
    try:
        success, message = venv_manager.uninstall_package(request.project_id, request.package)
        return {
            "success": success,
            "message": message,
            "project_id": request.project_id,
            "package": request.package
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/packages/list")
async def get_packages(request: GetPackagesRequest):
    """Get list of installed packages in the project's virtual environment"""
    try:
        packages = venv_manager.get_installed_packages(request.project_id)
        return {
            "success": True,
            "project_id": request.project_id,
            "packages": packages,
            "python_executable": venv_manager.get_python_executable(request.project_id)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/packages/info")
async def get_package_info(project_id: str, package: str):
    """Get detailed information about a specific package"""
    try:
        info = venv_manager.get_package_info(project_id, package)
        if info:
            return {
                "success": True,
                "project_id": project_id,
                "package": package,
                "info": info
            }
        else:
            raise HTTPException(status_code=404, detail=f"Package {package} not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))