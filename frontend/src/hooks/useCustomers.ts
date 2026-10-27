import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import toast from 'react-hot-toast'

export interface Customer {
  id: number
  name: string
  businessName?: string
  phone: string
  email?: string
  address?: string
  gstin?: string
  creditTerms?: number
  openingBalance?: number
  notes?: string
  totalPurchases: number
  amountPaid: number
  outstanding: number
  isActive: boolean
}

export function useCustomers(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['customers', params],
    queryFn: async () => {
      const res = await api.get('/customers', { params })
      return res.data
    }
  })
}

export function useCustomer(id: number | string) {
  return useQuery({
    queryKey: ['customers', id],
    queryFn: async () => {
      const res = await api.get(`/customers/${id}`)
      return res.data
    },
    enabled: !!id
  })
}

export function useCreateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<Customer>) => {
      const res = await api.post('/customers', data)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      toast.success('Customer added')
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to add customer')
  })
}

export function useUpdateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Customer> & { id: number }) => {
      const res = await api.put(`/customers/${id}`, data)
      return res.data
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      qc.invalidateQueries({ queryKey: ['customers', variables.id] })
      toast.success('Customer updated')
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to update customer')
  })
}

export function useDeleteCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await api.delete(`/customers/${id}`)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      toast.success('Customer deactivated')
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to deactivate customer')
  })
}
