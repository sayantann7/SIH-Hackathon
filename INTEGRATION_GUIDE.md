# Frontend-Backend Integration Troubleshooting

## Common Issues and Solutions

### 1. CORS Errors
**Problem:** Browser shows CORS policy errors when React app tries to call backend API.

**Solution:** 
- Ensure the backend includes CORS middleware (already configured)
- Make sure you're using the development proxy (Vite config set to proxy `/api` to `http://localhost:8000`)

### 2. API Connection Failed
**Problem:** React app can't connect to Python backend.

**Solution:**
- Start backend server: `python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload`
- Verify backend is running at http://localhost:8000/api/data
- Check that Vite dev server is running on port 5173

### 3. Backend Module Import Errors
**Problem:** `ModuleNotFoundError` when starting backend.

**Solution:**
- Activate virtual environment: `.venv\Scripts\activate`
- Install requirements: `pip install -r requirements.txt`
- Run from project root: `python -m uvicorn backend.main:app --reload`

### 4. React Build Issues
**Problem:** `npm run build` fails or `run-full-stack.bat` doesn't work.

**Solution:**
- Check Node.js is installed: `node --version`
- Install dependencies: `cd frontend_new && npm install`
- Try manual build: `npm run build`

### 5. Environment Variables
**Problem:** Groq API integration fails with "Missing GROQ_API_KEY".

**Solution:**
- Create `.env` file in project root (not in frontend_new folder)
- Add: `GROQ_API_KEY=your_actual_api_key`
- Restart backend server

### 6. Port Conflicts
**Problem:** "Port already in use" errors.

**Solution:**
- Backend (port 8000): Check for other FastAPI/Python apps
- Frontend (port 5173): Check for other Vite/React apps
- Change ports in scripts if needed

## Development Workflow

### Method 1: Automated (Recommended)
```cmd
# Start both servers
run-dev-servers.bat

# Open React app
# http://localhost:5173
```

### Method 2: Manual
```cmd
# Terminal 1: Start backend
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Start React frontend
cd frontend_new
npm run dev
```

### Method 3: Production Build
```cmd
# Build React app and serve through backend
run-full-stack.bat

# Open integrated app
# http://localhost:8000
```

## Testing Integration

Run the integration test:
```cmd
# Make sure backend is running first
python test_integration.py
```

## File Structure Check

Make sure you have:
```
SIH Hackathon/
├── backend/main.py           ✅ FastAPI server with CORS
├── frontend_new/
│   ├── src/api/client.js     ✅ API calls to backend
│   ├── vite.config.js        ✅ Proxy configuration
│   └── package.json          ✅ Dependencies
├── .env                      ✅ Environment variables
├── run-dev-servers.bat       ✅ Development script
└── run-full-stack.bat        ✅ Production script
```

## API Endpoints

The React app uses these backend endpoints:
- `GET /api/data` - Fetch CSV datasets
- `POST /api/schedule` - Generate schedule with parameters
- `POST /api/ingest-image` - Upload and process images

All are CORS-enabled and proxied through Vite during development.