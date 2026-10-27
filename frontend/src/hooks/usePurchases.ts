import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import toast from 'react-hot-toast'

export interface Purchase {
  id: number
  reference: string
  date: string
  supplierId: number
  supplierName: string
  quantityTonnes: number
  ratePerTonne: number
  baseCost: number
  transportCost: number
  loadingCharges: number
  otherExpenses: number
  landedCost: number
  amountPaid: number
  balance: number
  paymentStatus: 'unpaid' | 'partial' | 'paid'
  status: 'confirmed' | 'cancelled'
  notes?: string
  payments?: Payment[]
}

export interface Payment {
  id: number
  date: string
  amount: number
  method: string
  notes?: string
}

export function usePurchases(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['purchases', params],
    queryFn: async () => {
      const res = await api.get('/purchases', { params })
      return res.data
    }
  })
}

export function usePurchase(id: number | string) {
  return useQuery({
    queryKey: ['purchases', id],
    queryFn: async () => {
      const res = await api.get(`/purchases/${id}`)
      return res.data
    },
    enabled: !!id
  })
}

export function useCreatePurchase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<Purchase>) => {
      const res = await api.post('/purchases', data)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['rawMaterials'] })
      toast.success('Purchase recorded successfully')
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to create purchase')
  })
}

export function useUpdatePurchase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Purchase> & { id: number }) => {
      const res = await api.put(`/purchases/${id}`, data)
      return res.data
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['purchases'] })
      qc.invalidateQueries({ queryKey: ['purchases', variables.id] })
      toast.success('Purchase updated')
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to update purchase')
  })
}

export function useCancelPurchase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await api.patch(`/purchases/${id}/cancel`)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] })
      toast.success('Purchase cancelled')
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to cancel purchase')
  })
}

export function useRecordPurchasePayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number; amount: number; date: string; method: string; notes?: string }) => {
      const res = await api.post(`/purchases/${id}/payments`, data)
      return res.data
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['purchases'] })
      qc.invalidateQueries({ queryKey: ['purchases', variables.id] })
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Payment recorded')
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to record payment')
  })
}
