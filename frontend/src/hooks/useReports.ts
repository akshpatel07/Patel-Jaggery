import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'

export function useProfitLossReport(from?: string, to?: string) {
  return useQuery({
    queryKey: ['reports', 'profitLoss', from, to],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (from) params.from = from
      if (to) params.to = to
      const res = await api.get('/reports/profit-loss', { params })
      return res.data
    },
  })
}

export const useProfitLoss = useProfitLossReport

export function useProductionCostReport(from?: string, to?: string) {
  return useQuery({
    queryKey: ['reports', 'productionCost', from, to],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (from) params.from = from
      if (to) params.to = to
      const res = await api.get('/reports/production-cost', { params })
      return res.data
    },
  })
}

export function useSalesByCustomerReport(from?: string, to?: string) {
  return useQuery({
    queryKey: ['reports', 'salesByCustomer', from, to],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (from) params.from = from
      if (to) params.to = to
      const res = await api.get('/reports/sales-by-customer', { params })
      return res.data
    },
  })
}

export function useSalesByProductReport(from?: string, to?: string) {
  return useQuery({
    queryKey: ['reports', 'salesByProduct', from, to],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (from) params.from = from
      if (to) params.to = to
      const res = await api.get('/reports/sales-by-product', { params })
      return res.data
    },
  })
}

export function useStockValuationReport() {
  return useQuery({
    queryKey: ['reports', 'stockValuation'],
    queryFn: async () => {
      const res = await api.get('/reports/stock-valuation')
      return res.data
    },
  })
}

export const useStockValuation = useStockValuationReport

export function useLabourReport(from?: string, to?: string) {
  return useQuery({
    queryKey: ['reports', 'labour', from, to],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (from) params.from = from
      if (to) params.to = to
      const res = await api.get('/reports/labour', { params })
      return res.data
    },
  })
}

export function useElectricityReport(from?: string, to?: string) {
  return useQuery({
    queryKey: ['reports', 'electricity', from, to],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (from) params.from = from
      if (to) params.to = to
      const res = await api.get('/reports/electricity', { params })
      return res.data
    },
  })
}
