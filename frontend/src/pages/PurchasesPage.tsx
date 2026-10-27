import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Eye, XCircle, CreditCard } from 'lucide-react'
import { usePurchases, useCancelPurchase } from '../hooks/usePurchases'
import DataTable, { Column } from '../components/DataTable'
import PaymentModal from '../components/PaymentModal'
import ConfirmModal from '../components/ConfirmModal'
import { formatCurrency, formatTonne, formatDate, paymentBadgeClass, statusBadgeClass } from '../lib/utils'

export default function PurchasesPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [purchaseToCancel, setPurchaseToCancel] = useState<any>(null)

  const { data, isLoading } = usePurchases(statusFilter ? { status: statusFilter } : undefined)
  const cancelMutation = useCancelPurchase()

  const purchases = data?.purchases || []

  const handleCancel = (purchase: any) => {
    setPurchaseToCancel(purchase)
    setCancelModalOpen(true)
  }

  const confirmCancel = async () => {
    if (purchaseToCancel) {
      await cancelMutation.mutateAsync(purchaseToCancel.id)
      setCancelModalOpen(false)
      setPurchaseToCancel(null)
    }
  }

  const columns: Column<any>[] = [
    {
      key: 'purchase_date',
      header: 'Date',
      sortable: true,
      render: (r) => <span className="font-medium text-gray-900">{formatDate(r.purchase_date)}</span>,
    },
    {
      key: 'reference_number',
      header: 'Reference',
      render: (r) => <span className="text-gray-600 font-mono text-xs">{r.reference_number || '-'}</span>,
    },
    {
      key: 'supplier_name',
      header: 'Supplier',
      sortable: true,
      render: (r) => <span className="font-medium text-primary-800">{r.supplier_name || 'Direct / Cash'}</span>,
    },
    {
      key: 'quantity_tonnes',
      header: 'Quantity',
      sortable: true,
      render: (r) => <span className="font-semibold">{formatTonne(r.quantity_tonnes)}</span>,
    },
    {
      key: 'rate_per_tonne',
      header: 'Rate / Tonne',
      render: (r) => <span>{formatCurrency(r.rate_per_tonne)}</span>,
    },
    {
      key: 'total_landed_cost',
      header: 'Landed Cost',
      sortable: true,
      render: (r) => <span className="font-bold text-gray-900">{formatCurrency(r.total_landed_cost)}</span>,
    },
    {
      key: 'payment_status',
      header: 'Payment',
      render: (r) => {
        const bal = r.total_landed_cost - (r.amount_paid_total || r.amount_paid || 0)
        return (
          <div>
            <span className={paymentBadgeClass(r.payment_status)}>
              {r.payment_status.toUpperCase()}
            </span>
            {bal > 0 && r.status === 'confirmed' && (
              <span className="block text-[10px] text-red-600 mt-0.5">Due: {formatCurrency(bal)}</span>
            )}
          </div>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <span className={statusBadgeClass(r.status)}>
          {r.status.toUpperCase()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => navigate(`/purchases/${r.id}`)}
            title="View Details"
            className="p-1 text-gray-500 hover:text-primary-600 rounded"
          >
            <Eye className="w-4 h-4" />
          </button>
          {r.status === 'confirmed' && r.payment_status !== 'paid' && (
            <button
              onClick={() => {
                setSelectedPurchase(r)
                setPaymentModalOpen(true)
              }}
              title="Record Payment"
              className="p-1 text-amber-600 hover:text-amber-700 rounded"
            >
              <CreditCard className="w-4 h-4" />
            </button>
          )}
          {r.status === 'confirmed' && (
            <button
              onClick={() => handleCancel(r)}
              title="Cancel Purchase"
              className="p-1 text-red-500 hover:text-red-700 rounded"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-primary-900">Sugarcane Purchases</h2>
          <p className="text-xs text-gray-500">Track and manage raw sugarcane landed purchases</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="form-select text-xs py-1.5"
          >
            <option value="">All Statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button
            onClick={() => navigate('/purchases/new')}
            className="btn-primary text-xs flex items-center gap-1.5 py-2 px-3 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Record Purchase
          </button>
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        columns={columns}
        data={purchases}
        loading={isLoading}
        searchPlaceholder="Search supplier or reference..."
        emptyMessage="No sugarcane purchases recorded yet."
        emptyActionLabel="Add First Purchase"
        onEmptyAction={() => navigate('/purchases/new')}
        onRowClick={(r) => navigate(`/purchases/${r.id}`)}
      />

      {/* Payment Modal */}
      {selectedPurchase && (
        <PaymentModal
          open={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          id={selectedPurchase.id}
          type="purchase"
          title={`Record Supplier Payment - ${selectedPurchase.reference_number || selectedPurchase.id.slice(0, 8)}`}
          maxAmount={selectedPurchase.total_landed_cost - (selectedPurchase.amount_paid_total || 0)}
        />
      )}

      {/* Confirm Cancellation Modal */}
      <ConfirmModal
        open={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={confirmCancel}
        title="Cancel Sugarcane Purchase"
        message="Are you sure you want to cancel this purchase? This will automatically reverse the sugarcane stock added to your inventory."
        confirmText="Yes, Cancel Purchase"
        confirmVariant="danger"
        loading={cancelMutation.isPending}
      />
    </div>
  )
}

