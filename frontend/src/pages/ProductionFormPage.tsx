import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Calculator, CheckCircle2, Save, AlertCircle } from 'lucide-react'
import { useRawMaterials } from '../hooks/useRawMaterials'
import { formatCurrency, formatKg, formatTonne } from '../lib/utils'
import toast from 'react-hot-toast'
import api from '../lib/api'

interface IngredientRow {
  material_id: string
  material_name: string
  quantity: number
  unit: string
  unit_cost: number
  total_cost: number
}

export default function ProductionFormPage() {
  const navigate = useNavigate()
  const { data: rawData } = useRawMaterials()

  // Form State
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [sugarcaneTonnes, setSugarcaneTonnes] = useState<number | ''>('')
  const [sugarcaneCostPerTonne, setSugarcaneCostPerTonne] = useState<number>(3000)
  const [finishedKg, setFinishedKg] = useState<number | ''>('')
  const [labourRatePer100kg, setLabourRatePer100kg] = useState<number>(200)

  // Electricity
  const [electricityMethod, setElectricityMethod] = useState<'fixed' | 'per_day' | 'bill_allocation'>('fixed')
  const [electricityAmount, setElectricityAmount] = useState<number | ''>(3000)
  const [productionDays, setProductionDays] = useState<number>(1)

  // Direct costs
  const [fuelCost, setFuelCost] = useState<number | ''>(0)
  const [packagingCost, setPackagingCost] = useState<number | ''>(0)
  const [otherDirectCost, setOtherDirectCost] = useState<number | ''>(1000)
  const [notes, setNotes] = useState('')

  // Ingredients
  const [ingredients, setIngredients] = useState<IngredientRow[]>([])
  const [selectedMaterialId, setSelectedMaterialId] = useState('')
  const [selectedQty, setSelectedQty] = useState<number | ''>('')
  const [selectedUnitCost, setSelectedUnitCost] = useState<number | ''>('')

  // Submitting
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch current default labour rate and sugarcane weighted cost on mount
  useEffect(() => {
    async function fetchDefaults() {
      try {
        const [labourRes, settingsRes] = await Promise.all([
          api.get('/labour/current-rate').catch(() => null),
          api.get('/settings').catch(() => null),
        ])
        if (labourRes?.data?.rate_per_100kg) {
          setLabourRatePer100kg(labourRes.data.rate_per_100kg)
        }
      } catch (e) {
        console.error(e)
      }
    }
    fetchDefaults()
  }, [])

  // Raw material items (excluding sugarcane for ingredients table)
  const allMaterials = rawData?.materials || []
  const ingredientOptions = allMaterials.filter((m: any) => m.is_sugarcane !== 1)
  const sugarcaneItem = allMaterials.find((m: any) => m.is_sugarcane === 1)

  // Update sugarcane cost per tonne if available
  useEffect(() => {
    if (sugarcaneItem?.avg_cost && sugarcaneItem.avg_cost > 0) {
      setSugarcaneCostPerTonne(sugarcaneItem.avg_cost)
    }
  }, [sugarcaneItem])

  // Add ingredient row
  const handleAddIngredient = () => {
    if (!selectedMaterialId || !selectedQty) {
      toast.error('Select an ingredient and enter quantity')
      return
    }
    const mat = allMaterials.find((m: any) => m.id === selectedMaterialId)
    if (!mat) return

    const qty = Number(selectedQty) || 0
    const cost = Number(selectedUnitCost) || (mat.avg_cost || 0)
    const total = qty * cost

    setIngredients([
      ...ingredients,
      {
        material_id: mat.id,
        material_name: mat.name,
        quantity: qty,
        unit: mat.unit,
        unit_cost: cost,
        total_cost: total,
      },
    ])

    setSelectedMaterialId('')
    setSelectedQty('')
    setSelectedUnitCost('')
  }

  const handleRemoveIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index))
  }

  // Live Cost Calculations
  const scTonnes = Number(sugarcaneTonnes) || 0
  const sugarcaneCost = scTonnes * sugarcaneCostPerTonne

  const totalIngredientsCost = ingredients.reduce((sum, item) => sum + item.total_cost, 0)
  const outKg = Number(finishedKg) || 0

  // Labour: (finished kg / 100) * rate
  const labourCost = (outKg / 100) * labourRatePer100kg

  // Electricity
  let calculatedElectricity = 0
  const elecAmt = Number(electricityAmount) || 0
  if (electricityMethod === 'fixed' || electricityMethod === 'bill_allocation') {
    calculatedElectricity = elecAmt
  } else if (electricityMethod === 'per_day') {
    calculatedElectricity = elecAmt * (Number(productionDays) || 1)
  }

  const fuel = Number(fuelCost) || 0
  const pkg = Number(packagingCost) || 0
  const otherDirect = Number(otherDirectCost) || 0

  // Total Direct Manufacturing Cost
  const totalDirectCost = sugarcaneCost + totalIngredientsCost + labourCost + calculatedElectricity + fuel + pkg + otherDirect

  // Direct Cost per kg
  const directCostPerKg = outKg > 0 ? totalDirectCost / outKg : 0

  // Yield % = finished_kg / (sugarcane_tonnes * 1000) * 100
  const yieldPercent = scTonnes > 0 && outKg > 0 ? (outKg / (scTonnes * 1000)) * 100 : 0

  // Estimated Fixed Overhead (based on ₹30,000 monthly expense)
  // Batch gets proportion: 30000 * (outKg / estimated_month_kg)
  const estimatedAllocatedOverhead = outKg > 0 ? (30000 * outKg) / (outKg >= 10000 ? outKg : 10000) : 0
  const estimatedFullyAllocatedCost = totalDirectCost + estimatedAllocatedOverhead
  const estimatedFullCostPerKg = outKg > 0 ? estimatedFullyAllocatedCost / outKg : 0

  const handleSave = async (shouldConfirm: boolean) => {
    if (!date) {
      toast.error('Please specify production date')
      return
    }
    if (scTonnes <= 0) {
      toast.error('Sugarcane consumed quantity must be greater than 0')
      return
    }
    if (shouldConfirm && outKg <= 0) {
      toast.error('Finished jaggery quantity (kg) is mandatory before confirming a batch')
      return
    }

    try {
      setIsSubmitting(true)

      // 1. Create batch
      const res = await api.post('/production', {
        production_date: date,
        description: description.trim() || null,
        sugarcane_consumed_tonnes: scTonnes,
        finished_quantity_kg: outKg > 0 ? outKg : null,
        electricity_method: electricityMethod,
        electricity_amount: elecAmt,
        production_days: Number(productionDays) || 1,
        fuel_cost: fuel,
        packaging_cost: pkg,
        other_direct_cost: otherDirect,
        notes: notes.trim() || null,
      })

      const batchId = res.data?.batch?.id
      if (!batchId) throw new Error('Failed to create batch record')

      // 2. Set ingredients if any
      if (ingredients.length > 0) {
        await api.post(`/production/${batchId}/ingredients`, {
          ingredients: ingredients.map((i) => ({
            material_id: i.material_id,
            quantity: i.quantity,
            unit_cost: i.unit_cost,
          })),
        })
      }

      // 3. Confirm batch if requested
      if (shouldConfirm) {
        await api.post(`/production/${batchId}/confirm`)
        toast.success(`Batch confirmed! Output of ${formatKg(outKg)} added to finished stock.`)
      } else {
        toast.success('Batch saved as Draft')
      }

      navigate(`/production/${batchId}`)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error processing production run')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/production')}
          className="flex items-center text-sm font-medium text-gray-500 hover:text-primary-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Production
        </button>
        <h2 className="text-xl font-bold text-primary-900">Record Production Run (Batch)</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Form Sections */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Basic Info */}
          <div className="card space-y-4">
            <h3 className="text-sm font-semibold text-gray-800 border-b pb-2">1. Run Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Production Date *</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">Shift / Run Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Morning Shift - Pan #1"
                  className="form-input"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Sugarcane Consumption */}
          <div className="card space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-sm font-semibold text-gray-800">2. Sugarcane Input</h3>
              {sugarcaneItem && (
                <span className="text-xs text-primary-700 bg-primary-50 px-2 py-0.5 rounded">
                  Stock: {formatTonne(sugarcaneItem.current_stock || 0)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Sugarcane Consumed (Metric Tonnes) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={sugarcaneTonnes}
                  onChange={(e) => setSugarcaneTonnes(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 10.00"
                  className="form-input font-bold text-base"
                />
                <span className="text-[11px] text-gray-400 mt-0.5 block">
                  {scTonnes > 0 ? `${(scTonnes * 1000).toLocaleString('en-IN')} kg sugarcane` : '1 MT = 1,000 kg'}
                </span>
              </div>

              <div>
                <label className="form-label">Weighted Landed Cost / Tonne (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={sugarcaneCostPerTonne}
                  onChange={(e) => setSugarcaneCostPerTonne(Number(e.target.value))}
                  className="form-input"
                />
                <span className="text-[11px] text-gray-400 mt-0.5 block">
                  Total Sugarcane Cost: {formatCurrency(sugarcaneCost)}
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Additional Ingredients */}
          <div className="card space-y-4">
            <h3 className="text-sm font-semibold text-gray-800 border-b pb-2">3. Ingredients & Additives (Sugar, Lime, etc.)</h3>

            {/* Add ingredient controls */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end bg-cream-50 p-3 rounded-lg border border-cream-200">
              <div className="sm:col-span-2">
                <label className="form-label text-xs">Material</label>
                <select
                  value={selectedMaterialId}
                  onChange={(e) => {
                    setSelectedMaterialId(e.target.value)
                    const m = allMaterials.find((x: any) => x.id === e.target.value)
                    if (m?.avg_cost) setSelectedUnitCost(m.avg_cost)
                  }}
                  className="form-select text-xs"
                >
                  <option value="">Select ingredient</option>
                  {ingredientOptions.map((m: any) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.unit}) - Stock: {m.current_stock}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label text-xs">Quantity</label>
                <input
                  type="number"
                  step="0.1"
                  value={selectedQty}
                  onChange={(e) => setSelectedQty(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Qty"
                  className="form-input text-xs"
                />
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleAddIngredient}
                  className="w-full btn-secondary text-xs flex items-center justify-center gap-1 py-2"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            </div>

            {/* Added ingredients table */}
            {ingredients.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="py-2">Ingredient</th>
                      <th className="py-2">Quantity</th>
                      <th className="py-2">Unit Cost</th>
                      <th className="py-2">Total</th>
                      <th className="py-2 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ingredients.map((ing, idx) => (
                      <tr key={idx}>
                        <td className="py-2 font-medium">{ing.material_name}</td>
                        <td className="py-2">{ing.quantity} {ing.unit}</td>
                        <td className="py-2">{formatCurrency(ing.unit_cost)}</td>
                        <td className="py-2 font-semibold">{formatCurrency(ing.total_cost)}</td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveIngredient(idx)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">No extra ingredients added (pure sugarcane run).</p>
            )}
          </div>

          {/* Section 4: Finished Goods Output & Labour */}
          <div className="card space-y-4">
            <h3 className="text-sm font-semibold text-gray-800 border-b pb-2">4. Finished Output & Labour Rate</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label text-primary-900 font-bold">
                  Finished Jaggery Output (kg) *
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  required
                  value={finishedKg}
                  onChange={(e) => setFinishedKg(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 1000"
                  className="form-input font-extrabold text-lg text-primary-900 border-primary-500"
                />
                {outKg > 0 && scTonnes > 0 && (
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="text-gray-500">Mass-based Production Yield:</span>
                    <span className="font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                      {yieldPercent.toFixed(1)}% yield
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="form-label">Labour Rate per 100 kg (₹) *</label>
                <input
                  type="number"
                  step="1"
                  required
                  value={labourRatePer100kg}
                  onChange={(e) => setLabourRatePer100kg(Number(e.target.value))}
                  className="form-input"
                />
                <span className="text-[11px] text-gray-500 mt-1 block">
                  Labour Cost = ({outKg || 0} ÷ 100) × ₹{labourRatePer100kg} = <strong className="text-gray-900">{formatCurrency(labourCost)}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Section 5: Electricity & Other Direct Costs */}
          <div className="card space-y-4">
            <h3 className="text-sm font-semibold text-gray-800 border-b pb-2">5. Electricity & Utilities</h3>

            <div className="space-y-3">
              <label className="form-label">Electricity Calculation Method</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                {[
                  { id: 'fixed', label: 'Method A: Fixed Amount per Run' },
                  { id: 'per_day', label: 'Method B: Daily Rate × Days' },
                  { id: 'bill_allocation', label: 'Method C: From Electricity Bill' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setElectricityMethod(m.id as any)}
                    className={`p-2.5 rounded-lg border text-left font-medium transition-colors ${
                      electricityMethod === m.id
                        ? 'border-primary-600 bg-primary-50 text-primary-900'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="form-label">
                    {electricityMethod === 'per_day' ? 'Electricity Rate per Day (₹)' : 'Electricity Amount (₹)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={electricityAmount}
                    onChange={(e) => setElectricityAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="form-input"
                  />
                </div>

                {electricityMethod === 'per_day' && (
                  <div>
                    <label className="form-label">Production Duration (Days)</label>
                    <input
                      type="number"
                      min="1"
                      value={productionDays}
                      onChange={(e) => setProductionDays(Number(e.target.value) || 1)}
                      className="form-input"
                    />
                  </div>
                )}
              </div>
            </div>

            <h4 className="text-xs font-semibold text-gray-700 uppercase pt-2">Other Direct Expenses</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="form-label text-xs">Fuel / Bagasse (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={fuelCost}
                  onChange={(e) => setFuelCost(e.target.value === '' ? '' : Number(e.target.value))}
                  className="form-input text-xs"
                />
              </div>

              <div>
                <label className="form-label text-xs">Packaging (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={packagingCost}
                  onChange={(e) => setPackagingCost(e.target.value === '' ? '' : Number(e.target.value))}
                  className="form-input text-xs"
                />
              </div>

              <div>
                <label className="form-label text-xs">Other Direct Costs (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={otherDirectCost}
                  onChange={(e) => setOtherDirectCost(e.target.value === '' ? '' : Number(e.target.value))}
                  className="form-input text-xs"
                />
              </div>
            </div>

            <div>
              <label className="form-label text-xs">Notes & Operating Remarks</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Bagasse moisture, boiler performance, jaggery color/texture..."
                className="form-input text-xs"
              />
            </div>
          </div>
        </div>

        {/* Right 1 Col: Live Cost Calculation & Confirmation Panel */}
        <div className="space-y-6">
          <div className="card bg-cream-50 border border-gold-400/50 sticky top-4 space-y-4">
            <div className="flex items-center gap-2 text-primary-900 font-bold border-b border-gold-300 pb-2">
              <Calculator className="w-5 h-5 text-gold-600" />
              <span>Real-Time Cost Breakdown</span>
            </div>

            {/* Detailed Line Items */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Sugarcane Input ({formatTonne(scTonnes)}):</span>
                <span className="font-semibold text-gray-900">{formatCurrency(sugarcaneCost)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Ingredients ({ingredients.length} items):</span>
                <span className="font-semibold text-gray-900">{formatCurrency(totalIngredientsCost)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Labour Cost:</span>
                <span className="font-semibold text-gray-900">{formatCurrency(labourCost)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Electricity ({electricityMethod}):</span>
                <span className="font-semibold text-gray-900">{formatCurrency(calculatedElectricity)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Fuel & Bagasse:</span>
                <span className="font-semibold text-gray-900">{formatCurrency(fuel)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Packaging & Other:</span>
                <span className="font-semibold text-gray-900">{formatCurrency(pkg + otherDirect)}</span>
              </div>

              {/* Total Direct Cost */}
              <div className="border-t border-gold-300 pt-2 flex justify-between items-baseline">
                <span className="font-bold text-gray-900">Total Direct Cost:</span>
                <span className="font-extrabold text-base text-primary-900">{formatCurrency(totalDirectCost)}</span>
              </div>

              <div className="bg-white/80 p-2 rounded border border-gold-300/60 flex justify-between items-center">
                <span className="text-gray-600 font-medium">Direct Cost / kg:</span>
                <span className="font-extrabold text-sm text-primary-800">{formatCurrency(directCostPerKg)} / kg</span>
              </div>

              {/* Fixed Expense Allocation */}
              <div className="pt-2 border-t border-gold-300">
                <div className="flex justify-between text-gray-500 text-[11px]">
                  <span>Allocated Monthly Overhead:</span>
                  <span>+{formatCurrency(estimatedAllocatedOverhead)}</span>
                </div>
                <div className="flex justify-between font-bold text-primary-950 mt-1">
                  <span>Fully Allocated Cost:</span>
                  <span>{formatCurrency(estimatedFullyAllocatedCost)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-amber-900 mt-0.5">
                  <span>Fully Allocated Cost / kg:</span>
                  <span>{formatCurrency(estimatedFullCostPerKg)} / kg</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                disabled={isSubmitting || scTonnes <= 0 || outKg <= 0}
                onClick={() => handleSave(true)}
                className="w-full btn-primary flex justify-center items-center gap-2 py-2.5 font-bold text-sm shadow-md bg-primary-700 hover:bg-primary-800 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" /> Confirm Production Run
              </button>

              <button
                type="button"
                disabled={isSubmitting || scTonnes <= 0}
                onClick={() => handleSave(false)}
                className="w-full btn-secondary flex justify-center items-center gap-2 py-2 text-xs font-semibold"
              >
                <Save className="w-3.5 h-3.5" /> Save as Draft
              </button>
            </div>

            <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-[11px] text-amber-800 flex items-start gap-1.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                On confirmation, sugarcane & ingredients will be permanently deducted from raw inventory, and finished jaggery stock will be increased.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

