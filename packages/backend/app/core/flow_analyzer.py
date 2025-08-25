"""
Flow Analyzer Module
Analyzes node-based flow structures for execution planning
"""

from typing import Dict, List, Set, Tuple, Optional
from collections import defaultdict, deque


class FlowAnalyzer:
    """Static methods for analyzing flow DAG structures"""
    
    @staticmethod
    def find_start_nodes(nodes: List[Dict]) -> List[str]:
        """Find all start nodes in the project"""
        return [
            node['id'] for node in nodes
            if node.get('type') == 'start'
        ]
    
    @staticmethod
    def find_result_nodes(nodes: List[Dict]) -> List[str]:
        """Find all result nodes in the project"""
        return [
            node['id'] for node in nodes
            if node.get('type') == 'result'
        ]
    
    @staticmethod
    def build_adjacency_list(
        nodes: Dict[str, Dict],
        edges: List[Dict]
    ) -> Dict[str, List[Tuple[str, Optional[str]]]]:
        """Build adjacency list from edges with parameter mapping"""
        adjacency = defaultdict(list)
        
        for edge in edges:
            source = edge.get('source')
            target = edge.get('target')
            
            if source in nodes and target in nodes:
                # Extract parameter name if exists
                param = None
                if edge.get('data') and isinstance(edge['data'], dict):
                    param = edge['data'].get('param')
                
                adjacency[source].append((target, param))
        
        return dict(adjacency)
    
    @staticmethod
    def extract_reachable_subgraph(
        start_id: str,
        nodes: Dict[str, Dict],
        edges: List[Dict]
    ) -> Tuple[Set[str], Dict[str, List[Tuple[str, Optional[str]]]]]:
        """
        Extract nodes reachable from a given start node
        
        Returns:
            - Set of reachable node IDs
            - Adjacency list for the subgraph
        """
        # Build full adjacency list
        adjacency = FlowAnalyzer.build_adjacency_list(nodes, edges)
        
        # BFS to find reachable nodes
        reachable = set()
        queue = deque([start_id])
        
        while queue:
            current = queue.popleft()
            if current in reachable:
                continue
            
            reachable.add(current)
            
            # Add all targets to queue
            if current in adjacency:
                for target, _ in adjacency[current]:
                    if target not in reachable:
                        queue.append(target)
        
        # Filter adjacency list to only include reachable nodes
        subgraph_adjacency = {}
        for node in reachable:
            if node in adjacency:
                subgraph_adjacency[node] = [
                    (target, param)
                    for target, param in adjacency[node]
                    if target in reachable
                ]
        
        return reachable, subgraph_adjacency
    
    @staticmethod
    def topological_sort(
        nodes: Set[str],
        adjacency: Dict[str, List[Tuple[str, Optional[str]]]]
    ) -> List[str]:
        """
        Perform topological sort on the DAG
        
        Returns:
            Sorted list of node IDs in execution order
            
        Raises:
            ValueError: If a cycle is detected
        """
        # Calculate in-degrees
        in_degree = {node: 0 for node in nodes}
        
        for node in nodes:
            if node in adjacency:
                for target, _ in adjacency[node]:
                    if target in nodes:
                        in_degree[target] += 1
        
        # Kahn's algorithm
        queue = deque([node for node in nodes if in_degree[node] == 0])
        sorted_order = []
        
        while queue:
            current = queue.popleft()
            sorted_order.append(current)
            
            if current in adjacency:
                for target, _ in adjacency[current]:
                    if target in nodes:
                        in_degree[target] -= 1
                        if in_degree[target] == 0:
                            queue.append(target)
        
        # Check for cycles
        if len(sorted_order) != len(nodes):
            # Find nodes involved in cycle
            remaining = nodes - set(sorted_order)
            raise ValueError(f"Cycle detected involving nodes: {remaining}")
        
        return sorted_order
    
    @staticmethod
    def detect_cycles(
        nodes: Set[str],
        adjacency: Dict[str, List[Tuple[str, Optional[str]]]]
    ) -> bool:
        """
        Detect if there are any cycles in the graph
        
        Returns:
            True if cycle exists, False otherwise
        """
        try:
            FlowAnalyzer.topological_sort(nodes, adjacency)
            return False
        except ValueError:
            return True
    
    @staticmethod
    def find_independent_branches(
        nodes: Set[str],
        adjacency: Dict[str, List[Tuple[str, Optional[str]]]]
    ) -> List[Set[str]]:
        """
        Find groups of nodes that can be executed in parallel
        
        Returns:
            List of node sets, where each set can be executed in parallel
        """
        # Calculate in-degrees
        in_degree = {node: 0 for node in nodes}
        
        for node in nodes:
            if node in adjacency:
                for target, _ in adjacency[node]:
                    if target in nodes:
                        in_degree[target] += 1
        
        # Group nodes by their level (distance from root nodes)
        levels = []
        remaining = nodes.copy()
        
        while remaining:
            # Find nodes with no dependencies in remaining set
            current_level = set()
            for node in remaining:
                # Check if all dependencies are already processed
                dependencies_met = True
                for other_node in nodes:
                    if other_node in adjacency:
                        for target, _ in adjacency[other_node]:
                            if target == node and other_node in remaining:
                                dependencies_met = False
                                break
                    if not dependencies_met:
                        break
                
                if dependencies_met or in_degree[node] == 0:
                    current_level.add(node)
            
            if not current_level:
                # No progress possible (might be due to cycle)
                break
            
            levels.append(current_level)
            remaining -= current_level
            
            # Update in-degrees
            for node in current_level:
                if node in adjacency:
                    for target, _ in adjacency[node]:
                        if target in in_degree:
                            in_degree[target] -= 1
        
        return levels
    
    @staticmethod
    def analyze_flow_structure(
        nodes: List[Dict],
        edges: List[Dict]
    ) -> Dict:
        """
        Comprehensive analysis of the flow structure
        
        Returns:
            Dictionary with analysis results
        """
        nodes_dict = {node['id']: node for node in nodes}
        
        # Find special nodes
        start_nodes = FlowAnalyzer.find_start_nodes(nodes)
        result_nodes = FlowAnalyzer.find_result_nodes(nodes)
        
        # Build adjacency
        adjacency = FlowAnalyzer.build_adjacency_list(nodes_dict, edges)
        
        # Check for cycles
        all_nodes = set(nodes_dict.keys())
        has_cycles = FlowAnalyzer.detect_cycles(all_nodes, adjacency)
        
        # Find reachable nodes from each start
        reachable_from_starts = {}
        for start_id in start_nodes:
            reachable, _ = FlowAnalyzer.extract_reachable_subgraph(
                start_id, nodes_dict, edges
            )
            reachable_from_starts[start_id] = list(reachable)
        
        # Find unreachable nodes
        all_reachable = set()
        for nodes_set in reachable_from_starts.values():
            all_reachable.update(nodes_set)
        unreachable = all_nodes - all_reachable
        
        # Calculate statistics
        stats = {
            'total_nodes': len(nodes),
            'total_edges': len(edges),
            'start_nodes': start_nodes,
            'result_nodes': result_nodes,
            'has_cycles': has_cycles,
            'unreachable_nodes': list(unreachable),
            'reachable_from_starts': reachable_from_starts
        }
        
        # If no cycles, calculate execution order
        if not has_cycles and start_nodes:
            try:
                if len(start_nodes) == 1:
                    reachable, subgraph_adj = FlowAnalyzer.extract_reachable_subgraph(
                        start_nodes[0], nodes_dict, edges
                    )
                    execution_order = FlowAnalyzer.topological_sort(reachable, subgraph_adj)
                    stats['suggested_execution_order'] = execution_order
                    
                    # Find parallel groups
                    parallel_groups = FlowAnalyzer.find_independent_branches(
                        reachable, subgraph_adj
                    )
                    stats['parallel_execution_groups'] = [
                        list(group) for group in parallel_groups
                    ]
            except ValueError as e:
                stats['analysis_error'] = str(e)
        
        return stats
    
    @staticmethod
    def validate_flow(nodes: List[Dict], edges: List[Dict]) -> Tuple[bool, List[str]]:
        """
        Validate flow structure for execution
        
        Returns:
            - Valid: True if flow can be executed
            - Errors: List of validation errors
        """
        errors = []
        nodes_dict = {node['id']: node for node in nodes}
        
        # Check for start nodes
        start_nodes = FlowAnalyzer.find_start_nodes(nodes)
        if len(start_nodes) == 0:
            errors.append("No start node found")
        elif len(start_nodes) > 1:
            errors.append(f"Multiple start nodes found: {start_nodes}")
        
        # Check for orphaned edges
        for edge in edges:
            if edge.get('source') not in nodes_dict:
                errors.append(f"Edge source '{edge.get('source')}' not found in nodes")
            if edge.get('target') not in nodes_dict:
                errors.append(f"Edge target '{edge.get('target')}' not found in nodes")
        
        # Check for cycles
        if start_nodes:
            adjacency = FlowAnalyzer.build_adjacency_list(nodes_dict, edges)
            if FlowAnalyzer.detect_cycles(set(nodes_dict.keys()), adjacency):
                errors.append("Cycle detected in flow graph")
        
        # Check for unreachable nodes
        if start_nodes and len(start_nodes) == 1:
            reachable, _ = FlowAnalyzer.extract_reachable_subgraph(
                start_nodes[0], nodes_dict, edges
            )
            unreachable = set(nodes_dict.keys()) - reachable
            if unreachable:
                errors.append(f"Unreachable nodes from start: {list(unreachable)}")
        
        return len(errors) == 0, errors