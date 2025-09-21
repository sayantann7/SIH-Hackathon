# Image Ingestion: WhatsApp & Logbook Photos → Structured Constraints

This document explains the end-to-end feature that lets operators upload WhatsApp screenshots or logbook photos and automatically convert them into structured constraints that the optimizer uses.

The goal: no more manual CSV maintenance. The system extracts train IDs, statuses, and stabling slots from images and updates the datasets in `data/` so they remain the single source of truth (and are usable for ML later).

---

## Overview

- User uploads an image in the UI (header → "Ingest image").
- Backend calls an open-source, vision-enabled LLM on Groq (model: `meta-llama/llama-4-scout-17b-16e-instruct`).
- The LLM returns a strict JSON object with an `entries` array.
- Backend parses the JSON and updates CSVs:
  - `trains.csv`: ensure the train exists.
  - `jobcard.csv`: open job cards for maintenance status.
  - `cleaning.csv`: mark due cleaning.
  - `fitness.csv`: set fitness valid/score for run/standby.
  - `stabling.csv`: set `bay` when a slot is detected.
  - `branding.csv`: optional notes captured as metadata.
- Scheduler reads these CSVs and reflects updates on the next run.

---

## UI Flow (static/index.html)

- Upload button: "Ingest image" in the header.
- Hidden file input triggers a POST to `/api/ingest-image`.
- Success shows a toast and refreshes `/api/data` so tables update immediately.

---

## API: `POST /api/ingest-image`

Multipart form upload:
- Field: `file` → image file (JPG/PNG, etc.).

Response shape:
```json
{
  "parsed": [
    {"train_id": "T12", "status": "maintenance", "slot": "B3", "notes": "..."}
  ],
  "updates": [
    {"train_id": "T12", "action": "jobcard_open=1"},
    {"train_id": "T12", "action": "stabling.bay=B3"}
  ],
  "raw": "<model raw text>"
}
```

- `parsed`: structured entries that were applied.
- `updates`: a readable summary of dataset-level changes.
- `raw`: raw LLM text returned for debugging/audit.

HTTP errors:
- `400` if the file cannot be read or `GROQ_API_KEY` missing.
- `502` for upstream Groq errors.

---

## LLM Call (Groq SDK)

- Model: `meta-llama/llama-4-scout-17b-16e-instruct`.
- Prompt instructs the model to return only JSON with `entries`.
- Image is sent as `data:image/jpeg;base64,<...>` via SDK `chat.completions.create`.
- The backend then extracts JSON; if wrapped in text, we pull the JSON substring.

---

## Mapping: Entries → CSV Updates

Each entry has:
- `train_id` (string, required)
- `status` (one of: `run`, `standby`, `maintenance`, `cleaning`)
- `slot` (string/number, optional) → stored as `stabling.csv` `bay`
- `notes` (string, optional) → stored in `branding.csv` as metadata

Applied updates per `status`:
- `maintenance` → `jobcard.csv`: `{train_id, open=1}`
- `cleaning`   → `cleaning.csv`: `{train_id, last_cleaned_days=999}` (marks due)
- `run`        → `fitness.csv`: `{train_id, valid=1, score=1.0}`
- `standby`    → `fitness.csv`: `{train_id, valid=1, score=0.8}`

All updates add an ISO `timestamp` if missing.

`trains.csv` is ensured to contain each `train_id` with a minimal row if new.

Deduping policy: per file, rows are deduped by `train_id`, keeping the latest row.

---

## How the Scheduler Uses This

Your optimizer (`/api/schedule`) already reads from:
- `fitness.csv` (fields: `valid`, `score`)
- `jobcard.csv` (field: `open`)
- `cleaning.csv` (field: `last_cleaned_days`)
- `stabling.csv` (fields: `bay` | `site` | `depot` | `location` | `stabling`)
- `branding.csv` (field: `priority`) and optionally notes

After ingestion, re-running the scheduler reflects the latest constraints:
- `maintenance` status forces maintenance via job card.
- `cleaning` marks trains as due and allocates cleaning slots per capacity.
- `run`/`standby` influence fitness and risk components.
- `slot` affects stabling context shown in the UI.

---

## Configuration

- `GROQ_API_KEY` (required): API key for Groq.
- `GROQ_VISION_MODEL` (optional): override model; default is `meta-llama/llama-4-scout-17b-16e-instruct`.

Windows cmd example:
```
set GROQ_API_KEY=your_key_here
```

---

## Troubleshooting

- 400 Missing GROQ_API_KEY: set the env var before starting the server.
- 502 Groq API error: check network, API key, and model availability.
- No entries parsed: make sure the screenshot clearly shows train IDs and statuses; format should be legible.
- CSVs not updating: check file permissions in `data/`; inspect server logs.
- Unexpected assignments: verify the `fitness.csv`, `jobcard.csv`, and `cleaning.csv` updates; then rerun scheduler.

---

## Logging & Audit

- Console logs (logger name `ingest`):
  - Received upload (filename, bytes, content_type)
  - Groq call (model, image_b64_len)
  - Groq response received (chars, excerpt)
  - Parsed entries (count)
  - Applying entry (train_id, status, slot, has_notes)
  - Applied updates (count)
  - Audit row appended (path)

- Audit CSV: `data/ingestion_log.csv` — appended per upload with columns:
  - `timestamp`: ISO time
  - `filename`: uploaded file name
  - `size_bytes`: raw size of the image
  - `model`: LLM model used
  - `entries_json`: full JSON array of parsed entries
  - `updates_json`: actions applied across CSVs
  - `raw_excerpt`: first 800 chars of LLM output for debugging

---

## Future Enhancements

- Preview UI: show parsed entries for confirmation before commit.
- Append-only logs: keep `data/ingestion_log.csv` for audit.
- Advanced schema: stricter validation, normalization (e.g., T-12 → T12).
- Bulk ingest: handle multiple images and batch commits.
- Fine-tuned prompts per source (WhatsApp vs. logbook) for better accuracy.
