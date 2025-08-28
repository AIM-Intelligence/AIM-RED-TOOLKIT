#!/usr/bin/env python3
import requests
import json

# Execute flow with CSV path in result node 35
payload = {
    "project_id": "project-1756312820410-q5avdrx06",
    "start_node_id": "13",
    "params": {},
    "result_node_values": {
        "35": "/Users/kwontaeyoun/Desktop/AIM/AIM-RedLab/query_datasets/sample_queries.csv"
    },
    "max_workers": 4,
    "timeout_sec": 30,
    "halt_on_error": True
}

response = requests.post(
    "http://localhost:8000/api/project/execute-flow",
    json=payload
)

result = response.json()
print("=" * 80)
print("EXECUTION RESULTS:")
print("=" * 80)

# Check each node's result
for node_id, node_result in result.get("execution_results", {}).items():
    print(f"\nNode {node_id}:")
    print(f"  Status: {node_result.get('status')}")
    if node_result.get('error'):
        print(f"  Error: {node_result.get('error')}")
    if node_result.get('output'):
        output = node_result.get('output')
        if isinstance(output, str):
            print(f"  Output: {output[:100]}...")
        elif isinstance(output, dict):
            print(f"  Output keys: {list(output.keys())}")
        else:
            print(f"  Output type: {type(output)}")

print("\n" + "=" * 80)
print("Check the backend terminal for debug logs!")
print("=" * 80)