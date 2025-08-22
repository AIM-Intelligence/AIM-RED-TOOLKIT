"""
Virtual Environment Manager
Manages project-specific Python virtual environments
"""

import os
import sys
import subprocess
import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import venv
import shutil


class VenvManager:
    """Manages virtual environments for projects"""
    
    def __init__(self, projects_root: str):
        self.projects_root = Path(projects_root)
    
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
    
    def get_pip_executable(self, project_id: str) -> str:
        """Get the pip executable path for a project's venv"""
        venv_path = self.get_venv_path(project_id)
        
        # Windows vs Unix paths
        if os.name == 'nt':
            pip_exe = venv_path / "Scripts" / "pip.exe"
        else:
            pip_exe = venv_path / "bin" / "pip"
        
        return str(pip_exe)
    
    def venv_exists(self, project_id: str) -> bool:
        """Check if a virtual environment exists for a project"""
        venv_path = self.get_venv_path(project_id)
        python_exe = Path(self.get_python_executable(project_id))
        return venv_path.exists() and python_exe.exists()
    
    def create_venv(self, project_id: str) -> bool:
        """Create a virtual environment for a project"""
        try:
            venv_path = self.get_venv_path(project_id)
            
            # Check if project directory exists first
            project_dir = self.projects_root / project_id
            if not project_dir.exists():
                print(f"Project directory {project_id} does not exist, cannot create venv")
                return False
            
            # Create virtual environment
            venv.create(venv_path, with_pip=True)
            
            # Upgrade pip to latest version
            pip_exe = self.get_pip_executable(project_id)
            subprocess.run(
                [pip_exe, "install", "--upgrade", "pip"],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            # Generate pyrightconfig.json for LSP
            self._generate_pyright_config(project_id)
            
            return True
        except Exception as e:
            print(f"Error creating venv for project {project_id}: {e}")
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
                
            print(f"Generated pyrightconfig.json for project {project_id}")
        except Exception as e:
            print(f"Error generating pyrightconfig.json: {e}")
    
    def ensure_venv(self, project_id: str) -> str:
        """Ensure a virtual environment exists and return the Python executable"""
        if not self.venv_exists(project_id):
            self.create_venv(project_id)
        else:
            # Ensure pyrightconfig.json exists even for existing venvs
            project_dir = self.projects_root / project_id
            config_path = project_dir / "pyrightconfig.json"
            if not config_path.exists():
                self._generate_pyright_config(project_id)
        return self.get_python_executable(project_id)
    
    def install_package(self, project_id: str, package: str) -> Tuple[bool, str]:
        """Install a package in the project's virtual environment"""
        try:
            # Create venv if it doesn't exist (explicit user action)
            if not self.venv_exists(project_id):
                if not self.create_venv(project_id):
                    return False, "Failed to create virtual environment"
            
            pip_exe = self.get_pip_executable(project_id)
            
            result = subprocess.run(
                [pip_exe, "install", package],
                capture_output=True,
                text=True,
                timeout=120
            )
            
            if result.returncode == 0:
                # Regenerate pyrightconfig.json to ensure LSP picks up new packages
                self._generate_pyright_config(project_id)
                return True, result.stdout
            else:
                return False, result.stderr
        except Exception as e:
            return False, str(e)
    
    def uninstall_package(self, project_id: str, package: str) -> Tuple[bool, str]:
        """Uninstall a package from the project's virtual environment"""
        try:
            # Check if venv exists - don't create it for uninstall
            if not self.venv_exists(project_id):
                return False, "Virtual environment does not exist"
            
            pip_exe = self.get_pip_executable(project_id)
            
            result = subprocess.run(
                [pip_exe, "uninstall", "-y", package],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode == 0:
                # Regenerate pyrightconfig.json to ensure LSP picks up removed packages
                self._generate_pyright_config(project_id)
                return True, result.stdout
            else:
                return False, result.stderr
        except Exception as e:
            return False, str(e)
    
    def get_installed_packages(self, project_id: str) -> List[Dict[str, str]]:
        """Get list of installed packages in the project's virtual environment"""
        try:
            # Check if venv exists first, don't create it
            if not self.venv_exists(project_id):
                return []  # Return empty list if no venv exists yet
            
            pip_exe = self.get_pip_executable(project_id)
            
            # Get package list in JSON format
            result = subprocess.run(
                [pip_exe, "list", "--format=json"],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                packages = json.loads(result.stdout)
                return packages
            else:
                return []
        except Exception as e:
            print(f"Error getting packages for project {project_id}: {e}")
            return []
    
    def get_package_info(self, project_id: str, package: str) -> Optional[Dict]:
        """Get detailed information about a specific package"""
        try:
            # Check if venv exists first, don't create it
            if not self.venv_exists(project_id):
                return None  # Return None if no venv exists yet
            
            pip_exe = self.get_pip_executable(project_id)
            
            result = subprocess.run(
                [pip_exe, "show", package],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                # Parse the output
                info = {}
                for line in result.stdout.strip().split('\n'):
                    if ': ' in line:
                        key, value = line.split(': ', 1)
                        info[key.lower().replace('-', '_')] = value
                return info
            else:
                return None
        except Exception as e:
            print(f"Error getting package info: {e}")
            return None
    
    def execute_in_venv(self, project_id: str, code: str, timeout: int = 30) -> Dict:
        """Execute Python code in the project's virtual environment"""
        import tempfile
        
        try:
            python_exe = self.ensure_venv(project_id)
            
            # Create temporary file for code
            with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as temp_file:
                temp_file.write(code)
                temp_file_path = temp_file.name
            
            try:
                # Execute code with project's Python interpreter
                result = subprocess.run(
                    [python_exe, temp_file_path],
                    capture_output=True,
                    text=True,
                    timeout=timeout,
                    cwd=str(self.projects_root / project_id)  # Set working directory to project
                )
                
                return {
                    "output": result.stdout,
                    "error": result.stderr if result.stderr else None,
                    "exit_code": result.returncode
                }
            finally:
                os.unlink(temp_file_path)
                
        except subprocess.TimeoutExpired:
            return {
                "output": "",
                "error": "Code execution timed out",
                "exit_code": -1
            }
        except Exception as e:
            return {
                "output": "",
                "error": str(e),
                "exit_code": -1
            }
    
    def delete_venv(self, project_id: str) -> bool:
        """Delete the virtual environment for a project"""
        try:
            venv_path = self.get_venv_path(project_id)
            if venv_path.exists():
                shutil.rmtree(venv_path)
            return True
        except Exception as e:
            print(f"Error deleting venv for project {project_id}: {e}")
            return False