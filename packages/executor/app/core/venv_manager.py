"""
Async Virtual Environment Manager with Status Tracking
Manages background venv creation with progress monitoring
"""

import asyncio
import os
import sys
import subprocess
import json
import time
from pathlib import Path
from typing import Dict, Optional, Literal
from enum import Enum
from datetime import datetime
import threading
from concurrent.futures import ThreadPoolExecutor

class VenvStatus(str, Enum):
    """Virtual environment creation status"""
    NOT_STARTED = "not_started"
    CREATING = "creating"
    INSTALLING_PIP = "installing_pip"
    INSTALLING_BASE = "installing_base"
    INSTALLING_LSP = "installing_lsp"
    COMPLETED = "completed"
    FAILED = "failed"

class VenvCreationTask:
    """Tracks a single venv creation task"""
    
    def __init__(self, project_id: str):
        self.project_id = project_id
        self.status = VenvStatus.NOT_STARTED
        self.progress = 0  # 0-100
        self.message = "Not started"
        self.error: Optional[str] = None
        self.started_at: Optional[datetime] = None
        self.completed_at: Optional[datetime] = None
        self.current_package: Optional[str] = None
        
    def to_dict(self) -> Dict:
        """Convert to dictionary for API response"""
        return {
            "project_id": self.project_id,
            "status": self.status,
            "progress": self.progress,
            "message": self.message,
            "error": self.error,
            "current_package": self.current_package,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "duration_sec": (
                (self.completed_at - self.started_at).total_seconds()
                if self.started_at and self.completed_at
                else None
            )
        }

class AsyncVenvManager:
    """Manages async virtual environment creation with status tracking"""
    
    def __init__(self, projects_root: str):
        self.projects_root = Path(projects_root)
        self.tasks: Dict[str, VenvCreationTask] = {}
        self.executor = ThreadPoolExecutor(max_workers=3)  # Limit concurrent venv creations
        self._lock = threading.Lock()
        
        # Base packages to install
        self.base_packages = [
            "fastapi==0.115.5",
            "uvicorn[standard]==0.32.1",
            "pydantic==2.10.3",
            "httpx==0.28.1",
            "aiofiles==24.1.0",
            "websockets==14.1",
            "python-multipart==0.0.12",
        ]
        
        self.lsp_packages = [
            "pyright",
            "ruff==0.8.6"
        ]
    
    def get_venv_path(self, project_id: str) -> Path:
        """Get the virtual environment path for a project"""
        return self.projects_root / project_id / "venv"
    
    def get_python_executable(self, project_id: str) -> str:
        """Get the Python executable path for a project's venv"""
        venv_path = self.get_venv_path(project_id)
        
        # Windows vs Unix paths
        if os.name == 'nt':
            python_exe = venv_path / "Scripts" / "python.exe"
        else:
            python_exe = venv_path / "bin" / "python"
        
        return str(python_exe)
    
    def venv_exists(self, project_id: str) -> bool:
        """Check if a virtual environment exists for a project"""
        venv_path = self.get_venv_path(project_id)
        python_exe = Path(self.get_python_executable(project_id))
        return venv_path.exists() and python_exe.exists()
    
    def get_status(self, project_id: str) -> Optional[Dict]:
        """Get the status of a venv creation task"""
        with self._lock:
            task = self.tasks.get(project_id)
            return task.to_dict() if task else None
    
    def is_creating(self, project_id: str) -> bool:
        """Check if venv is currently being created"""
        with self._lock:
            task = self.tasks.get(project_id)
            return task and task.status in [
                VenvStatus.CREATING,
                VenvStatus.INSTALLING_PIP,
                VenvStatus.INSTALLING_BASE,
                VenvStatus.INSTALLING_LSP
            ]
    
    async def create_venv_async(self, project_id: str) -> Dict:
        """Start async venv creation and return immediately"""
        
        # Check if already exists
        if self.venv_exists(project_id):
            return {
                "success": True,
                "message": "Virtual environment already exists",
                "status": VenvStatus.COMPLETED
            }
        
        # Check if already creating
        if self.is_creating(project_id):
            return {
                "success": False,
                "message": "Virtual environment creation already in progress",
                "status": self.tasks[project_id].status
            }
        
        # Create task and start in background
        with self._lock:
            task = VenvCreationTask(project_id)
            task.status = VenvStatus.CREATING
            task.started_at = datetime.now()
            task.message = "Starting virtual environment creation..."
            self.tasks[project_id] = task
        
        # Submit to executor for background processing
        future = self.executor.submit(self._create_venv_sync, project_id)
        
        # Don't wait for completion - return immediately
        return {
            "success": True,
            "message": "Virtual environment creation started",
            "status": VenvStatus.CREATING,
            "task_id": project_id
        }
    
    def _create_venv_sync(self, project_id: str) -> bool:
        """Synchronous venv creation with progress updates"""
        task = self.tasks[project_id]
        
        try:
            venv_path = self.get_venv_path(project_id)
            project_dir = self.projects_root / project_id
            
            # Ensure project directory exists
            project_dir.mkdir(parents=True, exist_ok=True)
            
            # Step 1: Create venv (30% progress)
            task.status = VenvStatus.CREATING
            task.progress = 10
            task.message = "Creating virtual environment structure..."
            
            print(f"[AsyncVenv] Creating virtual environment at {venv_path}...")
            
            # Use --copies to avoid symlinks which can be problematic in Docker
            result = subprocess.run(
                [sys.executable, "-m", "venv", "--copies", str(venv_path)],
                capture_output=True,
                text=True,
                timeout=300  # 5 minutes timeout
            )
            
            if result.returncode != 0:
                raise Exception(f"Failed to create venv: {result.stderr}")
            
            task.progress = 30
            task.message = "Virtual environment created, setting up pip..."
            
            # Step 2: Ensure pip (40% progress)
            task.status = VenvStatus.INSTALLING_PIP
            python_exe = self.get_python_executable(project_id)
            
            # Ensure pip is available
            result = subprocess.run(
                [python_exe, "-m", "ensurepip", "--upgrade", "--default-pip"],
                capture_output=True,
                text=True,
                timeout=120
            )
            
            # Upgrade pip
            subprocess.run(
                [python_exe, "-m", "pip", "install", "--upgrade", "pip", "setuptools", "wheel"],
                capture_output=True,
                text=True,
                timeout=120
            )
            
            task.progress = 40
            task.message = "Installing base packages..."
            
            # Step 3: Install base packages (40-70% progress)
            task.status = VenvStatus.INSTALLING_BASE
            task.progress = 40
            task.message = "Installing base packages..."
            
            # Install all base packages at once for better performance
            print(f"[AsyncVenv] Installing base packages for project {project_id}...")
            task.current_package = "base packages"
            
            result = subprocess.run(
                [python_exe, "-m", "pip", "install", "--no-cache-dir", "--no-warn-script-location"] + self.base_packages,
                capture_output=True,
                text=True,
                timeout=300  # 5 minutes for all base packages
            )
            
            if result.returncode != 0:
                print(f"[AsyncVenv] Warning: Some packages failed to install: {result.stderr[:500]}")
                # Try installing them one by one as fallback
                for i, package in enumerate(self.base_packages):
                    task.current_package = package
                    task.progress = 40 + int((i / len(self.base_packages)) * 30)
                    subprocess.run(
                        [python_exe, "-m", "pip", "install", "--no-cache-dir", "--no-warn-script-location", package],
                        capture_output=True,
                        text=True,
                        timeout=120
                    )
            
            task.progress = 70
            task.message = "Installing LSP servers..."
            
            # Step 4: Install LSP servers (70-90% progress)
            task.status = VenvStatus.INSTALLING_LSP
            task.current_package = "LSP servers"
            
            print(f"[AsyncVenv] Installing LSP servers for project {project_id}...")
            
            # Install both LSP servers together
            result = subprocess.run(
                [python_exe, "-m", "pip", "install", "--no-cache-dir", "--no-warn-script-location"] + self.lsp_packages,
                capture_output=True,
                text=True,
                timeout=360  # 6 minutes for LSP servers (they can be large)
            )
            
            if result.returncode != 0:
                print(f"[AsyncVenv] Warning: LSP installation had issues: {result.stderr[:500]}")
                # Try installing them one by one as fallback
                for i, package in enumerate(self.lsp_packages):
                    task.current_package = package
                    task.progress = 70 + int((i / len(self.lsp_packages)) * 20)
                    subprocess.run(
                        [python_exe, "-m", "pip", "install", "--no-cache-dir", "--no-warn-script-location", package],
                        capture_output=True,
                        text=True,
                        timeout=240
                    )
            
            # Step 5: Generate pyrightconfig.json (90-100% progress)
            task.progress = 90
            task.message = "Generating configuration files..."
            self._generate_pyright_config(project_id)
            
            # Mark as completed
            task.status = VenvStatus.COMPLETED
            task.progress = 100
            task.message = "Virtual environment ready"
            task.completed_at = datetime.now()
            task.current_package = None
            
            print(f"[AsyncVenv] Successfully created venv for project {project_id}")
            return True
            
        except subprocess.TimeoutExpired as e:
            task.status = VenvStatus.FAILED
            task.error = f"Timeout during venv creation: {str(e)}"
            task.message = "Creation timed out"
            task.completed_at = datetime.now()
            print(f"[AsyncVenv] Timeout creating venv for project {project_id}: {e}")
            return False
            
        except Exception as e:
            task.status = VenvStatus.FAILED
            task.error = str(e)
            task.message = "Creation failed"
            task.completed_at = datetime.now()
            print(f"[AsyncVenv] Error creating venv for project {project_id}: {e}")
            return False
    
    def _generate_pyright_config(self, project_id: str):
        """Generate pyrightconfig.json for the project"""
        try:
            project_dir = self.projects_root / project_id
            config_path = project_dir / "pyrightconfig.json"
            
            config = {
                "include": ["."],
                "venvPath": ".",
                "venv": "venv",
                "typeCheckingMode": "standard",
                "reportMissingImports": "warning",
                "reportMissingTypeStubs": "none",
                "pythonVersion": "3.11",
                "analysis": {
                    "autoImportCompletions": True,
                    "useLibraryCodeForTypes": True,
                    "autoSearchPaths": True,
                    "diagnosticMode": "workspace"
                },
                "extraPaths": ["."]
            }
            
            with open(config_path, 'w') as f:
                json.dump(config, f, indent=2)
                
            print(f"[AsyncVenv] Generated pyrightconfig.json for project {project_id}")
        except Exception as e:
            print(f"[AsyncVenv] Error generating pyrightconfig.json: {e}")
    
    def cleanup_old_tasks(self, max_age_hours: int = 24):
        """Clean up old completed or failed tasks"""
        with self._lock:
            now = datetime.now()
            to_remove = []
            
            for project_id, task in self.tasks.items():
                if task.completed_at:
                    age = (now - task.completed_at).total_seconds() / 3600
                    if age > max_age_hours:
                        to_remove.append(project_id)
            
            for project_id in to_remove:
                del self.tasks[project_id]
    
    def delete_venv(self, project_id: str) -> None:
        """Delete a project's virtual environment"""
        venv_path = self.get_venv_path(project_id)
        if venv_path.exists():
            import shutil
            shutil.rmtree(venv_path)
            print(f"Deleted virtual environment at {venv_path}")