from fastapi import FastAPI, Request, Form
from fastapi.responses import JSONResponse, HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import pandas as pd
import os
import json
import pulp
from typing import Dict, Any
from pathlib import Path
import math

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

app = FastAPI(title="KMRL Scheduler MVP")

# serve static files at '/static' (Starlette requires leading slash)
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")

def load_csv(name):
    p = DATA_DIR / name
    return pd.read_csv(p)

def df_records_safe(df: pd.DataFrame):
    """Convert DataFrame to list[dict] with NaN/inf replaced by None for JSON compliance."""
    # Replace NaN/inf with None
    df_clean = df.copy()
    # Replace NaN
    df_clean = df_clean.where(pd.notna(df_clean), None)
    # Replace +/-inf
    for col in df_clean.columns:
        df_clean[col] = df_clean[col].apply(
            lambda v: (None if _is_nan_or_inf(v) else v)
        )
    return df_clean.to_dict(orient="records")

def _is_nan_or_inf(v) -> bool:
    try:
        return math.isnan(v) or math.isinf(v)
    except Exception:
        return False

def safe_number(v):
    """Return None for NaN/inf, otherwise the original value."""
    try:
        if math.isnan(v) or math.isinf(v):
            return None
    except Exception:
        pass
    return v

@app.get("/", response_class=HTMLResponse)
def root():
    return FileResponse(str(BASE_DIR / "static" / "index.html"))

@app.get("/api/data")
def api_data():
    # return all CSVs for frontend display
    files = {}
    for f in os.listdir(DATA_DIR):
        if f.endswith(".csv"):
            df = pd.read_csv(DATA_DIR / f)
            files[f] = df_records_safe(df)
    return JSONResponse(files)

@app.post("/api/schedule")
def api_schedule(params: Dict[Any, Any] = None):
    """
    Build and solve a PuLP scheduler using synthetic CSV data.
    Accepts optional JSON params to modify capacities or simulate a train failure.
    """
    # load data
    def latest_by_train(path: Path):
        df = pd.read_csv(path)
        # Normalize train_id early and drop empty ids
        if "train_id" in df.columns:
            df["train_id"] = df["train_id"].astype(str).str.strip()
            df = df[df["train_id"].notna() & (df["train_id"] != "")]

        if "timestamp" in df.columns:
            # Parse mixed formats safely; invalids -> NaT, place NaT last in sort
            df["timestamp"] = pd.to_datetime(df["timestamp"], format="mixed", errors="coerce")
            df = df.sort_values(["train_id", "timestamp"], na_position="last").groupby("train_id", as_index=False).tail(1)
        else:
            # No timestamp column: keep the last occurrence per train_id
            if "train_id" in df.columns:
                df = df.drop_duplicates(subset=["train_id"], keep="last")

        # Final safeguard: ensure uniqueness of index
        if "train_id" in df.columns:
            df = df.drop_duplicates(subset=["train_id"], keep="last")
        return df.set_index("train_id").to_dict(orient="index")

    trains_df = pd.read_csv(DATA_DIR / "trains.csv")
    if "train_id" in trains_df.columns:
        trains_df["train_id"] = trains_df["train_id"].astype(str).str.strip()
    trains_info = {}
    if "train_id" in trains_df.columns:
        try:
            trains_info = trains_df.set_index("train_id").to_dict(orient="index")
        except Exception:
            # fallback if duplicate ids exist
            trains_df = trains_df.drop_duplicates(subset=["train_id"], keep="last")
            trains_info = trains_df.set_index("train_id").to_dict(orient="index")
    fitness = latest_by_train(DATA_DIR / "fitness.csv")
    jobcard = latest_by_train(DATA_DIR / "jobcard.csv")
    branding = latest_by_train(DATA_DIR / "branding.csv")
    mileage = latest_by_train(DATA_DIR / "mileage.csv")
    cleaning = latest_by_train(DATA_DIR / "cleaning.csv")
    stabling = latest_by_train(DATA_DIR / "stabling.csv")

    # optionally accept overrides via params
    overrides = params or {}
    cleaning_capacity = int(overrides.get("cleaning_capacity", 3))
    fail_train = overrides.get("fail_train", None)  # simulate sudden failure
    # Advanced tuning parameters with safe defaults (non-binding unless specified)
    min_run = int(overrides.get("min_run", 1))
    max_run = int(overrides.get("max_run", len(trains_df)))
    maintenance_capacity = int(overrides.get("maintenance_capacity", len(trains_df)))
    min_standby = int(overrides.get("min_standby", 0))
    max_standby = int(overrides.get("max_standby", len(trains_df)))
    min_branded_run = int(overrides.get("min_branded_run", 0))
    run_min_fitness_score = float(overrides.get("run_min_fitness_score", 0.0))
    min_clean_due = int(overrides.get("min_clean_due", 0))

    # Prefer train IDs from trains.csv if available; otherwise from fitness keys
    if "train_id" in trains_df.columns:
        train_ids = list(trains_df["train_id"].astype(str).unique())
    else:
        train_ids = list(fitness.keys())
    states = ["run", "standby", "maintenance", "cleaning"]

    def safe_float(v, default: float = 0.0) -> float:
        try:
            f = float(v)
            if math.isnan(f) or math.isinf(f):
                return default
            return f
        except Exception:
            return default

    # create variables
    x = pulp.LpVariable.dicts("assign", (train_ids, states), cat="Binary")

    # model
    model = pulp.LpProblem("KMRL_Scheduler", pulp.LpMinimize)

    # optionally compute sets used by constraints
    branded_trains = [t for t in train_ids if safe_float(branding.get(t, {}).get("priority", 0.0), 0.0) > 0]
    needs_cleaning = {t: (0 if cleaning.get(t) else 1) or (1 if int(safe_float(cleaning.get(t, {}).get("due", 0), 0)) == 1 else 0) for t in train_ids}
   
    # each train must be exactly one state
    for t in train_ids:
        model += pulp.lpSum([x[t][s] for s in states]) == 1, f"one_state_{t}"

    # fitness constraint: if expired -> cannot run
    for t in train_ids:
        if fitness.get(t, {}).get("valid", 1) == 0:
            model += x[t]["run"] == 0, f"fitness_block_{t}"
    # additional: minimum fitness score required to run
    for t in train_ids:
        if safe_float(fitness.get(t, {}).get("score", 1.0), 1.0) < run_min_fitness_score:
            model += x[t]["run"] == 0, f"min_fitness_to_run_{t}"

    # job card: if open -> must be maintenance
    for t in train_ids:
        if jobcard.get(t, {}).get("open", 0) == 1:
            model += x[t]["maintenance"] == 1, f"jobcard_requires_maint_{t}"

    # branding: if branding_required -> prefer run by adding negative cost (we'll use objective)
    branding_score = {t: safe_float(branding.get(t, {}).get("priority", 0.0), 0.0) for t in train_ids}

    # cleaning capacity
    model += pulp.lpSum([x[t]["cleaning"] for t in train_ids]) <= cleaning_capacity, "clean_cap"
    # ensure a minimum number of cleaning for due trains (subject to capacity)
    due_list = [t for t in train_ids if needs_cleaning.get(t, 0) == 1]
    if min_clean_due > 0 and len(due_list) > 0:
        model += pulp.lpSum([x[t]["cleaning"] for t in due_list]) >= min(min_clean_due, len(due_list)), "clean_due_min"

    # mutual exclusivity run vs cleaning already enforced by one_state constraint

    # simulate sudden failure: force failed train to not run
    if fail_train and fail_train in train_ids:
        model += x[fail_train]["run"] == 0, f"sim_fail_{fail_train}"

    # mileage balancing: compute average and minimize absolute deviation proxy
    mile_km = {t: safe_float(mileage.get(t, {}).get("km", 0.0), 0.0) for t in train_ids}
    avg_mileage = sum(mile_km.values()) / max(1, len(train_ids))
    dev = {t: pulp.LpVariable(f"dev_{t}", lowBound=0) for t in train_ids}
    for t in train_ids:
        model += dev[t] >= mile_km[t] - avg_mileage
        model += dev[t] >= avg_mileage - mile_km[t]

    # risk proxy: lower fitness score increases risk
    risk_score = {t: 1 - safe_float(fitness.get(t, {}).get("score", 1.0), 1.0) for t in train_ids}

    # objective: weighted sum: risk + mileage deviation - branding bonus
    risk_w = 50.0
    mileage_w = 1.0
    branding_w = 20.0

    model += (
        risk_w * pulp.lpSum([risk_score[t] * x[t]["run"] for t in train_ids])
        + mileage_w * pulp.lpSum([dev[t] for t in train_ids])
        - branding_w * pulp.lpSum([branding_score[t] * x[t]["run"] for t in train_ids])
    ), "main_objective"

    # Global resource and service level constraints
    model += pulp.lpSum([x[t]["run"] for t in train_ids]) >= min(min_run, len(train_ids)), "min_run"
    model += pulp.lpSum([x[t]["run"] for t in train_ids]) <= max(0, min(max_run, len(train_ids))), "max_run"
    model += pulp.lpSum([x[t]["maintenance"] for t in train_ids]) <= max(0, maintenance_capacity), "maint_cap"
    model += pulp.lpSum([x[t]["standby"] for t in train_ids]) >= max(0, min_standby), "min_standby"
    model += pulp.lpSum([x[t]["standby"] for t in train_ids]) <= max(0, max_standby), "max_standby"

    # Ensure minimum branded trains running if requested
    if min_branded_run > 0 and len(branded_trains) > 0:
        model += pulp.lpSum([x[t]["run"] for t in branded_trains]) >= min(min_branded_run, len(branded_trains)), "min_branded_run"

    # solve with time limit
    solver = pulp.PULP_CBC_CMD(msg=False, timeLimit=10)
    model.solve(solver)

    # build result
    result = []
    for t in train_ids:
        assigned = None
        for s in states:
            val = pulp.value(x[t][s])
            if val is not None and round(val) == 1:
                assigned = s
                break
        explanation = []
        if fitness.get(t, {}).get("valid", 1) == 0:
            explanation.append("fitness expired")
        if jobcard.get(t, {}).get("open", 0) == 1:
            explanation.append("open job card")
        if safe_float(fitness.get(t, {}).get("score", 1.0), 1.0) < run_min_fitness_score:
            explanation.append(f"fitness below run threshold {run_min_fitness_score}")
        if needs_cleaning.get(t, 0) and assigned == "cleaning":
            explanation.append("cleaning due")
        if t == fail_train and assigned != "run":
            explanation.append("simulated failure")
        if branding_score[t] > 0:
            explanation.append(f"branding priority:{branding_score[t]}")
        # stabling site best-effort across likely column names
        stab = stabling.get(t, {})
        stabling_site = None
        for key in ("site", "depot", "yard", "location", "stabling"):
            if key in stab and stab.get(key) not in (None, ""):
                stabling_site = stab.get(key)
                break

        result.append(
            {
                "train_id": t,
                "assigned": assigned,
                "explanation": explanation,
                "mileage_km": safe_number(mile_km[t]),
                "fitness_score": safe_number(fitness.get(t, {}).get("score", 1.0)),
                "fitness_valid": int(fitness.get(t, {}).get("valid", 1)),
                "jobcard_open": int(jobcard.get(t, {}).get("open", 0)),
                "branding_priority": safe_number(branding_score[t]),
                "model": (trains_info.get(t, {}) or {}).get("model"),
                "stabling_site": stabling_site,
                "has_cleaning_record": bool(cleaning.get(t))
            }
        )

    return JSONResponse({"schedule": result, "objective_status": pulp.LpStatus[model.status]})

if __name__ == '__main__':
    import uvicorn
    import importlib
    # Choose an import string that works whether executed from project root or backend folder
    try:
        importlib.import_module("backend")
        app_path = "backend.main:app"
    except ModuleNotFoundError:
        # When running `python main.py` from inside the backend folder
        app_path = "main:app"

    uvicorn.run(app_path, host="0.0.0.0", port=8000, reload=True)
    print("Server started at http://localhost:8000")