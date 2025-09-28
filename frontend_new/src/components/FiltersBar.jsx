export default function FiltersBar({ filters, onToggle, onShowControls }) {
  function toggle(k) { onToggle({ ...filters, [k]: !filters[k] }) }
  return (
    <div className="w-full flex flex-wrap gap-2 mb-3 justify-center">
      {['run','standby','maintenance','cleaning'].map(s => (
        <button
          key={s}
          type="button"
          data-active={filters[s]||false}
          onClick={()=>toggle(s)}
          className="filter-btn capitalize"
        >{s}</button>
      ))}
      <button type="button" data-active={filters.cleaning_due||false} onClick={()=>toggle('cleaning_due')} className="filter-btn">Cleaning Due</button>
      <button type="button" data-active={filters.jobcard_open||false} onClick={()=>toggle('jobcard_open')} className="filter-btn">Jobcard Open</button>
      <button type="button" data-active={filters.branding_priority||false} onClick={()=>toggle('branding_priority')} className="filter-btn">Branding Priority</button>
      {onShowControls && (
        <button type="button" onClick={onShowControls} className="filter-btn font-semibold">Show Controls</button>
      )}
    </div>
  )
}
