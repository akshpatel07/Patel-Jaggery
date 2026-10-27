import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import toast from 'react-hot-toast'

export function useFinishedGoods() {
  return useQuery({
    queryKey: ['finishedGoods', 'stock'],
    queryFn: async () => {
      const res = await api.get('/finished-goods/stock')
      return res.data
    }
  })
}

export function useFinishedGoodsMovements(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['finishedGoods', 'movements', params],
    queryFn: async () => {
      const res = await api.get('/finished-goods/movements', { params })
      return res.data
    }
  })
}

export function useCreateFinishedGoodsAdjustment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { productId: number; quantity: number; type: string; reason: string; date: string }) => {
      const res = await api.post('/finished-goods/adjustments', data)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finishedGoods'] })
      toast.success('Stock adjusted')
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to adjust stock')
  })
}
