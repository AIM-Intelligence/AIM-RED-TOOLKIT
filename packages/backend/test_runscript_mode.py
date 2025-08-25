#!/usr/bin/env python3
"""
Test script to verify RunScript pattern implementation
"""

import tempfile
import json
from pathlib import Path
from app.core.enhanced_flow_executor import EnhancedFlowExecutor

def test_runscript_execution():
    """Test that RunScript functions work with parameter mapping"""
    
    with tempfile.TemporaryDirectory() as tmpdir:
        executor = EnhancedFlowExecutor(Path(tmpdir))
        
        # Create test project
        project_id = 'test-project'
        node_id = 'test-node'
        project_dir = Path(tmpdir) / project_id
        project_dir.mkdir()
        
        # Write a RunScript node
        node_file = project_dir / f'{node_id}_Calculator.py'
        node_file.write_text('''
from typing import Literal

def RunScript(
    x: float = 10.0,
    y: float = 20.0,
    operation: Literal["add", "multiply", "divide"] = "add"
):
    """Calculator with RunScript pattern"""
    
    if operation == "add":
        result = x + y
    elif operation == "multiply":
        result = x * y
    elif operation == "divide":
        result = x / y if y != 0 else float('inf')
    else:
        result = 0
    
    return {
        "result": result,
        "operation_used": operation,
        "inputs": {"x": x, "y": y}
    }
''')
        
        # Test 1: Analyze signature
        print("=== Test 1: Signature Analysis ===")
        metadata = executor.analyze_node_signature(
            project_id, 
            node_id,
            {'data': {'file': f'{node_id}_Calculator.py'}}
        )
        print(json.dumps(metadata, indent=2))
        
        # Test 2: Execute with parameters
        print("\n=== Test 2: Execute with Parameters ===")
        
        # Simulate node execution with input mapping
        node_data = {'data': {'file': f'{node_id}_Calculator.py'}}
        
        # Test with different inputs
        test_inputs = [
            {"x": 5, "y": 3, "operation": "add"},
            {"x": 4, "y": 7, "operation": "multiply"},
            {"x": 100, "y": 25, "operation": "divide"},
            {},  # Test with defaults
        ]
        
        for input_data in test_inputs:
            print(f"\nInput: {input_data}")
            result = executor._execute_node_isolated(
                project_id,
                node_id,
                node_data,
                input_data
            )
            
            if result['status'] == 'success':
                print(f"Output: {result['output']}")
            else:
                print(f"Error: {result.get('error', 'Unknown error')}")
        
        # Test 3: Object passing between nodes
        print("\n=== Test 3: Object Passing ===")
        
        # Create a node that outputs a complex object
        producer_id = 'producer-node'
        producer_file = project_dir / f'{producer_id}_Producer.py'
        producer_file.write_text('''
import pandas as pd

def RunScript(rows: int = 5):
    """Create a DataFrame"""
    
    # Create a simple DataFrame
    df = pd.DataFrame({
        'A': range(rows),
        'B': [x**2 for x in range(rows)],
        'C': [f'row_{i}' for i in range(rows)]
    })
    
    return {
        "dataframe": df,
        "row_count": len(df),
        "columns": list(df.columns)
    }
''')
        
        # Execute producer
        producer_result = executor._execute_node_isolated(
            project_id,
            producer_id,
            {'data': {'file': f'{producer_id}_Producer.py'}},
            {"rows": 3}
        )
        
        print(f"Producer output type: {type(producer_result['output'])}")
        print(f"Producer output: {producer_result['output']}")
        
        # Create a consumer that uses the DataFrame
        consumer_id = 'consumer-node'
        consumer_file = project_dir / f'{consumer_id}_Consumer.py'
        consumer_file.write_text('''
def RunScript(dataframe, operation: str = "sum"):
    """Process a DataFrame"""
    
    if hasattr(dataframe, 'shape'):
        # It's a DataFrame
        if operation == "sum":
            result = dataframe.select_dtypes(include='number').sum().to_dict()
        else:
            result = {"shape": dataframe.shape}
    else:
        result = {"error": "Input is not a DataFrame"}
    
    return {
        "result": result,
        "input_type": type(dataframe).__name__
    }
''')
        
        # Pass the output from producer to consumer
        if producer_result['status'] == 'success':
            consumer_result = executor._execute_node_isolated(
                project_id,
                consumer_id,
                {'data': {'file': f'{consumer_id}_Consumer.py'}},
                producer_result['output']  # Pass entire output dict
            )
            
            print(f"\nConsumer result: {consumer_result}")

if __name__ == "__main__":
    test_runscript_execution()