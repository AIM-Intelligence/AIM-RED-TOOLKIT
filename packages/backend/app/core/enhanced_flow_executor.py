"""
Enhanced Flow Executor with Object Store Support
Enables passing Python objects between nodes without JSON serialization
"""

import json
import sys
import time
import inspect
import traceback
from typing import Any, Dict, Optional, List, Set, Tuple
from pathlib import Path
from collections import defaultdict, deque

from .flow_executor import FlowExecutor
from .execute_code import execute_python_code


class EnhancedFlowExecutor(FlowExecutor):
    """Enhanced Flow Executor that supports Python object passing between nodes"""
    
    def __init__(self, projects_root: str):
        super().__init__(projects_root)
        # Object store for each project - stores Python objects that can't be JSON serialized
        self.object_stores = {}  # {project_id: {ref_id: object}}
        
    def _execute_node_isolated(
        self,
        project_id: str,
        node_id: str,
        node_data: Dict,
        input_data: Any,
        timeout: int = 30,
    ) -> Dict[str, Any]:
        """Execute node in the same process to enable object passing"""
        
        node_type = node_data.get("type", "custom")
        
        # Handle start nodes
        if node_type == "start":
            return {
                "status": "success",
                "output": None,
                "execution_time_ms": 0,
                "logs": "Start node - flow initiated",
            }
        
        # Handle result nodes
        if node_type == "result":
            # Unwrap input if it's a reference
            actual_input = self._unwrap_input(project_id, input_data)
            return {
                "status": "success",
                "output": actual_input,  # Pass through the actual value
                "execution_time_ms": 0,
                "logs": "Result node - displaying input data",
            }
        
        # Handle custom nodes with in-process execution
        try:
            start_time = time.time()
            
            # 1. Unwrap input data (convert references to actual objects)
            actual_input = self._unwrap_input(project_id, input_data)
            
            # 2. Execute node code in the same process
            result = self._execute_in_process(
                project_id, node_id, node_data, actual_input
            )
            
            # 3. Wrap output (store objects and return references if needed)
            wrapped_output = self._wrap_output(project_id, node_id, result)
            
            execution_time_ms = round((time.time() - start_time) * 1000)
            
            return {
                "status": "success",
                "output": wrapped_output,
                "execution_time_ms": execution_time_ms,
                "logs": "",
            }
            
        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "execution_time_ms": 0,
                "logs": traceback.format_exc(),
            }
    
    def _execute_in_process(
        self,
        project_id: str,
        node_id: str,
        node_data: Dict,
        input_data: Any
    ) -> Any:
        """Execute node code in the same process with a safe namespace"""
        
        # Get node file path
        file_name = node_data.get("data", {}).get("file")
        if not file_name:
            title = node_data.get("data", {}).get("title", f"Node_{node_id}")
            sanitized_title = "".join(
                c if c.isalnum() or c == "_" else "_" for c in title
            )
            file_name = f"{node_id}_{sanitized_title}.py"
        
        file_path = self.projects_root / project_id / file_name
        
        if not file_path.exists():
            raise FileNotFoundError(f"Node file '{file_name}' not found")
        
        # Read node code
        with open(file_path, 'r', encoding='utf-8') as f:
            node_code = f.read()
        
        # Create safe execution namespace
        namespace = self._create_safe_namespace(input_data)
        
        # Execute the code
        exec(node_code, namespace)
        
        # Find and execute the main function
        result = None
        function_found = False
        
        # Priority: RunScript > main > first callable
        if 'RunScript' in namespace and callable(namespace['RunScript']):
            result = self._call_function_with_input(namespace['RunScript'], input_data)
            function_found = True
        elif 'main' in namespace and callable(namespace['main']):
            result = self._call_function_with_input(namespace['main'], input_data)
            function_found = True
        else:
            # Find first callable function
            for name, obj in namespace.items():
                if callable(obj) and not name.startswith('_') and name not in [
                    'json', 'sys', 'traceback', 'inspect', 'math', 'datetime',
                    'pandas', 'pd', 'numpy', 'np'
                ]:
                    result = self._call_function_with_input(obj, input_data)
                    function_found = True
                    break
        
        if not function_found:
            raise RuntimeError("No callable function found in node")
        
        return result
    
    def _create_safe_namespace(self, input_data: Any) -> Dict:
        """Create a safe execution namespace with limited builtins"""
        
        # Safe builtins - remove dangerous functions
        safe_builtins = {
            'abs', 'all', 'any', 'bool', 'dict', 'enumerate',
            'filter', 'float', 'int', 'len', 'list', 'map',
            'max', 'min', 'print', 'range', 'round', 'set',
            'sorted', 'str', 'sum', 'tuple', 'type', 'zip',
            'isinstance', 'hasattr', 'getattr', 'setattr',
            'repr', 'hash', 'id', 'iter', 'next', 'reversed',
            '__build_class__', 'property', 'classmethod', 'staticmethod',
            'super', 'object', 'Exception', 'ValueError', 'TypeError',
            'AttributeError', 'KeyError', 'IndexError', 'RuntimeError',
            '__import__'  # Allow importing modules within node code
        }
        
        # Get the actual builtins based on how they're available
        import builtins
        
        namespace = {
            '__builtins__': {k: getattr(builtins, k) for k in safe_builtins 
                           if hasattr(builtins, k)},
            '__name__': '__main__',  # Required for class definitions
            'input_data': input_data,
            # Standard libraries
            'json': __import__('json'),
            'math': __import__('math'),
            'datetime': __import__('datetime'),
            'time': __import__('time'),
            'random': __import__('random'),
            're': __import__('re'),
            'collections': __import__('collections'),
            'itertools': __import__('itertools'),
        }
        
        # Don't import pandas/numpy here - let nodes import them if needed
        # This avoids import errors affecting all nodes
        
        return namespace
    
    def _call_function_with_input(self, func: callable, input_data: Any) -> Any:
        """Call a function with appropriate input handling"""
        
        try:
            sig = inspect.signature(func)
            params = list(sig.parameters.keys())
            
            # No parameters
            if len(params) == 0:
                return func()
            
            # If input is a dict and function expects named parameters
            if isinstance(input_data, dict) and len(params) > 1:
                # Try to map dict keys to function parameters
                kwargs = {}
                for param_name in params:
                    if param_name in input_data:
                        kwargs[param_name] = input_data[param_name]
                    elif sig.parameters[param_name].default is not inspect.Parameter.empty:
                        # Use default value if available
                        pass
                    else:
                        # Required parameter missing, fall back to single argument
                        return func(input_data)
                return func(**kwargs)
            
            # Single parameter or non-dict input
            if input_data is not None:
                return func(input_data)
            else:
                return func()
                
        except Exception:
            # Fallback: try calling with input_data or without
            if input_data is not None:
                return func(input_data)
            else:
                return func()
    
    def _unwrap_input(self, project_id: str, data: Any) -> Any:
        """Convert references to actual objects from the object store"""
        
        if data is None:
            return None
        
        # Handle reference objects
        if isinstance(data, dict):
            # Check if this is a reference object
            if data.get("type") == "reference" and "ref" in data:
                ref = data["ref"]
                if project_id in self.object_stores:
                    if ref in self.object_stores[project_id]:
                        return self.object_stores[project_id][ref]
                    else:
                        # Reference not found - return preview if available
                        return data.get("preview", None)
                return None
            
            # Recursively unwrap dict values
            unwrapped = {}
            for key, value in data.items():
                unwrapped[key] = self._unwrap_input(project_id, value)
            return unwrapped
        
        # Handle lists
        if isinstance(data, list):
            return [self._unwrap_input(project_id, item) for item in data]
        
        # Return as-is for primitive types
        return data
    
    def _wrap_output(self, project_id: str, node_id: str, data: Any) -> Any:
        """Wrap output data - use JSON for small data, references for large/complex objects"""
        
        # Primitive types pass through directly
        if data is None or isinstance(data, (bool, int, float, str)):
            return data
        
        # Try JSON serialization for small data
        try:
            json_str = json.dumps(data)
            # If serializable and under 10KB, return directly
            if len(json_str) < 10000:
                return data
        except (TypeError, ValueError):
            # Not JSON serializable, need to use reference
            pass
        
        # Store as reference for large or complex objects
        return self._store_as_reference(project_id, node_id, data)
    
    def _store_as_reference(self, project_id: str, node_id: str, data: Any) -> Dict:
        """Store an object and return a reference"""
        
        # Initialize project store if needed
        if project_id not in self.object_stores:
            self.object_stores[project_id] = {}
        
        # Generate unique reference ID
        ref_id = f"{node_id}_{int(time.time() * 1000)}"
        
        # Store the object
        self.object_stores[project_id][ref_id] = data
        
        # Return reference with metadata
        return {
            "type": "reference",
            "ref": ref_id,
            "preview": self._generate_preview(data),
            "data_type": type(data).__name__,
            "size": sys.getsizeof(data) if hasattr(data, '__sizeof__') else None
        }
    
    def _generate_preview(self, data: Any) -> str:
        """Generate a human-readable preview of the data"""
        
        try:
            # pandas DataFrame
            if hasattr(data, 'shape') and hasattr(data, 'columns'):
                return f"DataFrame: {data.shape[0]} rows × {data.shape[1]} cols"
            
            # numpy array
            elif hasattr(data, 'shape') and hasattr(data, 'ndim'):
                return f"Array: shape={data.shape}, dtype={data.dtype}"
            
            # List or tuple
            elif isinstance(data, (list, tuple)):
                preview = f"{type(data).__name__} with {len(data)} items"
                if len(data) > 0:
                    preview += f" (first: {str(data[0])[:50]})"
                return preview
            
            # Dictionary
            elif isinstance(data, dict):
                keys = list(data.keys())[:3]
                preview = f"Dict with {len(data)} keys"
                if keys:
                    preview += f" ({', '.join(str(k) for k in keys)}{'...' if len(data) > 3 else ''})"
                return preview
            
            # Set
            elif isinstance(data, set):
                return f"Set with {len(data)} items"
            
            # Custom objects
            elif hasattr(data, '__class__'):
                class_name = data.__class__.__name__
                # Try to get a meaningful representation
                if hasattr(data, '__len__'):
                    return f"{class_name} ({len(data)} items)"
                elif hasattr(data, '__str__'):
                    str_repr = str(data)[:100]
                    return f"{class_name}: {str_repr}{'...' if len(str(data)) > 100 else ''}"
                else:
                    return f"{class_name} object"
            
            # Default: string representation
            else:
                preview = str(data)[:100]
                if len(str(data)) > 100:
                    preview += "..."
                return preview
                
        except Exception as e:
            return f"{type(data).__name__} object (preview error: {str(e)[:50]})"
    
    def cleanup_project_store(self, project_id: str):
        """Clean up object store for a project"""
        
        if project_id in self.object_stores:
            # Clear all references for this project
            self.object_stores[project_id].clear()
            del self.object_stores[project_id]
    
    def get_store_info(self, project_id: str) -> Dict:
        """Get information about the object store for debugging"""
        
        if project_id not in self.object_stores:
            return {"exists": False, "count": 0, "refs": []}
        
        store = self.object_stores[project_id]
        return {
            "exists": True,
            "count": len(store),
            "refs": [
                {
                    "ref": ref,
                    "type": type(obj).__name__,
                    "size": sys.getsizeof(obj) if hasattr(obj, '__sizeof__') else None
                }
                for ref, obj in store.items()
            ]
        }