#!/usr/bin/env python3
"""
Test script for dynamic ports with RunScript pattern
"""

import tempfile
import json
from pathlib import Path
from app.core.enhanced_flow_executor import EnhancedFlowExecutor

def test_dynamic_ports():
    """Test that RunScript functions work with dynamic ports and parameter mapping"""
    
    with tempfile.TemporaryDirectory() as tmpdir:
        executor = EnhancedFlowExecutor(Path(tmpdir))
        
        # Create test project
        project_id = 'test-project'
        project_dir = Path(tmpdir) / project_id
        project_dir.mkdir()
        
        print("=== Dynamic Ports Test with RunScript Pattern ===\n")
        
        # Test 1: Create a node with multiple parameters
        calc_id = 'calculator'
        calc_file = project_dir / f'{calc_id}.py'
        calc_file.write_text('''
from typing import Literal

def RunScript(
    x: float = 10.0,
    y: float = 20.0,
    z: float = 5.0,
    operation: Literal["sum", "product", "average"] = "sum"
):
    """Calculator with multiple inputs"""
    
    if operation == "sum":
        result = x + y + z
    elif operation == "product":
        result = x * y * z
    elif operation == "average":
        result = (x + y + z) / 3
    else:
        result = 0
    
    return {
        "result": result,
        "operation": operation,
        "inputs_used": {"x": x, "y": y, "z": z}
    }
''')
        
        # Test metadata extraction
        metadata = executor.analyze_node_signature(
            project_id, 
            calc_id,
            {'data': {'file': f'{calc_id}.py'}}
        )
        
        print("1. Signature Analysis:")
        print(f"   Mode: {metadata['mode']}")
        print(f"   Function: {metadata['function_name']}")
        print(f"   Inputs: {metadata['inputs']}")
        print(f"   Outputs: {[o['name'] for o in metadata['outputs']]}")
        
        # Test 2: Execute with specific parameter mapping (simulating targetHandle)
        print("\n2. Parameter Mapping Tests:")
        
        # Test with all parameters
        test_cases = [
            # Full parameters
            ({"x": 5, "y": 3, "z": 2, "operation": "sum"}, None),
            # Partial parameters (use defaults)
            ({"x": 10, "operation": "product"}, None),
            # With target handle mapping (simulating edge connections)
            ({"value1": 7, "value2": 8}, {"value1": "x", "value2": "y"}),
        ]
        
        for input_data, target_handles in test_cases:
            print(f"\n   Input: {input_data}")
            if target_handles:
                print(f"   Handle mapping: {target_handles}")
            
            result = executor._execute_node_isolated(
                project_id,
                calc_id,
                {'data': {'file': f'{calc_id}.py'}},
                input_data,
                target_handles=target_handles
            )
            
            if result['status'] == 'success':
                # Unwrap if it's a reference
                output = result['output']
                if isinstance(output, dict) and output.get('type') == 'reference':
                    # Get actual value from store
                    ref = output['ref']
                    actual = executor.object_stores[project_id][ref]
                    print(f"   Result: {actual['result']}")
                    print(f"   Operation: {actual['operation']}")
                else:
                    print(f"   Output: {output}")
            else:
                print(f"   Error: {result.get('error')}")
        
        # Test 3: Chain nodes with different outputs/inputs
        print("\n3. Node Chaining Test:")
        
        # Create a producer node
        producer_id = 'producer'
        producer_file = project_dir / f'{producer_id}.py'
        producer_file.write_text('''
def RunScript(base: float = 100):
    """Produce multiple outputs"""
    return {
        "half": base / 2,
        "double": base * 2,
        "square": base ** 2
    }
''')
        
        # Execute producer
        producer_result = executor._execute_node_isolated(
            project_id,
            producer_id,
            {'data': {'file': f'{producer_id}.py'}},
            {"base": 10}
        )
        
        # Get the outputs
        if producer_result['status'] == 'success':
            output_ref = producer_result['output']
            if isinstance(output_ref, dict) and output_ref.get('type') == 'reference':
                producer_output = executor.object_stores[project_id][output_ref['ref']]
                print(f"   Producer outputs: {producer_output}")
                
                # Now use specific outputs as inputs to calculator
                # Simulate edges: half->x, double->y, square->z
                calc_input = {
                    "source1": producer_output["half"],
                    "source2": producer_output["double"],
                    "source3": producer_output["square"]
                }
                handle_mapping = {
                    "source1": "x",
                    "source2": "y", 
                    "source3": "z"
                }
                
                calc_result = executor._execute_node_isolated(
                    project_id,
                    calc_id,
                    {'data': {'file': f'{calc_id}.py'}},
                    calc_input,
                    target_handles=handle_mapping
                )
                
                if calc_result['status'] == 'success':
                    output_ref = calc_result['output']
                    if isinstance(output_ref, dict) and output_ref.get('type') == 'reference':
                        calc_output = executor.object_stores[project_id][output_ref['ref']]
                        print(f"   Calculator with chained inputs:")
                        print(f"     x={producer_output['half']}, y={producer_output['double']}, z={producer_output['square']}")
                        print(f"     Result: {calc_output['result']}")
                        print(f"     Inputs used: {calc_output['inputs_used']}")

if __name__ == "__main__":
    test_dynamic_ports()