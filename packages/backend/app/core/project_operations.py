import json
import shutil
from pathlib import Path
from typing import List, Dict, Any
from .projects_registry import (
    add_project_to_registry,
    remove_project_from_registry,
    get_projects_registry
)

PROJECTS_BASE_PATH = Path("projects")

def ensure_projects_dir() -> None:
    """Ensure the projects directory exists"""
    PROJECTS_BASE_PATH.mkdir(exist_ok=True)

def get_all_projects() -> List[Dict[str, str]]:
    """Get all projects from the projects registry"""
    registry = get_projects_registry()
    return registry["projects"]

def create_project(project_name: str, project_description: str) -> Dict[str, Any]:
    """Create a new project folder and json file"""
    ensure_projects_dir()
    project_path = PROJECTS_BASE_PATH / project_name
    
    if project_path.exists():
        raise ValueError(f"Project '{project_name}' already exists")
    
    # Add to registry first (will raise error if already exists)
    add_project_to_registry(project_name, project_description)
    
    try:
        project_path.mkdir(exist_ok=True)
        
        # Create empty project json with initial structure
        project_json_path = project_path / "structure.json"
        initial_structure = {
            "project_name": project_name,
            "project_description": project_description,
            "nodes": [],
            "edges": []
        }
        
        with open(project_json_path, 'w') as f:
            json.dump(initial_structure, f, indent=2)
        
        return {
            "success": True,
            "message": f"Project '{project_name}' created successfully",
            "project_name": project_name,
            "project_description": project_description
        }
    except Exception as e:
        # If folder creation fails, remove from registry
        remove_project_from_registry(project_name)
        raise e

def delete_project(project_name: str) -> Dict[str, Any]:
    """Delete entire project folder and remove from registry"""
    ensure_projects_dir()
    project_path = PROJECTS_BASE_PATH / project_name
    
    if not project_path.exists():
        raise ValueError(f"Project '{project_name}' does not exist")
    
    # Delete folder first
    shutil.rmtree(project_path)
    
    # Remove from registry
    try:
        remove_project_from_registry(project_name)
    except ValueError:
        # Project might not be in registry if it was created before registry system
        pass
    
    return {
        "success": True,
        "message": f"Project '{project_name}' deleted successfully"
    }

def get_project_path(project_name: str) -> Path:
    """Get the path to a project directory"""
    ensure_projects_dir()
    project_path = PROJECTS_BASE_PATH / project_name
    
    if not project_path.exists():
        raise ValueError(f"Project '{project_name}' does not exist")
    
    return project_path