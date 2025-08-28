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

print("Execution order:", result.get("execution_order"))
print("\nNode outputs (Result nodes):")
print("Node 35 (CSV path input):", result.get("result_nodes", {}).get("35"))

print("\nNode 3 (CSV Loader) result:")
node3 = result.get("execution_results", {}).get("3", {})
print("Status:", node3.get("status"))
if node3.get("error"):
    print("Error:", node3.get("error"))
    # Only show first few lines of logs
    logs = node3.get("logs", "").split("\n")[:5]
    print("Logs (first 5 lines):")
    for log in logs:
        print("  ", log)