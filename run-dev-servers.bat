@echo off
echo Starting development servers...
echo.
echo Starting Python backend on port 8000...
start "Backend" cmd /k "python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload"

echo Waiting 3 seconds for backend to start...
timeout /t 3 /nobreak >nul

echo Starting React frontend on port 5173...
start "Frontend" cmd /k "cd frontend_new && npm run dev"

echo.
echo Both servers are starting:
echo - Backend API: http://localhost:8000
echo - React Frontend: http://localhost:5173
echo.
echo The React app will proxy API calls to the Python backend.
pause