import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import toast from 'react-hot-toast'

export interface Expense {
  id: number
  date: string
  category: string
  classification: 'fixed' | 'variable' | 'semi-variable'
  description: string
  amount: number
  paymentMethod: string
  reference?: string
  notes?: string
}

export function useExpenses(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['expenses', params],
    queryFn: async () => {
      const res = await api.get('/expenses', { params })
      return res.data
    }
  })
}

export function useExpenseCategories() {
  return useQuery({
    queryKey: ['expenses', 'categories'],
    queryFn: async () => {
      const res = await api.get('/expenses/categories')
      return res.data
    }
  })
}

export function useCreateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<Expense>) => {
      const res = await api.post('/expenses', data)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Expense recorded')
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to record expense')
  })
}

export function useUpdateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Expense> & { id: number }) => {
      const res = await api.put(`/expenses/${id}`, data)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      toast.success('Expense updated')
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to update expense')
  })
}

export function useDeleteExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await api.delete(`/expenses/${id}`)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      toast.success('Expense deleted')
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to delete expense')
  })
}
