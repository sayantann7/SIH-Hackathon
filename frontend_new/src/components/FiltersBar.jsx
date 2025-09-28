export default function FiltersBar({ filters, onToggle, onShowControls }) {
  const statusKeys = ['run','standby','maintenance','cleaning']
  const attrKeys = ['cleaning_due','jobcard_open','branding_priority']
  const allKeys = [...statusKeys, ...attrKeys]

  function clearAll(){
    const next = { ...filters }
    allKeys.forEach(k => { next[k] = false })
    onToggle(next)
  }
  function activateSingle(k){
    const next = { ...filters }
    allKeys.forEach(key => { next[key] = (key === k) })
    onToggle(next)
  }
  function handleClick(k){
    if(filters[k]){
      // deselect -> revert to All (none active)
      clearAll()
    } else {
      activateSingle(k)
    }
  }
  const anyActive = allKeys.some(k => filters[k])

  return (
    <div className="w-full flex flex-wrap gap-2 mb-3 justify-center">
      <button
        type="button"
        data-active={!anyActive}
        onClick={clearAll}
        className="filter-btn"
      >All</button>
      {statusKeys.map(s => (
        <button
          key={s}
          type="button"
          data-active={filters[s]||false}
          onClick={()=>handleClick(s)}
          className="filter-btn capitalize"
        >{s}</button>
      ))}
      {attrKeys.map(a => (
        <button
          key={a}
          type="button"
          data-active={filters[a]||false}
          onClick={()=>handleClick(a)}
          className="filter-btn capitalize"
        >{a.replace('_',' ')}</button>
      ))}
      {onShowControls && (
        <button type="button" onClick={onShowControls} className="filter-btn font-semibold">Show Controls</button>
      )}
    </div>
  )
}
