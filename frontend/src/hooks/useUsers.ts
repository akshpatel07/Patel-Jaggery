import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import toast from 'react-hot-toast'

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/users')
      return res.data
    },
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { name: string; email: string; password: string; role: string }) => {
      const res = await api.post('/users', data)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('User created')
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create user'),
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string | number; [key: string]: any }) => {
      const res = await api.put(`/users/${id}`, data)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('User updated')
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update user'),
  })
}

export function useAuditLog(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['auditLog', params],
    queryFn: async () => {
      const res = await api.get('/users/audit-log', { params })
      return res.data
    },
  })
}
