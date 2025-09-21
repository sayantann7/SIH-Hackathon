from fastapi import FastAPI, Request, Form, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse, HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import pandas as pd
import os
import json
import pulp
from typing import Dict, Any
from pathlib import Path
import math
import base64
from groq import Groq
from datetime import datetime
import logging
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
# Load environment variables from .env at project root (if present)
load_dotenv(dotenv_path=BASE_DIR / ".env")
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

def now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

def ensure_dir(p: Path):
    p.mkdir(parents=True, exist_ok=True)

def append_or_update_csv(csv_path: Path, key: str, row: Dict[str, Any]):
    """Upsert a row by key and keep the last record per key.
    - Adds a timestamp when missing.
    - Preserves existing values for columns not provided in the new row.
    """
    ensure_dir(csv_path.parent)
    df_existing = None
    if csv_path.exists():
        try:
            df_existing = pd.read_csv(csv_path)
        except Exception:
            df_existing = pd.DataFrame()
    else:
        df_existing = pd.DataFrame()

    row = {**row}
    if "timestamp" not in row:
        row["timestamp"] = now_iso()
    # If an existing row for this key exists, backfill unspecified columns from it
    if not df_existing.empty and key in df_existing.columns and row.get(key) in set(df_existing[key].astype(str)):
        try:
            ex_row = df_existing[df_existing[key].astype(str) == str(row.get(key))].tail(1)
        except Exception:
            ex_row = pd.DataFrame()
        if not ex_row.empty:
            cols = list(set(df_existing.columns).union(row.keys()))
            merged = {}
            for c in cols:
                if c in row and row[c] is not None and row[c] != "":
                    merged[c] = row[c]
                else:
                    merged[c] = ex_row.iloc[0][c] if c in ex_row.columns else None
            new_row_df = pd.DataFrame([merged])
        else:
            new_row_df = pd.DataFrame([row])
    else:
        new_row_df = pd.DataFrame([row])

    if df_existing.empty:
        df_out = new_row_df
    else:
        df_out = pd.concat([df_existing, new_row_df], ignore_index=True)
        # Deduplicate by key keeping last
        if key in df_out.columns:
            df_out = df_out.drop_duplicates(subset=[key], keep="last")
    df_out.to_csv(csv_path, index=False)

def append_ingestion_audit(filename: str, size_bytes: int, model: str, entries: Any, updates: Any, raw_text: str):
    """Append a single audit row to data/ingestion_log.csv with a safe excerpt of raw text."""
    ensure_dir(DATA_DIR)
    import csv
    path = DATA_DIR / "ingestion_log.csv"
    row = {
        "timestamp": now_iso(),
        "filename": filename or "(upload)",
        "size_bytes": size_bytes,
        "model": model,
        "entries_json": json.dumps(entries or [], ensure_ascii=False),
        "updates_json": json.dumps(updates or [], ensure_ascii=False),
        "raw_excerpt": (raw_text or "")[:800]
    }
    header = list(row.keys())
    write_header = not path.exists() or path.stat().st_size == 0
    with open(path, mode="a", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=header)
        if write_header:
            w.writeheader()
        w.writerow(row)

def ensure_train_exists(train_id: str):
    trains_csv = DATA_DIR / "trains.csv"
    df = None
    if trains_csv.exists():
        try:
            df = pd.read_csv(trains_csv)
        except Exception:
            df = pd.DataFrame()
    else:
        df = pd.DataFrame()
    if df.empty or "train_id" not in df.columns or train_id not in set(df.get("train_id", []).astype(str)):
        # Append minimal train row
        row = {"train_id": train_id, "model": "Unknown", "capacity": None, "timestamp": now_iso()}
        append_or_update_csv(trains_csv, "train_id", row)

def call_groq_vision(image_bytes: bytes) -> Dict[str, Any]:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="Missing GROQ_API_KEY environment variable")
    model = os.getenv("GROQ_VISION_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    prompt = (
        "Extract a clean JSON with an array named 'entries'. Each entry must have: "
        "train_id (string), status (one of run, standby, maintenance, cleaning), "
        "slot (string or number, optional), and notes (string, optional). "
        "Only output JSON with no extra commentary."
    )
    try:
        client = Groq(api_key=api_key)
        logging.getLogger("ingest").info("Calling Groq vision model", extra={"model": model, "image_b64_len": len(b64)})
        chat = client.chat.completions.create(
            model=model,
            temperature=0.2,
            max_tokens=800,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
                        },
                    ],
                }
            ],
        )
        content = chat.choices[0].message.content
        logging.getLogger("ingest").info("Groq response received", extra={"chars": len(content), "excerpt": (content[:200] if content else "")})
        return {"raw": content}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Groq API error: {e}")

def extract_json_block(text: str) -> Dict[str, Any]:
    """Try to parse a JSON object from text; fallback to substring between first { and last }."""
    if not text:
        return {}
    try:
        return json.loads(text)
    except Exception:
        pass
    # find likely JSON block
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        snippet = text[start:end+1]
        try:
            return json.loads(snippet)
        except Exception:
            return {}
    return {}

def apply_entries(entries: Any) -> Dict[str, Any]:
    updates = []
    for item in entries or []:
        t = str(item.get("train_id", "")).strip()
        if not t:
            continue
        t = t.upper()
        status = str(item.get("status", "")).strip().lower()
        slot = item.get("slot", None)
        notes = item.get("notes", None)
        logging.getLogger("ingest").info("Applying entry", extra={"train_id": t, "status": status, "slot": slot, "has_notes": bool(notes)})
        ensure_train_exists(t)

        # Map status to CSV updates used by the optimizer
        if status == "maintenance":
            append_or_update_csv(DATA_DIR / "jobcard.csv", "train_id", {"train_id": t, "open": 1})
            updates.append({"train_id": t, "action": "jobcard_open=1"})
        elif status == "cleaning":
            # Mark as due: very large last_cleaned_days
            append_or_update_csv(DATA_DIR / "cleaning.csv", "train_id", {"train_id": t, "last_cleaned_days": 999})
            updates.append({"train_id": t, "action": "cleaning_due"})
        elif status == "run":
            # Encourage run by marking fitness valid/high
            append_or_update_csv(DATA_DIR / "fitness.csv", "train_id", {"train_id": t, "valid": 1, "score": 1.0})
            updates.append({"train_id": t, "action": "fitness_valid=1,score=1.0"})
        elif status == "standby":
            # Ensure fitness valid, neutral score
            append_or_update_csv(DATA_DIR / "fitness.csv", "train_id", {"train_id": t, "valid": 1, "score": 0.8})
            updates.append({"train_id": t, "action": "fitness_valid=1,score=0.8"})

        # Slot maps to stabling bay when provided
        if slot is not None and slot != "":
            append_or_update_csv(DATA_DIR / "stabling.csv", "train_id", {"train_id": t, "bay": slot})
            updates.append({"train_id": t, "action": f"stabling.bay={slot}"})

        # Derive and apply branding priority and other hints from structured fields or notes
        branding_priority_value = None
        # Explicit fields override inference
        for k in ("priority", "branding_priority", "branding"):
            if k in item and item.get(k) not in (None, ""):
                try:
                    v = int(float(item.get(k)))
                    branding_priority_value = 1 if v > 0 else 0
                except Exception:
                    pass
        text = str(notes).lower() if notes else ""
        if branding_priority_value is None and ("brand" in text or "branding priority" in text):
            branding_priority_value = 1
        # Apply branding update if we have either notes or a priority value
        if notes is not None or branding_priority_value is not None:
            row = {"train_id": t}
            if branding_priority_value is not None:
                row["priority"] = branding_priority_value
                updates.append({"train_id": t, "action": f"branding.priority={branding_priority_value}"})
            if notes is not None:
                row["notes"] = str(notes)[:200]
            append_or_update_csv(DATA_DIR / "branding.csv", "train_id", row)

        # Heuristic mapping from notes
        if text:
            if ("cleaning due" in text) or ("due for cleaning" in text) or ("cleaning overdue" in text):
                append_or_update_csv(DATA_DIR / "cleaning.csv", "train_id", {"train_id": t, "last_cleaned_days": 999})
                updates.append({"train_id": t, "action": "cleaning_due"})
            if ("fitness expired" in text) or ("fitness invalid" in text) or ("fitness not valid" in text):
                append_or_update_csv(DATA_DIR / "fitness.csv", "train_id", {"train_id": t, "valid": 0, "score": 0.0})
                updates.append({"train_id": t, "action": "fitness_valid=0,score=0.0"})
            elif "fitness low" in text:
                append_or_update_csv(DATA_DIR / "fitness.csv", "train_id", {"train_id": t, "valid": 1, "score": 0.3})
                updates.append({"train_id": t, "action": "fitness_valid=1,score=0.3"})

    return {"updates": updates}

@app.post("/api/ingest-image")
async def ingest_image(file: UploadFile = File(...)):
    try:
        content = await file.read()
    except Exception:
        raise HTTPException(status_code=400, detail="Unable to read uploaded file")
    logger = logging.getLogger("ingest")
    if not logging.getLogger().handlers:
        logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [%(name)s] %(message)s")
    logger.info(
        "Received upload",
        extra={
            "upload_filename": getattr(file, "filename", None),
            "upload_bytes": len(content),
            "upload_content_type": getattr(file, "content_type", None),
        },
    )
    result = call_groq_vision(content)
    parsed = extract_json_block(result.get("raw", ""))
    entries = parsed.get("entries") if isinstance(parsed, dict) else None
    if entries is None:
        # fallback: maybe raw is already an array
        if isinstance(parsed, list):
            entries = parsed
        else:
            entries = []
    logger.info("Parsed entries", extra={"count": len(entries)})
    applied = apply_entries(entries)
    logger.info("Applied updates", extra={"count": len(applied.get("updates", []))})
    try:
        append_ingestion_audit(
            filename=getattr(file, "filename", None) or "(upload)",
            size_bytes=len(content),
            model=os.getenv("GROQ_VISION_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct"),
            entries=entries,
            updates=applied.get("updates", []),
            raw_text=result.get("raw") or "",
        )
        logger.info("Audit row appended", extra={"audit_file": str(DATA_DIR / "ingestion_log.csv")})
    except Exception as e:
        logger.warning(f"Failed to write ingestion audit: {e}")
    # return what we got
    return JSONResponse({
        "parsed": entries,
        "updates": applied.get("updates", []),
        "raw": result.get("raw")
    })

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
    fleet_n = max(1, len(trains_df))
    default_min_run = int(overrides.get("min_run", math.ceil(0.4 * fleet_n)))
    min_run = max(1, default_min_run)
    max_run = int(overrides.get("max_run", len(trains_df)))
    maintenance_capacity = int(overrides.get("maintenance_capacity", len(trains_df)))
    min_standby = int(overrides.get("min_standby", 0))
    default_max_standby = int(overrides.get("max_standby", math.ceil(0.6 * fleet_n)))
    max_standby = max(0, min(default_max_standby, fleet_n))
    min_branded_run = int(overrides.get("min_branded_run", 0))
    run_min_fitness_score = float(overrides.get("run_min_fitness_score", 0.0))
    min_clean_due = int(overrides.get("min_clean_due", 0))
    cleaning_due_threshold = int(overrides.get("cleaning_due_threshold", 7))
    # objective weights (configurable)
    risk_w = float(overrides.get("risk_w", 50.0))
    mileage_w = float(overrides.get("mileage_w", 1.0))
    branding_w = float(overrides.get("branding_w", 20.0))
    # discourage non-run states to avoid excessive standby
    standby_w = float(overrides.get("standby_w", 6.0))
    maintenance_w = float(overrides.get("maintenance_w", 2.0))
    cleaning_w = float(overrides.get("cleaning_w", 0.5))

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
    # cleaning due: based on last_cleaned_days if present; missing record => due
    needs_cleaning = {}
    for t in train_ids:
        if not cleaning.get(t):
            needs_cleaning[t] = 1
        else:
            days = safe_float(cleaning.get(t, {}).get("last_cleaned_days", None), None)
            needs_cleaning[t] = 1 if (days is None or days >= cleaning_due_threshold) else 0
   
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

    # mileage: prefer assigning lower-mileage trains to run (normalized cost on run decision)
    mile_km = {t: safe_float(mileage.get(t, {}).get("km", 0.0), 0.0) for t in train_ids}
    max_mileage = max(1.0, max(mile_km.values()) if len(mile_km) > 0 else 1.0)
    norm_mileage = {t: (mile_km[t] / max_mileage) for t in train_ids}

    # risk proxy: lower fitness score increases risk
    risk_score = {t: 1 - safe_float(fitness.get(t, {}).get("score", 1.0), 1.0) for t in train_ids}

    model += (
        risk_w * pulp.lpSum([risk_score[t] * x[t]["run"] for t in train_ids])
        + mileage_w * pulp.lpSum([norm_mileage[t] * x[t]["run"] for t in train_ids])
        + standby_w * pulp.lpSum([x[t]["standby"] for t in train_ids])
        + maintenance_w * pulp.lpSum([x[t]["maintenance"] for t in train_ids])
        + cleaning_w * pulp.lpSum([x[t]["cleaning"] for t in train_ids])
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
    conflicts = []
    for t in train_ids:
        assigned = None
        for s in states:
            val = pulp.value(x[t][s])
            if val is not None and round(val) == 1:
                assigned = s
                break
        explanation = []
        blocking_reasons = []
        if fitness.get(t, {}).get("valid", 1) == 0:
            explanation.append("fitness expired")
            blocking_reasons.append("fitness expired")
        if jobcard.get(t, {}).get("open", 0) == 1:
            explanation.append("open job card")
            blocking_reasons.append("open job card")
        if safe_float(fitness.get(t, {}).get("score", 1.0), 1.0) < run_min_fitness_score:
            explanation.append(f"fitness below run threshold {run_min_fitness_score}")
            blocking_reasons.append("fitness below threshold")
        if needs_cleaning.get(t, 0) and assigned == "cleaning":
            explanation.append("cleaning due")
        if t == fail_train and assigned != "run":
            explanation.append("simulated failure")
            blocking_reasons.append("simulated failure")
        if branding_score[t] > 0:
            explanation.append(f"branding priority:{branding_score[t]}")
        # stabling site best-effort across likely column names (include 'bay')
        stab = stabling.get(t, {})
        stabling_site = None
        for key in ("site", "depot", "yard", "location", "stabling", "bay"):
            if key in stab and stab.get(key) not in (None, ""):
                stabling_site = stab.get(key)
                break

        # record conflicts if train is not assigned to run but had a blocking reason
        if assigned != "run" and blocking_reasons:
            conflicts.append({
                "train_id": t,
                "assigned": assigned,
                "reasons": blocking_reasons
            })

        # per-train score components (for explainability/ranking)
        run_cost_component = risk_w * risk_score[t] - branding_w * branding_score[t]
        mileage_component = safe_float(norm_mileage.get(t, 0.0) if assigned == "run" else 0.0, 0.0)

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
                "has_cleaning_record": bool(cleaning.get(t)),
                "cleaning_due": int(needs_cleaning.get(t, 0)),
                "rank_score": safe_number(
                    run_cost_component
                    + mileage_w * mileage_component
                    + (standby_w if assigned == "standby" else 0.0)
                    + (maintenance_w if assigned == "maintenance" else 0.0)
                    + (cleaning_w if assigned == "cleaning" else 0.0)
                )
            }
        )

    # rank induction list (lower objective contribution is better); only for readability
    ranked = sorted(result, key=lambda r: (r["rank_score"] if r["rank_score"] is not None else 0.0))

    return JSONResponse({
        "schedule": result,
        "ranked": ranked,
        "conflicts": conflicts,
        "objective_status": pulp.LpStatus[model.status],
        "parameters": {
            "cleaning_capacity": cleaning_capacity,
            "cleaning_due_threshold": cleaning_due_threshold,
            "min_clean_due": min_clean_due,
            "min_run": min_run,
            "max_run": max_run,
            "maintenance_capacity": maintenance_capacity,
            "min_standby": min_standby,
            "max_standby": max_standby,
            "min_branded_run": min_branded_run,
            "run_min_fitness_score": run_min_fitness_score,
            "risk_w": risk_w,
            "mileage_w": mileage_w,
            "branding_w": branding_w,
            "fail_train": fail_train
        }
    })

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