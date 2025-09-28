@echo off
echo Building React frontend...
cd frontend_new
call npm run build
cd ..

echo Starting Python backend (with React frontend)...
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

pause