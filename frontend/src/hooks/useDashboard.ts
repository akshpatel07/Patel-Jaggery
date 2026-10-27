import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'

export function useDashboardSummary(period: string, from?: string, to?: string) {
  return useQuery({
    queryKey: ['dashboard', 'summary', period, from, to],
    queryFn: async () => {
      const params: Record<string, string> = { period }
      if (from) params.from = from
      if (to) params.to = to
      const res = await api.get('/dashboard/summary', { params })
      return res.data
    }
  })
}

export function useDashboardCharts(period: string, from?: string, to?: string) {
  return useQuery({
    queryKey: ['dashboard', 'charts', period, from, to],
    queryFn: async () => {
      const params: Record<string, string> = { period }
      if (from) params.from = from
      if (to) params.to = to
      const res = await api.get('/dashboard/charts', { params })
      return res.data
    }
  })
}

export function useDashboardAlerts() {
  return useQuery({
    queryKey: ['dashboard', 'alerts'],
    queryFn: async () => {
      const res = await api.get('/dashboard/alerts')
      return res.data
    }
  })
}
