import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import toast from 'react-hot-toast'

export function useRawMaterials() {
  return useQuery({
    queryKey: ['rawMaterials', 'stock'],
    queryFn: async () => {
      const res = await api.get('/raw-materials')
      return res.data
    },
  })
}

export const useRawMaterialStock = useRawMaterials

export function useRawMaterialMovements(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['rawMaterials', 'movements', params],
    queryFn: async () => {
      const res = await api.get('/raw-materials/movements', { params })
      return res.data
    },
  })
}
