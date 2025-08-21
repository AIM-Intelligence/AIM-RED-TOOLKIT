# AIM-RedLab 통합 준비 상태

## ✅ 완료된 작업

### 1. **Python 객체 전달 시스템**
- ✅ Pickle 기반 직렬화/역직렬화 구현
- ✅ 노드 간 Python 객체 그대로 전달 가능
- ✅ 클래스 인스턴스, NumPy 배열, datetime 등 모든 객체 지원
- ✅ JSON과 Pickle 자동 선택 (항상 Pickle 사용)

### 2. **백엔드 구조**
- ✅ `pipeline_executor.py`: 객체 직렬화 지원
- ✅ `serialize_object()` / `deserialize_object()` 함수 구현
- ✅ 노드 실행 시 `input_data` / `output_data` 변수로 데이터 전달

### 3. **프론트엔드 개선**
- ✅ 파이프라인 실행 버튼 (객체 전달 기본 활성화)
- ✅ 실행 결과 모달 (객체 타입 표시)
- ✅ 토스트 알림 시스템 (alert 대체)
- ✅ 디버깅 코드 제거

### 4. **테스트 정리**
- ✅ 테스트 노드 파일 삭제
- ✅ 테스트 프로젝트 제거
- ✅ projects.json 초기화

## 📊 AIM-RedLab 모듈 상태

| 모듈 | Import 상태 | 주요 클래스 |
|------|------------|------------|
| `aim_inputs` | ✅ 정상 | CSVUpload, JSONUpload |
| `aim_params` | ✅ 정상 | NumberValue, TextValue, BoolValue |
| `aim_jailbreak` | ✅ 정상 (경로 수정 완료) | GCGAttackSync, GCGAttack, PAIRAttack |
| `aim_models` | ✅ 정상 | MockProvider |
| `aim_judge` | ✅ 정상 | PolicyEngine, JudgeInput |
| `aim_reports` | ✅ 정상 | ResultCollector, ChainData |

## 🔄 노드 간 데이터 전달 방식

### 노드 작성 예시:
```python
# 노드 1: 객체 생성
from aim_jailbreak.attacks.prompt_injection.gcg_sync import GCGAttackSync
attack = GCGAttackSync()
output_data = {"attack": attack}

# 노드 2: 객체 사용
attack = input_data['node_1']['attack']  # 객체 그대로 전달됨!
result = attack.attack("test prompt")
output_data = {"result": result}
```

## 🚀 AIM-RedLab 통합 방법

### 1. 노드 템플릿 생성
각 AIM-RedLab 모듈을 위한 노드 템플릿 생성:
- CSV 입력 노드
- 파라미터 설정 노드
- 공격 실행 노드
- 평가 노드
- 리포트 생성 노드

### 2. 예제 파이프라인
```
[CSV 입력] → [파라미터 설정] → [GCG 공격] → [안전성 평가] → [리포트]
```

### 3. 코드 예시
```python
# CSV 입력 노드
from aim_inputs import CSVUpload
csv = CSVUpload("attacks")
data = csv.load("prompts.csv")
output_data = {"csv": csv, "data": data}

# 공격 실행 노드
from aim_jailbreak.attacks.prompt_injection.gcg_sync import GCGAttackSync
csv = input_data['node_1']['csv']
attack = GCGAttackSync()
results = []
for row in csv.data:
    result = attack.attack(row['prompt'])
    results.append(result)
output_data = {"results": results}
```

## ⚠️ 주의사항

1. **보안**: Pickle은 보안 위험이 있으므로 신뢰할 수 있는 코드만 실행
2. **경로**: ✅ 경로 자동 설정 완료 (`pipeline_executor.py`에서 AIM-RedLab 경로 자동 추가)
3. **비동기**: 일부 AIM-RedLab 함수는 async (asyncio 필요)
4. **폴더 이동**: AIM-RedLab 폴더 이동 시 `/packages/backend/app/core/pipeline_executor.py`의 162-163번 줄 경로 수정 필요

## 📌 다음 단계

1. AIM-RedLab 각 모듈을 위한 노드 템플릿 생성
2. 노드 생성 UI에 템플릿 선택 기능 추가
3. 예제 파이프라인 제공
4. 사용자 가이드 작성

## ✨ 준비 완료!

시스템이 AIM-RedLab 통합을 위한 모든 준비를 마쳤습니다.
Python 객체를 노드 간에 자유롭게 전달할 수 있으며,
AIM-RedLab의 모든 기능을 시각적 파이프라인으로 구성할 수 있습니다.