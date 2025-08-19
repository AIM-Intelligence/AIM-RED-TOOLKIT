#!/usr/bin/env python3
"""
Test script for savecode API
Tests the code saving functionality of the backend
"""

import requests
import json

# Configuration
BASE_URL = "http://localhost:8000"
PROJECT_NAME = "test_project"
NODE_ID = "1"
NODE_TITLE = "Data Input"

def test_save_code():
    """Test the savecode API endpoint"""
    
    # Test code to save
    test_code = """# Node: Data Input
# ID: 1
# Updated by test script

import pandas as pd
import numpy as np

def load_data(filename):
    '''Load data from CSV file'''
    df = pd.read_csv(filename)
    print(f"Loaded {len(df)} rows from {filename}")
    return df

def preprocess_data(df):
    '''Preprocess the dataframe'''
    # Remove null values
    df = df.dropna()
    
    # Normalize numeric columns
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    df[numeric_cols] = (df[numeric_cols] - df[numeric_cols].mean()) / df[numeric_cols].std()
    
    return df

# Main execution
if __name__ == "__main__":
    data = load_data("sample.csv")
    processed_data = preprocess_data(data)
    print("Data preprocessing complete!")
"""
    
    # Prepare request
    url = f"{BASE_URL}/api/code/savecode"
    payload = {
        "project_name": PROJECT_NAME,
        "node_id": NODE_ID,
        "node_title": NODE_TITLE,
        "code": test_code
    }
    
    print(f"Testing savecode API...")
    print(f"URL: {url}")
    print(f"Project: {PROJECT_NAME}")
    print(f"Node ID: {NODE_ID}")
    print(f"Node Title: {NODE_TITLE}")
    print("-" * 50)
    
    try:
        # Send POST request
        response = requests.post(
            url,
            headers={"Content-Type": "application/json"},
            json=payload
        )
        
        # Check response
        if response.status_code == 200:
            result = response.json()
            print("✅ SUCCESS!")
            print(f"Response: {json.dumps(result, indent=2)}")
            
            if 'file_path' in result:
                print(f"\n📁 File saved to: {result['file_path']}")
                
                # Now test getting the code back
                print("\n" + "=" * 50)
                print("Testing getcode API to verify save...")
                test_get_code()
        else:
            print(f"❌ FAILED with status code: {response.status_code}")
            print(f"Response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection Error: Make sure the backend server is running!")
        print("Run: pnpm backend:dev")
    except Exception as e:
        print(f"❌ Error: {e}")

def test_get_code():
    """Test getting the saved code back"""
    url = f"{BASE_URL}/api/code/getcode"
    payload = {
        "project_name": PROJECT_NAME,
        "node_id": NODE_ID,
        "node_title": NODE_TITLE
    }
    
    try:
        response = requests.post(
            url,
            headers={"Content-Type": "application/json"},
            json=payload
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Code retrieved successfully!")
            print("\n📝 Retrieved code (first 10 lines):")
            code_lines = result['code'].split('\n')[:10]
            for i, line in enumerate(code_lines, 1):
                print(f"  {i:2}: {line}")
            if len(result['code'].split('\n')) > 10:
                print(f"  ... ({len(result['code'].split('\n')) - 10} more lines)")
        else:
            print(f"❌ Failed to retrieve code: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error retrieving code: {e}")

def create_test_project():
    """Create a test project if it doesn't exist"""
    url = f"{BASE_URL}/api/project/make"
    payload = {
        "project_name": PROJECT_NAME,
        "project_description": "Test project for savecode API"
    }
    
    print("Creating test project...")
    try:
        response = requests.post(
            url,
            headers={"Content-Type": "application/json"},
            json=payload
        )
        
        if response.status_code == 200:
            print("✅ Test project created")
            return True
        elif response.status_code == 400:
            print("ℹ️ Test project already exists")
            return True
        else:
            print(f"❌ Failed to create project: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error creating project: {e}")
        return False

def create_test_node():
    """Create a test node if it doesn't exist"""
    url = f"{BASE_URL}/api/project/makenode"
    payload = {
        "project_name": PROJECT_NAME,
        "node_id": NODE_ID,
        "node_type": "default",
        "position": {"x": 100, "y": 100},
        "data": {
            "title": NODE_TITLE,
            "description": "Test node for savecode API"
        }
    }
    
    print("Creating test node...")
    try:
        response = requests.post(
            url,
            headers={"Content-Type": "application/json"},
            json=payload
        )
        
        if response.status_code == 200:
            print("✅ Test node created")
            return True
        elif response.status_code == 400:
            print("ℹ️ Test node already exists")
            return True
        else:
            print(f"❌ Failed to create node: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error creating node: {e}")
        return False

if __name__ == "__main__":
    print("=" * 50)
    print("SAVECODE API TEST")
    print("=" * 50)
    
    # Setup test environment
    if create_test_project() and create_test_node():
        print("\n" + "=" * 50)
        # Run the test
        test_save_code()
    else:
        print("\n❌ Failed to setup test environment")
        print("Make sure the backend server is running: pnpm backend:dev")