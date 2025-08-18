# AIM-RED Toolkit

A web-based Python IDE with React frontend and FastAPI backend, fully containerized with Docker.

## Features

- **Frontend**: React + TypeScript + Vite + Tailwind CSS + XYFlow
- **Backend**: FastAPI for Python code execution
- **Containerized**: Full Docker support for easy deployment

## Quick Start with Docker

### Development Mode

```bash
# Clone the repository
git clone https://github.com/AIM-Intelligence/AIM-RED-TOOLKIT.git
cd aim-red-toolkit

# Start services in development environment with Docker Compose
docker-compose up --build

# Access the application
# Frontend: http://localhost:5173
# Backend API: http://localhost:8000
```

### Production Mode

```bash
# Build and run production containers
docker-compose -f docker-compose.prod.yml up --build

# Access the application at http://localhost, using nginx
```

## Development without Docker

### Prerequisites

- Node.js 20+
- Python 3.11+
- pnpm package manager

### Installation

```bash
# Install pnpm globally
npm install -g pnpm

# Install dependencies
pnpm install

# Install Python dependencies
cd packages/backend
pip install -r requirements.txt
cd ../..
```

### Running the Application

```bash
# Run both frontend and backend
pnpm dev

# Or run separately
pnpm frontend:dev  # Frontend on http://localhost:5173
pnpm backend:dev   # Backend on http://localhost:8000
```

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

# Stop services
docker-compose down

# Remove volumes
docker-compose down -v
```

## API Endpoints

- `GET /` - Root endpoint
- `GET /api/health` - Health check
- `POST /api/execute` - Execute Python code
- `GET /api/version` - Get Python and API version

## Security Notes

The backend executes Python code in the container. For production use, consider:

- Implementing code sandboxing
- Adding resource limits
- Using separate execution containers
- Implementing authentication

## License

MIT
