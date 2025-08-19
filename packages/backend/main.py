from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import health, code, project

app = FastAPI(title="AIM Red Toolkit Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://frontend:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "AIM Red Toolkit Backend API", "status": "healthy"}

app.include_router(health.router, prefix="/api")
app.include_router(code.router, prefix="/api/code")
app.include_router(project.router, prefix="/api/project")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)