function statusChip(s) {
  if (!s) return <span className="chip">–</span>
  const map = {
    run: 'chip-run', standby: 'chip-standby', maintenance: 'chip-maintenance', cleaning: 'chip-cleaning'
  }
  return <span className={`chip ${map[s]||''}`}>{s}</span>
}

export default function TrainTable({ trains }) {
  return (
    <div className="card p-0 overflow-y-auto overflow-x-hidden max-h-[70vh] scroll-thin relative px-1">
      <table className="simple table-fixed w-full">
        <thead>
          <tr>
            <th className="w-20">Train</th>
            <th>Status</th>
            <th>Mileage</th>
            <th>Fitness</th>
            <th>Branding</th>
            <th>Cleaning</th>
            <th>Jobcard</th>
            <th>Stabling</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {trains.map(t => (
            <tr key={t.train_id} className="odd:bg-white even:bg-steel-50/40">
              <td className="font-medium text-steel-800">{t.train_id}</td>
              <td>{statusChip(t.assigned)}</td>
              <td>{t.mileage_km ?? '—'}</td>
              <td>{t.fitness_score != null ? (t.fitness_score).toFixed(2) : '—'}</td>
              <td>{t.branding_priority ? <span className="chip">P{t.branding_priority}</span> : '—'}</td>
              <td>{t.cleaning_due ? <span className="chip-cleaning chip">Due</span> : t.has_cleaning_record ? <span className="chip">OK</span> : '—'}</td>
              <td>{t.jobcard_open ? <span className="chip-jobcard chip">Open</span> : '—'}</td>
              <td>{t.stabling_site || '—'}</td>
              <td className="text-[12px] font-semibold leading-snug space-y-0.5 whitespace-normal break-words pr-1">{(t.explanation||[]).map((e,i)=><div key={i}>{e}</div>)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
