# AIM‑RED LSP Hardening Guide  
**(Docker + Auto‑Restart + Structured Logging)**

본 문서는 AIM‑RED Toolkit의 LSP 런타임을 **컨테이너 친화적**으로 만들고, **프로세스 자동 복구**, **상세 로깅/디버깅**을 제공하기 위한 **구현 지침**입니다.  
모든 코드 블록은 **파일 경로**와 함께 제공되므로 Claude Code에서 그대로 생성/수정하면 됩니다.

---

## 목차

1. [무엇을 추가/수정하나 (요약표)](#무엇을-추가수정하나-요약표)  
2. [Docker: 컨테이너에서 Pyright/Ruff 실행](#docker-컨테이너에서-pyrightruff-실행)  
3. [LSP 프로세스 자동 복구(지수 백오프 + 유휴 종료)](#lsp-프로세스-자동-복구지수-백오프--유휴-종료)  
4. [WS ↔ LSP(stdio) 브릿지 + 종료 신호(재연결 유도)](#ws--lspstdio-브릿지--종료-신호재연결-유도)  
5. [구조화 로깅(요약/상세) + 로그 엔드포인트](#구조화-로깅요약상세--로그-엔드포인트)  
6. [프론트엔드: 자동 재연결 + 상태 인디케이터](#프론트엔드-자동-재연결--상태-인디케이터)  
7. [FastAPI 메인 애플리케이션 연동](#fastapi-메인-애플리케이션-연동)  
8. [Checklist & 운영 팁](#checklist--운영-팁)  
9. [부록 A: `pyrightconfig.json` 템플릿](#부록-a-pyrightconfigjson-템플릿)  
10. [부록 B: 변경 파일 요약](#부록-b-변경-파일-요약)

---

## 무엇을 추가/수정하나 (요약표)

| 목적 | 파일(추가/수정) | 요약 |
| --- | --- | --- |
| 컨테이너에서 Pyright/Ruff 실행 | **`packages/backend/Dockerfile`** *(수정)* | Python 이미지에 **Node 20 + pnpm + pyright** 설치, pip로 **ruff** 설치 |
| 〃 | **`docker-compose.dev.yml` / `docker-compose.prod.yml`** *(수정)* | 백엔드 환경변수/LSP 로그 볼륨/헬스체크 추가 |
| LSP 프로세스 수명/재시작 | **`packages/backend/app/core/lsp_manager.py`** *(신규 또는 보강)* | per‑project per‑lsp **프로세스 관리**, **지수 백오프 + 지터** 재시작, **유휴 종료**, **헬스 상태** 제공 |
| WS 브릿지 + 재시작 시나리오 | **`packages/backend/app/api/lsp.py`** *(보강)* | Pyright/Ruff **WS ↔ stdio** 브릿지. 서버 죽으면 **WS close code**로 클라이언트에 “재연결” 신호 |
| 구조화 로깅 | **`packages/backend/app/core/logging.py`** *(신규)* | JSON 구조화 로거/레벨/샘플링, **LSP 트래픽 요약 로그**, stdio 라인 로그 |
| 진단/디버그 | **`packages/backend/app/api/lsp_debug.py`** *(신규)* | `/api/lsp/health`, `/api/lsp/restart/{lsp_type}`, `/api/lsp/logs` 제공 |
| 프론트 자동 재연결 | **`packages/frontend/src/lsp/pythonLspClient.ts`** *(보강)* | **지수 백오프 자동 재연결**, 서버 재시작 코드 인지, 상태 인디케이터 |
| 타입 | **`packages/frontend/src/types/interface.ts`** *(보강)* | `LspType = 'pyright' | 'ruff'` 등 명시적 유니온 타입 |

> **주의**: LSP 서버는 “단일 클라이언트” 가정이 일반적입니다. 동일 `project_id`에서 다중 에디터가 접속할 경우, **새 연결이 기존 연결을 선점**하도록 정책화하는 것을 권장합니다.

---

## Docker: 컨테이너에서 Pyright/Ruff 실행

### 경로: `packages/backend/Dockerfile`

```Dockerfile
# packages/backend/Dockerfile
FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1     PYTHONUNBUFFERED=1

# OS deps
RUN apt-get update && apt-get install -y --no-install-recommends     curl ca-certificates git tini procps     && rm -rf /var/lib/apt/lists/*

# Node 20 + corepack(pnpm)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash -     && apt-get update && apt-get install -y --no-install-recommends nodejs     && rm -rf /var/lib/apt/lists/*

# pnpm + 글로벌 PATH (pnpm global bin)
ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"
RUN corepack enable && pnpm --version

# pyright(global)
RUN pnpm add -g pyright@1.1.404 && pyright --version

# Python deps (ruff 포함)
WORKDIR /app
COPY packages/backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt     && pip install --no-cache-dir ruff==0.8.6

# 앱 소스
COPY packages/backend /app

# LSP/로그 디렉토리
RUN mkdir -p /var/log/aim-red/lsp
VOLUME ["/var/log/aim-red/lsp", "/app/projects"]

# LSP 런타임 환경
ENV LSP_LOG_LEVEL=INFO     LSP_STDIO_LOG_DIR=/var/log/aim-red/lsp     LSP_IDLE_TTL_MS=600000     LSP_MAX_RESTARTS=5     LSP_RESTART_WINDOW_MS=60000

EXPOSE 8000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["python", "-m", "uvicorn", "app.main:app", "--host","0.0.0.0","--port","8000"]
```

### 경로: `docker-compose.dev.yml` (prod도 동일 패턴으로 적용)

```yaml
services:
  backend:
    build:
      context: .
      dockerfile: packages/backend/Dockerfile
    environment:
      - LSP_LOG_LEVEL=DEBUG           # dev: DEBUG 권장 (TRACE는 페이로드까지)
      - LSP_STDIO_LOG_DIR=/var/log/aim-red/lsp
      - LSP_IDLE_TTL_MS=600000
      - LSP_MAX_RESTARTS=5
      - LSP_RESTART_WINDOW_MS=60000
    volumes:
      - ./packages/backend/projects:/app/projects
      - lsp-logs:/var/log/aim-red/lsp
    ports:
      - "8000:8000"
    healthcheck:
      test: ["CMD-SHELL", "curl -fsS http://localhost:8000/api/health || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 15s

volumes:
  lsp-logs:
```

> 포인트
> - **Node + pnpm + pyright** 를 백엔드 이미지에 함께 설치 → LSP 프로세스를 백엔드에서 직접 스폰  
> - **ruff**는 pip로 설치(0.8.6에는 `ruff server` LSP 탑재)  
> - LSP 로그 디렉토리 **볼륨 마운트**로 유지

---

## LSP 프로세스 자동 복구(지수 백오프 + 유휴 종료)

### 경로: `packages/backend/app/core/lsp_manager.py`

```python
# packages/backend/app/core/lsp_manager.py
from __future__ import annotations
import asyncio, os, time, random, signal
from dataclasses import dataclass, field
from typing import Dict, Optional, Literal, Tuple
from .logging import get_logger, lsp_stdio_logger

LspType = Literal["pyright", "ruff"]

@dataclass
class LspProcess:
    project_id: str
    lsp_type: LspType
    cwd: str
    proc: Optional[asyncio.subprocess.Process] = None
    started_at: float = 0.0
    restarts: int = 0
    last_started_ts: float = 0.0
    last_activity_ts: float = field(default_factory=lambda: time.time())
    is_starting: bool = False
    is_stopping: bool = False
    last_exit: Optional[int] = None

class LspManager:
    def __init__(self) -> None:
        self.log = get_logger(__name__)
        self._procs: Dict[Tuple[str, LspType], LspProcess] = {}
        self._lock = asyncio.Lock()

        self.LOG_LEVEL = os.getenv("LSP_LOG_LEVEL", "INFO")
        self.IDLE_TTL_MS = int(os.getenv("LSP_IDLE_TTL_MS", "600000"))
        self.MAX_RESTARTS = int(os.getenv("LSP_MAX_RESTARTS", "5"))
        self.RESTART_WINDOW_MS = int(os.getenv("LSP_RESTART_WINDOW_MS", "60000"))

    def _cmd_for(self, lsp_type: LspType) -> Tuple[str, ...]:
        if lsp_type == "pyright":
            return ("pyright-langserver", "--stdio")
        elif lsp_type == "ruff":
            return ("ruff", "server")
        raise ValueError(f"Unknown LSP: {lsp_type}")

    async def get_or_start(self, project_id: str, lsp_type: LspType, cwd: str) -> LspProcess:
        key = (project_id, lsp_type)
        async with self._lock:
            lp = self._procs.get(key)
            if lp and lp.proc and lp.proc.returncode is None:
                lp.last_activity_ts = time.time()
                return lp

            if not lp:
                lp = LspProcess(project_id=project_id, lsp_type=lsp_type, cwd=cwd)
                self._procs[key] = lp

            await self._start_process(lp)
            return lp

    async def _start_process(self, lp: LspProcess) -> None:
        if lp.is_starting:
            return
        lp.is_starting = True
        try:
            backoff = min(2 ** lp.restarts, 30)  # seconds
            jitter = random.random() * 0.5
            if lp.restarts > 0:
                await asyncio.sleep(backoff + jitter)

            cmd = self._cmd_for(lp.lsp_type)
            self.log.info("lsp.start", extra={"project_id": lp.project_id, "lsp": lp.lsp_type, "cmd": cmd, "cwd": lp.cwd})
            lp.proc = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=lp.cwd,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            lp.started_at = time.time()
            lp.last_started_ts = lp.started_at
            lp.last_activity_ts = lp.started_at

            asyncio.create_task(self._drain_stream(lp, lp.proc.stdout, "stdout"))
            asyncio.create_task(self._drain_stream(lp, lp.proc.stderr, "stderr"))
            asyncio.create_task(self._wait_process(lp))
        finally:
            lp.is_starting = False

    async def _drain_stream(self, lp: LspProcess, stream: asyncio.StreamReader, name: str) -> None:
        while lp.proc and lp.proc.returncode is None:
            line = await stream.readline()
            if not line:
                break
            txt = line.decode(errors="replace").rstrip("\n")
            lsp_stdio_logger(lp.project_id, lp.lsp_type, name, txt)
            lp.last_activity_ts = time.time()

    async def _wait_process(self, lp: LspProcess) -> None:
        rc = await lp.proc.wait()
        lp.last_exit = rc
        self.log.warning("lsp.exit", extra={"project_id": lp.project_id, "lsp": lp.lsp_type, "returncode": rc})
        now = time.time()
        if (now - lp.last_started_ts) * 1000 <= self.RESTART_WINDOW_MS:
            lp.restarts += 1
        else:
            lp.restarts = 1

        if lp.restarts <= self.MAX_RESTARTS and not lp.is_stopping:
            await self._start_process(lp)
        else:
            self.log.error("lsp.giveup", extra={"project_id": lp.project_id, "lsp": lp.lsp_type, "restarts": lp.restarts})

    async def send_raw(self, project_id: str, lsp_type: LspType, data: bytes) -> None:
        key = (project_id, lsp_type)
        lp = self._procs.get(key)
        if not lp or not lp.proc or not lp.proc.stdin or lp.proc.returncode is not None:
            raise RuntimeError("LSP not running")
        lp.proc.stdin.write(data)
        await lp.proc.stdin.drain()
        lp.last_activity_ts = time.time()

    async def idle_collect(self) -> None:
        while True:
            await asyncio.sleep(30)
            now = time.time()
            ttl = self.IDLE_TTL_MS / 1000.0
            kill: list[LspProcess] = []
            for lp in list(self._procs.values()):
                if lp.proc and lp.proc.returncode is None:
                    if now - lp.last_activity_ts > ttl:
                        kill.append(lp)
            for lp in kill:
                await self.stop(lp.project_id, lp.lsp_type, reason="idle")

    async def stop(self, project_id: str, lsp_type: LspType, reason: str = "manual") -> None:
        key = (project_id, lsp_type)
        lp = self._procs.get(key)
        if not lp or not lp.proc or lp.proc.returncode is not None:
            return
        lp.is_stopping = True
        self.log.info("lsp.stop", extra={"project_id": project_id, "lsp": lsp_type, "reason": reason})
        try:
            lp.proc.send_signal(signal.SIGTERM)
            try:
                await asyncio.wait_for(lp.proc.wait(), timeout=3)
            except asyncio.TimeoutError:
                lp.proc.kill()
        finally:
            lp.is_stopping = False

    def health(self, project_id: str, lsp_type: LspType) -> dict:
        key = (project_id, lsp_type)
        lp = self._procs.get(key)
        if not lp:
            return {"running": False, "reason": "not_created"}
        return {
            "running": (lp.proc is not None and lp.proc.returncode is None),
            "pid": getattr(lp.proc, "pid", None),
            "restarts": lp.restarts,
            "last_exit": lp.last_exit,
            "last_activity_ts": lp.last_activity_ts,
            "started_at": lp.started_at,
        }

# 글로벌 싱글톤
lsp_manager = LspManager()
```

> 포인트  
> - **재시작 정책**: `MAX_RESTARTS` 회/`RESTART_WINDOW_MS` 내 → 초과 시 giveup  
> - **지수 백오프 + 지터**: 서버 플래핑 방지  
> - **유휴 종료**: `LSP_IDLE_TTL_MS` 이후 stop  
> - **stdout/stderr** 라인 단위 파일/구조화 로그

---

## WS ↔ LSP(stdio) 브릿지 + 종료 신호(재연결 유도)

### 경로: `packages/backend/app/api/lsp.py`

```python
# packages/backend/app/api/lsp.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
import asyncio, re
from ..core.lsp_manager import lsp_manager, LspType
from ..core.logging import get_logger, log_lsp_frame

router = APIRouter()
HEADER_RE = re.compile(rb"Content-Length:\s*(\d+)\r\n\r\n", re.I)

@router.websocket("/api/lsp/{lsp_type}")
async def lsp_ws(websocket: WebSocket, lsp_type: LspType, project_id: str = Query(...)):
    await websocket.accept()
    log = get_logger(__name__)
    cwd = f"/app/projects/{project_id}"

    # LSP 프로세스 확보/기동
    lp = await lsp_manager.get_or_start(project_id, lsp_type, cwd)

    # 서버->클라이언트 펌프
    async def pump_server_to_client():
        buf = b""
        try:
            while True:
                if not lp.proc or not lp.proc.stdout or lp.proc.returncode is not None:
                    raise RuntimeError("lsp_down")
                chunk = await lp.proc.stdout.read(4096)
                if not chunk:
                    raise RuntimeError("eof")
                buf += chunk
                while True:
                    m = HEADER_RE.search(buf)
                    if not m: break
                    length = int(m.group(1))
                    start = m.end()
                    if len(buf) - start < length: break
                    body = buf[start:start+length]
                    frame = buf[:start+length]
                    buf = buf[start+length:]
                    # 로깅(응답)
                    log_lsp_frame(direction="out", lsp_type=lsp_type, project_id=project_id, payload=body)
                    await websocket.send_bytes(frame)
        except Exception:
            # 서버 종료/에러 → 클라이언트 재연결 유도
            try:
                await websocket.close(code=4001, reason=f"{lsp_type} restarting")
            except Exception:
                pass

    # 클라이언트->서버 펌프
    async def pump_client_to_server():
        try:
            while True:
                frame = await websocket.receive_bytes()
                # 로깅(요청)
                body = frame.split(b"\r\n\r\n", 1)[1] if b"\r\n\r\n" in frame else b""
                log_lsp_frame(direction="in", lsp_type=lsp_type, project_id=project_id, payload=body)
                await lsp_manager.send_raw(project_id, lsp_type, frame)
        except WebSocketDisconnect:
            pass
        except Exception:
            pass

    tasks = [asyncio.create_task(pump_server_to_client()),
             asyncio.create_task(pump_client_to_server())]
    done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
    for t in pending:
        t.cancel()
```

- LSP 프로세스가 내려가면 **WS close code = `4001`** 로 클라이언트에 알림 → 프론트는 **지수 백오프 자동 재연결** 수행  
- LSP 프레임(Content‑Length 기반)을 **그대로 중계** + **요약 로깅**

---

## 구조화 로깅(요약/상세) + 로그 엔드포인트

### 경로: `packages/backend/app/core/logging.py`

```python
# packages/backend/app/core/logging.py
import logging, os, json, time, pathlib
from collections import deque
from typing import Literal

LOG_LEVEL = os.getenv("LSP_LOG_LEVEL", "INFO").upper()
STDIO_DIR = pathlib.Path(os.getenv("LSP_STDIO_LOG_DIR", "/tmp"))
STDIO_DIR.mkdir(parents=True, exist_ok=True)

# 최근 이벤트 메모리 버퍼 (디버그 엔드포인트용)
_RING = deque(maxlen=2000)

def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        h = logging.StreamHandler()
        h.setFormatter(_JsonFormatter())
        logger.addHandler(h)
        logger.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))
    return logger

class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        base = {
            "ts": int(time.time() * 1000),
            "level": record.levelname,
            "msg": record.getMessage(),
            "logger": record.name,
        }
        if isinstance(record.__dict__.get("extra"), dict):
            base.update(record.__dict__["extra"])
        return json.dumps(base, ensure_ascii=False)

def lsp_stdio_logger(project_id: str, lsp_type: str, stream: str, line: str) -> None:
    # 파일 로그
    fn = STDIO_DIR / f"{project_id}.{lsp_type}.{stream}.log"
    with fn.open("a", encoding="utf-8") as f:
        f.write(line + "\n")
    # 샘플 구조화 로그
    get_logger("lsp.stdio").debug("stdio", extra={"project_id": project_id, "lsp": lsp_type, "stream": stream})

def log_lsp_frame(direction: Literal["in","out"], lsp_type: str, project_id: str, payload: bytes) -> None:
    try:
        obj = json.loads(payload.decode("utf-8"))
        method = obj.get("method")
        _id = obj.get("id")
        size = len(payload)
        rec = {"direction": direction, "method": method, "id": _id, "bytes": size,
               "project_id": project_id, "lsp": lsp_type}
        _RING.append(rec)
        # 기본은 메타만 출력
        get_logger("lsp.frame").debug("frame", extra=rec)
        # TRACE 모드일 때만 페이로드 출력(운영환경에서는 비활성 권장)
    except Exception:
        pass

def read_ring(n: int = 200) -> list:
    return list(_RING)[-n:]
```

### 경로: `packages/backend/app/api/lsp_debug.py`

```python
# packages/backend/app/api/lsp_debug.py
from fastapi import APIRouter, Query
from ..core.lsp_manager import lsp_manager, LspType
from ..core.logging import read_ring

router = APIRouter()

@router.get("/api/lsp/health")
def lsp_health(project_id: str, lsp_type: LspType):
    return lsp_manager.health(project_id, lsp_type)

@router.post("/api/lsp/restart/{lsp_type}")
async def lsp_restart(lsp_type: LspType, project_id: str = Query(...)):
    await lsp_manager.stop(project_id, lsp_type, reason="api_restart")
    return {"success": True}

@router.get("/api/lsp/logs")
def lsp_logs(n: int = 200):
    return {"events": read_ring(n)}
```

> **안전 가이드**  
> - `/api/lsp/logs` 는 **메타데이터(메서드명/ID/바이트 수)** 위주로 노출합니다.  
> - 코드/문서 페이로드는 기본적으로 로그에 남기지 않습니다(민감정보 보호).  
> - 상세 페이로드가 꼭 필요할 때에만 개발 환경에서 로그 레벨을 올려 제한적으로 활성화하세요.

---

## 프론트엔드: 자동 재연결 + 상태 인디케이터

### 경로: `packages/frontend/src/lsp/pythonLspClient.ts`

```ts
// packages/frontend/src/lsp/pythonLspClient.ts
import * as monaco from 'monaco-editor';
import {
  CloseAction, ErrorAction, MonacoLanguageClient, MessageTransports
} from 'monaco-languageclient';
import { toSocket, WebSocketMessageReader, WebSocketMessageWriter } from 'vscode-ws-jsonrpc';

export type LspType = 'pyright' | 'ruff';

interface LspClientHandle {
  dispose: () => void;
  status(): 'connecting' | 'ready' | 'reconnecting' | 'closed';
}

export function connectLspWithAutoRetry(
  lspType: LspType,
  projectId: string,
  onStatus?: (s: LspClientHandle['status']) => void
): LspClientHandle {
  let ws: WebSocket | null = null;
  let client: MonacoLanguageClient | null = null;
  let closed = false;
  let state: LspClientHandle['status'] = 'connecting';
  const setState = (s: LspClientHandle['status']) => { state = s; onStatus?.(s); };

  let attempt = 0;
  const connect = () => {
    if (closed) return;
    setState(attempt === 0 ? 'connecting' : 'reconnecting');

    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${location.host}/api/lsp/${lspType}?project_id=${encodeURIComponent(projectId)}`;
    ws = new WebSocket(url);

    ws.onopen = () => {
      const socket = toSocket(ws!);
      const reader = new WebSocketMessageReader(socket);
      const writer = new WebSocketMessageWriter(socket);
      const transports: MessageTransports = { reader, writer };

      client = new MonacoLanguageClient({
        name: lspType.toUpperCase(),
        clientOptions: {
          documentSelector: [{ language: 'python' }],
          errorHandler: {
            error: () => ({ action: ErrorAction.Continue }),
            closed: () => ({ action: CloseAction.DoNotRestart }),
          },
        },
        connectionProvider: { get: async () => transports },
      });

      client.start();
      setState('ready');
      attempt = 0;
    };

    ws.onclose = () => {
      if (closed) return;
      setState('reconnecting');
      try { client?.stop(); } catch {}
      const base = Math.min(30, 2 ** attempt); // 지수 백오프(최대 30s)
      const jitter = Math.random() * 0.5;
      attempt += 1;
      setTimeout(connect, (base + jitter) * 1000);
    };

    ws.onerror = () => { /* onclose에서 처리 */ };
  };

  connect();

  return {
    dispose() {
      closed = true;
      try { client?.stop(); } catch {}
      try { ws?.close(); } catch {}
      setState('closed');
    },
    status() { return state; },
  };
}
```

**IDE 통합 팁 (예: `IdeModal.tsx`)**

```ts
// 예시: LSP 연결/해제 & 상태표시
import { useEffect, useState } from 'react';
import { connectLspWithAutoRetry } from '../../lsp/pythonLspClient';

const [pyStatus, setPyStatus] = useState<'connecting'|'ready'|'reconnecting'|'closed'>('connecting');
const [rfStatus, setRfStatus] = useState<'connecting'|'ready'|'reconnecting'|'closed'>('connecting');

useEffect(() => {
  const py = connectLspWithAutoRetry('pyright', projectId, setPyStatus);
  const rf = connectLspWithAutoRetry('ruff', projectId, setRfStatus);
  return () => { py.dispose(); rf.dispose(); };
}, [projectId]);

// UI 어딘가에 상태 뱃지 표시
// {pyStatus} / {rfStatus}
```

- 백엔드가 **`code=4001`** 로 WS를 닫으면 위 로직이 **지수 백오프**로 자동 재연결  
- “패키지 설치/제거 후” Rebuild 버튼 → `POST /api/lsp/restart/{pyright|ruff}?project_id=...`

---

## FastAPI 메인 애플리케이션 연동

### 경로: `packages/backend/app/main.py` (필요 부분만 예시)

```python
# packages/backend/app/main.py
from fastapi import FastAPI
from app.api import lsp, lsp_debug
from app.core.lsp_manager import lsp_manager
import asyncio

app = FastAPI()

# 기존 라우터들 ...
app.include_router(lsp.router)
app.include_router(lsp_debug.router)

@app.on_event("startup")
async def on_startup():
    # 유휴 LSP 수거 루프 시작
    asyncio.create_task(lsp_manager.idle_collect())
```

---

## Checklist & 운영 팁

- [ ] `VenvManager`가 venv 생성/패키지 설치/제거 시 **`pyrightconfig.json`** 자동(재)생성  
  - 프로젝트 저장 구조상 `packages/backend/projects/<project_id>/venv/` 사용 → `venvPath: "."`, `venv: "venv"` 로 설정  
- [ ] 패키지 변경 직후 UI에서 “**Rebuild LSP**” 버튼 → `POST /api/lsp/restart/pyright?project_id=...` 호출  
- [ ] 로그 확인:
  - 파일: `/var/log/aim-red/lsp/{project}.{lsp}.{stdout|stderr}.log`
  - 메타 이벤트: `GET /api/lsp/logs?n=200`
  - 런타임 레벨: `LSP_LOG_LEVEL=DEBUG` (페이로드 로깅은 개발시에만 잠깐)  
- [ ] 장애 시나리오 대응:
  - Pyright 바이너리 경로 문제 → Dockerfile의 **pnpm global PATH** 확인
  - Ruff 미설치 → `pip show ruff` 확인
  - 권한 문제 → `/app/projects` 볼륨 권한
  - LSP 플래핑 → `MAX_RESTARTS`/`RESTART_WINDOW_MS` 상향, 백오프 최대치 조정

---

## 부록 A: `pyrightconfig.json` 템플릿

> `packages/backend/projects/<project_id>/pyrightconfig.json`

```json
{
  "include": ["."],
  "venvPath": ".",
  "venv": "venv",
  "typeCheckingMode": "basic",
  "reportMissingImports": "warning",
  "analysis": {
    "autoImportCompletions": true
  },
  "extraPaths": ["."]
}
```

- **요지**: Pyright에게 “이 프로젝트 루트의 `venv/`를 써라”라고 알려 **미설치 모듈 경고**, **자동 임포트 제안** 등을 활성화합니다.

---

## 부록 B: 변경 파일 요약

**신규**
- `packages/backend/app/core/logging.py`
- `packages/backend/app/api/lsp_debug.py`

**보강**
- `packages/backend/app/core/lsp_manager.py` (자동 재시작/백오프/유휴수거/로그)
- `packages/backend/app/api/lsp.py` (WS 브릿지 + 종료 코드 통지 + 로깅)
- `packages/backend/Dockerfile` (Node+pnpm+pyright, ruff)
- `docker-compose.dev.yml` / `docker-compose.prod.yml` (env/볼륨/헬스체크)
- `packages/frontend/src/lsp/pythonLspClient.ts` (자동 재연결)
- `packages/frontend/src/types/interface.ts` (LspType 등)

---

### 마무리

위 변경을 적용하면, 컨테이너 환경에서도 **Pyright/Ruff LSP가 안정적으로 구동**되고, **프로세스 다운 시 자동 복구**, **운영에 적합한 구조화 로깅**을 갖춘 VS Code급 IDE 경험을 그대로 제공할 수 있습니다.
