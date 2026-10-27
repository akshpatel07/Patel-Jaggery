import React from 'react'
import { useForm } from 'react-hook-form'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import api from '../lib/api'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'

export interface PaymentModalProps {
  open: boolean
  onOpenChange?: (open: boolean) => void
  onClose?: () => void
  onSubmit?: (data: PaymentFormData) => void
  id?: string | number
  type?: 'sale' | 'purchase' | string
  loading?: boolean
  maxAmount?: number
  title?: string
}

export interface PaymentFormData {
  amount: number
  date: string
  method: string
  notes?: string
}

const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'NEFT', 'RTGS', 'Other']

export default function PaymentModal({
  open,
  onOpenChange,
  onClose,
  onSubmit,
  id,
  type,
  loading: externalLoading = false,
  maxAmount,
  title = 'Record Payment',
}: PaymentModalProps) {
  const qc = useQueryClient()
  const [internalLoading, setInternalLoading] = React.useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<PaymentFormData>({
    defaultValues: { date: new Date().toISOString().split('T')[0], method: 'Cash' },
  })

  const handleClose = () => {
    reset()
    if (onOpenChange) onOpenChange(false)
    if (onClose) onClose()
  }

  const onFormSubmit = async (data: PaymentFormData) => {
    if (onSubmit) {
      onSubmit(data)
      handleClose()
      return
    }

    if (id && type) {
      try {
        setInternalLoading(true)
        if (type === 'sale') {
          await api.post(`/sales/${id}/payment`, {
            payment_date: data.date,
            amount: Number(data.amount),
            payment_method: data.method,
            notes: data.notes || null,
          })
          qc.invalidateQueries({ queryKey: ['sales'] })
        } else if (type === 'purchase') {
          await api.post(`/purchases/${id}/payment`, {
            payment_date: data.date,
            amount: Number(data.amount),
            payment_method: data.method,
            notes: data.notes || null,
          })
          qc.invalidateQueries({ queryKey: ['purchases'] })
        }
        qc.invalidateQueries({ queryKey: ['dashboard'] })
        toast.success('Payment recorded successfully')
        handleClose()
      } catch (err: any) {
        toast.error(err.response?.data?.error || 'Failed to record payment')
      } finally {
        setInternalLoading(false)
      }
    }
  }

  const isLoading = externalLoading || internalLoading

  return (
    <Dialog.Root open={open} onOpenChange={(val) => !val && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold text-gray-900">{title}</Dialog.Title>
            <button type="button" onClick={handleClose} className="p-1 hover:bg-gray-100 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
            <div>
              <label className="form-label">Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={maxAmount}
                className="form-input"
                placeholder="0.00"
                {...register('amount', {
                  required: 'Amount is required',
                  min: { value: 0.01, message: 'Amount must be positive' },
                  ...(maxAmount
                    ? { max: { value: maxAmount, message: `Cannot exceed ₹${maxAmount}` } }
                    : {}),
                })}
              />
              {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
              {maxAmount !== undefined && (
                <p className="text-xs text-gray-500 mt-1">Outstanding: ₹{maxAmount.toFixed(2)}</p>
              )}
            </div>
            <div>
              <label className="form-label">Payment Date *</label>
              <input
                type="date"
                className="form-input"
                {...register('date', { required: 'Date is required' })}
              />
              {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date.message}</p>}
            </div>
            <div>
              <label className="form-label">Payment Method *</label>
              <select className="form-select" {...register('method', { required: true })}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Notes</label>
              <textarea
                rows={2}
                className="form-input"
                placeholder="Transaction ID / Cheque #..."
                {...register('notes')}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={handleClose}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary text-xs" disabled={isLoading}>
                {isLoading ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
