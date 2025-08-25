from typing import Dict, Any, Optional

def create_edge(project_id: str, edge_id: str, edge_type: str, source: str, target: str, 
                marker_end: Optional[Dict] = None, source_handle: Optional[str] = None,
                target_handle: Optional[str] = None, **kwargs) -> Dict[str, Any]:
    """Create a new edge between nodes matching React Flow structure"""
    from .project_structure import get_project_structure, save_project_structure
    
    structure = get_project_structure(project_id)
    
    # Verify source and target nodes exist
    node_ids = [node['id'] for node in structure['nodes']]
    if source not in node_ids:
        raise ValueError(f"Source node '{source}' does not exist")
    if target not in node_ids:
        raise ValueError(f"Target node '{target}' does not exist")
    
    # Check if edge already exists
    if any(edge['id'] == edge_id for edge in structure['edges']):
        raise ValueError(f"Edge with ID '{edge_id}' already exists")
    
    # Add new edge with React Flow structure
    new_edge = {
        "id": edge_id,
        "type": edge_type,
        "source": source,
        "target": target,
        "sourceHandle": source_handle,  # Can be None or specific handle ID
        "targetHandle": target_handle   # Can be None or specific handle ID
    }
    
    # Add markerEnd if provided
    if marker_end:
        new_edge["markerEnd"] = marker_end
    else:
        # Default markerEnd for ReactFlow (use exact string that ReactFlow expects)
        new_edge["markerEnd"] = {"type": "arrowclosed"}
    
    # Add any additional properties
    for key, value in kwargs.items():
        if key not in ["id", "type", "source", "target", "sourceHandle", "targetHandle", "markerEnd", "source_handle", "target_handle"] and value is not None:
            new_edge[key] = value
    
    structure['edges'].append(new_edge)
    
    save_project_structure(project_id, structure)
    
    return {
        "success": True,
        "message": f"Edge '{edge_id}' created successfully",
        "edge": new_edge
    }

def delete_edge(project_id: str, edge_id: str) -> Dict[str, Any]:
    """Delete an edge"""
    from .project_structure import get_project_structure, save_project_structure
    
    structure = get_project_structure(project_id)
    
    # Check if edge exists
    if not any(edge['id'] == edge_id for edge in structure['edges']):
        raise ValueError(f"Edge with ID '{edge_id}' not found")
    
    # Remove edge
    structure['edges'] = [e for e in structure['edges'] if e['id'] != edge_id]
    
    save_project_structure(project_id, structure)
    
    return {
        "success": True,
        "message": f"Edge '{edge_id}' deleted successfully"
    }