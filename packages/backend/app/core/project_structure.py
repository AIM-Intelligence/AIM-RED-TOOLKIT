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

def update_project_structure(project_id: str, nodes: list, edges: list) -> Dict[str, Any]:
    """Update the project structure with new nodes and edges"""
    from .project_operations import get_project_path
    from .node_operations import generate_number_param_code
    
    project_path = get_project_path(project_id)
    project_json_path = project_path / "structure.json"
    
    # Get existing project info
    existing_structure = get_project_structure(project_id)
    
    # Update NumberParam node Python files
    for node in nodes:
        if node.get("type") == "numberParam" and node.get("data"):
            node_data = node["data"]
            # Generate Python code for NumberParam
            code = generate_number_param_code(
                param_name=node_data.get("paramName", f"param_{node['id']}"),
                param_label=node_data.get("paramLabel", node_data.get("title", "Number Parameter")),
                param_description=node_data.get("paramDescription", node_data.get("description", "Number parameter")),
                value=node_data.get("value", 0),
                min_value=node_data.get("minValue"),
                max_value=node_data.get("maxValue"),
                step=node_data.get("step", 1),
                unit=node_data.get("unit", ""),
                precision=node_data.get("precision", 2),
                integer_only=node_data.get("integerOnly", False)
            )
            
            # Save Python file
            file_name = node_data.get("file") or f"{node['id']}_{node_data.get('title', 'Number_Param').replace(' ', '_')}.py"
            py_filepath = project_path / file_name
            with open(py_filepath, 'w') as f:
                f.write(code)
            
            # Ensure file attribute is in node data
            if "file" not in node_data:
                node_data["file"] = file_name
    
    # Create new structure
    structure = {
        "project_name": existing_structure.get("project_name", "Untitled"),
        "project_description": existing_structure.get("project_description", ""),
        "project_id": project_id,
        "nodes": nodes,
        "edges": edges
    }
    
    # Save the updated structure
    save_project_structure(project_id, structure)
    
    return structure
