import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Eye, CheckCircle2, XCircle, Factory } from 'lucide-react'
import { useProductions, useCancelProduction, useConfirmProduction } from '../hooks/useProduction'
import DataTable, { Column } from '../components/DataTable'
import ConfirmModal from '../components/ConfirmModal'
import { formatCurrency, formatKg, formatTonne, formatDate, statusBadgeClass } from '../lib/utils'

export default function ProductionPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('')
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [batchToCancel, setBatchToCancel] = useState<any>(null)

  const { data, isLoading } = useProductions(statusFilter ? { status: statusFilter } : undefined)
  const cancelMutation = useCancelProduction()
  const confirmMutation = useConfirmProduction()

  const batches = data?.batches || []

  const handleCancel = (b: any) => {
    setBatchToCancel(b)
    setCancelModalOpen(true)
  }

  const confirmCancel = async () => {
    if (batchToCancel) {
      await cancelMutation.mutateAsync(batchToCancel.id)
      setCancelModalOpen(false)
      setBatchToCancel(null)
    }
  }

  const columns: Column<any>[] = [
    {
      key: 'batch_number',
      header: 'Batch #',
      sortable: true,
      render: (r) => <span className="font-mono font-bold text-primary-900">{r.batch_number}</span>,
    },
    {
      key: 'production_date',
      header: 'Date',
      sortable: true,
      render: (r) => <span>{formatDate(r.production_date)}</span>,
    },
    {
      key: 'sugarcane_consumed_tonnes',
      header: 'Sugarcane Input',
      render: (r) => <span>{formatTonne(r.sugarcane_consumed_tonnes)}</span>,
    },
    {
      key: 'finished_quantity_kg',
      header: 'Jaggery Output',
      sortable: true,
      render: (r) => (
        <span className="font-bold text-gray-900">
          {r.finished_quantity_kg ? formatKg(r.finished_quantity_kg) : <span className="text-amber-600 font-normal">Pending</span>}
        </span>
      ),
    },
    {
      key: 'yield_percentage',
      header: 'Yield %',
      render: (r) => (
        <span className="font-semibold text-xs px-2 py-0.5 bg-cream-200 rounded text-amber-900">
          {r.yield_percentage ? `${r.yield_percentage.toFixed(1)}%` : '-'}
        </span>
      ),
    },
    {
      key: 'total_direct_cost',
      header: 'Direct Cost',
      render: (r) => <span>{r.total_direct_cost ? formatCurrency(r.total_direct_cost) : '-'}</span>,
    },
    {
      key: 'cost_per_kg',
      header: 'Cost / kg',
      sortable: true,
      render: (r) => (
        <span className="font-bold text-primary-700">
          {r.cost_per_kg ? `${formatCurrency(r.cost_per_kg)}` : '-'}
        </span>
      ),
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
            onClick={() => navigate(`/production/${r.id}`)}
            title="View Batch Details"
            className="p-1 text-gray-500 hover:text-primary-600 rounded"
          >
            <Eye className="w-4 h-4" />
          </button>
          {r.status === 'confirmed' && (
            <button
              onClick={() => handleCancel(r)}
              title="Cancel Batch & Reverse Stock"
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
          <h2 className="text-xl font-bold text-primary-900">Production Management</h2>
          <p className="text-xs text-gray-500">
            Record manufacturing batches, calculate exact direct & allocated cost per kg, and track yields
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
            onClick={() => navigate('/production/new')}
            className="btn-primary text-xs flex items-center gap-1.5 py-2 px-3 whitespace-nowrap bg-gold-600 hover:bg-gold-700"
          >
            <Plus className="w-4 h-4" /> New Production Run
          </button>
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        columns={columns}
        data={batches}
        loading={isLoading}
        searchPlaceholder="Search batch number or notes..."
        emptyMessage="No production runs recorded yet."
        emptyActionLabel="Create First Production Run"
        onEmptyAction={() => navigate('/production/new')}
        onRowClick={(r) => navigate(`/production/${r.id}`)}
      />

      {/* Cancel Modal */}
      <ConfirmModal
        open={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={confirmCancel}
        title="Cancel Production Batch"
        message="Are you sure you want to cancel this batch? This will reverse the finished jaggery stock added and restore the consumed sugarcane and ingredient stock."
        confirmText="Yes, Cancel Batch"
        confirmVariant="danger"
        loading={cancelMutation.isPending}
      />
    </div>
  )
}

