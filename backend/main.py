"""
Entrypoint for running the FastAPI application.
Run via:
    python -m uvicorn backend.main:app --reload
or:
    python backend/main.py
"""
from backend.app.main import app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
