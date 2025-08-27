from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from pathlib import Path
import json
import shutil

router = APIRouter()

# Templates directory
TEMPLATES_DIR = Path(__file__).parent.parent.parent / "templates"
PROJECTS_ROOT = Path(__file__).parent.parent.parent / "projects"

class ComponentTemplate(BaseModel):
    id: str
    name: str
    description: str
    icon: str
    template: str
    category: str

class CreateFromTemplateRequest(BaseModel):
    project_id: str
    node_id: str
    template_name: str
    title: str
    description: Optional[str] = ""

class ComponentLibraryResponse(BaseModel):
    success: bool
    templates: List[Dict[str, Any]]

@router.get("/library")
async def get_component_library():
    """Get list of available component templates"""
    try:
        templates = []
        
        # List all template files
        if TEMPLATES_DIR.exists():
            for template_file in TEMPLATES_DIR.glob("*.py"):
                template_name = template_file.stem
                
                # Read first few lines to get description
                with open(template_file, 'r') as f:
                    lines = f.readlines()
                    description = ""
                    for line in lines[:10]:
                        if line.strip().startswith('"""'):
                            continue
                        if '"""' in line:
                            break
                        if line.strip():
                            description = line.strip()
                            break
                
                templates.append({
                    "name": template_name,
                    "description": description,
                    "file": template_file.name
                })
        
        return {
            "success": True,
            "templates": templates
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/create-from-template")
async def create_node_from_template(request: CreateFromTemplateRequest):
    """Create a new node from a component template"""
    try:
        # Get project directory
        project_dir = PROJECTS_ROOT / request.project_id
        if not project_dir.exists():
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Get template file
        template_file = TEMPLATES_DIR / f"{request.template_name}.py"
        if not template_file.exists():
            raise HTTPException(status_code=404, detail=f"Template '{request.template_name}' not found")
        
        # Create node file name
        sanitized_title = "".join(c if c.isalnum() or c == "_" else "_" for c in request.title)
        node_file_name = f"{request.node_id}_{sanitized_title}.py"
        node_file_path = project_dir / node_file_name
        
        # Copy template to node file
        shutil.copy(template_file, node_file_path)
        
        # Update structure.json to add the node
        structure_file = project_dir / "structure.json"
        if structure_file.exists():
            with open(structure_file, 'r') as f:
                structure = json.load(f)
        else:
            structure = {"nodes": [], "edges": []}
        
        # Determine node type based on template
        node_type = "custom"
        if "start" in request.template_name.lower():
            node_type = "start"
        elif "result" in request.template_name.lower():
            node_type = "result"
        
        # Add node to structure
        new_node = {
            "id": request.node_id,
            "type": node_type,
            "position": {"x": 250, "y": 100},  # Default position
            "data": {
                "title": request.title,
                "description": request.description or f"Created from {request.template_name} template",
                "file": node_file_name
            }
        }
        
        # Check if node already exists
        node_exists = False
        for i, node in enumerate(structure["nodes"]):
            if node["id"] == request.node_id:
                structure["nodes"][i] = new_node
                node_exists = True
                break
        
        if not node_exists:
            structure["nodes"].append(new_node)
        
        # Save updated structure
        with open(structure_file, 'w') as f:
            json.dump(structure, f, indent=2)
        
        return {
            "success": True,
            "node_id": request.node_id,
            "file_name": node_file_name,
            "message": f"Node created from template '{request.template_name}'"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/template/{template_name}")
async def get_template_code(template_name: str):
    """Get the code content of a specific template"""
    try:
        template_file = TEMPLATES_DIR / f"{template_name}.py"
        if not template_file.exists():
            raise HTTPException(status_code=404, detail=f"Template '{template_name}' not found")
        
        with open(template_file, 'r') as f:
            code = f.read()
        
        return {
            "success": True,
            "template_name": template_name,
            "code": code
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))