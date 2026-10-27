import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import toast from 'react-hot-toast'

export function useElectricityBills(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['electricity', 'bills', params],
    queryFn: async () => {
      const res = await api.get('/electricity/bills', { params })
      return res.data
    },
  })
}

export function useMonthlyElectricity(from?: string, to?: string) {
  return useQuery({
    queryKey: ['electricity', 'monthly', from, to],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (from) params.from = from
      if (to) params.to = to
      const res = await api.get('/reports/electricity', { params })
      return res.data
    },
  })
}
