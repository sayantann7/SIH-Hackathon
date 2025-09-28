import { useState } from 'react'

export default function ParameterControls({ params, onChange, onToast }) {
  const [showMore, setShowMore] = useState(false)
  function set(k, v) { onChange({ ...params, [k]: v }) }

  // Baseline defaults for full reset
  const BASE = { risk_w: 50, mileage_w: 1, branding_w: 20 }

  // Presets now defined as either 'reset' (replace) or 'delta' (additive stacking)
  const PRESETS = {
    default: { mode: 'reset', values: { ...BASE } },
    branding: { mode: 'delta', delta: { branding_w: +10 } },
    cleaning: { mode: 'delta', delta: { min_clean_due: +1 } },
    risk: { mode: 'delta', delta: { risk_w: +15 } },
    mileage: { mode: 'delta', delta: { mileage_w: +2 } }
  }

  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)) }

  function applyPreset(name) {
    const cfg = PRESETS[name]
    if (!cfg) return
    if (cfg.mode === 'reset') {
      onChange({ ...params, ...cfg.values })
      onToast && onToast(`Preset "${name}" applied.`, { type: 'success' })
      return
    }
    const next = { ...params }
    Object.entries(cfg.delta).forEach(([k, dv]) => {
      const current = Number(next[k] ?? 0)
      let proposed = current + dv
      if (k === 'risk_w') proposed = clamp(proposed, 0, 100)
      if (k === 'mileage_w') proposed = clamp(proposed, 0, 10)
      if (k === 'branding_w') proposed = clamp(proposed, 0, 50)
      if (k === 'min_clean_due') proposed = clamp(proposed, 0, 20)
      next[k] = proposed
    })
    if (name === 'cleaning' && (next.min_clean_due||0) < 1) next.min_clean_due = 1
    onChange(next)
    onToast && onToast(`Preset "${name}" applied.`, { type: 'success' })
  }

  return (
    <div className="p-4 pb-2 space-y-4">
      <div className="grid grid-cols-12 gap-4 items-start">
        <label className="space-y-1 col-span-6 lg:col-span-4">
          <span className="text-[12px] font-semibold text-steel-700">Cleaning slots today</span>
          <input type="number" min={0} className="input" value={params.cleaning_capacity} onChange={e=>set('cleaning_capacity', Number(e.target.value)||0)} />
        </label>
        <label className="space-y-1 col-span-6 lg:col-span-4">
          <span className="text-[12px] font-semibold text-steel-700">Mark train out of service</span>
          <input type="text" placeholder="e.g. T5" className="input" value={params.fail_train||''} onChange={e=>set('fail_train', e.target.value.toUpperCase())} />
        </label>
        <div className="col-span-12">
          <div className="flex flex-wrap gap-2 items-center mt-1">
            <span className="text-[12px] font-semibold text-steel-700 mr-1">Quick presets:</span>
            <button type="button" onClick={()=>applyPreset('default')} className="filter-btn" data-active={false}>Default</button>
            <button type="button" onClick={()=>applyPreset('branding')} className="filter-btn" data-active={false}>Branding</button>
            <button type="button" onClick={()=>applyPreset('cleaning')} className="filter-btn" data-active={false}>Cleaning</button>
            <button type="button" onClick={()=>applyPreset('risk')} className="filter-btn" data-active={false}>Risk Averse</button>
            <button type="button" onClick={()=>applyPreset('mileage')} className="filter-btn" data-active={false}>Mileage Balance</button>
          </div>
        </div>
        <div className="col-span-12 -mt-1 text-[11px] text-steel-500 leading-snug">
          Tip: After scanning a photo, review the suggested changes, then click <span className="font-semibold text-steel-600">Create schedule</span>.
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={()=>setShowMore(m=>!m)}
          className={`btn-secondary px-4 py-2 text-[12px] !leading-none flex items-center gap-1 ${showMore ? '!bg-aqua-600 !text-white' : ''}`}
          aria-expanded={showMore}
        >
          {showMore ? 'Hide options' : 'More options'}
          <span className="text-[10px] opacity-80">{showMore ? '▲' : '▼'}</span>
        </button>
        {showMore && (
          <div className="mt-3 p-4 rounded-lg border border-steel-100 bg-white space-y-4 animate-fade-in">
            <div className="grid grid-cols-12 gap-4">
              <label className="space-y-1 col-span-4">
                <span className="text-[12px] font-semibold text-steel-700">Cleaning due threshold (days)</span>
                <input type="number" min={0} className="input" value={params.cleaning_due_threshold} onChange={e=>set('cleaning_due_threshold', Number(e.target.value)||0)} />
              </label>
              <label className="space-y-1 col-span-4">
                <span className="text-[12px] font-semibold text-steel-700">Min due-to-clean today</span>
                <input type="number" min={0} className="input" value={params.min_clean_due} onChange={e=>set('min_clean_due', Number(e.target.value)||0)} />
              </label>
              <label className="space-y-1 col-span-4">
                <span className="text-[12px] font-semibold text-steel-700">Risk weight</span>
                <input type="range" min={0} max={100} step={1} className="range" value={params.risk_w} onChange={e=>set('risk_w', Number(e.target.value))} />
                <span className="text-[10px] text-steel-500">{params.risk_w}</span>
              </label>
              <label className="space-y-1 col-span-4">
                <span className="text-[12px] font-semibold text-steel-700">Mileage weight</span>
                <input type="range" min={0} max={10} step={0.5} className="range" value={params.mileage_w} onChange={e=>set('mileage_w', Number(e.target.value))} />
                <span className="text-[10px] text-steel-500">{params.mileage_w}</span>
              </label>
              <label className="space-y-1 col-span-4">
                <span className="text-[12px] font-semibold text-steel-700">Branding weight</span>
                <input type="range" min={0} max={50} step={1} className="range" value={params.branding_w} onChange={e=>set('branding_w', Number(e.target.value))} />
                <span className="text-[10px] text-steel-500">{params.branding_w}</span>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
