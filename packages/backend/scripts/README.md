# Backend Scripts

This directory contains utility and maintenance scripts for the AIM-RED Toolkit backend.

## Scripts

### cleanup_start_nodes.py
Removes unnecessary file references from Start and Result nodes in project structure files.

**Purpose**: Start and Result nodes don't need Python code files, but older versions of the system created them. This script cleans up these references.

**Usage**:
```bash
cd packages/backend
python scripts/cleanup_start_nodes.py
```

**What it does**:
1. Scans all projects in the `projects/` directory
2. Removes `file` field from Start and Result nodes in `structure.json`
3. Optionally deletes the orphaned Python files (if permissions allow)
4. Reports on changes made

## Adding New Scripts

When adding new utility scripts:
1. Place them in this `scripts/` directory
2. Use the project's core modules by importing from `app.core`
3. Document the script's purpose and usage in this README
4. Make scripts executable with `#!/usr/bin/env python3`