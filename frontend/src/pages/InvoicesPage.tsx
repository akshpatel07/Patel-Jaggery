import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Printer, Eye, Search, FileText } from 'lucide-react'
import { useSales } from '../hooks/useSales'
import DataTable, { Column } from '../components/DataTable'
import { formatCurrency, formatKg, formatDate, paymentBadgeClass } from '../lib/utils'

export default function InvoicesPage() {
  const navigate = useNavigate()
  const [paymentStatus, setPaymentStatus] = useState('')
  const { data, isLoading } = useSales({
    status: 'confirmed',
    ...(paymentStatus ? { payment_status: paymentStatus } : {}),
  })

  const invoices = data?.sales || []

  const columns: Column<any>[] = [
    {
      key: 'invoice_number',
      header: 'Invoice #',
      sortable: true,
      render: (r) => <span className="font-mono font-bold text-primary-900">{r.invoice_number}</span>,
    },
    {
      key: 'sale_date',
      header: 'Invoice Date',
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
      render: (r) => <span>{r.item_name} ({formatKg(r.quantity_kg)})</span>,
    },
    {
      key: 'invoice_total',
      header: 'Invoice Amount',
      sortable: true,
      render: (r) => <span className="font-extrabold text-gray-900">{formatCurrency(r.invoice_total)}</span>,
    },
    {
      key: 'amount_paid',
      header: 'Amount Paid',
      render: (r) => <span className="font-semibold text-green-700">{formatCurrency(r.amount_paid || 0)}</span>,
    },
    {
      key: 'balance',
      header: 'Balance Due',
      render: (r) => {
        const bal = r.invoice_total - (r.amount_paid || 0)
        return (
          <span className={`font-bold ${bal > 0 ? 'text-red-600' : 'text-gray-400'}`}>
            {bal > 0 ? formatCurrency(bal) : 'Paid In Full'}
          </span>
        )
      },
    },
    {
      key: 'payment_status',
      header: 'Status',
      render: (r) => <span className={paymentBadgeClass(r.payment_status)}>{r.payment_status.toUpperCase()}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => navigate(`/sales/${r.id}`)}
            className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1"
          >
            <Eye className="w-3.5 h-3.5" /> View
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-primary-900">Commercial Invoices</h2>
          <p className="text-xs text-gray-500">
            View, print, and track all confirmed customer billing invoices and outstanding balances
          </p>
        </div>

        <div>
          <select
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
            className="form-select text-xs py-1.5"
          >
            <option value="">All Invoices</option>
            <option value="unpaid">Unpaid Invoices</option>
            <option value="partial">Partially Paid</option>
            <option value="paid">Paid In Full</option>
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={invoices}
        loading={isLoading}
        searchPlaceholder="Search invoice # or customer..."
        emptyMessage="No confirmed invoices available."
        onRowClick={(r) => navigate(`/sales/${r.id}`)}
      />
    </div>
  )
}

