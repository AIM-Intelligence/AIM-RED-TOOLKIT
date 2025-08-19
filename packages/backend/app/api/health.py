from fastapi import APIRouter
import sys

router = APIRouter()

@router.get("/health")
async def health_check():
    return {"status": "healthy", "service": "backend"}

@router.get("/version")
async def get_version():
    return {
        "python_version": sys.version,
        "api_version": "1.0.0"
    }