import React, { useState } from 'react'
import { Plus, Store, AlertTriangle, ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { useFinishedGoods, useFinishedGoodsMovements } from '../hooks/useFinishedGoods'
import DataTable, { Column } from '../components/DataTable'
import { formatCurrency, formatKg, formatDate } from '../lib/utils'
import toast from 'react-hot-toast'
import api from '../lib/api'

export default function FinishedGoodsPage() {
  const [activeTab, setActiveTab] = useState<'stock' | 'movements' | 'adjust'>('stock')
  const { data: goodsData, refetch: refetchGoods } = useFinishedGoods()
  const { data: movementsData } = useFinishedGoodsMovements()

  // Add Item Modal
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [newItemDesc, setNewItemDesc] = useState('')

  // Adjustment form
  const [adjItemId, setAdjItemId] = useState('')
  const [adjType, setAdjType] = useState('damage')
  const [adjQty, setAdjQty] = useState<number | ''>('')
  const [adjNotes, setAdjNotes] = useState('')
  const [adjLoading, setAdjLoading] = useState(false)

  const items = goodsData?.items || []
  const movements = movementsData?.movements || []

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItemName.trim()) return

    try {
      await api.post('/finished-goods', {
        name: newItemName.trim(),
        description: newItemDesc.trim() || null,
        unit: 'kg',
      })
      toast.success('Product added')
      setItemModalOpen(false)
      setNewItemName('')
      setNewItemDesc('')
      refetchGoods()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add product')
    }
  }

  const handleAdjustment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adjItemId || !adjQty) {
      toast.error('Select product and enter quantity')
      return
    }

    try {
      setAdjLoading(true)
      await api.post('/finished-goods/adjustment', {
        item_id: adjItemId,
        movement_type: adjType,
        quantity: -Math.abs(Number(adjQty)), // reductions are negative
        notes: adjNotes.trim() || 'Stock reduction',
      })
      toast.success('Stock reduction recorded')
      setAdjQty('')
      setAdjNotes('')
      refetchGoods()
      setActiveTab('stock')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to record adjustment')
    } finally {
      setAdjLoading(false)
    }
  }

  const stockColumns: Column<any>[] = [
    {
      key: 'name',
      header: 'Product Name',
      sortable: true,
      render: (r) => <span className="font-bold text-gray-900">{r.name}</span>,
    },
    {
      key: 'unit',
      header: 'Unit',
      render: (r) => <span className="text-gray-600 font-mono text-xs">{r.unit}</span>,
    },
    {
      key: 'current_stock',
      header: 'Available Stock (kg)',
      sortable: true,
      render: (r) => (
        <span className="font-extrabold text-sm text-primary-900">
          {formatKg(r.current_stock || 0)}
        </span>
      ),
    },
    {
      key: 'avg_cost_per_kg',
      header: 'Avg Mfg Cost / kg',
      render: (r) => <span>{formatCurrency(r.avg_cost_per_kg || 0)}</span>,
    },
    {
      key: 'total_inventory_value',
      header: 'Inventory Value',
      sortable: true,
      render: (r) => (
        <span className="font-semibold text-gray-900">
          {formatCurrency((r.current_stock || 0) * (r.avg_cost_per_kg || 0))}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => {
        const isLow = (r.current_stock || 0) < 100
        return (
          <span className={isLow ? 'badge-yellow' : 'badge-green'}>
            {isLow ? 'LOW STOCK' : 'IN STOCK'}
          </span>
        )
      },
    },
  ]

  const movementColumns: Column<any>[] = [
    {
      key: 'movement_date',
      header: 'Date',
      sortable: true,
      render: (r) => <span className="text-xs">{formatDate(r.movement_date)}</span>,
    },
    {
      key: 'item_name',
      header: 'Product',
      render: (r) => <span className="font-medium text-gray-900">{r.item_name}</span>,
    },
    {
      key: 'movement_type',
      header: 'Type',
      render: (r) => (
        <span className="text-xs font-mono px-2 py-0.5 bg-gray-100 rounded text-gray-700">
          {r.movement_type.toUpperCase()}
        </span>
      ),
    },
    {
      key: 'quantity',
      header: 'Quantity (kg)',
      sortable: true,
      render: (r) => (
        <span className={`font-semibold flex items-center text-xs ${r.quantity >= 0 ? 'text-green-700' : 'text-red-600'}`}>
          {r.quantity >= 0 ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}
          {r.quantity > 0 ? `+${r.quantity}` : r.quantity} kg
        </span>
      ),
    },
    {
      key: 'unit_cost',
      header: 'Unit Cost',
      render: (r) => <span>{r.unit_cost ? formatCurrency(r.unit_cost) : '-'}</span>,
    },
    {
      key: 'total_cost',
      header: 'Total Cost',
      render: (r) => <span>{r.total_cost ? formatCurrency(r.total_cost) : '-'}</span>,
    },
    {
      key: 'notes',
      header: 'Notes / Source',
      render: (r) => <span className="text-xs text-gray-500 truncate max-w-xs block">{r.notes || '-'}</span>,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-primary-900">Finished Goods Inventory</h2>
          <p className="text-xs text-gray-500">
            Monitor finished jaggery stock, weighted inventory valuation, and batch movements
          </p>
        </div>

        <button
          onClick={() => setItemModalOpen(true)}
          className="btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3"
        >
          <Plus className="w-4 h-4" /> Add Product Type
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-4 text-sm font-medium">
        <button
          onClick={() => setActiveTab('stock')}
          className={`pb-2.5 px-1 border-b-2 transition-colors ${
            activeTab === 'stock'
              ? 'border-primary-600 text-primary-800 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Available Stock
        </button>
        <button
          onClick={() => setActiveTab('movements')}
          className={`pb-2.5 px-1 border-b-2 transition-colors ${
            activeTab === 'movements'
              ? 'border-primary-600 text-primary-800 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Movement History
        </button>
        <button
          onClick={() => setActiveTab('adjust')}
          className={`pb-2.5 px-1 border-b-2 transition-colors ${
            activeTab === 'adjust'
              ? 'border-primary-600 text-primary-800 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Damaged Stock / Adjustments
        </button>
      </div>

      {activeTab === 'stock' && (
        <DataTable
          columns={stockColumns}
          data={items}
          searchPlaceholder="Search finished products..."
          emptyMessage="No finished goods configured yet."
        />
      )}

      {activeTab === 'movements' && (
        <DataTable
          columns={movementColumns}
          data={movements}
          searchPlaceholder="Search movements..."
          emptyMessage="No finished goods movements recorded yet."
        />
      )}

      {activeTab === 'adjust' && (
        <div className="max-w-xl bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-gray-800 border-b pb-2">Record Finished Stock Deduction</h3>
          <p className="text-xs text-gray-500">
            Record damaged blocks, quality rejection, tasting samples, or audit variances.
          </p>

          <form onSubmit={handleAdjustment} className="space-y-4 pt-2">
            <div>
              <label className="form-label">Product *</label>
              <select
                required
                value={adjItemId}
                onChange={(e) => setAdjItemId(e.target.value)}
                className="form-select"
              >
                <option value="">Select Product</option>
                {items.map((i: any) => (
                  <option key={i.id} value={i.id}>
                    {i.name} (Current: {i.current_stock || 0} kg)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Reason *</label>
                <select
                  value={adjType}
                  onChange={(e) => setAdjType(e.target.value)}
                  className="form-select"
                >
                  <option value="damage">Damaged / Rejected Stock</option>
                  <option value="adjustment">Physical Count Variance</option>
                  <option value="sample">Samples / Quality Tasting</option>
                </select>
              </div>

              <div>
                <label className="form-label">Deduction Quantity (kg) *</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  required
                  value={adjQty}
                  onChange={(e) => setAdjQty(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 25"
                  className="form-input"
                />
              </div>
            </div>

            <div>
              <label className="form-label">Notes</label>
              <textarea
                rows={2}
                value={adjNotes}
                onChange={(e) => setAdjNotes(e.target.value)}
                placeholder="Mould, packaging tear, breakage, etc."
                className="form-input"
              />
            </div>

            <button
              type="submit"
              disabled={adjLoading}
              className="btn-danger text-sm py-2 px-4"
            >
              {adjLoading ? 'Saving...' : 'Deduct Finished Stock'}
            </button>
          </form>
        </div>
      )}

      {/* Add Product Modal */}
      {itemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-gray-900">Add Finished Product Type</h3>
            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="form-label">Product Name *</label>
                <input
                  type="text"
                  required
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="e.g. Liquid Jaggery (Kakvi), Organic Jaggery Cubes"
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">Description / Pack Size</label>
                <input
                  type="text"
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                  placeholder="e.g. 1 kg bucket, 500g zip pouch"
                  className="form-input"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setItemModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-xs">
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
