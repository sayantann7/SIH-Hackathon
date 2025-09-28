import React, { useMemo } from 'react'

function statusChip(s) {
  if (!s) return <span className="chip">–</span>
  const map = { run:'chip-run', standby:'chip-standby', maintenance:'chip-maintenance', cleaning:'chip-cleaning' }
  return <span className={`chip ${map[s]||''}`}>{s}</span>
}

export default function InsightsView({ ranked }) {
  const rows = useMemo(()=>{
    if (!ranked||!ranked.length) return []
    return [...ranked].sort((a,b)=> (a.rank_score??0) - (b.rank_score??0))
  }, [ranked])

  function exportCsv(){
    if(!rows.length) return
    const header = ['train_id','assigned','rank_score','fitness_score','branding_priority','mileage_km','cleaning_due']
    const lines = rows.map(r => [
      r.train_id,
      r.assigned||'',
      r.rank_score==null?'':r.rank_score,
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
        <div className="text-[12px] text-steel-600">Ordered by rank score (lower is better)</div>
        <button onClick={exportCsv} className="btn-secondary text-[13px]">Export CSV</button>
      </div>
      <div className="card p-0 overflow-auto flex-1 scroll-thin">
        <table className="simple w-full table-fixed">
          <thead>
            <tr>
              <th className="w-20">Train</th>
              <th className="w-28">Assigned</th>
              <th className="w-32">Rank score</th>
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
                <td className="text-[11px]">{r.rank_score}</td>
                <td>{r.fitness_score!=null ? r.fitness_score : '—'}</td>
                <td>{r.branding_priority!=null ? r.branding_priority : '—'}</td>
                <td>{r.mileage_km!=null ? r.mileage_km : '—'}</td>
                <td>{r.cleaning_due ? <span className="chip-cleaning chip">Due</span> : '—'}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="text-center py-6 text-[11px] text-steel-500">Run a schedule to view insights.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}