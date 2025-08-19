from pathlib import Path
from typing import Dict, Any, Optional

def create_node(project_name: str, node_id: str, node_type: str, position: Dict[str, float], 
                data: Dict[str, Any]) -> Dict[str, Any]:
    """Create a new node and corresponding python file matching React Flow structure"""
    from .project_operations import get_project_path
    from .project_structure import get_project_structure, save_project_structure
    
    project_path = get_project_path(project_name)
    
    # Extract title from data for filename
    node_title = data.get('title', f'node_{node_id}')
    
    # Create python file for the node
    py_filename = f"{node_id}_{node_title}.py".replace(" ", "_").replace("/", "_")
    py_filepath = project_path / py_filename
    
    # Create empty python file with basic template
    initial_code = data.get('code', f"# Node: {node_title}\n# ID: {node_id}\n\n# Write your Python code here\nprint('Hello, World!')")
    with open(py_filepath, 'w') as f:
        f.write(initial_code)
    
    # Update project json
    structure = get_project_structure(project_name)
    
    # Check if node already exists
    if any(node['id'] == node_id for node in structure['nodes']):
        # Delete the created file if node already exists
        py_filepath.unlink()
        raise ValueError(f"Node with ID '{node_id}' already exists")
    
    # Add new node with React Flow structure
    new_node = {
        "id": node_id,
        "type": node_type,
        "position": position,
        "data": {
            **data,
            "file": py_filename  # Add file reference to data
        }
    }
    structure['nodes'].append(new_node)
    
    save_project_structure(project_name, structure)
    
    return {
        "success": True,
        "message": f"Node '{node_title}' created successfully",
        "node": new_node
    }

def delete_node(project_name: str, node_id: str) -> Dict[str, Any]:
    """Delete a node and its corresponding python file"""
    from .project_operations import get_project_path
    from .project_structure import get_project_structure, save_project_structure
    
    project_path = get_project_path(project_name)
    
    # Get project structure
    structure = get_project_structure(project_name)
    
    # Find node to delete
    node_to_delete = None
    for node in structure['nodes']:
        if node['id'] == node_id:
            node_to_delete = node
            break
    
    if not node_to_delete:
        raise ValueError(f"Node with ID '{node_id}' not found")
    
    # Delete python file (file reference is now in data)
    file_name = node_to_delete.get('data', {}).get('file')
    if file_name:
        py_filepath = project_path / file_name
        if py_filepath.exists():
            py_filepath.unlink()
    
    # Remove node from structure
    structure['nodes'] = [n for n in structure['nodes'] if n['id'] != node_id]
    
    # Remove any edges connected to this node
    structure['edges'] = [
        e for e in structure['edges'] 
        if e.get('source') != node_id and e.get('target') != node_id
    ]
    
    save_project_structure(project_name, structure)
    
    return {
        "success": True,
        "message": f"Node '{node_id}' deleted successfully"
    }

def get_node_code(project_name: str, node_id: str) -> str:
    """Get the code content of a node's python file"""
    from .project_operations import get_project_path
    from .project_structure import get_project_structure
    
    project_path = get_project_path(project_name)
    structure = get_project_structure(project_name)
    
    # Find node
    node = None
    for n in structure['nodes']:
        if n['id'] == node_id:
            node = n
            break
    
    if not node:
        raise ValueError(f"Node with ID '{node_id}' not found")
    
    # Read python file (file reference is now in data)
    file_name = node.get('data', {}).get('file')
    if not file_name:
        return ""
    
    py_filepath = project_path / file_name
    if not py_filepath.exists():
        return ""
    
    with open(py_filepath, 'r') as f:
        return f.read()

def save_node_code(project_name: str, node_id: str, code: str) -> Dict[str, Any]:
    """Save code to a node's python file"""
    from .project_operations import get_project_path
    from .project_structure import get_project_structure
    
    project_path = get_project_path(project_name)
    structure = get_project_structure(project_name)
    
    # Find node
    node = None
    for n in structure['nodes']:
        if n['id'] == node_id:
            node = n
            break
    
    if not node:
        raise ValueError(f"Node with ID '{node_id}' not found")
    
    # Write to python file (file reference is now in data)
    file_name = node.get('data', {}).get('file')
    if not file_name:
        raise ValueError(f"Node '{node_id}' does not have an associated file")
    
    py_filepath = project_path / file_name
    with open(py_filepath, 'w') as f:
        f.write(code)
    
    return {
        "success": True,
        "message": f"Code saved for node '{node_id}'",
        "file_path": str(py_filepath)
    }