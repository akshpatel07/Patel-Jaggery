import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import toast from 'react-hot-toast'

export interface Supplier {
  id: number
  name: string
  businessName?: string
  phone: string
  email?: string
  address?: string
  gstin?: string
  notes?: string
  totalPurchases: number
  amountPaid: number
  outstanding: number
  isActive: boolean
}

export function useSuppliers(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['suppliers', params],
    queryFn: async () => {
      const res = await api.get('/suppliers', { params })
      return res.data
    }
  })
}

export function useSupplier(id: number | string) {
  return useQuery({
    queryKey: ['suppliers', id],
    queryFn: async () => {
      const res = await api.get(`/suppliers/${id}`)
      return res.data
    },
    enabled: !!id
  })
}

export function useCreateSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<Supplier>) => {
      const res = await api.post('/suppliers', data)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Supplier added')
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to add supplier')
  })
}

export function useUpdateSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Supplier> & { id: number }) => {
      const res = await api.put(`/suppliers/${id}`, data)
      return res.data
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      qc.invalidateQueries({ queryKey: ['suppliers', variables.id] })
      toast.success('Supplier updated')
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to update supplier')
  })
}

export function useDeleteSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await api.delete(`/suppliers/${id}`)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Supplier deactivated')
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to deactivate supplier')
  })
}
