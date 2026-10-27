import React from 'react'
import { formatCurrency, formatKg } from '../lib/utils'

interface CostLine {
  label: string
  amount: number
  perKg?: number
  isTotal?: boolean
  isSubtotal?: boolean
}

interface CostBreakdownProps {
  lines: CostLine[]
  totalKg?: number
  title?: string
}

export default function CostBreakdown({ lines, totalKg, title = 'Cost Breakdown' }: CostBreakdownProps) {
  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-primary-800 mb-3">{title}</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-1 font-medium text-gray-600">Cost Item</th>
            <th className="text-right py-1 font-medium text-gray-600">Amount</th>
            {totalKg ? <th className="text-right py-1 font-medium text-gray-600">Per kg</th> : null}
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr
              key={i}
              className={line.isTotal ? 'border-t-2 border-primary-200 font-bold text-primary-800' : line.isSubtotal ? 'border-t border-gray-200 font-semibold' : 'border-b border-gray-50'}
            >
              <td className="py-1.5">{line.label}</td>
              <td className="py-1.5 text-right">{formatCurrency(line.amount)}</td>
              {totalKg && (
                <td className="py-1.5 text-right text-gray-500">
                  {line.amount && totalKg ? formatCurrency(line.amount / totalKg) : '-'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {totalKg && (
        <p className="text-xs text-gray-500 mt-2">Based on {formatKg(totalKg)} output</p>
      )}
    </div>
  )
}
