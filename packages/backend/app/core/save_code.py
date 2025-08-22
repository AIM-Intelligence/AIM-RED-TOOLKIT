import os
from pathlib import Path

def save_project_code(project_hash: str, project_title: str, node_id: str, node_title: str, code: str) -> dict:
    """
    Save code to a project-specific directory
    
    Args:
        project_hash: Unique project identifier
        project_title: Project title for filename
        node_id: Node identifier
        node_title: Node title for filename
        code: Code content to save
        
    Returns:
        Dictionary with success status and file path
    """
    # Get absolute path to projects directory
    projects_dir = Path(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))) / "projects"
    projects_dir.mkdir(exist_ok=True)
    
    project_dir = projects_dir / project_hash
    project_dir.mkdir(exist_ok=True)
    
    filename = f"{project_title}-{node_id}-{node_title}.py"
    filename = filename.replace(" ", "_").replace("/", "_")
    
    file_path = project_dir / filename
    
    with open(file_path, "w") as f:
        f.write(code)
    
    return {
        "success": True,
        "message": "Code saved successfully",
        "file_path": str(file_path)
    }