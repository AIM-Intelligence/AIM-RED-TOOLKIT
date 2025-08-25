from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
from app.api import health, project, executor_proxy
from app.core.logging import get_logger

logger = get_logger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle"""
    # Startup
    logger.info("Starting AIM Red Toolkit Backend")
    
    # Ensure projects directory exists for metadata
    from app.core.project_operations import ensure_projects_dir
    ensure_projects_dir()
    logger.info("Projects directory ready")
    
    yield
    
    # Shutdown
    logger.info("Shutting down AIM Red Toolkit Backend")
    logger.info("Shutdown complete")

app = FastAPI(
    title="AIM Red Toolkit Backend",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://frontend:5173",
        "http://localhost:3000",
        "http://frontend:3000",
        "http://localhost",
        "http://frontend"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "message": "AIM Red Toolkit Backend API",
        "status": "healthy",
        "features": {
            "lsp": "enabled",
            "pyright": "available",
            "ruff": "available"
        }
    }

# Include API routers
app.include_router(health.router, prefix="/api")
app.include_router(project.router, prefix="/api/project")

# Proxy to executor for code/venv operations
app.include_router(executor_proxy.router, prefix="/api")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)