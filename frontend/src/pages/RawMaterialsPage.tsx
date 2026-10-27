import React, { useState } from 'react'
import { Plus, Sliders, AlertTriangle, ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { useRawMaterials, useRawMaterialStock, useRawMaterialMovements } from '../hooks/useRawMaterials'
import DataTable, { Column } from '../components/DataTable'
import { formatCurrency, formatDate, statusBadgeClass } from '../lib/utils'
import toast from 'react-hot-toast'
import api from '../lib/api'

export default function RawMaterialsPage() {
  const [activeTab, setActiveTab] = useState<'stock' | 'movements' | 'adjust'>('stock')
  const { data: itemsData, refetch: refetchItems } = useRawMaterials()
  const { data: movementsData } = useRawMaterialMovements()

  // Add Item Modal
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [newItemUnit, setNewItemUnit] = useState('kg')
  const [newItemMinStock, setNewItemMinStock] = useState<number | ''>(0)

  // Adjustment Form State
  const [adjMaterialId, setAdjMaterialId] = useState('')
  const [adjType, setAdjType] = useState('adjustment')
  const [adjQuantity, setAdjQuantity] = useState<number | ''>('')
  const [adjUnitCost, setAdjUnitCost] = useState<number | ''>('')
  const [adjNotes, setAdjNotes] = useState('')
  const [adjLoading, setAdjLoading] = useState(false)

  const items = itemsData?.materials || []
  const movements = movementsData?.movements || []

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItemName.trim()) return

    try {
      await api.post('/raw-materials', {
        name: newItemName.trim(),
        unit: newItemUnit,
        min_stock_level: Number(newItemMinStock) || 0,
        is_sugarcane: 0,
      })
      toast.success('Raw material added')
      setItemModalOpen(false)
      setNewItemName('')
      refetchItems()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add raw material')
    }
  }

  const handleAdjustment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adjMaterialId || !adjQuantity) {
      toast.error('Please select material and enter quantity')
      return
    }

    try {
      setAdjLoading(true)
      await api.post('/raw-materials/adjustment', {
        material_id: adjMaterialId,
        movement_type: adjType,
        quantity: Number(adjQuantity),
        unit_cost: Number(adjUnitCost) || 0,
        notes: adjNotes.trim() || 'Manual stock adjustment',
      })
      toast.success('Stock adjustment recorded')
      setAdjQuantity('')
      setAdjUnitCost('')
      setAdjNotes('')
      refetchItems()
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
      header: 'Material Name',
      sortable: true,
      render: (r) => (
        <div>
          <span className="font-semibold text-gray-900">{r.name}</span>
          {r.is_sugarcane === 1 && (
            <span className="ml-2 px-1.5 py-0.5 bg-green-100 text-green-800 text-[10px] rounded font-semibold">
              PRIMARY INPUT
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'unit',
      header: 'Unit',
      render: (r) => <span className="text-gray-600 font-mono text-xs">{r.unit}</span>,
    },
    {
      key: 'current_stock',
      header: 'Available Stock',
      sortable: true,
      render: (r) => (
        <span className={`font-bold text-sm ${r.current_stock <= (r.min_stock_level || 0) && r.min_stock_level > 0 ? 'text-red-600' : 'text-gray-900'}`}>
          {r.current_stock.toLocaleString('en-IN')} {r.unit}
        </span>
      ),
    },
    {
      key: 'avg_cost',
      header: 'Avg Cost / Unit',
      render: (r) => <span>{formatCurrency(r.avg_cost || 0)}</span>,
    },
    {
      key: 'min_stock_level',
      header: 'Min Threshold',
      render: (r) => <span>{r.min_stock_level ? `${r.min_stock_level} ${r.unit}` : 'None'}</span>,
    },
    {
      key: 'status',
      header: 'Stock Level',
      render: (r) => {
        const isLow = r.min_stock_level > 0 && r.current_stock <= r.min_stock_level
        return (
          <span className={isLow ? 'badge-red' : 'badge-green'}>
            {isLow ? 'LOW STOCK' : 'OPTIMAL'}
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
      key: 'material_name',
      header: 'Material',
      render: (r) => <span className="font-medium text-gray-900">{r.material_name}</span>,
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
      header: 'Quantity In/Out',
      sortable: true,
      render: (r) => (
        <span className={`font-semibold flex items-center text-xs ${r.quantity >= 0 ? 'text-green-700' : 'text-red-600'}`}>
          {r.quantity >= 0 ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}
          {r.quantity > 0 ? `+${r.quantity}` : r.quantity} {r.unit}
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
      header: 'Notes',
      render: (r) => <span className="text-xs text-gray-500 truncate max-w-xs block">{r.notes || '-'}</span>,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-primary-900">Raw Material Inventory</h2>
          <p className="text-xs text-gray-500">
            Track sugarcane, sugar, lime, and processing ingredients with movement traceability
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setItemModalOpen(true)}
            className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
          >
            <Plus className="w-4 h-4" /> Add New Material
          </button>
        </div>
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
          Stock Adjustments
        </button>
      </div>

      {/* TAB CONTENT: Available Stock */}
      {activeTab === 'stock' && (
        <DataTable
          columns={stockColumns}
          data={items}
          searchPlaceholder="Search materials..."
          emptyMessage="No raw material items configured yet."
        />
      )}

      {/* TAB CONTENT: Movement History */}
      {activeTab === 'movements' && (
        <DataTable
          columns={movementColumns}
          data={movements}
          searchPlaceholder="Search movements..."
          emptyMessage="No stock movements recorded yet."
        />
      )}

      {/* TAB CONTENT: Stock Adjustments */}
      {activeTab === 'adjust' && (
        <div className="max-w-2xl bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-gray-800 border-b pb-2">Record Raw Material Stock Adjustment</h3>
          <p className="text-xs text-gray-500">
            Use this to record physical count corrections, transit wastage, or opening balances.
          </p>

          <form onSubmit={handleAdjustment} className="space-y-4 pt-2">
            <div>
              <label className="form-label">Material *</label>
              <select
                required
                value={adjMaterialId}
                onChange={(e) => setAdjMaterialId(e.target.value)}
                className="form-select"
              >
                <option value="">Select Material</option>
                {items.map((i: any) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.unit}) - Current: {i.current_stock}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Movement Type *</label>
                <select
                  value={adjType}
                  onChange={(e) => setAdjType(e.target.value)}
                  className="form-select"
                >
                  <option value="adjustment">Stock Adjustment (In / Out)</option>
                  <option value="wastage">Wastage / Spoilage (Negative Out)</option>
                  <option value="return">Return to Supplier (Negative Out)</option>
                </select>
              </div>

              <div>
                <label className="form-label">Quantity (+ to add, - to deduct) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={adjQuantity}
                  onChange={(e) => setAdjQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 50 or -10"
                  className="form-input"
                />
              </div>
            </div>

            <div>
              <label className="form-label">Unit Cost (₹) (Optional)</label>
              <input
                type="number"
                step="0.01"
                value={adjUnitCost}
                onChange={(e) => setAdjUnitCost(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Cost per unit"
                className="form-input"
              />
            </div>

            <div>
              <label className="form-label">Reason / Notes</label>
              <textarea
                rows={2}
                value={adjNotes}
                onChange={(e) => setAdjNotes(e.target.value)}
                placeholder="Physical audit variance, moisture loss, etc."
                className="form-input"
              />
            </div>

            <button
              type="submit"
              disabled={adjLoading}
              className="btn-primary text-sm py-2 px-4 w-full sm:w-auto"
            >
              {adjLoading ? 'Saving...' : 'Post Stock Adjustment'}
            </button>
          </form>
        </div>
      )}

      {/* Add Material Modal */}
      {itemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-gray-900">Add Configurable Raw Material</h3>
            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="form-label">Material Name *</label>
                <input
                  type="text"
                  required
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="e.g. Activated Carbon, Food-grade Lime"
                  className="form-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Unit *</label>
                  <select
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                    className="form-select"
                  >
                    <option value="kg">kg</option>
                    <option value="tonne">tonne</option>
                    <option value="litre">litre</option>
                    <option value="piece">piece</option>
                    <option value="bag">bag</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">Min Stock Threshold</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newItemMinStock}
                    onChange={(e) => setNewItemMinStock(e.target.value === '' ? '' : Number(e.target.value))}
                    className="form-input"
                  />
                </div>
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
                  Create Material
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

