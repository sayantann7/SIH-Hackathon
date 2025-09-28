import React, { useMemo } from 'react'

function statusChip(s) {
  if (!s) return <span className="chip">–</span>
  const map = { run:'chip-run', standby:'chip-standby', maintenance:'chip-maintenance', cleaning:'chip-cleaning' }
  return <span className={`chip ${map[s]||''}`}>{s}</span>
}

export default function InsightsView({ ranked }) {
  const rows = useMemo(()=>{
    if (!ranked||!ranked.length) return []
    // No explicit rank score column; keep original ordering or fallback to train_id
    return [...ranked]
  }, [ranked])

  function exportCsv(){
    if(!rows.length) return
    const header = ['train_id','assigned','fitness_score','branding_priority','mileage_km','cleaning_due']
    const lines = rows.map(r => [
      r.train_id,
      r.assigned||'',
      r.fitness_score==null?'':r.fitness_score,
      r.branding_priority==null?'':r.branding_priority,
      r.mileage_km==null?'':r.mileage_km,
      r.cleaning_due? 'Due': ''
    ].join(','))
    const blob = new Blob([header.join(',')+'\n'+lines.join('\n')], { type:'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'insights_ranked.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full gap-3">
  <div className="flex items-center gap-6">
	<div className="text-[16px] font-semibold text-steel-800 tracking-wide">Insights Overview</div>
        <button onClick={exportCsv} className="btn-secondary text-[13px]">Export CSV</button>
      </div>
      <div className="card p-0 overflow-auto flex-1 scroll-thin pb-3">
        <table className="simple w-full table-fixed">
          <thead>
            <tr>
              <th className="w-20">Train</th>
              <th className="w-28">Assigned</th>
              <th className="w-24">Fitness</th>
              <th className="w-24">Branding</th>
              <th className="w-28">Mileage</th>
              <th className="w-28">Cleaning due</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.train_id} className="odd:bg-white even:bg-steel-50/40">
                <td className="font-medium text-steel-800">{r.train_id}</td>
                <td>{statusChip(r.assigned)}</td>
                <td>{r.fitness_score!=null ? r.fitness_score : '—'}</td>
                <td>{r.branding_priority!=null ? r.branding_priority : '—'}</td>
                <td>{r.mileage_km!=null ? r.mileage_km : '—'}</td>
                <td>{r.cleaning_due ? <span className="chip-cleaning chip">Due</span> : '—'}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="text-center py-6 text-[11px] text-steel-500">Run a schedule to view insights.</td>
              </tr>
            )}
            {/* Spacer row for comfortable end-of-scroll breathing room */}
            <tr aria-hidden="true">
              <td colSpan={6} className="p-0 h-4"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}