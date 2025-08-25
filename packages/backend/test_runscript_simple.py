#!/usr/bin/env python3
"""
Simple test for RunScript pattern without external dependencies
"""

import tempfile
import json
from pathlib import Path
from app.core.enhanced_flow_executor import EnhancedFlowExecutor

def test_runscript_with_objects():
    """Test RunScript with custom objects"""
    
    with tempfile.TemporaryDirectory() as tmpdir:
        executor = EnhancedFlowExecutor(Path(tmpdir))
        
        # Create test project
        project_id = 'test-project'
        project_dir = Path(tmpdir) / project_id
        project_dir.mkdir()
        
        print("=== RunScript Pattern Test ===\n")
        
        # Test 1: Create a person factory node
        factory_id = 'person-factory'
        factory_file = project_dir / f'{factory_id}.py'
        factory_file.write_text('''
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age
    
    def greet(self):
        return f"Hello, I'm {self.name}, {self.age} years old"
    
    def __repr__(self):
        return f"Person(name='{self.name}', age={self.age})"

def RunScript(name: str = "Alice", age: int = 30):
    """Create a Person object using RunScript pattern"""
    
    person = Person(name, age)
    
    return {
        "person": person,
        "greeting": person.greet(),
        "info": {"name": name, "age": age}
    }
''')
        
        # Analyze signature
        metadata = executor.analyze_node_signature(
            project_id, 
            factory_id,
            {'data': {'file': f'{factory_id}.py'}}
        )
        
        print("1. Signature Analysis:")
        print(f"   Mode: {metadata['mode']}")
        print(f"   Function: {metadata.get('function_name', 'N/A')}")
        print(f"   Inputs: {[f"{i['name']}:{i['type']}" for i in metadata.get('inputs', [])]}")
        print(f"   Outputs: {[o['name'] for o in metadata.get('outputs', [])]}")
        if 'error' in metadata:
            print(f"   Error: {metadata['error']}")
        
        # Execute with different parameters
        print("\n2. Execution Tests:")
        
        test_cases = [
            {"name": "Bob", "age": 25},
            {"name": "Charlie"},  # Use default age
            {}  # Use all defaults
        ]
        
        for inputs in test_cases:
            result = executor._execute_node_isolated(
                project_id,
                factory_id,
                {'data': {'file': f'{factory_id}.py'}},
                inputs
            )
            
            if result['status'] == 'success':
                output = result['output']
                print(f"\n   Input: {inputs}")
                print(f"   Output: {output}")
                
                # Check if output is wrapped
                if isinstance(output, dict) and output.get('type') == 'reference':
                    print(f"   Output stored as reference: {output['ref']}")
                    print(f"   Preview: {output['preview']}")
                else:
                    print(f"   Greeting: {output.get('greeting', 'N/A') if isinstance(output, dict) else 'N/A'}")
        
        # Test 2: Process person in another node
        print("\n3. Object Passing Test:")
        
        processor_id = 'person-processor'
        processor_file = project_dir / f'{processor_id}.py'
        processor_file.write_text('''
def RunScript(person, action: str = "describe"):
    """Process a Person object"""
    
    if hasattr(person, 'name') and hasattr(person, 'age'):
        if action == "describe":
            result = f"{person.name} is {person.age} years old"
        elif action == "birthday":
            person.age += 1
            result = f"{person.name} is now {person.age} years old!"
        else:
            result = str(person)
    else:
        result = f"Invalid person object: {type(person)}"
    
    return {
        "result": result,
        "processed": True
    }
''')
        
        # Create a person and pass it to processor
        factory_result = executor._execute_node_isolated(
            project_id,
            factory_id,
            {'data': {'file': f'{factory_id}.py'}},
            {"name": "Diana", "age": 35}
        )
        
        if factory_result['status'] == 'success':
            # Pass the entire output (with reference) to processor
            processor_result = executor._execute_node_isolated(
                project_id,
                processor_id,
                {'data': {'file': f'{processor_id}.py'}},
                factory_result['output']
            )
            
            print(f"   Factory created: {factory_result['output'].get('greeting')}")
            print(f"   Processor result: {processor_result['output'].get('result')}")
            print(f"   Object successfully passed: {processor_result['status'] == 'success'}")

if __name__ == "__main__":
    test_runscript_with_objects()