import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import toast from 'react-hot-toast'

export interface Sale {
  id: number
  invoiceNumber: string
  date: string
  customerId: number
  customerName: string
  product: string
  quantityKg: number
  pricePerKg: number
  subtotal: number
  discount: number
  deliveryCharges: number
  tax: number
  invoiceTotal: number
  amountPaid: number
  balance: number
  paymentStatus: 'unpaid' | 'partial' | 'paid'
  status: 'draft' | 'confirmed' | 'cancelled'
  notes?: string
  payments?: SalePayment[]
}

export interface SalePayment {
  id: number
  date: string
  amount: number
  method: string
  notes?: string
}

export function useSales(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['sales', params],
    queryFn: async () => {
      const res = await api.get('/sales', { params })
      return res.data
    }
  })
}

export function useSale(id: number | string) {
  return useQuery({
    queryKey: ['sales', id],
    queryFn: async () => {
      const res = await api.get(`/sales/${id}`)
      return res.data
    },
    enabled: !!id
  })
}

export function useCreateSale() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<Sale>) => {
      const res = await api.post('/sales', data)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Sale created successfully')
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to create sale')
  })
}

export function useUpdateSale() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Sale> & { id: number }) => {
      const res = await api.put(`/sales/${id}`, data)
      return res.data
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['sales'] })
      qc.invalidateQueries({ queryKey: ['sales', variables.id] })
      toast.success('Sale updated')
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to update sale')
  })
}

export function useConfirmSale() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await api.patch(`/sales/${id}/confirm`)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] })
      qc.invalidateQueries({ queryKey: ['finishedGoods'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Sale confirmed and stock deducted')
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to confirm sale')
  })
}

export function useCancelSale() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await api.patch(`/sales/${id}/cancel`)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] })
      qc.invalidateQueries({ queryKey: ['finishedGoods'] })
      toast.success('Sale cancelled')
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to cancel sale')
  })
}

export function useRecordSalePayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number; amount: number; date: string; method: string; notes?: string }) => {
      const res = await api.post(`/sales/${id}/payments`, data)
      return res.data
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['sales'] })
      qc.invalidateQueries({ queryKey: ['sales', variables.id] })
      qc.invalidateQueries({ queryKey: ['customers'] })
      toast.success('Payment recorded')
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to record payment')
  })
}

export function useNextInvoiceNumber() {
  return useQuery({
    queryKey: ['sales', 'nextInvoice'],
    queryFn: async () => {
      const res = await api.get('/sales/next-invoice-number')
      return res.data
    }
  })
}
