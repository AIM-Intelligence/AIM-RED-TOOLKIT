"""
Proxy API calls to executor service
"""

from fastapi import APIRouter, HTTPException, Request, Response
import httpx
import os
from typing import Any, Dict
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# Get executor URL from environment
EXECUTOR_URL = os.getenv("EXECUTOR_URL", "http://executor:8001")

async def proxy_to_executor(
    path: str,
    method: str = "POST",
    json_data: Dict[str, Any] = None,
    params: Dict[str, Any] = None
):
    """Proxy a request to the executor service"""
    url = f"{EXECUTOR_URL}/api/{path}"
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.request(
                method=method,
                url=url,
                json=json_data,
                params=params,
                timeout=30.0
            )
            
            if response.status_code >= 400:
                logger.error(f"Executor error: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=response.text
                )
            
            return response.json()
            
    except httpx.RequestError as e:
        logger.error(f"Error connecting to executor: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Executor service unavailable: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error proxying to executor: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal error: {str(e)}"
        )

# Code endpoints
@router.post("/code/getcode")
async def get_node_code(request: Request):
    """Proxy get node code to executor"""
    json_data = await request.json()
    return await proxy_to_executor("code/getcode", json_data=json_data)

@router.post("/code/savecode")
async def save_node_code(request: Request):
    """Proxy save node code to executor"""
    json_data = await request.json()
    return await proxy_to_executor("code/savecode", json_data=json_data)

@router.post("/code/execute-node")
async def execute_node(request: Request):
    """Proxy execute node to executor"""
    json_data = await request.json()
    return await proxy_to_executor("execute/node", json_data=json_data)


# Venv endpoints
@router.get("/project/{project_id}/venv-status")
async def get_venv_status(project_id: str):
    """Proxy venv status to executor"""
    return await proxy_to_executor(
        f"venv/status",
        method="GET",
        params={"project_id": project_id}
    )

@router.post("/venv/create")
async def create_venv(request: Request):
    """Proxy venv creation to executor"""
    json_data = await request.json()
    return await proxy_to_executor("venv/create", json_data=json_data)

# Create venv when project is created
async def create_project_venv(project_id: str):
    """Tell executor to create venv for new project"""
    try:
        result = await proxy_to_executor(
            "venv/create",
            json_data={"project_id": project_id}
        )
        logger.info(f"Venv creation initiated for project {project_id}: {result}")
        return result
    except Exception as e:
        logger.error(f"Failed to create venv for project {project_id}: {e}")
        # Don't fail project creation if venv fails
        return {"success": False, "error": str(e)}