# syntax=docker/dockerfile:1.7

# Use a slim Python base image
FROM python:3.11-slim

# Prevent Python from writing .pyc files and enable unbuffered logs
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Set workdir
WORKDIR /app

# System deps (if pandas needs additional libs)
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential curl coinor-cbc \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency lists first for better caching
COPY requirements.txt ./

# Install python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY backend ./backend
COPY static ./static
COPY data ./data
COPY README.md ./README.md

# Expose FastAPI port
EXPOSE 8000

# Default environment (can be overridden at runtime)
# The app reads GROQ_API_KEY via python-dotenv (load_dotenv), and we also allow
# passing it with `--env-file .env` or `-e GROQ_API_KEY=...` when running.

# Start the server
CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
