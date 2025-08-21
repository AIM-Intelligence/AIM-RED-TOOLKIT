# Universal Node Template - Works with any input configuration
# 이 템플릿은 커스텀 노드에서도 작동합니다
import json

print("Input data keys:", list(input_data.keys()))

# 모든 입력값을 수집
values = []

# targetHandle이 있는 경우 (a, b 등)와 없는 경우 (node_1, node_2 등) 모두 처리
for key, data in input_data.items():
    print(f"Processing input '{key}':", type(data))
    
    value = None
    
    if isinstance(data, dict):
        if 'parameter' in data:
            # NumberParam에서 온 파라미터 객체
            param = data['parameter']
            if hasattr(param, 'value'):
                value = param.value
                print(f"  Got value from parameter: {value}")
        elif 'value' in data:
            # 다른 노드에서 온 값
            value = data['value']
            print(f"  Got direct value: {value}")
    elif isinstance(data, (int, float)):
        # 직접적인 숫자 값
        value = data
        print(f"  Got numeric value: {value}")
    
    if value is not None:
        values.append(value)

# 값이 있으면 처리
if len(values) == 0:
    print("No input values found!")
    result = 0
elif len(values) == 1:
    result = values[0]
    print(f"Single value: {result}")
elif len(values) == 2:
    # 두 개의 값이면 더하기
    result = values[0] + values[1]
    print(f"Adding: {values[0]} + {values[1]} = {result}")
else:
    # 여러 값이면 모두 더하기
    result = sum(values)
    print(f"Sum of {len(values)} values: {result}")

print("=== RESULT ===")
print(f"Result: {result}")

# Output
output_data = {"value": result}

# Serialize and output for next nodes
serialized_output = serialize_object(output_data)
print("___OUTPUT_DATA_START___")
print(json.dumps(serialized_output))
print("___OUTPUT_DATA_END___")