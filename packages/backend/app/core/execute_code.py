import subprocess
import tempfile
import os
import sys

def execute_python_code(code: str, timeout: int = 30) -> dict:
    """
    Execute Python code in a secure temporary environment
    
    Args:
        code: Python code to execute
        timeout: Maximum execution time in seconds
        
    Returns:
        Dictionary with output, error, and exit_code
    """
    try:
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as temp_file:
            temp_file.write(code)
            temp_file_path = temp_file.name
        
        try:
            result = subprocess.run(
                [sys.executable, temp_file_path],
                capture_output=True,
                text=True,
                timeout=timeout
            )
            
            return {
                "output": result.stdout,
                "error": result.stderr if result.stderr else None,
                "exit_code": result.returncode
            }
        finally:
            os.unlink(temp_file_path)
            
    except subprocess.TimeoutExpired:
        return {
            "output": "",
            "error": "Code execution timed out",
            "exit_code": -1
        }
    except Exception as e:
        return {
            "output": "",
            "error": str(e),
            "exit_code": -1
        }