const base = '' // same origin

async function json(res) {
  if (!res.ok) {
    let text = await res.text().catch(() => '')
    throw new Error(text || res.statusText)
  }
  return res.json()
}

export async function fetchSnapshot() {
  return json(await fetch(`${base}/api/data`))
}

export async function runSchedule(params) {
  return json(await fetch(`${base}/api/schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params || {})
  }))
}

export async function uploadImage(file) {
  const fd = new FormData()
  fd.append('file', file)
  return json(await fetch(`${base}/api/ingest-image`, { method: 'POST', body: fd }))
}
