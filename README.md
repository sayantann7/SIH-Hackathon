# SIH25081 MVP - Kochi Metro Train Scheduling Optimizer

This repository contains a full working MVP for the **Smart AI-driven Train Scheduling System** described in SIH Problem Statement **SIH25081**. 

The goal is to provide Kochi Metro Rail Limited with a **decision-support system** that automates nightly scheduling of trainsets while considering multiple constraints (fitness certificates, job-card status, branding priorities, mileage balancing, cleaning slots, and stabling geometry).

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
sih25081_mvp/
│── backend_main.py       # FastAPI + PuLP backend
│── requirements.txt      # Dependencies
│── README.md             # Project details
│── Dockerfile            # Container build file
│── run.sh                # Helper script
│── data/                 # Synthetic CSV datasets
│    ├── trains.csv
│    ├── fitness.csv
│    ├── jobcard.csv
│    ├── branding.csv
│    ├── mileage.csv
│    ├── cleaning.csv
│    └── stabling.csv
│── static/               # Frontend UI
│    └── index.html
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

➡️ New: Photo ingestion (WhatsApp/logbook) with Groq vision LLM. See [INGESTION.md](./INGESTION.md).

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

## 📝 Detailed Prompt to Recreate MVP

If you need to regenerate this MVP from scratch, use this prompt:

```
Create a full MVP for SIH25081 (AI-driven Train Scheduling for Kochi Metro) with:
- Backend: Python (FastAPI), PuLP for optimization, Pandas for data handling.
- Endpoints: `/api/data` (fetch CSVs), `/api/schedule` (run optimizer, return JSON).
- Constraints: 
  - Fitness expired → cannot run
  - Job card open → must rest
  - Branding priority → must run (add bonus in objective)
  - Cleaning slot capacity (limit trains in cleaning)
  - Mileage balancing → minimize variance
  - What-if simulation: fail_train param forces maintenance
- Objective: Weighted sum of (risk + mileage deviation - branding bonus).
- Datasets: 6 CSVs (trains, fitness, jobcard, branding, mileage, cleaning, stabling).
- Frontend: Minimal HTML/JS page with controls for cleaning capacity and failure simulation, table to display results.
- Deliverables: backend_main.py, requirements.txt, datasets, static/index.html, Dockerfile, README.md.
```