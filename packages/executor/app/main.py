from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
import logging
from app.api import venv, lsp, terminal, execute, code
from app.core.lsp_manager import lsp_manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle"""
    # Startup
    logger.info("Starting AIM Red Toolkit Executor Service")
    
    # Ensure projects directory exists
    import os
    os.makedirs("/app/projects", exist_ok=True)
    logger.info("Projects directory ready")
    
    # Start LSP idle collection task
    idle_task = asyncio.create_task(lsp_manager.idle_collect())
    logger.info("Started LSP idle collection task")
    
    yield
    
    # Shutdown
    logger.info("Shutting down AIM Red Toolkit Executor Service")
    
    # Cancel idle collection task
    idle_task.cancel()
    try:
        await idle_task
    except asyncio.CancelledError:
        pass
    
    logger.info("Shutdown complete")

app = FastAPI(
    title="AIM Red Toolkit Executor Service",
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
        "http://localhost:8000",
        "http://backend:8000",
        "http://localhost",
        "http://frontend",
        "http://backend"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "service": "AIM Red Toolkit Executor",
        "status": "healthy",
        "features": {
            "venv": "enabled",
            "lsp": "enabled",
            "terminal": "enabled",
            "execution": "enabled"
        }
    }

@app.get("/health")
async def health():
    return {"status": "healthy"}

# Include API routers
app.include_router(venv.router, prefix="/api/venv")
app.include_router(code.router, prefix="/api/code")
app.include_router(execute.router, prefix="/api/execute")

# LSP endpoints (WebSocket)
app.include_router(lsp.router, prefix="/api/lsp")

# Terminal endpoint (WebSocket)
app.include_router(terminal.router, prefix="/api")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)