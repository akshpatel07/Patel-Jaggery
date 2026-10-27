import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import toast from 'react-hot-toast'

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await api.get('/settings')
      return res.data
    },
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (settings: Record<string, unknown>) => {
      const res = await api.put('/settings', { settings })
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      toast.success('Settings saved')
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to save settings'),
  })
}

export function useFixedExpenses() {
  return useQuery({
    queryKey: ['settings', 'fixedExpenses'],
    queryFn: async () => {
      const res = await api.get('/settings/fixed-expenses')
      return res.data
    },
  })
}

export function useCreateFixedExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      name: string
      amount: number
      category?: string
      start_date?: string
      notes?: string
    }) => {
      const res = await api.post('/settings/fixed-expenses', data)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'fixedExpenses'] })
      toast.success('Fixed expense added')
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to add fixed expense'),
  })
}

export function useUpdateFixedExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string | number; [key: string]: any }) => {
      const res = await api.put(`/settings/fixed-expenses/${id}`, data)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'fixedExpenses'] })
      toast.success('Fixed expense updated')
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update fixed expense'),
  })
}
