import React, { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Save, Plus, AlertCircle, Building, Factory, DollarSign } from 'lucide-react'
import { useSettings, useFixedExpenses, useUpdateSettings, useCreateFixedExpense } from '../hooks/useSettings'
import { formatCurrency, formatDate } from '../lib/utils'
import toast from 'react-hot-toast'
import api from '../lib/api'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'business' | 'mfg' | 'fixed_expenses'>('business')

  const { data: settingsData, refetch: refetchSettings } = useSettings()
  const { data: fixedData, refetch: refetchFixed } = useFixedExpenses()
  const updateSettings = useUpdateSettings()
  const createFixed = useCreateFixedExpense()

  // Business settings state
  const [businessName, setBusinessName] = useState('SweetHarvest')
  const [currency, setCurrency] = useState('INR')
  const [invoicePrefix, setInvoicePrefix] = useState('SH')
  const [fyStart, setFyStart] = useState('04-01')
  const [defaultLabourRate, setDefaultLabourRate] = useState('200')
  const [defaultElecMethod, setDefaultElecMethod] = useState('fixed')
  const [valuationMethod, setValuationMethod] = useState('weighted_average')

  // Fixed expense modal
  const [fixedModalOpen, setFixedModalOpen] = useState(false)
  const [fixedName, setFixedName] = useState('Factory & Admin Overhead')
  const [fixedAmount, setFixedAmount] = useState<number | ''>(30000)
  const [fixedCategory, setFixedCategory] = useState('overhead')
  const [fixedStartDate, setFixedStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [fixedNotes, setFixedNotes] = useState('Base factory rent, supervisor salary & maintenance')

  const settings = settingsData?.settings || {}
  const fixedExpenses = fixedData?.fixed_expenses || []

  useEffect(() => {
    if (settings.business_name) setBusinessName(settings.business_name)
    if (settings.currency) setCurrency(settings.currency)
    if (settings.invoice_prefix) setInvoicePrefix(settings.invoice_prefix)
    if (settings.financial_year_start) setFyStart(settings.financial_year_start)
    if (settings.default_labour_rate) setDefaultLabourRate(settings.default_labour_rate)
    if (settings.default_electricity_method) setDefaultElecMethod(settings.default_electricity_method)
    if (settings.valuation_method) setValuationMethod(settings.valuation_method)
  }, [settings])

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await updateSettings.mutateAsync({
        business_name: businessName,
        currency,
        invoice_prefix: invoicePrefix,
        financial_year_start: fyStart,
        default_labour_rate: defaultLabourRate,
        default_electricity_method: defaultElecMethod,
        valuation_method: valuationMethod,
      })
      refetchSettings()
    } catch (err) {
      // handled in hook
    }
  }

  const handleAddFixed = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fixedName.trim() || !fixedAmount) {
      toast.error('Name and positive monthly amount are required')
      return
    }

    try {
      await createFixed.mutateAsync({
        name: fixedName.trim(),
        amount: Number(fixedAmount),
        category: fixedCategory,
        start_date: fixedStartDate,
        notes: fixedNotes.trim() || undefined,
      })
      setFixedModalOpen(false)
      refetchFixed()
    } catch (err) {
      // handled
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-primary-900">System Configuration & Settings</h2>
          <p className="text-xs text-gray-500">
            Manage company profile, fixed monthly overhead (₹30,000), labour defaults, and valuation methods
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-4 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('business')}
          className={`pb-2.5 px-1 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'business'
              ? 'border-primary-600 text-primary-900 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Building className="w-3.5 h-3.5" /> Business Profile
        </button>

        <button
          onClick={() => setActiveTab('mfg')}
          className={`pb-2.5 px-1 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'mfg'
              ? 'border-primary-600 text-primary-900 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Factory className="w-3.5 h-3.5" /> Manufacturing & Valuation
        </button>

        <button
          onClick={() => setActiveTab('fixed_expenses')}
          className={`pb-2.5 px-1 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'fixed_expenses'
              ? 'border-primary-600 text-primary-900 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" /> Monthly Fixed Expenses (Overhead)
        </button>
      </div>

      {/* 1. BUSINESS PROFILE */}
      {activeTab === 'business' && (
        <div className="card space-y-4">
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Business Name</label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="form-input font-bold"
                />
              </div>

              <div>
                <label className="form-label">Currency</label>
                <input
                  type="text"
                  disabled
                  value="INR (₹) - Indian Rupee"
                  className="form-input bg-gray-50 text-gray-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Invoice Sequence Prefix</label>
                <input
                  type="text"
                  value={invoicePrefix}
                  onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase())}
                  placeholder="e.g. SH"
                  className="form-input uppercase font-mono"
                />
                <span className="text-[11px] text-gray-400 mt-0.5 block">Format: {invoicePrefix}-2024-001</span>
              </div>

              <div>
                <label className="form-label">Financial Year Starting Date (MM-DD)</label>
                <input
                  type="text"
                  value={fyStart}
                  onChange={(e) => setFyStart(e.target.value)}
                  placeholder="04-01"
                  className="form-input font-mono"
                />
                <span className="text-[11px] text-gray-400 mt-0.5 block">Default: 04-01 (1st April in India)</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={updateSettings.isPending}
                className="btn-primary flex items-center gap-1.5 py-2 px-6"
              >
                <Save className="w-4 h-4" /> Save Business Profile
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2. MANUFACTURING & VALUATION */}
      {activeTab === 'mfg' && (
        <div className="card space-y-6">
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Default Labour Rate per 100 kg (₹)</label>
                <input
                  type="number"
                  value={defaultLabourRate}
                  onChange={(e) => setDefaultLabourRate(e.target.value)}
                  className="form-input font-bold"
                />
                <span className="text-[11px] text-gray-400 mt-0.5 block">
                  Applicable to new batches created
                </span>
              </div>

              <div>
                <label className="form-label">Default Electricity Method</label>
                <select
                  value={defaultElecMethod}
                  onChange={(e) => setDefaultElecMethod(e.target.value)}
                  className="form-select"
                >
                  <option value="fixed">Fixed Amount per Run</option>
                  <option value="per_day">Daily Rate × Production Days</option>
                  <option value="bill_allocation">Electricity Bill Allocation</option>
                </select>
              </div>
            </div>

            <div>
              <label className="form-label">Inventory Costing & Valuation Method</label>
              <select
                value={valuationMethod}
                onChange={(e) => setValuationMethod(e.target.value)}
                className="form-select font-semibold"
              >
                <option value="weighted_average">Weighted Average Costing (Standard)</option>
                <option value="batch_linked">Batch-Linked Specific Identification</option>
              </select>
              <span className="text-[11px] text-gray-500 mt-1 block">
                Sugarcane consumed and finished goods sold strictly adhere to this transparent costing basis.
              </span>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={updateSettings.isPending}
                className="btn-primary flex items-center gap-1.5 py-2 px-6"
              >
                <Save className="w-4 h-4" /> Update Manufacturing Defaults
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. MONTHLY FIXED EXPENSES (₹30,000) */}
      {activeTab === 'fixed_expenses' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-cream-50 p-4 rounded-xl border border-gold-300">
            <div>
              <h4 className="text-sm font-bold text-gray-900">Current Fixed Overhead: ₹30,000 / month</h4>
              <p className="text-xs text-gray-600 mt-0.5">
                Proportionally allocated to confirmed batches in each month based on kg output:
                <br />
                <code className="text-primary-800 bg-white px-1.5 py-0.5 rounded font-mono text-[11px]">
                  Batch Overhead = Monthly Fixed Cost × (Batch Output kg ÷ Month Total Output kg)
                </code>
              </p>
            </div>

            <button
              onClick={() => setFixedModalOpen(true)}
              className="btn-primary text-xs flex items-center gap-1.5 py-2 px-3 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> Add Fixed Expense
            </button>
          </div>

          <div className="card p-0 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-cream-100 text-gray-700 border-b">
                <tr>
                  <th className="py-2.5 px-4 text-left">Overhead Category</th>
                  <th className="py-2.5 px-4 text-right">Monthly Amount</th>
                  <th className="py-2.5 px-4 text-left">Effective Start Date</th>
                  <th className="py-2.5 px-4 text-left">Notes</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {fixedExpenses.map((fe: any) => (
                  <tr key={fe.id}>
                    <td className="py-3 px-4 font-bold text-gray-900">{fe.name}</td>
                    <td className="py-3 px-4 text-right font-extrabold text-primary-900">
                      {formatCurrency(fe.amount)}
                    </td>
                    <td className="py-3 px-4">{formatDate(fe.start_date)}</td>
                    <td className="py-3 px-4 text-gray-500">{fe.notes || '-'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={fe.is_active ? 'badge-green' : 'badge-gray'}>
                        {fe.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add Fixed Modal */}
          {fixedModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
                <h3 className="text-base font-bold text-gray-900">Configure Monthly Fixed Expense</h3>
                <form onSubmit={handleAddFixed} className="space-y-4">
                  <div>
                    <label className="form-label">Expense Description *</label>
                    <input
                      type="text"
                      required
                      value={fixedName}
                      onChange={(e) => setFixedName(e.target.value)}
                      placeholder="e.g. Factory Rent & Supervisor"
                      className="form-input"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Monthly Amount (₹) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        required
                        value={fixedAmount}
                        onChange={(e) => setFixedAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        className="form-input font-bold"
                      />
                    </div>

                    <div>
                      <label className="form-label">Start Date *</label>
                      <input
                        type="date"
                        required
                        value={fixedStartDate}
                        onChange={(e) => setFixedStartDate(e.target.value)}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="form-label">Notes</label>
                    <textarea
                      rows={2}
                      value={fixedNotes}
                      onChange={(e) => setFixedNotes(e.target.value)}
                      placeholder="What this fixed cost covers..."
                      className="form-input text-xs"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setFixedModalOpen(false)}
                      className="btn-secondary text-xs"
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary text-xs">
                      Save Fixed Expense
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

