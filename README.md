# SIH25081 MVP - Kochi Metro Train Scheduling Optimizer

This repository contains a working MVP for the Smart AI‑driven Train Scheduling System (Problem Statement SIH25081).

It provides a decision-support backend (FastAPI + PuLP) and a simple frontend to generate daily schedules while considering constraints like fitness certificates, job cards, branding priorities, mileage, cleaning capacity, and stabling.

---

## 📜 Problem Statement (Simplified)
KMRL must decide each night:
- Which trains run in the morning service.
- Which trains remain standby.
- Which trains are taken for maintenance or cleaning.

Currently, this is done manually using spreadsheets and WhatsApp logs, leading to errors, inefficiency, and scalability issues.  
The MVP demonstrates how an AI + optimization-driven system can automate this decision-making with explainability and simulation.

---

## 🛠️ Tech Stack

### **Frontend**
- HTML/CSS/JS (basic MVP UI in `static/index.html`)
- Axios-style fetch calls for backend API
- Tailwind/React can be added later

### **Backend**
- **FastAPI** → REST API for scheduling & data
- **Python PuLP** → Linear optimization & constraint solver (CBC backend)
- **Pandas** → Data handling (CSV datasets)
- **Uvicorn** → ASGI server

### **Machine Learning (Stretch Features)**
- **Scikit-learn** → Baseline classification model
- **TensorFlow/Keras** → Deep neural network (predictive maintenance)
- **NumPy/Pandas** → preprocessing

### **Database/Storage**
- CSV datasets (synthetic mock data in `data/`)
- PostgreSQL/MongoDB can replace later for persistence

### **DevOps / Cloud**
- Dockerfile included → containerize backend
- Google Cloud / DigitalOcean / Vercel for deployment

### **Collaboration**
- GitHub for version control
- Figma/Canva for design
- Trello/Notion for task management

### **Testing**
- PyTest for backend logic
- Jest/Cypress can be added for frontend

---

## 📂 Project Structure

```
.
├─ backend/
│  └─ main.py            # FastAPI + PuLP scheduler and image ingestion
├─ data/                 # CSV datasets
│  ├─ trains.csv
│  ├─ fitness.csv
│  ├─ jobcard.csv
│  ├─ branding.csv
│  ├─ mileage.csv
│  ├─ cleaning.csv
│  └─ stabling.csv
├─ static/
│  └─ index.html         # Simple UI
├─ requirements.txt
├─ Dockerfile
├─ .dockerignore
└─ README.md
```

---

## 📊 Features in MVP

✅ Ingests synthetic datasets for 1000 trains  
✅ Applies constraints (fitness expiry, job-card, branding, cleaning capacity)  
✅ Balances mileage across trains  
✅ Generates daily schedule (Run / Standby / Cleaning / Maintenance)  
✅ Provides reasoning per train (why it was assigned)  
✅ Offers **what-if simulation** (simulate a train failure, adjust cleaning slots)  
✅ Frontend UI to view schedules and rerun optimizer  

➡️ Ingestion: Photo/scan ingestion using Groq Vision LLM to update constraints (branding/fitness/cleaning/jobcard). Set `GROQ_API_KEY` in a `.env` file.

---

## 🔥 Stretch Features

- Classification model for predictive maintenance (risk score for failures)  
- Deep Neural Network for advanced reliability predictions  
- Integration with cloud deployment  
- Richer frontend with charts and dashboards (React/Next.js)  
- Database integration for real-time data ingestion  

---

## 📅 Roadmap

- **Week 1:** Build rule-based PuLP optimizer with mock data  
- **Week 2:** Expose APIs with FastAPI and add frontend visualization  
- **Week 3:** Add simulation features + integrate ML model  
- **Week 4:** Polish UI, prepare pitch and presentation for SIH  

---

---

## � Run Locally (No Docker)

Requirements:
- Python 3.11+
- CBC solver (PuLP will use the built-in CBC in Docker; locally you can use the default CBC bundled with PuLP or install `coin-or-cbc` for your OS)

1) Install dependencies
```cmd
cd "c:\Users\offic\Desktop\SIH Hackathon"
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

2) Set up environment variables with `.env`
Create a file named `.env` in the project root:
```env
GROQ_API_KEY=your_real_groq_api_key_here
# Optional: override model
# GROQ_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
```

3) Start the server
```cmd
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

4) Open the app
- UI: http://localhost:8000
- Data: GET http://localhost:8000/api/data
- Schedule: POST http://localhost:8000/api/schedule
- Ingest image: POST multipart to http://localhost:8000/api/ingest-image

---

## 🐳 Run with Docker

The image exposes port `8000` and the app loads `GROQ_API_KEY` from `.env` at runtime. We also mount `data/` so your CSVs are editable outside the container.

1) Build the image
```cmd
cd "c:\Users\offic\Desktop\SIH Hackathon"
docker build -t kmrl-scheduler:latest .
```

2) Create `.env` (if not already)
```env
GROQ_API_KEY=your_real_groq_api_key_here
# GROQ_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
```

3) Run the container mapping port `8000` and passing `.env`
```cmd
docker run --rm -p 8000:8000 --env-file .env -v "%cd%\data":/app/data kmrl-scheduler:latest
```

4) Open the app
- UI: http://localhost:8000

Notes:
- `.dockerignore` ensures `.env` is not copied into the image. It’s provided at runtime with `--env-file`.
- The container installs `coinor-cbc` so PuLP has a solver available.
- If you need to persist logs or other folders, add additional `-v` volume flags.

---

## Troubleshooting

- 400 Missing GROQ_API_KEY on ingest-image: Ensure `.env` contains `GROQ_API_KEY` and that you passed it with `--env-file` in Docker or placed `.env` in project root for non-Docker runs.
- Only one train in schedule: Ensure you pulled latest code; the result assembly loop was fixed.
- CSV parsing issues: Check timestamp formats; the backend handles mixed formats but malformed columns may still need cleaning.

---

## License

MIT (for MVP demonstration purposes)