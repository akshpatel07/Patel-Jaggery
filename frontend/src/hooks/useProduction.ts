import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import toast from 'react-hot-toast'

export interface Ingredient {
  materialId: number
  materialName: string
  quantity: number
  unit: string
  unitCost: number
  totalCost: number
}

export interface Batch {
  id: number
  batchNumber: string
  date: string
  description?: string
  sugarcaneQuantityTonnes: number
  sugarcaneRatePerTonne: number
  sugarcaneCost: number
  ingredients: Ingredient[]
  ingredientCost: number
  outputQuantityKg: number
  yieldPercent: number
  labourRate: number
  labourCost: number
  electricityMethod: string
  electricityCost: number
  fuelCost: number
  packagingCost: number
  otherDirectCost: number
  fixedOverheadAllocated: number
  totalCost: number
  costPerKg: number
  status: 'draft' | 'confirmed' | 'cancelled'
  notes?: string
}

export function useProductions(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['production', params],
    queryFn: async () => {
      const res = await api.get('/production', { params })
      return res.data
    }
  })
}

export function useProduction(id: number | string) {
  return useQuery({
    queryKey: ['production', id],
    queryFn: async () => {
      const res = await api.get(`/production/${id}`)
      return res.data
    },
    enabled: !!id
  })
}

export function useCreateProduction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<Batch>) => {
      const res = await api.post('/production', data)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Batch created successfully')
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to create batch')
  })
}

export function useUpdateProduction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Batch> & { id: number }) => {
      const res = await api.put(`/production/${id}`, data)
      return res.data
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['production'] })
      qc.invalidateQueries({ queryKey: ['production', variables.id] })
      toast.success('Batch updated')
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to update batch')
  })
}

export function useConfirmProduction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await api.patch(`/production/${id}/confirm`)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production'] })
      qc.invalidateQueries({ queryKey: ['finishedGoods'] })
      qc.invalidateQueries({ queryKey: ['rawMaterials'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Batch confirmed and stock updated')
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to confirm batch')
  })
}

export function useCancelProduction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await api.patch(`/production/${id}/cancel`)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production'] })
      qc.invalidateQueries({ queryKey: ['finishedGoods'] })
      qc.invalidateQueries({ queryKey: ['rawMaterials'] })
      toast.success('Batch cancelled')
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to cancel batch')
  })
}

export function useProductionDefaults() {
  return useQuery({
    queryKey: ['production', 'defaults'],
    queryFn: async () => {
      const res = await api.get('/production/defaults')
      return res.data
    }
  })
}
