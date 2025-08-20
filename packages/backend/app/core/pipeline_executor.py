import json
import pickle
import base64
import tempfile
import subprocess
import sys
import os
from typing import Dict, Any, List, Optional
from pathlib import Path
from .project_structure import get_project_structure
from .node_operations import get_node_code

def serialize_object(obj: Any, use_pickle: bool = True) -> Dict[str, Any]:
    """
    Serialize Python object for inter-node communication
    
    Args:
        obj: Python object to serialize
        use_pickle: If True, use pickle for complex objects. If False, use JSON
    
    Returns:
        Dictionary with serialization metadata and data
    """
    if not use_pickle or isinstance(obj, (dict, list, str, int, float, bool, type(None))):
        # Use JSON for simple types
        try:
            json.dumps(obj)  # Test if JSON serializable
            return {
                "type": "json",
                "data": obj
            }
        except (TypeError, ValueError):
            pass
    
    # Use pickle for complex objects
    try:
        pickled = pickle.dumps(obj)
        encoded = base64.b64encode(pickled).decode('utf-8')
        return {
            "type": "pickle",
            "data": encoded,
            "class": obj.__class__.__name__ if hasattr(obj, '__class__') else "unknown"
        }
    except Exception as e:
        # Fallback to string representation
        return {
            "type": "str",
            "data": str(obj),
            "error": str(e)
        }

def deserialize_object(serialized: Dict[str, Any]) -> Any:
    """
    Deserialize object from inter-node communication
    
    Args:
        serialized: Serialized object dictionary
    
    Returns:
        Original Python object
    """
    if not isinstance(serialized, dict) or "type" not in serialized:
        return serialized
    
    obj_type = serialized.get("type")
    data = serialized.get("data")
    
    if obj_type == "json":
        return data
    elif obj_type == "pickle":
        try:
            decoded = base64.b64decode(data)
            return pickle.loads(decoded)
        except Exception as e:
            print(f"Warning: Failed to deserialize pickle object: {e}")
            return data
    elif obj_type == "str":
        return data
    else:
        return serialized

def execute_pipeline(project_id: str, use_pickle: bool = True) -> Dict[str, Any]:
    """
    Execute all nodes in a pipeline following the edge connections
    """
    try:
        # Get project structure
        structure = get_project_structure(project_id)
        nodes = structure.get("nodes", [])
        edges = structure.get("edges", [])
        
        if not nodes:
            return {
                "success": False,
                "error": "No nodes in project",
                "results": []
            }
        
        # Build dependency graph
        node_map = {node["id"]: node for node in nodes}
        dependencies = {}
        for edge in edges:
            source = edge["source"]
            target = edge["target"]
            if target not in dependencies:
                dependencies[target] = []
            dependencies[target].append(source)
        
        # Find execution order (topological sort)
        execution_order = []
        visited = set()
        
        def visit(node_id):
            if node_id in visited:
                return
            visited.add(node_id)
            
            # Visit dependencies first
            if node_id in dependencies:
                for dep in dependencies[node_id]:
                    visit(dep)
            
            execution_order.append(node_id)
        
        # Visit all nodes
        for node in nodes:
            visit(node["id"])
        
        # Execute nodes in order
        results = []
        node_outputs = {}  # Store outputs for data passing
        
        for node_id in execution_order:
            node = node_map.get(node_id)
            if not node:
                continue
                
            node_title = node["data"].get("title", f"Node {node_id}")
            
            try:
                # Get node code
                code = get_node_code(project_id, node_id)
                
                # Prepare input data from dependencies
                input_data = {}
                if node_id in dependencies:
                    for dep_id in dependencies[node_id]:
                        if dep_id in node_outputs:
                            # Find edge to get targetHandle information
                            target_handle = None
                            for edge in edges:
                                if edge.get('source') == dep_id and edge.get('target') == node_id:
                                    target_handle = edge.get('targetHandle')
                                    break
                            
                            # Use targetHandle as key if available, otherwise use node_id
                            # node_outputs already contains serialized data, pass it directly
                            if target_handle:
                                input_data[target_handle] = node_outputs[dep_id]
                                print(f"Debug: Added input '{target_handle}' from node {dep_id}")
                            else:
                                input_data[f"node_{dep_id}"] = node_outputs[dep_id]
                                print(f"Debug: Added input 'node_{dep_id}' from node {dep_id}")
                
                # Create execution code with data passing
                execution_code = f"""
import json
import pickle
import base64
import sys
import os

# Add project root and AIM-RedLab to Python path
# Using absolute path for the project
project_root = '/Users/kwontaeyoun/Desktop/AIM/AIM-RED-TOOLKIT'
aim_redlab_path = os.path.join(project_root, 'AIM-RedLab')

if project_root not in sys.path:
    sys.path.insert(0, project_root)
if aim_redlab_path not in sys.path:
    sys.path.insert(0, aim_redlab_path)

# Deserialization helper
def deserialize_object(serialized):
    if not isinstance(serialized, dict) or "type" not in serialized:
        return serialized
    
    obj_type = serialized.get("type")
    data = serialized.get("data")
    
    if obj_type == "json":
        return data
    elif obj_type == "pickle":
        try:
            decoded = base64.b64decode(data)
            return pickle.loads(decoded)
        except Exception as e:
            print(f"Warning: Failed to deserialize: {{e}}", file=sys.stderr)
            return data
    elif obj_type == "str":
        return data
    else:
        return serialized

# Serialization helper
def serialize_object(obj, use_pickle=True):
    if not use_pickle or isinstance(obj, (dict, list, str, int, float, bool, type(None))):
        try:
            json.dumps(obj)
            return {{"type": "json", "data": obj}}
        except (TypeError, ValueError):
            pass
    
    try:
        pickled = pickle.dumps(obj)
        encoded = base64.b64encode(pickled).decode('utf-8')
        return {{
            "type": "pickle",
            "data": encoded,
            "class": obj.__class__.__name__ if hasattr(obj, '__class__') else "unknown"
        }}
    except Exception as e:
        return {{"type": "str", "data": str(obj), "error": str(e)}}

# Input data from previous nodes - deserialize each input separately
input_data_deserialized = {{}}
for key, value in ({json.dumps(input_data)}).items():
    input_data_deserialized[key] = deserialize_object(value)
input_data = input_data_deserialized

# Output data to pass to next nodes
output_data = {{}}

# User code
{code}

# Serialize and output the result
output_serialized = serialize_object(output_data, use_pickle={use_pickle})
print("___OUTPUT_DATA_START___")
print(json.dumps(output_serialized))
print("___OUTPUT_DATA_END___")
"""
                
                # Execute code
                with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as temp_file:
                    temp_file.write(execution_code)
                    temp_file_path = temp_file.name
                    
                # Debug: save execution code for inspection
                import shutil
                debug_path = f"/tmp/debug_node_{node_id}.py"
                shutil.copy(temp_file_path, debug_path)
                print(f"Debug: Saved execution code to {debug_path}")
                
                try:
                    result = subprocess.run(
                        [sys.executable, temp_file_path],
                        capture_output=True,
                        text=True,
                        timeout=30
                    )
                    
                    output = result.stdout
                    error = result.stderr if result.stderr else None
                    
                    # Extract output data
                    output_data = {}
                    output_data_raw = None
                    if "___OUTPUT_DATA_START___" in output and "___OUTPUT_DATA_END___" in output:
                        start = output.index("___OUTPUT_DATA_START___") + len("___OUTPUT_DATA_START___")
                        end = output.index("___OUTPUT_DATA_END___")
                        data_str = output[start:end].strip()
                        try:
                            # Parse serialized output
                            output_data_raw = json.loads(data_str)
                            # Store serialized form for next nodes
                            node_outputs[node_id] = output_data_raw
                            # Deserialize for display
                            output_data = deserialize_object(output_data_raw)
                        except:
                            pass
                        
                        # Clean output
                        output = output[:output.index("___OUTPUT_DATA_START___")].strip()
                    else:
                        node_outputs[node_id] = {"type": "json", "data": {}}
                    
                    # Prepare result with metadata
                    result_data = {
                        "node_id": node_id,
                        "node_title": node_title,
                        "output": output,
                        "error": error,
                        "exit_code": result.returncode,
                        "output_data": output_data
                    }
                    
                    # Add serialization info if using pickle
                    if output_data_raw and output_data_raw.get("type") == "pickle":
                        result_data["output_type"] = "object"
                        result_data["output_class"] = output_data_raw.get("class", "unknown")
                    else:
                        result_data["output_type"] = "json"
                    
                    results.append(result_data)
                    
                finally:
                    os.unlink(temp_file_path)
                    
            except subprocess.TimeoutExpired:
                results.append({
                    "node_id": node_id,
                    "node_title": node_title,
                    "output": "",
                    "error": "Code execution timed out",
                    "exit_code": -1,
                    "output_data": {}
                })
            except Exception as e:
                results.append({
                    "node_id": node_id,
                    "node_title": node_title,
                    "output": "",
                    "error": str(e),
                    "exit_code": -1,
                    "output_data": {}
                })
        
        return {
            "success": True,
            "results": results,
            "execution_order": execution_order
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "results": []
        }