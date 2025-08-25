# AIM-Forge

A visual flow-based Python IDE with VS Code-level development experience through Language Server Protocol (LSP) integration. Build, connect, and execute Python code nodes in an intuitive visual environment with real-time code intelligence.

## Architecture

The system uses a microservices architecture with three main components:

- **Frontend**: React-based UI with Monaco Editor and XYFlow for visual programming
- **Backend**: FastAPI service handling project metadata and node-edge structures
- **Executor**: Dedicated Python execution environment with LSP servers and virtual environments

## Features

- **Visual Flow Programming**: Create and connect Python nodes in an interactive diagram
- **VS Code-Level Intelligence**: Full LSP support with Pyright and Ruff
  - Real-time type checking and auto-completion
  - Intelligent code suggestions based on installed packages
  - Instant linting and formatting
  - Go to definition and hover information
- **Project Isolation**: Each project has its own Python virtual environment in the executor
- **Auto-Recovery**: LSP processes automatically restart with exponential backoff
- **Docker-Ready**: Fully containerized with production-ready configurations

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Node.js 20+ and pnpm (for local development)
- Python 3.11+ (for local development)
- NEVER erase "projects" folder in backend directory!

### 🚀 Running with Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/AIM-Intelligence/AIM-RED-TOOLKIT.git
cd aim-red-toolkit

# Start services
docker-compose up --build

# Access the application
# Frontend: http://localhost:5173
# Backend API: http://localhost:8000
# Executor API: http://localhost:8001 (internal service)
# API Docs: http://localhost:8000/docs
```

## Usage Guide

### Creating Your First Project

1. **Open the application** at http://localhost:5173
2. **Create a new project** using the "New Project" button
3. **Add nodes** to your flow:
   - **Start Node**: Entry point for flow execution
   - **Default Node**: Write Python code that processes data
   - **Result Node**: Display output from connected nodes
4. **Connect nodes** by dragging from output to input ports
5. **Write code** in custom nodes - enjoy full IntelliSense!
6. **Execute the flow** from any start node

## Docker Commands

```bash
# Build images
docker-compose build

# Start services
docker-compose up

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f

# Check LSP logs specifically
docker-compose logs -f backend | grep LSP

# Stop services
docker-compose down

# Clean everything (including volumes)
docker-compose down -v
```

## Environment Variables

### Backend

```bash
EXECUTOR_URL=http://executor:8001  # Executor service URL
```

### Executor (LSP & Execution Configuration)

```bash
LSP_LOG_LEVEL=DEBUG          # Log level: DEBUG, INFO, WARNING, ERROR
LSP_IDLE_TTL_MS=600000       # Idle timeout before stopping LSP (10 min)
LSP_MAX_RESTARTS=5           # Max restart attempts
LSP_RESTART_WINDOW_MS=60000  # Time window for restart counting
TERMINAL_IDLE_TIMEOUT_MS=600000    # Terminal idle timeout (10 min)
TERMINAL_MAX_SESSION_MS=3600000    # Max terminal session (1 hour)
```

### Frontend

```bash
VITE_API_URL=http://backend:8000  # Backend API URL
```

### Container Issues

```bash
# Rebuild containers after dependency changes
docker-compose build --no-cache

# Check container logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Access backend container
docker exec -it aim-red-backend-dev bash

# Check if pyright is installed
docker exec aim-red-backend-dev pyright --version
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT

## Support

For issues and questions:

- GitHub Issues: [Report bugs or request features](https://github.com/AIM-Intelligence/AIM-RED-TOOLKIT/issues)
- Documentation: Check `/docs` folder for detailed guides
- https://aim-intelligence.com
