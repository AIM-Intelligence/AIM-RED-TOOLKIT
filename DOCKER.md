# Docker Configuration for AIM-RED Toolkit

## Overview
This project uses Docker Compose to containerize both frontend and backend services. The configuration ensures proper file persistence for project data.

## Volume Mount Structure

### Backend Volumes
- `./packages/backend/app:/app/app` - Mounts source code for hot-reload in development
- `./packages/backend/projects:/app/projects` - Persistent storage for project files

### Why This Structure Works
1. **Project Files Persistence**: All project files created/modified by the backend API are stored in `./packages/backend/projects` on the host machine
2. **Hot Reload**: Source code changes in `./packages/backend/app` are immediately reflected in the container
3. **Data Safety**: Project data persists even when containers are recreated

## Running with Docker

### Development Mode
```bash
# Build and start services
docker-compose up --build

# Or run in background
docker-compose up -d --build

# Stop services
docker-compose down

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Production Mode
```bash
# Build and start production services
docker-compose -f docker-compose.prod.yml up --build

# Run in background
docker-compose -f docker-compose.prod.yml up -d --build

# Stop production services
docker-compose -f docker-compose.prod.yml down
```

## File Operations in Docker

The backend performs the following file operations that work correctly with the volume mounts:

1. **Create Project**: Creates a new folder in `/app/projects/{project_id}/`
2. **Save Node Code**: Writes Python files to `/app/projects/{project_id}/{node_id}_{title}.py`
3. **Read Project Structure**: Reads from `/app/projects/projects.json` and `/app/projects/{project_id}/structure.json`
4. **Delete Project**: Removes entire project folder from `/app/projects/{project_id}/`

All these operations map to `./packages/backend/projects/` on the host machine, ensuring:
- Files are accessible from the host for debugging
- Data persists across container restarts
- Multiple developers can share project files

## Troubleshooting

### Permission Issues
If you encounter permission issues with the projects directory:
```bash
# Fix permissions on host
chmod -R 755 packages/backend/projects
```

### Projects Directory Not Found
The projects directory is automatically created by the backend when needed. If missing:
```bash
# Create manually with proper structure
mkdir -p packages/backend/projects
touch packages/backend/projects/.gitkeep
```

### Container Can't Write Files
Ensure the volume mount is correct in docker-compose.yml:
```yaml
volumes:
  - ./packages/backend/projects:/app/projects  # Correct
  # NOT: - ./packages/backend:/app  # This would override the entire app directory
```

## Data Backup

To backup project data:
```bash
# Backup all projects
tar -czf projects-backup-$(date +%Y%m%d).tar.gz packages/backend/projects/

# Restore from backup
tar -xzf projects-backup-20240101.tar.gz
```

## Development vs Production

### Development (docker-compose.yml)
- Mounts source code for hot-reload
- Runs with `--reload` flag
- Frontend on port 5173
- Backend on port 8000

### Production (docker-compose.prod.yml)
- No source code mounting (uses built image)
- No `--reload` flag
- Frontend on port 80 (nginx)
- Backend on port 8000
- Includes restart policies

## Network Configuration

Both services are on the same Docker network (`aim-red-network`), allowing:
- Frontend to reach backend via `http://backend:8000`
- No CORS issues between services
- Isolated from other Docker containers