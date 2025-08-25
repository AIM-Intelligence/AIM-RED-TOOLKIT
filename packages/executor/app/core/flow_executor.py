"""
Flow executor for running node graphs in topological order
"""

import asyncio
import json
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional, Set
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from collections import defaultdict
from .executor import execute_python_code
from .venv_manager import AsyncVenvManager

logger = logging.getLogger(__name__)

class FlowExecutor:
    """Executes node flows with dependency management"""
    
    def __init__(self, projects_root: str):
        self.projects_root = Path(projects_root)
        self.venv_manager = AsyncVenvManager(projects_root)
    
    def get_project_structure(self, project_id: str) -> Dict[str, Any]:
        """Load project structure from JSON file"""
        project_path = self.projects_root / project_id
        structure_file = project_path / "structure.json"
        
        if not structure_file.exists():
            raise FileNotFoundError(f"Project structure not found for {project_id}")
        
        with open(structure_file, 'r') as f:
            return json.load(f)
    
    def get_node_code(self, project_id: str, node_id: str) -> str:
        """Get the code for a node from its file"""
        project_dir = self.projects_root / project_id
        
        # Try to find the node file with pattern node_id_*.py
        for file_path in project_dir.glob(f"{node_id}_*.py"):
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read()
        
        # Try exact match
        exact_file = project_dir / f"{node_id}.py"
        if exact_file.exists():
            with open(exact_file, 'r', encoding='utf-8') as f:
                return f.read()
        
        return ""  # Return empty for nodes without code (start, result)
    
    def build_dependency_graph(self, nodes: List[Dict], edges: List[Dict]) -> Dict[str, Set[str]]:
        """Build a dependency graph from edges"""
        dependencies = defaultdict(set)
        
        for edge in edges:
            target = edge['target']
            source = edge['source']
            dependencies[target].add(source)
        
        # Ensure all nodes are in the graph
        for node in nodes:
            if node['id'] not in dependencies:
                dependencies[node['id']] = set()
        
        return dependencies
    
    def topological_sort(self, dependencies: Dict[str, Set[str]]) -> List[str]:
        """Perform topological sort to determine execution order"""
        in_degree = defaultdict(int)
        graph = defaultdict(list)
        
        # Build adjacency list and calculate in-degrees
        for node, deps in dependencies.items():
            in_degree[node] = len(deps)
            for dep in deps:
                graph[dep].append(node)
        
        # Find nodes with no dependencies
        queue = [node for node, degree in in_degree.items() if degree == 0]
        result = []
        
        while queue:
            node = queue.pop(0)
            result.append(node)
            
            # Reduce in-degree for dependent nodes
            for neighbor in graph[node]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)
        
        # Check for cycles
        if len(result) != len(dependencies):
            raise ValueError("Cycle detected in flow graph")
        
        return result
    
    async def execute_node(self, project_id: str, node_id: str, node_type: str, 
                          input_data: Any, timeout: int = 30) -> Any:
        """Execute a single node and return its output"""
        
        # Special handling for non-custom nodes
        if node_type == 'start':
            return input_data  # Pass through initial params
        elif node_type == 'result':
            return input_data  # Pass through the result
        
        # Get node code
        code = self.get_node_code(project_id, node_id)
        if not code:
            logger.warning(f"No code found for node {node_id}, returning input")
            return input_data
        
        # Create wrapper to execute the node with input data
        input_json_str = json.dumps(input_data) if input_data is not None else 'null'
        
        wrapper_code = f"""
import json
import sys

# Node code
{code}

# Execute with input
try:
    input_json = '''{input_json_str}'''
    if input_json != 'null':
        input_data = json.loads(input_json)
    else:
        input_data = None
    
    # Find and execute main function
    if 'main' in locals() and callable(main):
        result = main(input_data) if input_data is not None else main()
    else:
        # Find first callable that's not a builtin
        result = None
        for name, obj in list(locals().items()):
            if callable(obj) and not name.startswith('_') and name not in ['json', 'sys']:
                result = obj(input_data) if input_data is not None else obj()
                break
        
        if result is None:
            result = input_data  # Pass through if no function found
    
    print(json.dumps({{'success': True, 'output': result}}))
except Exception as e:
    import traceback
    print(json.dumps({{
        'success': False,
        'error': str(e),
        'traceback': traceback.format_exc()
    }}))
"""
        
        # Execute using project's virtual environment
        python_exe = self.venv_manager.get_python_executable(project_id)
        project_dir = str(self.projects_root / project_id)
        
        execution_result = execute_python_code(
            wrapper_code, 
            timeout=timeout, 
            python_executable=python_exe, 
            working_dir=project_dir
        )
        
        if execution_result['exit_code'] == 0:
            try:
                output = json.loads(execution_result['output'])
                if output.get('success'):
                    return output.get('output')
                else:
                    raise RuntimeError(f"Node {node_id} failed: {output.get('error', 'Unknown error')}")
            except json.JSONDecodeError:
                raise RuntimeError(f"Failed to parse output from node {node_id}: {execution_result['output']}")
        else:
            raise RuntimeError(f"Node {node_id} execution failed: {execution_result.get('error', 'Unknown error')}")
    
    async def execute_flow(self, project_id: str, start_node_id: Optional[str] = None,
                          params: Dict[str, Any] = None, max_workers: int = 4,
                          timeout_sec: int = 30, halt_on_error: bool = True) -> Dict[str, Any]:
        """Execute the entire flow starting from a given node"""
        
        # Check if venv exists
        if not self.venv_manager.venv_exists(project_id):
            return {
                "success": False,
                "error": f"Virtual environment not found for project {project_id}"
            }
        
        # Load project structure
        structure = self.get_project_structure(project_id)
        nodes = {node['id']: node for node in structure['nodes']}
        edges = structure['edges']
        
        # Find start node if not specified
        if not start_node_id:
            start_nodes = [n for n in nodes.values() if n.get('type') == 'start']
            if not start_nodes:
                return {
                    "success": False,
                    "error": "No start node found in project"
                }
            start_node_id = start_nodes[0]['id']
        
        if start_node_id not in nodes:
            return {
                "success": False,
                "error": f"Start node {start_node_id} not found"
            }
        
        # Build dependency graph
        dependencies = self.build_dependency_graph(list(nodes.values()), edges)
        
        # Get execution order
        try:
            execution_order = self.topological_sort(dependencies)
        except ValueError as e:
            return {
                "success": False,
                "error": str(e)
            }
        
        # Find nodes reachable from start node
        reachable = set()
        to_visit = [start_node_id]
        edge_map = defaultdict(list)
        
        for edge in edges:
            edge_map[edge['source']].append(edge['target'])
        
        while to_visit:
            current = to_visit.pop(0)
            if current not in reachable:
                reachable.add(current)
                to_visit.extend(edge_map[current])
        
        # Filter execution order to only reachable nodes
        execution_order = [n for n in execution_order if n in reachable]
        
        # Execute nodes
        results = {}
        node_outputs = {}
        errors = []
        
        try:
            for node_id in execution_order:
                node = nodes[node_id]
                node_type = node.get('type', 'custom')
                
                # Determine input data
                if node_id == start_node_id:
                    input_data = params
                else:
                    # Get input from dependencies
                    deps = dependencies[node_id]
                    if len(deps) == 0:
                        input_data = None
                    elif len(deps) == 1:
                        dep_id = list(deps)[0]
                        input_data = node_outputs.get(dep_id)
                    else:
                        # Multiple dependencies - combine outputs
                        input_data = {dep_id: node_outputs.get(dep_id) for dep_id in deps}
                
                try:
                    # Execute the node
                    output = await self.execute_node(
                        project_id, node_id, node_type, input_data, timeout_sec
                    )
                    
                    node_outputs[node_id] = output
                    results[node_id] = {
                        "success": True,
                        "output": output,
                        "type": node_type
                    }
                    
                except Exception as e:
                    error_msg = str(e)
                    errors.append({
                        "node_id": node_id,
                        "error": error_msg
                    })
                    results[node_id] = {
                        "success": False,
                        "error": error_msg,
                        "type": node_type
                    }
                    
                    if halt_on_error:
                        break
            
            # Find result nodes
            result_nodes = [n for n in nodes.values() 
                          if n.get('type') == 'result' and n['id'] in reachable]
            
            # Collect outputs from result nodes
            final_outputs = {}
            for result_node in result_nodes:
                node_id = result_node['id']
                if node_id in node_outputs:
                    final_outputs[node_id] = node_outputs[node_id]
            
            return {
                "success": len(errors) == 0,
                "execution_order": execution_order,
                "results": results,
                "final_outputs": final_outputs,
                "errors": errors if errors else None
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Flow execution failed: {str(e)}",
                "execution_order": execution_order,
                "results": results
            }