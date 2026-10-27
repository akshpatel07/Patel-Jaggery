import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Eye, CreditCard, XCircle, Printer } from 'lucide-react'
import { useSales, useCancelSale } from '../hooks/useSales'
import DataTable, { Column } from '../components/DataTable'
import PaymentModal from '../components/PaymentModal'
import ConfirmModal from '../components/ConfirmModal'
import { formatCurrency, formatKg, formatDate, paymentBadgeClass, statusBadgeClass } from '../lib/utils'

export default function SalesPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [selectedSale, setSelectedSale] = useState<any>(null)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [saleToCancel, setSaleToCancel] = useState<any>(null)

  const { data, isLoading } = useSales(statusFilter ? { status: statusFilter } : undefined)
  const cancelMutation = useCancelSale()

  const sales = data?.sales || []

  const handleCancel = (sale: any) => {
    setSaleToCancel(sale)
    setCancelModalOpen(true)
  }

  const confirmCancel = async () => {
    if (saleToCancel) {
      await cancelMutation.mutateAsync(saleToCancel.id)
      setCancelModalOpen(false)
      setSaleToCancel(null)
    }
  }

  const columns: Column<any>[] = [
    {
      key: 'invoice_number',
      header: 'Invoice #',
      sortable: true,
      render: (r) => <span className="font-mono font-bold text-primary-900">{r.invoice_number}</span>,
    },
    {
      key: 'sale_date',
      header: 'Date',
      sortable: true,
      render: (r) => <span>{formatDate(r.sale_date)}</span>,
    },
    {
      key: 'customer_name',
      header: 'Customer',
      sortable: true,
      render: (r) => <span className="font-medium text-gray-900">{r.customer_name || 'Walk-in Cash Customer'}</span>,
    },
    {
      key: 'item_name',
      header: 'Product',
      render: (r) => <span>{r.item_name}</span>,
    },
    {
      key: 'quantity_kg',
      header: 'Quantity',
      sortable: true,
      render: (r) => <span className="font-bold">{formatKg(r.quantity_kg)}</span>,
    },
    {
      key: 'price_per_kg',
      header: 'Rate / kg',
      render: (r) => <span>{formatCurrency(r.price_per_kg)}</span>,
    },
    {
      key: 'invoice_total',
      header: 'Total Amount',
      sortable: true,
      render: (r) => <span className="font-extrabold text-gray-900">{formatCurrency(r.invoice_total)}</span>,
    },
    {
      key: 'payment_status',
      header: 'Payment',
      render: (r) => {
        const bal = r.invoice_total - (r.amount_paid || 0)
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
      render: (r) => <span className={statusBadgeClass(r.status)}>{r.status.toUpperCase()}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => navigate(`/sales/${r.id}`)}
            title="View Invoice"
            className="p-1 text-gray-500 hover:text-primary-600 rounded"
          >
            <Eye className="w-4 h-4" />
          </button>
          {r.status === 'confirmed' && r.payment_status !== 'paid' && (
            <button
              onClick={() => {
                setSelectedSale(r)
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
              title="Cancel Sale & Restore Stock"
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
          <h2 className="text-xl font-bold text-primary-900">Sales and Orders</h2>
          <p className="text-xs text-gray-500">
            Create invoices, record payments, calculate COGS, and automatically deduct finished stock
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="form-select text-xs py-1.5"
          >
            <option value="">All Statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="draft">Draft</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button
            onClick={() => navigate('/sales/new')}
            className="btn-primary text-xs flex items-center gap-1.5 py-2 px-3 whitespace-nowrap bg-primary-700 hover:bg-primary-800"
          >
            <Plus className="w-4 h-4" /> Record New Sale
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={sales}
        loading={isLoading}
        searchPlaceholder="Search invoice # or customer..."
        emptyMessage="No sales recorded yet."
        emptyActionLabel="Create First Sale"
        onEmptyAction={() => navigate('/sales/new')}
        onRowClick={(r) => navigate(`/sales/${r.id}`)}
      />

      {selectedSale && (
        <PaymentModal
          open={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          id={selectedSale.id}
          type="sale"
          title={`Record Customer Payment - ${selectedSale.invoice_number}`}
          maxAmount={selectedSale.invoice_total - (selectedSale.amount_paid || 0)}
        />
      )}

      <ConfirmModal
        open={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={confirmCancel}
        title="Cancel Sale & Restore Inventory"
        message="Are you sure you want to cancel this invoice? This will reverse the revenue and return the sold jaggery stock back to finished goods inventory."
        confirmText="Yes, Cancel Sale"
        confirmVariant="danger"
        loading={cancelMutation.isPending}
      />
    </div>
  )
}

