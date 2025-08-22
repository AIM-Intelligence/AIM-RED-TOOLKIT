from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
from app.api import health, code, project, lsp, lsp_debug
from app.core.lsp_manager import lsp_manager
from app.core.logging import get_logger

logger = get_logger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle"""
    # Startup
    logger.info("Starting AIM Red Toolkit Backend")
    
    # Start LSP idle collection task
    idle_task = asyncio.create_task(lsp_manager.idle_collect())
    logger.info("Started LSP idle collection task")
    
    yield
    
    # Shutdown
    logger.info("Shutting down AIM Red Toolkit Backend")
    
    # Cancel idle collection task
    idle_task.cancel()
    try:
        await idle_task
    except asyncio.CancelledError:
        pass
    
    # Stop all LSP processes gracefully
    # Note: This is handled by process cleanup, but we can add explicit cleanup if needed
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
app.include_router(code.router, prefix="/api/code")
app.include_router(project.router, prefix="/api/project")

# LSP endpoints (WebSocket and management)
app.include_router(lsp.router, prefix="/api/lsp")
app.include_router(lsp_debug.router, prefix="/api/lsp")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)