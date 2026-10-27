import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Eye, Phone, Truck } from 'lucide-react'
import { useSuppliers } from '../hooks/useSuppliers'
import DataTable, { Column } from '../components/DataTable'
import { formatCurrency } from '../lib/utils'

export default function SuppliersPage() {
  const navigate = useNavigate()
  const { data, isLoading } = useSuppliers()
  const suppliers = data?.suppliers || []

  const columns: Column<any>[] = [
    {
      key: 'name',
      header: 'Supplier / Farmer',
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
      header: 'Contact',
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
      header: 'Purchases Count',
      sortable: true,
      render: (r) => <span>{r.total_purchases || 0} batches</span>,
    },
    {
      key: 'outstanding_balance',
      header: 'Outstanding Payable',
      sortable: true,
      render: (r) => {
        const bal = r.outstanding_balance ?? 0
        return (
          <span className={`font-extrabold ${bal > 0 ? 'text-amber-700' : 'text-gray-600'}`}>
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
            onClick={() => navigate(`/suppliers/${r.id}`)}
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
          <h2 className="text-xl font-bold text-primary-900">Sugarcane Suppliers & Farmers</h2>
          <p className="text-xs text-gray-500">
            Manage sugarcane growers, payment accounts, landed purchases, and outstanding dues
          </p>
        </div>

        <button
          onClick={() => navigate('/suppliers/new')}
          className="btn-primary text-xs flex items-center gap-1.5 py-2 px-3 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /> Add New Supplier
        </button>
      </div>

      <DataTable
        columns={columns}
        data={suppliers}
        loading={isLoading}
        searchPlaceholder="Search supplier name or phone..."
        emptyMessage="No suppliers added yet."
        emptyActionLabel="Add First Supplier"
        onEmptyAction={() => navigate('/suppliers/new')}
        onRowClick={(r) => navigate(`/suppliers/${r.id}`)}
      />
    </div>
  )
}

