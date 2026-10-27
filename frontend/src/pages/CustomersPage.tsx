import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Eye, Phone, Mail, UserCheck } from 'lucide-react'
import { useCustomers } from '../hooks/useCustomers'
import DataTable, { Column } from '../components/DataTable'
import { formatCurrency } from '../lib/utils'

export default function CustomersPage() {
  const navigate = useNavigate()
  const { data, isLoading } = useCustomers()
  const customers = data?.customers || []

  const columns: Column<any>[] = [
    {
      key: 'name',
      header: 'Customer Name',
      sortable: true,
      render: (r) => (
        <div>
          <span className="font-bold text-gray-900">{r.name}</span>
          {r.business_name && <span className="block text-xs text-gray-500">{r.business_name}</span>}
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone / Contact',
      render: (r) => (
        <span className="text-gray-600 text-xs flex items-center gap-1">
          {r.phone ? (
            <>
              <Phone className="w-3 h-3 text-gray-400" />
              {r.phone}
            </>
          ) : (
            '-'
          )}
        </span>
      ),
    },
    {
      key: 'total_purchases',
      header: 'Total Purchases',
      sortable: true,
      render: (r) => <span className="font-semibold">{formatCurrency(r.total_purchases || 0)}</span>,
    },
    {
      key: 'amount_paid',
      header: 'Amount Paid',
      render: (r) => <span className="text-green-700 font-semibold">{formatCurrency(r.amount_paid || 0)}</span>,
    },
    {
      key: 'outstanding',
      header: 'Outstanding Balance',
      sortable: true,
      render: (r) => {
        const bal = r.outstanding ?? ((r.total_purchases || 0) - (r.amount_paid || 0) + (r.opening_balance || 0))
        return (
          <span className={`font-extrabold ${bal > 0 ? 'text-red-600' : 'text-gray-600'}`}>
            {formatCurrency(bal)}
          </span>
        )
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => navigate(`/customers/${r.id}`)}
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
          <h2 className="text-xl font-bold text-primary-900">Customer Directory</h2>
          <p className="text-xs text-gray-500">
            Manage jaggery buyers, credit terms, transaction history, and statement accounts
          </p>
        </div>

        <button
          onClick={() => navigate('/customers/new')}
          className="btn-primary text-xs flex items-center gap-1.5 py-2 px-3 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /> Add New Customer
        </button>
      </div>

      <DataTable
        columns={columns}
        data={customers}
        loading={isLoading}
        searchPlaceholder="Search customer name, business, or phone..."
        emptyMessage="No customers added yet."
        emptyActionLabel="Add First Customer"
        onEmptyAction={() => navigate('/customers/new')}
        onRowClick={(r) => navigate(`/customers/${r.id}`)}
      />
    </div>
  )
}

