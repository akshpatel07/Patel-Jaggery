import React from 'react'

interface DateRangePickerProps {
  from: string
  to: string
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
  label?: boolean
}

export default function DateRangePicker({ from, to, onFromChange, onToChange, label = true }: DateRangePickerProps) {
  return (
    <div className="flex items-end gap-3">
      <div>
        {label && <label className="form-label">From</label>}
        <input type="date" className="form-input" value={from} onChange={e => onFromChange(e.target.value)} />
      </div>
      <div>
        {label && <label className="form-label">To</label>}
        <input type="date" className="form-input" value={to} onChange={e => onToChange(e.target.value)} />
      </div>
    </div>
  )
}
