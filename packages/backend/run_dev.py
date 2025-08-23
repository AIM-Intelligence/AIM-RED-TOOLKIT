#!/usr/bin/env python
"""
Development server runner with proper reload configuration
"""

import uvicorn
import os
import sys

if __name__ == "__main__":
    # Check if we should disable reload (for Docker on Windows/WSL2)
    disable_reload = os.environ.get("DISABLE_RELOAD", "false").lower() == "true"
    
    if disable_reload:
        # Run without reload for stability in Docker
        print("Running without reload (DISABLE_RELOAD=true)")
        uvicorn.run(
            "app.main:app",
            host="0.0.0.0",
            port=8000,
            reload=False,
            log_level="info",
        )
    else:
        # Configure reload with specific directories only
        # Watch only the app source code, not projects or venv
        reload_dirs = ["/app/app"]
        
        # Use watchfiles directly with better control
        print(f"Running with reload, watching: {reload_dirs}")
        
        # Set environment variable to help watchfiles
        os.environ["WATCHFILES_IGNORE_PATHS"] = "/app/projects"
        
        uvicorn.run(
            "app.main:app",
            host="0.0.0.0",
            port=8000,
            reload=True,
            reload_dirs=reload_dirs,
            # Don't use reload_excludes as it seems to cause issues
            # Instead rely on reload_dirs to limit what's watched
            reload_delay=0.5,  # Longer delay for stability
            log_level="info",
        )