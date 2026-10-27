import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle, XCircle, AlertCircle, FileText, Factory, TrendingUp } from 'lucide-react'
import { useProduction, useCancelProduction, useConfirmProduction } from '../hooks/useProduction'
import ConfirmModal from '../components/ConfirmModal'
import { formatCurrency, formatKg, formatTonne, formatDate, statusBadgeClass } from '../lib/utils'
import toast from 'react-hot-toast'

export default function ProductionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data, isLoading } = useProduction(id!)
  const cancelMutation = useCancelProduction()
  const confirmMutation = useConfirmProduction()

  const [cancelModalOpen, setCancelModalOpen] = useState(false)

  const batch = data?.batch
  const ingredients = data?.ingredients || []
  const finishedMovements = data?.finished_movements || []

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading batch details...</div>
  }

  if (!batch) {
    return (
      <div className="card text-center p-8 space-y-4">
        <p className="text-gray-500">Batch not found</p>
        <button onClick={() => navigate('/production')} className="btn-secondary text-sm">
          Return to Production
        </button>
      </div>
    )
  }

  const handleConfirm = async () => {
    try {
      await confirmMutation.mutateAsync(batch.id)
    } catch (e) {
      // toast handled in hook
    }
  }

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync(batch.id)
      setCancelModalOpen(false)
    } catch (e) {
      // toast handled in hook
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/production')}
          className="flex items-center text-sm font-medium text-gray-500 hover:text-primary-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Production
        </button>
        <div className="flex items-center gap-2">
          {batch.status === 'draft' && (
            <button
              onClick={handleConfirm}
              className="btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4" /> Confirm Run
            </button>
          )}
          {batch.status === 'confirmed' && (
            <button
              onClick={() => setCancelModalOpen(true)}
              className="btn-danger text-xs flex items-center gap-1.5 py-1.5 px-3"
            >
              <XCircle className="w-4 h-4" /> Cancel & Reverse Stock
            </button>
          )}
        </div>
      </div>

      {/* Main Batch Header */}
      <div className="card space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-gray-100 gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900">
                Batch {batch.batch_number}
              </h2>
              <span className={statusBadgeClass(batch.status)}>{batch.status.toUpperCase()}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Production Date: <strong>{formatDate(batch.production_date)}</strong>
              {batch.description && ` • ${batch.description}`}
            </p>
          </div>

          <div className="text-right">
            <span className="text-xs text-gray-500 block">Total Manufacturing Cost</span>
            <span className="text-2xl font-black text-primary-900">
              {formatCurrency(batch.total_cost || batch.total_direct_cost || 0)}
            </span>
          </div>
        </div>

        {/* 4 Summary Metric Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-cream-50 rounded-lg border border-cream-200">
            <span className="text-xs text-gray-500 block">Jaggery Output</span>
            <span className="text-lg font-bold text-gray-900">{formatKg(batch.finished_quantity_kg || 0)}</span>
          </div>
          <div className="p-3 bg-cream-50 rounded-lg border border-cream-200">
            <span className="text-xs text-gray-500 block">Sugarcane Consumed</span>
            <span className="text-lg font-bold text-gray-900">{formatTonne(batch.sugarcane_consumed_tonnes)}</span>
          </div>
          <div className="p-3 bg-cream-50 rounded-lg border border-cream-200">
            <span className="text-xs text-gray-500 block">Production Yield</span>
            <span className="text-lg font-bold text-amber-800">
              {batch.yield_percentage ? `${batch.yield_percentage.toFixed(1)}%` : '-'}
            </span>
          </div>
          <div className="p-3 bg-cream-50 rounded-lg border border-cream-200">
            <span className="text-xs text-gray-500 block">Cost / kg</span>
            <span className="text-lg font-black text-primary-800">
              {batch.cost_per_kg ? `${formatCurrency(batch.cost_per_kg)}` : '-'}
            </span>
          </div>
        </div>

        {/* Comprehensive Cost Calculation Breakdown */}
        <div className="space-y-3">
          <h4 className="font-semibold text-gray-800 text-sm">Detailed Manufacturing Cost Breakdown</h4>
          <div className="overflow-x-auto border border-gray-100 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-cream-100 text-gray-600 border-b">
                <tr>
                  <th className="py-2.5 px-4 text-left">Cost Component</th>
                  <th className="py-2.5 px-4 text-left">Basis / Quantity</th>
                  <th className="py-2.5 px-4 text-right">Rate / Unit</th>
                  <th className="py-2.5 px-4 text-right">Incurred Cost</th>
                  <th className="py-2.5 px-4 text-right">Cost / kg</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-800">
                <tr>
                  <td className="py-2 px-4 font-medium">Sugarcane Raw Material</td>
                  <td className="py-2 px-4">{formatTonne(batch.sugarcane_consumed_tonnes)}</td>
                  <td className="py-2 px-4 text-right">
                    {formatCurrency(batch.sugarcane_cost / (batch.sugarcane_consumed_tonnes || 1))} / MT
                  </td>
                  <td className="py-2 px-4 text-right font-semibold">{formatCurrency(batch.sugarcane_cost)}</td>
                  <td className="py-2 px-4 text-right">
                    {formatCurrency(batch.sugarcane_cost / (batch.finished_quantity_kg || 1))}
                  </td>
                </tr>

                <tr>
                  <td className="py-2 px-4 font-medium">Ingredients (Sugar, Lime, etc.)</td>
                  <td className="py-2 px-4">{ingredients.length} items consumed</td>
                  <td className="py-2 px-4 text-right">-</td>
                  <td className="py-2 px-4 text-right font-semibold">{formatCurrency(batch.total_ingredient_cost || 0)}</td>
                  <td className="py-2 px-4 text-right">
                    {formatCurrency((batch.total_ingredient_cost || 0) / (batch.finished_quantity_kg || 1))}
                  </td>
                </tr>

                <tr>
                  <td className="py-2 px-4 font-medium">Labour Cost</td>
                  <td className="py-2 px-4">({batch.finished_quantity_kg} kg ÷ 100)</td>
                  <td className="py-2 px-4 text-right">{formatCurrency(batch.labour_rate_per_100kg)} / 100 kg</td>
                  <td className="py-2 px-4 text-right font-semibold">{formatCurrency(batch.labour_cost || 0)}</td>
                  <td className="py-2 px-4 text-right">
                    {formatCurrency((batch.labour_cost || 0) / (batch.finished_quantity_kg || 1))}
                  </td>
                </tr>

                <tr>
                  <td className="py-2 px-4 font-medium">Electricity & Utilities</td>
                  <td className="py-2 px-4">Method: {batch.electricity_method}</td>
                  <td className="py-2 px-4 text-right">-</td>
                  <td className="py-2 px-4 text-right font-semibold">{formatCurrency(batch.electricity_amount || 0)}</td>
                  <td className="py-2 px-4 text-right">
                    {formatCurrency((batch.electricity_amount || 0) / (batch.finished_quantity_kg || 1))}
                  </td>
                </tr>

                <tr>
                  <td className="py-2 px-4 font-medium">Fuel, Packaging & Direct Overhead</td>
                  <td className="py-2 px-4">Fuel: {formatCurrency(batch.fuel_cost || 0)} | Packaging: {formatCurrency(batch.packaging_cost || 0)}</td>
                  <td className="py-2 px-4 text-right">-</td>
                  <td className="py-2 px-4 text-right font-semibold">
                    {formatCurrency((batch.fuel_cost || 0) + (batch.packaging_cost || 0) + (batch.other_direct_cost || 0))}
                  </td>
                  <td className="py-2 px-4 text-right">
                    {formatCurrency(((batch.fuel_cost || 0) + (batch.packaging_cost || 0) + (batch.other_direct_cost || 0)) / (batch.finished_quantity_kg || 1))}
                  </td>
                </tr>

                {/* Total Direct Cost Row */}
                <tr className="bg-primary-50/50 font-bold text-primary-950">
                  <td className="py-2.5 px-4" colSpan={3}>TOTAL DIRECT MANUFACTURING COST</td>
                  <td className="py-2.5 px-4 text-right text-sm">{formatCurrency(batch.total_direct_cost || 0)}</td>
                  <td className="py-2.5 px-4 text-right text-sm">
                    {formatCurrency((batch.total_direct_cost || 0) / (batch.finished_quantity_kg || 1))}
                  </td>
                </tr>

                {/* Fixed Expense Allocation Row */}
                <tr className="bg-cream-50 font-medium">
                  <td className="py-2 px-4">Allocated Fixed Business Overhead</td>
                  <td className="py-2 px-4" colSpan={2}>Proportional month allocation</td>
                  <td className="py-2 px-4 text-right font-semibold">{formatCurrency(batch.allocated_overhead || 0)}</td>
                  <td className="py-2 px-4 text-right">
                    {formatCurrency((batch.allocated_overhead || 0) / (batch.finished_quantity_kg || 1))}
                  </td>
                </tr>

                {/* Final Fully Allocated Total */}
                <tr className="bg-primary-100 font-extrabold text-primary-950">
                  <td className="py-3 px-4 text-sm" colSpan={3}>FULLY ALLOCATED MANUFACTURING COST</td>
                  <td className="py-3 px-4 text-right text-base">{formatCurrency(batch.total_cost || batch.total_direct_cost || 0)}</td>
                  <td className="py-3 px-4 text-right text-base text-primary-800">
                    {formatCurrency(batch.cost_per_kg || 0)} / kg
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Ingredients List */}
        {ingredients.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-gray-800 text-sm">Ingredients Consumed</h4>
            <div className="divide-y divide-gray-100 border rounded-lg text-xs">
              {ingredients.map((ing: any) => (
                <div key={ing.id} className="p-2.5 flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-gray-900">{ing.material_name}</span>
                    <span className="text-gray-500 ml-2">({ing.quantity} {ing.unit})</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold">{formatCurrency(ing.total_cost)}</span>
                    <span className="text-gray-400 block text-[10px]">
                      @{formatCurrency(ing.unit_cost)} / {ing.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      <ConfirmModal
        open={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={handleCancel}
        title="Cancel Production Batch & Reverse Inventory"
        message="Are you sure you want to cancel this batch? This will reverse the finished goods stock added and return the consumed sugarcane and ingredients back to raw material inventory."
        confirmText="Yes, Cancel Batch"
        confirmVariant="danger"
        loading={cancelMutation.isPending}
      />
    </div>
  )
}

