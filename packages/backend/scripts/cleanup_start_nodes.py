#!/usr/bin/env python3
"""
Clean up old Start and Result node files and remove file references from structure.json
This script removes file references from Start and Result nodes since they don't need Python files.
"""

import json
import os
import sys
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.project_operations import PROJECTS_BASE_PATH

def cleanup_project(project_path: Path) -> bool:
    """
    Clean up a single project by removing file references from Start and Result nodes
    
    Args:
        project_path: Path to the project directory
        
    Returns:
        bool: True if the project was modified, False otherwise
    """
    structure_file = project_path / "structure.json"
    
    if not structure_file.exists():
        print(f"  Structure file not found: {structure_file}")
        return False
    
    # Load structure
    try:
        with open(structure_file, 'r', encoding='utf-8') as f:
            structure = json.load(f)
    except json.JSONDecodeError as e:
        print(f"  Error reading structure.json: {e}")
        return False
    
    modified = False
    
    # Process nodes
    for node in structure.get('nodes', []):
        node_type = node.get('type')
        
        # Remove file references from Start and Result nodes
        if node_type in ['start', 'result']:
            if 'file' in node.get('data', {}):
                # Note the old file for logging
                old_file = project_path / node['data']['file']
                if old_file.exists():
                    print(f"  Found old {node_type} node file: {old_file.name}")
                    # Optionally delete the file if permissions allow
                    try:
                        old_file.unlink()
                        print(f"    Deleted: {old_file.name}")
                    except PermissionError:
                        print(f"    Could not delete (permission denied): {old_file.name}")
                
                # Remove file reference from structure
                del node['data']['file']
                modified = True
                print(f"  Cleaned {node_type} node: {node['id']} (removed file reference)")
    
    # Save updated structure if modified
    if modified:
        try:
            with open(structure_file, 'w', encoding='utf-8') as f:
                json.dump(structure, f, indent=2)
            print(f"  ✓ Updated structure.json")
        except Exception as e:
            print(f"  Error saving structure.json: {e}")
            return False
    else:
        print(f"  No changes needed")
    
    return modified

def main():
    """Main function to process all projects"""
    
    # Check if projects directory exists
    if not PROJECTS_BASE_PATH.exists():
        print(f"Projects directory not found: {PROJECTS_BASE_PATH}")
        return 1
    
    print(f"Cleaning up Start and Result nodes in: {PROJECTS_BASE_PATH}")
    print("=" * 60)
    
    # Get list of project directories
    project_dirs = [d for d in PROJECTS_BASE_PATH.iterdir() 
                    if d.is_dir() and not d.name.startswith('.')]
    
    if not project_dirs:
        print("No projects found")
        return 0
    
    # Process each project
    total_projects = len(project_dirs)
    total_cleaned = 0
    
    for i, project_dir in enumerate(project_dirs, 1):
        print(f"\n[{i}/{total_projects}] Processing project: {project_dir.name}")
        if cleanup_project(project_dir):
            total_cleaned += 1
    
    # Summary
    print("\n" + "=" * 60)
    print(f"Cleanup complete!")
    print(f"  Total projects: {total_projects}")
    print(f"  Modified projects: {total_cleaned}")
    print(f"  Unchanged projects: {total_projects - total_cleaned}")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())