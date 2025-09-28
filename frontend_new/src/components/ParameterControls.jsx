import { useState } from 'react'

export default function ParameterControls({ params, onChange, onToast }) {
  const [showMore, setShowMore] = useState(false)
  function set(k, v) { onChange({ ...params, [k]: v }) }

  // Baseline defaults for full reset
  const BASE = { risk_w: 50, mileage_w: 1, branding_w: 20 }

  // Presets now defined as either 'reset' (replace) or 'delta' (additive stacking)
  const PRESETS = {
    default: { mode: 'reset', values: { ...BASE } },
    branding: { mode: 'delta', delta: { branding_w: +10 } }, // increase branding emphasis
    cleaning: { mode: 'delta', delta: { min_clean_due: +1 } }, // ensure at least 1 due train cleaned
    risk: { mode: 'delta', delta: { risk_w: +15 } }, // push risk avoidance
    mileage: { mode: 'delta', delta: { mileage_w: +2 } } // balance mileage stronger
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
    // delta stacking
    const next = { ...params }
    Object.entries(cfg.delta).forEach(([k, dv]) => {
      const current = Number(next[k] ?? 0)
      let proposed = current + dv
      // clamp known ranges
      if (k === 'risk_w') proposed = clamp(proposed, 0, 100)
      if (k === 'mileage_w') proposed = clamp(proposed, 0, 10)
      if (k === 'branding_w') proposed = clamp(proposed, 0, 50)
      if (k === 'min_clean_due') proposed = clamp(proposed, 0, 20)
      next[k] = proposed
    })
    // Special guarantee: cleaning preset should ensure min_clean_due >=1
    if (name === 'cleaning' && (next.min_clean_due||0) < 1) next.min_clean_due = 1
    onChange(next)
    onToast && onToast(`Preset "${name}" applied.`, { type: 'success' })
  }

  return (
    <div className="p-4 pb-2 space-y-4">
      <div className="grid grid-cols-12 gap-4 text-[11px] items-start">
        <label className="space-y-1 col-span-4">
          <span className="font-medium text-steel-600">Cleaning slots today</span>
          <input type="number" min={0} className="input" value={params.cleaning_capacity} onChange={e=>set('cleaning_capacity', Number(e.target.value)||0)} />
        </label>
        <label className="space-y-1 col-span-4">
          <span className="font-medium text-steel-600">Mark train out of service</span>
          <input type="text" placeholder="e.g. T5" className="input" value={params.fail_train||''} onChange={e=>set('fail_train', e.target.value.toUpperCase())} />
        </label>
        <div className="col-span-12 lg:col-span-4 space-y-1">
          <span className="font-medium text-steel-600 block">Quick presets</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={()=>applyPreset('default')} className="px-3 py-1 rounded-md border text-aqua-700 border-aqua-300 bg-white hover:bg-aqua-50 text-[11px] font-medium">Default</button>
            <button type="button" onClick={()=>applyPreset('branding')} className="px-3 py-1 rounded-md border border-aqua-300 hover:bg-aqua-50 text-[11px] font-medium text-aqua-700">Branding boost +10</button>
            <button type="button" onClick={()=>applyPreset('cleaning')} className="px-3 py-1 rounded-md border border-aqua-300 hover:bg-aqua-50 text-[11px] font-medium text-aqua-700">Cleaning boost +1</button>
            <button type="button" onClick={()=>applyPreset('risk')} className="px-3 py-1 rounded-md border border-aqua-300 hover:bg-aqua-50 text-[11px] font-medium text-aqua-700">Risk averse +15</button>
            <button type="button" onClick={()=>applyPreset('mileage')} className="px-3 py-1 rounded-md border border-aqua-300 hover:bg-aqua-50 text-[11px] font-medium text-aqua-700">Balance mileage +2</button>
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
            <div className="grid grid-cols-12 gap-4 text-[11px]">
              <label className="space-y-1 col-span-4">
                <span className="font-medium text-steel-600">Cleaning due threshold (days)</span>
                <input type="number" min={0} className="input" value={params.cleaning_due_threshold} onChange={e=>set('cleaning_due_threshold', Number(e.target.value)||0)} />
              </label>
              <label className="space-y-1 col-span-4">
                <span className="font-medium text-steel-600">Min due-to-clean today</span>
                <input type="number" min={0} className="input" value={params.min_clean_due} onChange={e=>set('min_clean_due', Number(e.target.value)||0)} />
              </label>
              <label className="space-y-1 col-span-4">
                <span className="font-medium text-steel-600">Risk weight</span>
                <input type="range" min={0} max={100} step={1} className="range" value={params.risk_w} onChange={e=>set('risk_w', Number(e.target.value))} />
                <span className="text-[10px] text-steel-500">{params.risk_w}</span>
              </label>
              <label className="space-y-1 col-span-4">
                <span className="font-medium text-steel-600">Mileage weight</span>
                <input type="range" min={0} max={10} step={0.5} className="range" value={params.mileage_w} onChange={e=>set('mileage_w', Number(e.target.value))} />
                <span className="text-[10px] text-steel-500">{params.mileage_w}</span>
              </label>
              <label className="space-y-1 col-span-4">
                <span className="font-medium text-steel-600">Branding weight</span>
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
