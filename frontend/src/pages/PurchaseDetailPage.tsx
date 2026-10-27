import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CreditCard, XCircle, FileText, CheckCircle, Truck } from 'lucide-react'
import { usePurchase, useCancelPurchase } from '../hooks/usePurchases'
import PaymentModal from '../components/PaymentModal'
import ConfirmModal from '../components/ConfirmModal'
import { formatCurrency, formatTonne, formatDate, paymentBadgeClass, statusBadgeClass } from '../lib/utils'

export default function PurchaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data, isLoading } = usePurchase(id!)
  const cancelMutation = useCancelPurchase()

  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)

  const purchase = data?.purchase
  const payments = data?.payments || []

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading purchase details...</div>
  }

  if (!purchase) {
    return (
      <div className="card text-center p-8 space-y-4">
        <p className="text-gray-500">Purchase not found</p>
        <button onClick={() => navigate('/purchases')} className="btn-secondary text-sm">
          Return to Purchases
        </button>
      </div>
    )
  }

  const amountPaidTotal = purchase.amount_paid_total || purchase.amount_paid || 0
  const balanceDue = Math.max(0, purchase.total_landed_cost - amountPaidTotal)

  const confirmCancel = async () => {
    await cancelMutation.mutateAsync(purchase.id)
    setCancelModalOpen(false)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/purchases')}
          className="flex items-center text-sm font-medium text-gray-500 hover:text-primary-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Purchases
        </button>
        <div className="flex items-center gap-2">
          {purchase.status === 'confirmed' && balanceDue > 0 && (
            <button
              onClick={() => setPaymentModalOpen(true)}
              className="btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3"
            >
              <CreditCard className="w-4 h-4" /> Record Payment
            </button>
          )}
          {purchase.status === 'confirmed' && (
            <button
              onClick={() => setCancelModalOpen(true)}
              className="btn-danger text-xs flex items-center gap-1.5 py-1.5 px-3"
            >
              <XCircle className="w-4 h-4" /> Cancel Purchase
            </button>
          )}
        </div>
      </div>

      {/* Main Details Card */}
      <div className="card space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-gray-100 gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900">
                Purchase #{purchase.reference_number || purchase.id.slice(0, 8)}
              </h2>
              <span className={statusBadgeClass(purchase.status)}>{purchase.status.toUpperCase()}</span>
              <span className={paymentBadgeClass(purchase.payment_status)}>{purchase.payment_status.toUpperCase()}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Recorded on {formatDate(purchase.created_at)}</p>
          </div>
          <div className="text-right">
            <span className="text-xs text-gray-500 block">Total Landed Cost</span>
            <span className="text-2xl font-black text-primary-800">{formatCurrency(purchase.total_landed_cost)}</span>
          </div>
        </div>

        {/* 2-col info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-700 text-xs uppercase tracking-wider">Purchase Information</h4>
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Purchase Date:</span>
              <span className="font-medium">{formatDate(purchase.purchase_date)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Supplier:</span>
              <span className="font-medium text-primary-700">{purchase.supplier_name || 'Direct / Cash'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Sugarcane Quantity:</span>
              <span className="font-bold text-gray-900">{formatTonne(purchase.quantity_tonnes)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Purchase Rate / Tonne:</span>
              <span className="font-medium">{formatCurrency(purchase.rate_per_tonne)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Base Cost:</span>
              <span className="font-medium">{formatCurrency(purchase.base_cost)}</span>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-gray-700 text-xs uppercase tracking-wider">Cost Incurred Breakdown</h4>
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Transportation:</span>
              <span className="font-medium">{formatCurrency(purchase.transport_cost)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Loading / Unloading:</span>
              <span className="font-medium">{formatCurrency(purchase.loading_charges)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Other Expenses:</span>
              <span className="font-medium">{formatCurrency(purchase.other_expenses)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Landed Rate / Tonne:</span>
              <span className="font-bold text-primary-800">
                {formatCurrency(purchase.total_landed_cost / purchase.quantity_tonnes)}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Amount Paid:</span>
              <span className="font-bold text-green-700">{formatCurrency(amountPaidTotal)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Balance Due:</span>
              <span className="font-bold text-red-600">{formatCurrency(balanceDue)}</span>
            </div>
          </div>
        </div>

        {purchase.notes && (
          <div className="p-3 bg-cream-50 rounded-lg text-xs text-gray-700 border border-gray-100">
            <span className="font-semibold block mb-0.5">Notes:</span>
            {purchase.notes}
          </div>
        )}
      </div>

        {/* Payments History */}
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-gray-800">Payment Transactions</h3>
        {payments.length === 0 ? (
          <p className="text-xs text-gray-500 py-3">No payments recorded for this purchase yet.</p>
        ) : (
          <div className="divide-y divide-gray-100 text-xs">
            {payments.map((p: any) => (
              <div key={p.id} className="py-2.5 flex justify-between items-center">
                <div>
                  <span className="font-semibold text-gray-900">{formatCurrency(p.amount)}</span>
                  <span className="text-gray-500 ml-2">via {p.payment_method || 'Cash'}</span>
                  {p.notes && <p className="text-gray-400 text-[11px] mt-0.5">{p.notes}</p>}
                </div>
                <span className="text-gray-500">{formatDate(p.payment_date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment Modal */}
      <PaymentModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        id={purchase.id}
        type="purchase"
        title={`Record Payment for ${purchase.reference_number || purchase.id.slice(0, 8)}`}
        maxAmount={balanceDue}
      />

      {/* Cancel Modal */}
      <ConfirmModal
        open={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={confirmCancel}
        title="Cancel Purchase & Reverse Inventory"
        message="Are you sure you want to cancel this purchase? This will permanently mark it as cancelled and reverse the raw sugarcane stock added to inventory."
        confirmText="Yes, Cancel Purchase"
        confirmVariant="danger"
        loading={cancelMutation.isPending}
      />
    </div>
  )
}

