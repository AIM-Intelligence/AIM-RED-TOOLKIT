from pathlib import Path
from typing import Dict, Any, Optional

def create_node(project_id: str, node_id: str, node_type: str, position: Dict[str, float], 
                data: Dict[str, Any]) -> Dict[str, Any]:
    """Create a new node and corresponding python file matching React Flow structure"""
    from .project_operations import get_project_path
    from .project_structure import get_project_structure, save_project_structure
    
    project_path = get_project_path(project_id)
    
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
    structure = get_project_structure(project_id)
    
    # Check if node already exists
    if any(node['id'] == node_id for node in structure['nodes']):
        # Delete the created file if node already exists
        py_filepath.unlink()
        raise ValueError(f"Node with ID '{node_id}' already exists")
    
    # Add new node with React Flow structure
    # Ensure data has required fields
    node_data = {
        "title": data.get('title', f'Node {node_id}'),
        "description": data.get('description', ''),
        "file": py_filename,  # Add file reference to data
        **data  # Include any additional data fields
    }
    
    new_node = {
        "id": node_id,
        "type": node_type,
        "position": position,
        "data": node_data
    }
    structure['nodes'].append(new_node)
    
    save_project_structure(project_id, structure)
    
    return {
        "success": True,
        "message": f"Node '{node_title}' created successfully",
        "node": new_node
    }

def delete_node(project_id: str, node_id: str) -> Dict[str, Any]:
    """Delete a node and its corresponding python file"""
    from .project_operations import get_project_path
    from .project_structure import get_project_structure, save_project_structure
    
    project_path = get_project_path(project_id)
    
    # Get project structure
    structure = get_project_structure(project_id)
    
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
    
    save_project_structure(project_id, structure)
    
    return {
        "success": True,
        "message": f"Node '{node_id}' deleted successfully"
    }

def get_node_code(project_id: str, node_id: str) -> str:
    """Get the code content of a node's python file"""
    from .project_operations import get_project_path
    from .project_structure import get_project_structure
    
    project_path = get_project_path(project_id)
    structure = get_project_structure(project_id)
    
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

def save_node_code(project_id: str, node_id: str, code: str) -> Dict[str, Any]:
    """Save code to a node's python file"""
    from .project_operations import get_project_path
    from .project_structure import get_project_structure
    
    project_path = get_project_path(project_id)
    structure = get_project_structure(project_id)
    
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

def generate_number_param_code(
    param_name: str,
    param_label: str,
    param_description: str,
    value: float,
    min_value=None,
    max_value=None,
    step: float = 1,
    unit: str = "",
    precision: int = 2,
    integer_only: bool = False
) -> str:
    """Generate Python code for NumberParam node"""
    
    # Convert None values to Python None string
    min_value_str = "None" if min_value is None else str(min_value)
    max_value_str = "None" if max_value is None else str(max_value)
    integer_only_str = "True" if integer_only else "False"
    
    code = f'''"""
NumberValue Parameter Node
This node creates a NumberValue parameter that can be passed to other nodes
"""

from aim_params import NumberValue
from aim_params.core.metadata import UIMetadata

# Parameter configuration
param_name = "{param_name}"
param_label = "{param_label}"
param_description = "{param_description}"
value = {value}
min_value = {min_value_str}
max_value = {max_value_str}
step = {step}
unit = "{unit}"
precision = {precision}
integer_only = {integer_only_str}

# Create NumberValue parameter
param = NumberValue(
    name=param_name,
    ui_metadata=UIMetadata(
        label=param_label,
        description=param_description,
        default=value,
        required=True,
        editable=True
    ),
    value=value,
    min_value=min_value if min_value is not None else None,
    max_value=max_value if max_value is not None else None,
    step=step if step > 0 else None,
    unit=unit if unit else None,
    precision=precision if precision >= 0 else None,
    integer_only=integer_only
)

# Display parameter info
print(f"Created NumberValue parameter: {{param_name}}")
print(f"  Label: {{param_label}}")
print(f"  Value: {{param.format_display()}}")
print(f"  Range: {{min_value}} - {{max_value}}")
print(f"  Integer only: {{integer_only}}")

# Pass parameter to next nodes
output_data = {{
    "parameter": param,
    "name": param_name,
    "value": param.value,
    "metadata": {{
        "type": "NumberValue",
        "min": min_value,
        "max": max_value,
        "step": step,
        "unit": unit,
        "integer_only": integer_only
    }}
}}'''
    
    return code