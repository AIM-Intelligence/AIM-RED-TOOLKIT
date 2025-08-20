# 커스텀 노드 가이드

## 문제 상황
커스텀 노드에서 NumberParam 값을 받을 때 작동하지 않는 문제

## 원인
- SimpleAdd 노드는 `targetHandle` (a, b)을 사용해서 입력을 구분
- 커스텀 노드는 `targetHandle`이 없어서 `node_1`, `node_2` 등으로 입력을 받음
- 기존 코드는 `a`, `b`만 찾기 때문에 커스텀 노드에서 작동 안 함

## 해결책: Universal Node Template 사용

### 유니버설 템플릿 코드
```python
# Universal Node - 모든 입력 자동 처리
print("Input data keys:", list(input_data.keys()))

# 모든 입력값을 수집
values = []

for key, data in input_data.items():
    value = None
    
    if isinstance(data, dict):
        if 'parameter' in data:
            # NumberParam에서 온 파라미터
            param = data['parameter']
            if hasattr(param, 'value'):
                value = param.value
        elif 'value' in data:
            # 다른 노드에서 온 값
            value = data['value']
    elif isinstance(data, (int, float)):
        # 직접적인 숫자 값
        value = data
    
    if value is not None:
        values.append(value)

# 처리 로직
if len(values) == 2:
    result = values[0] + values[1]
    print(f"Result: {result}")
else:
    result = sum(values)

output_data = {"value": result}
```

### 특징
1. **자동 입력 감지**: targetHandle 유무와 관계없이 작동
2. **유연한 처리**: NumberParam, 일반 노드, 직접 값 모두 처리
3. **다중 입력 지원**: 2개 이상의 입력도 자동으로 합산

### 사용 방법
1. 커스텀 노드 생성
2. 위 템플릿 코드 복사/붙여넣기
3. 필요에 따라 처리 로직 수정 (더하기, 곱하기 등)

### 예제: 곱셈 노드
```python
# 처리 로직 부분만 수정
if len(values) == 2:
    result = values[0] * values[1]  # 곱하기로 변경
    print(f"Result: {values[0]} × {values[1]} = {result}")
```

## 요약
- 기존 SimpleAdd 코드는 커스텀 노드에서 작동 안 함
- Universal Template 사용하면 어디서든 작동
- `/packages/backend/app/templates/universal_node.py` 파일 참조