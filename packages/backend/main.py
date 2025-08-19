from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from pathlib import Path

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SaveCodeRequest(BaseModel):
    project_hash: str
    project_title: str
    node_id: str
    node_title: str
    code: str

@app.get("/api/healthcheck")
async def healthcheck():
    return {"status": "healthy"}

@app.post("/api/save-code")
async def save_code(request: SaveCodeRequest):
    try:
        projects_dir = Path("projects")
        projects_dir.mkdir(exist_ok=True)
        
        project_dir = projects_dir / request.project_hash
        project_dir.mkdir(exist_ok=True)
        
        filename = f"{request.project_title}-{request.node_id}-{request.node_title}.py"
        filename = filename.replace(" ", "_").replace("/", "_")
        
        file_path = project_dir / filename
        
        with open(file_path, "w") as f:
            f.write(request.code)
        
        return {
            "success": True,
            "message": f"Code saved successfully",
            "file_path": str(file_path)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)