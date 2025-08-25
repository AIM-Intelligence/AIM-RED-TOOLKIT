"""
Code execution module for running Python code in isolated subprocess
"""

import subprocess
import sys
import tempfile
from typing import Optional, Dict, Any
from pathlib import Path

def execute_python_code(
    code: str, 
    timeout: int = 30, 
    python_executable: Optional[str] = None, 
    working_dir: Optional[str] = None
) -> Dict[str, Any]:
    """
    Execute Python code in a secure temporary environment
    
    Args:
        code: Python code to execute
        timeout: Maximum execution time in seconds
        python_executable: Optional path to Python executable (for venv)
        working_dir: Optional working directory for execution
        
    Returns:
        Dictionary with output, error, and exit_code
    """
    try:
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as temp_file:
            temp_file.write(code)
            temp_file_path = temp_file.name
        
        try:
            # Use provided Python executable or system default
            python_exe = python_executable if python_executable else sys.executable
            
            result = subprocess.run(
                [python_exe, temp_file_path],
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=working_dir  # Set working directory if provided
            )
            
            return {
                "output": result.stdout,
                "error": result.stderr,
                "exit_code": result.returncode
            }
            
        finally:
            # Clean up temp file
            import os
            try:
                os.unlink(temp_file_path)
            except:
                pass
                
    except subprocess.TimeoutExpired:
        return {
            "output": "",
            "error": f"Execution timed out after {timeout} seconds",
            "exit_code": -1
        }
    except Exception as e:
        return {
            "output": "",
            "error": str(e),
            "exit_code": -1
        }

def get_project_venv_python(project_id: str) -> str:
    """Get the Python executable path for a project's venv"""
    import os
    venv_path = Path(f"/app/projects/{project_id}/venv")
    
    if os.name == 'nt':
        python_exe = venv_path / "Scripts" / "python.exe"
    else:
        python_exe = venv_path / "bin" / "python"
    
    if python_exe.exists():
        return str(python_exe)
    
    # Fallback to system Python
    return sys.executable