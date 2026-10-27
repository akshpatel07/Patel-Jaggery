import React from 'react'
import { cn } from '../lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string
  icon?: React.ReactNode
  trend?: number
  subValue?: string
  accentColor?: string
  loading?: boolean
}

export default function StatCard({ label, value, icon, trend, subValue, accentColor = 'border-primary-500', loading = false }: StatCardProps) {
  if (loading) {
    return (
      <div className={cn('card border-l-4', accentColor)}>
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/3"></div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('card border-l-4', accentColor)}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500 truncate">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 truncate">{value}</p>
          {subValue && <p className="mt-1 text-xs text-gray-500">{subValue}</p>}
          {trend !== undefined && (
            <div className={cn('flex items-center mt-1 text-xs font-medium', trend >= 0 ? 'text-green-600' : 'text-red-600')}>
              {trend >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
              <span>{Math.abs(trend).toFixed(1)}% vs last period</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="flex-shrink-0 ml-3 p-2 bg-primary-50 rounded-lg text-primary-600">
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}
