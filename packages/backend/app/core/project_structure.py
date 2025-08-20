import json
from pathlib import Path
from typing import Dict, Any

def get_project_structure(project_id: str) -> Dict[str, Any]:
    """Get the node-edge structure from project json using project_id"""
    from .project_operations import get_project_path
    
    project_path = get_project_path(project_id)
    project_json_path = project_path / "structure.json"
    
    if not project_json_path.exists():
        raise ValueError(f"Project structure file for project ID '{project_id}' does not exist")
    
    with open(project_json_path, 'r') as f:
        return json.load(f)

def save_project_structure(project_id: str, structure: Dict[str, Any]) -> None:
    """Save the node-edge structure to project json using project_id"""
    from .project_operations import get_project_path
    
    project_path = get_project_path(project_id)
    project_json_path = project_path / "structure.json"
    
    with open(project_json_path, 'w') as f:
        json.dump(structure, f, indent=2)
