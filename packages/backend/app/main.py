from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import subprocess
import tempfile
import os
import sys
from typing import Optional

app = FastAPI(title="Python IDE Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://frontend:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CodeExecutionRequest(BaseModel):
    code: str
    language: str = "python"
    timeout: Optional[int] = 30

class CodeExecutionResponse(BaseModel):
    output: str
    error: Optional[str] = None
    exit_code: int

@app.get("/")
async def root():
    return {"message": "Python IDE Backend API", "status": "healthy"}

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "backend"}

@app.post("/api/execute", response_model=CodeExecutionResponse)
async def execute_code(request: CodeExecutionRequest):
    """
    Execute Python code in a secure environment
    """
    if request.language != "python":
        raise HTTPException(status_code=400, detail="Only Python is supported")
    
    try:
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as temp_file:
            temp_file.write(request.code)
            temp_file_path = temp_file.name
        
        try:
            result = subprocess.run(
                [sys.executable, temp_file_path],
                capture_output=True,
                text=True,
                timeout=request.timeout
            )
            
            return CodeExecutionResponse(
                output=result.stdout,
                error=result.stderr if result.stderr else None,
                exit_code=result.returncode
            )
        finally:
            os.unlink(temp_file_path)
            
    except subprocess.TimeoutExpired:
        return CodeExecutionResponse(
            output="",
            error="Code execution timed out",
            exit_code=-1
        )
    except Exception as e:
        return CodeExecutionResponse(
            output="",
            error=str(e),
            exit_code=-1
        )

@app.get("/api/version")
async def get_version():
    return {
        "python_version": sys.version,
        "api_version": "1.0.0"
    }