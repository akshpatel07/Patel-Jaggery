import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import toast from 'react-hot-toast'

export function useLabourRates() {
  return useQuery({
    queryKey: ['labour', 'rates'],
    queryFn: async () => {
      const res = await api.get('/labour/rates')
      return res.data
    }
  })
}

export function useLabourReports(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['labour', 'reports', params],
    queryFn: async () => {
      const res = await api.get('/labour/reports', { params })
      return res.data
    }
  })
}

export function useAddLabourRate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { rate: number; effectiveDate: string; notes?: string }) => {
      const res = await api.post('/labour/rates', data)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['labour'] })
      qc.invalidateQueries({ queryKey: ['production', 'defaults'] })
      toast.success('Labour rate added')
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to add labour rate')
  })
}
