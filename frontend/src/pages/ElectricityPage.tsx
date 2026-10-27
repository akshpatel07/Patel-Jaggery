import React, { useState } from 'react'
import { Plus, Zap, AlertCircle, CheckCircle, Split } from 'lucide-react'
import { useElectricityBills, useMonthlyElectricity } from '../hooks/useElectricity'
import DataTable, { Column } from '../components/DataTable'
import { formatCurrency, formatDate } from '../lib/utils'
import toast from 'react-hot-toast'
import api from '../lib/api'

export default function ElectricityPage() {
  const [activeTab, setActiveTab] = useState<'bills' | 'monthly'>('bills')
  const { data: billsData, refetch: refetchBills } = useElectricityBills()
  const { data: monthlyData } = useMonthlyElectricity()

  // New Bill Modal
  const [billModalOpen, setBillModalOpen] = useState(false)
  const [billNumber, setBillNumber] = useState('')
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10))
  const [totalAmount, setTotalAmount] = useState<number | ''>('')
  const [periodFrom, setPeriodFrom] = useState('')
  const [periodTo, setPeriodTo] = useState('')
  const [allocationBasis, setAllocationBasis] = useState('production_days')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const bills = billsData?.bills || []
  const monthly = monthlyData?.monthly_electricity || []

  const handleAddBill = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!totalAmount || Number(totalAmount) <= 0) {
      toast.error('Please enter a valid bill amount')
      return
    }

    try {
      setSubmitting(true)
      await api.post('/electricity/bills', {
        bill_number: billNumber.trim() || null,
        bill_date: billDate,
        total_amount: Number(totalAmount),
        period_from: periodFrom || null,
        period_to: periodTo || null,
        allocation_basis: allocationBasis,
        notes: notes.trim() || null,
      })
      toast.success('Electricity bill recorded')
      setBillModalOpen(false)
      setBillNumber('')
      setTotalAmount('')
      setNotes('')
      refetchBills()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add electricity bill')
    } finally {
      setSubmitting(false)
    }
  }

  const billColumns: Column<any>[] = [
    {
      key: 'bill_number',
      header: 'Bill Number',
      sortable: true,
      render: (r) => <span className="font-mono font-bold text-gray-900">{r.bill_number || 'MSEB / Utility'}</span>,
    },
    {
      key: 'bill_date',
      header: 'Bill Date',
      sortable: true,
      render: (r) => <span>{formatDate(r.bill_date)}</span>,
    },
    {
      key: 'total_amount',
      header: 'Bill Amount',
      sortable: true,
      render: (r) => <span className="font-extrabold text-primary-900">{formatCurrency(r.total_amount)}</span>,
    },
    {
      key: 'period',
      header: 'Billing Period',
      render: (r) => (
        <span className="text-xs text-gray-500">
          {r.period_from && r.period_to ? `${formatDate(r.period_from)} → ${formatDate(r.period_to)}` : 'Monthly'}
        </span>
      ),
    },
    {
      key: 'allocated_amount',
      header: 'Allocated to Batches',
      render: (r) => <span className="text-green-700 font-semibold">{formatCurrency(r.allocated_amount || 0)}</span>,
    },
    {
      key: 'unallocated_amount',
      header: 'Unallocated',
      render: (r) => {
        const unalloc = Math.max(0, r.total_amount - (r.allocated_amount || 0))
        return (
          <span className={`font-semibold ${unalloc > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
            {formatCurrency(unalloc)}
          </span>
        )
      },
    },
  ]

  const monthlyColumns: Column<any>[] = [
    {
      key: 'month',
      header: 'Month',
      sortable: true,
      render: (r) => <span className="font-bold text-gray-900">{r.month}</span>,
    },
    {
      key: 'batch_count',
      header: 'Batches Powered',
      render: (r) => <span>{r.batch_count} runs</span>,
    },
    {
      key: 'total_electricity_cost',
      header: 'Total Electricity Cost',
      sortable: true,
      render: (r) => <span className="font-extrabold text-primary-900">{formatCurrency(r.total_electricity_cost)}</span>,
    },
    {
      key: 'electricity_cost_per_kg',
      header: 'Electricity Cost / kg',
      render: (r) => (
        <span className="font-semibold text-primary-800">
          {formatCurrency(r.electricity_cost_per_kg)} / kg
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-primary-900">Electricity & Utilities</h2>
          <p className="text-xs text-gray-500">
            Manage factory power bills, configure allocation methods across runs, and prevent double-counting
          </p>
        </div>

        <button
          onClick={() => setBillModalOpen(true)}
          className="btn-primary text-xs flex items-center gap-1.5 py-2 px-3 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /> Record Electricity Bill
        </button>
      </div>

      {/* 3 Methods Explainer Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card border-l-4 border-primary-600 bg-white p-4">
          <span className="font-bold text-xs uppercase text-primary-800 tracking-wider">Method A</span>
          <h4 className="font-bold text-gray-900 text-sm mt-1">Fixed Amount per Run</h4>
          <p className="text-xs text-gray-500 mt-1">
            Assigns a specific flat electricity charge directly to each production run (e.g. ₹3,000 per pan run).
          </p>
        </div>

        <div className="card border-l-4 border-gold-500 bg-white p-4">
          <span className="font-bold text-xs uppercase text-gold-700 tracking-wider">Method B</span>
          <h4 className="font-bold text-gray-900 text-sm mt-1">Per Production Day</h4>
          <p className="text-xs text-gray-500 mt-1">
            Charges power based on daily consumption rate multiplied by total production duration days.
          </p>
        </div>

        <div className="card border-l-4 border-brown-500 bg-white p-4">
          <span className="font-bold text-xs uppercase text-brown-700 tracking-wider">Method C</span>
          <h4 className="font-bold text-gray-900 text-sm mt-1">Actual Bill Allocation</h4>
          <p className="text-xs text-gray-500 mt-1">
            Upload the state utility electricity bill and apportion it systematically across batches without duplication.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-4 text-sm font-medium">
        <button
          onClick={() => setActiveTab('bills')}
          className={`pb-2.5 px-1 border-b-2 transition-colors ${
            activeTab === 'bills'
              ? 'border-primary-600 text-primary-800 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Utility Electricity Bills
        </button>
        <button
          onClick={() => setActiveTab('monthly')}
          className={`pb-2.5 px-1 border-b-2 transition-colors ${
            activeTab === 'monthly'
              ? 'border-primary-600 text-primary-800 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Monthly Power Expenditure
        </button>
      </div>

      {activeTab === 'bills' && (
        <DataTable
          columns={billColumns}
          data={bills}
          searchPlaceholder="Search bills..."
          emptyMessage="No electricity bills recorded yet."
        />
      )}

      {activeTab === 'monthly' && (
        <DataTable
          columns={monthlyColumns}
          data={monthly}
          searchPlaceholder="Search monthly power usage..."
          emptyMessage="No batch electricity allocations recorded yet."
        />
      )}

      {/* Record Bill Modal */}
      {billModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-gray-900">Record Electricity Utility Bill</h3>
            <p className="text-xs text-gray-500">
              Note: This bill will be allocated to production runs. It will NOT be counted twice as a general operating expense.
            </p>

            <form onSubmit={handleAddBill} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Bill / Consumer #</label>
                  <input
                    type="text"
                    value={billNumber}
                    onChange={(e) => setBillNumber(e.target.value)}
                    placeholder="e.g. MSEB-78291"
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">Bill Date *</label>
                  <input
                    type="date"
                    required
                    value={billDate}
                    onChange={(e) => setBillDate(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Total Bill Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 24500"
                  className="form-input text-lg font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Period From</label>
                  <input
                    type="date"
                    value={periodFrom}
                    onChange={(e) => setPeriodFrom(e.target.value)}
                    className="form-input text-xs"
                  />
                </div>

                <div>
                  <label className="form-label">Period To</label>
                  <input
                    type="date"
                    value={periodTo}
                    onChange={(e) => setPeriodTo(e.target.value)}
                    className="form-input text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Allocation Basis</label>
                <select
                  value={allocationBasis}
                  onChange={(e) => setAllocationBasis(e.target.value)}
                  className="form-select"
                >
                  <option value="production_days">Production Days</option>
                  <option value="output_kg">Output in kg</option>
                  <option value="machine_hours">Machine Operating Hours</option>
                </select>
              </div>

              <div>
                <label className="form-label">Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Meter reading, tariff slab, units consumed..."
                  className="form-input"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBillModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary text-xs"
                >
                  {submitting ? 'Saving...' : 'Save Electricity Bill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

