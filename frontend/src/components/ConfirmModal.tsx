import React from 'react'
import * as AlertDialog from '@radix-ui/react-alert-dialog'

export interface ConfirmModalProps {
  open: boolean
  onOpenChange?: (open: boolean) => void
  onClose?: () => void
  title: string
  description?: string
  message?: string
  confirmLabel?: string
  confirmText?: string
  cancelLabel?: string
  onConfirm: () => void | Promise<void>
  variant?: 'danger' | 'warning' | 'default'
  confirmVariant?: 'danger' | 'warning' | 'default' | string
  loading?: boolean
}

export default function ConfirmModal({
  open,
  onOpenChange,
  onClose,
  title,
  description,
  message,
  confirmLabel,
  confirmText,
  cancelLabel = 'Cancel',
  onConfirm,
  variant,
  confirmVariant,
  loading = false,
}: ConfirmModalProps) {
  const handleOpenChange = (newOpen: boolean) => {
    if (onOpenChange) onOpenChange(newOpen)
    if (!newOpen && onClose) onClose()
  }

  const activeVariant = confirmVariant || variant || 'default'
  const btnClass =
    activeVariant === 'danger'
      ? 'btn-danger'
      : activeVariant === 'warning'
      ? 'bg-yellow-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-yellow-600 transition-colors'
      : 'btn-primary'

  const descText = description || message || ''
  const cLabel = confirmText || confirmLabel || 'Confirm'

  return (
    <AlertDialog.Root open={open} onOpenChange={handleOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/40 z-40 animate-in fade-in" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
          <AlertDialog.Title className="text-lg font-semibold text-gray-900 mb-2">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-gray-600 mb-6">
            {descText}
          </AlertDialog.Description>
          <div className="flex justify-end gap-3">
            <AlertDialog.Cancel asChild>
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => onClose && onClose()}
                disabled={loading}
              >
                {cancelLabel}
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                type="button"
                className={`${btnClass} text-xs`}
                onClick={onConfirm}
                disabled={loading}
              >
                {loading ? 'Processing...' : cLabel}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
