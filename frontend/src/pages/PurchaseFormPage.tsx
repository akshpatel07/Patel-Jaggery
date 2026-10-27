import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Calculator, Save, Plus } from 'lucide-react'
import { useCreatePurchase } from '../hooks/usePurchases'
import { useSuppliers } from '../hooks/useSuppliers'
import { formatCurrency, formatTonne } from '../lib/utils'
import toast from 'react-hot-toast'
import api from '../lib/api'

export default function PurchaseFormPage() {
  const navigate = useNavigate()
  const createPurchase = useCreatePurchase()
  const { data: supplierData } = useSuppliers()

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [supplierId, setSupplierId] = useState('')
  const [reference, setReference] = useState('')
  const [quantity, setQuantity] = useState<number | ''>('')
  const [rate, setRate] = useState<number | ''>('')
  const [transportCost, setTransportCost] = useState<number | ''>(0)
  const [loadingCharges, setLoadingCharges] = useState<number | ''>(0)
  const [otherExpenses, setOtherExpenses] = useState<number | ''>(0)
  const [amountPaid, setAmountPaid] = useState<number | ''>(0)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [notes, setNotes] = useState('')

  // Live calculations
  const qtyNum = Number(quantity) || 0
  const rateNum = Number(rate) || 0
  const baseCost = qtyNum * rateNum
  const transportNum = Number(transportCost) || 0
  const loadingNum = Number(loadingCharges) || 0
  const otherNum = Number(otherExpenses) || 0
  const totalLandedCost = baseCost + transportNum + loadingNum + otherNum
  const landedRatePerTonne = qtyNum > 0 ? totalLandedCost / qtyNum : 0

  const suppliers = supplierData?.suppliers || []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!date) {
      toast.error('Please select purchase date')
      return
    }
    if (qtyNum <= 0) {
      toast.error('Please enter valid sugarcane quantity in tonnes')
      return
    }
    if (rateNum <= 0) {
      toast.error('Please enter valid purchase rate per tonne')
      return
    }

    try {
      await api.post('/purchases', {
        purchase_date: date,
        supplier_id: supplierId || null,
        reference_number: reference.trim() || null,
        quantity_tonnes: qtyNum,
        rate_per_tonne: rateNum,
        transport_cost: transportNum,
        loading_charges: loadingNum,
        other_expenses: otherNum,
        notes: notes.trim() || null,
      })

      // If initial payment entered
      const paidNum = Number(amountPaid) || 0
      toast.success('Sugarcane purchase confirmed and raw stock updated!')
      navigate('/purchases')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save purchase')
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/purchases')}
          className="flex items-center text-sm font-medium text-gray-500 hover:text-primary-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Purchases
        </button>
        <h2 className="text-xl font-bold text-primary-900">Record Sugarcane Purchase</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Form (2 cols) */}
          <div className="md:col-span-2 space-y-6">
            <div className="card space-y-4">
              <h3 className="text-sm font-semibold text-gray-800 border-b pb-2">Purchase & Supplier Information</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Purchase Date *</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">Invoice / Reference #</label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="e.g. BILL-9201"
                    className="form-input"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="form-label mb-0">Supplier</label>
                  <button
                    type="button"
                    onClick={() => navigate('/suppliers/new')}
                    className="text-xs text-primary-600 hover:underline flex items-center"
                  >
                    <Plus className="w-3 h-3 mr-0.5" /> Add New Supplier
                  </button>
                </div>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="form-select"
                >
                  <option value="">Direct Farmer / Cash Purchase</option>
                  {suppliers.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.business_name ? `(${s.business_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="card space-y-4">
              <h3 className="text-sm font-semibold text-gray-800 border-b pb-2">Sugarcane Quantity & Costs</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Sugarcane Quantity (Metric Tonnes) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 10.50"
                    className="form-input text-base font-semibold"
                  />
                  <span className="text-[11px] text-gray-400 mt-0.5 block">1 MT = 1,000 kg</span>
                </div>

                <div>
                  <label className="form-label">Purchase Rate per Tonne (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={rate}
                    onChange={(e) => setRate(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 3000"
                    className="form-input text-base font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="form-label">Transport Cost (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={transportCost}
                    onChange={(e) => setTransportCost(e.target.value === '' ? '' : Number(e.target.value))}
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">Loading/Unloading (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={loadingCharges}
                    onChange={(e) => setLoadingCharges(e.target.value === '' ? '' : Number(e.target.value))}
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">Other Expenses (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={otherExpenses}
                    onChange={(e) => setOtherExpenses(e.target.value === '' ? '' : Number(e.target.value))}
                    className="form-input"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Notes & Remarks</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Field location, truck details, quality notes..."
                  className="form-input"
                />
              </div>
            </div>
          </div>

          {/* Live Calculation Summary (1 col) */}
          <div className="space-y-6">
            <div className="card bg-cream-50 border border-gold-400/40 sticky top-4 space-y-4">
              <div className="flex items-center gap-2 text-primary-900 font-bold border-b border-gold-300 pb-2">
                <Calculator className="w-5 h-5 text-gold-600" />
                <span>Landed Cost Breakdown</span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Quantity:</span>
                  <span className="font-semibold text-gray-900">{formatTonne(qtyNum)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Rate per Tonne:</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(rateNum)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Base Sugarcane Cost:</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(baseCost)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Transportation:</span>
                  <span className="text-gray-800">+{formatCurrency(transportNum)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Loading & Charges:</span>
                  <span className="text-gray-800">+{formatCurrency(loadingNum)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Other Incurred Costs:</span>
                  <span className="text-gray-800">+{formatCurrency(otherNum)}</span>
                </div>

                <div className="border-t border-gold-300 pt-3 flex justify-between items-baseline">
                  <span className="font-bold text-sm text-primary-950">Total Landed Cost:</span>
                  <span className="font-extrabold text-base text-primary-800">{formatCurrency(totalLandedCost)}</span>
                </div>

                <div className="bg-white/80 p-2.5 rounded-lg border border-gold-300/60 mt-2 text-center">
                  <span className="text-[11px] text-gray-500 block">Actual Landed Rate / Tonne</span>
                  <span className="font-bold text-sm text-primary-700">{formatCurrency(landedRatePerTonne)}</span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full btn-primary flex justify-center items-center gap-2 py-2.5 font-semibold text-sm shadow-md"
              >
                <Save className="w-4 h-4" /> Confirm & Post Purchase
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

