import React, { useState } from 'react'
import { Plus, HardHat, TrendingUp, Calendar, AlertCircle } from 'lucide-react'
import { useLabourRates, useLabourReports } from '../hooks/useLabour'
import DataTable, { Column } from '../components/DataTable'
import { formatCurrency, formatKg, formatDate } from '../lib/utils'
import toast from 'react-hot-toast'
import api from '../lib/api'

export default function LabourPage() {
  const [activeTab, setActiveTab] = useState<'rates' | 'reports'>('rates')
  const { data: ratesData, refetch: refetchRates } = useLabourRates()
  const { data: reportsData } = useLabourReports()

  // New rate modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [newRate, setNewRate] = useState<number | ''>(200)
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const rates = ratesData?.rates || []
  const monthlyLabour = reportsData?.monthly_labour || []

  const currentRate = rates[0]?.rate_per_100kg || 200

  const handleAddRate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRate || Number(newRate) <= 0) {
      toast.error('Please enter a valid positive labour rate')
      return
    }

    try {
      setSubmitting(true)
      await api.post('/labour/rates', {
        rate_per_100kg: Number(newRate),
        effective_date: effectiveDate,
        notes: notes.trim() || 'Scheduled rate update',
      })
      toast.success('New labour rate activated')
      setModalOpen(false)
      setNotes('')
      refetchRates()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update labour rate')
    } finally {
      setSubmitting(false)
    }
  }

  const rateColumns: Column<any>[] = [
    {
      key: 'rate_per_100kg',
      header: 'Labour Rate (per 100 kg)',
      sortable: true,
      render: (r: any) => (
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-sm text-primary-900">{formatCurrency(r.rate_per_100kg)}</span>
          <span className="text-gray-500 text-xs">/ 100 kg</span>
        </div>
      ),
    },
    {
      key: 'effective_date',
      header: 'Effective Date',
      sortable: true,
      render: (r) => <span>{formatDate(r.effective_date)}</span>,
    },
    {
      key: 'notes',
      header: 'Remarks / Notes',
      render: (r) => <span className="text-gray-600 text-xs">{r.notes || '-'}</span>,
    },
    {
      key: 'created_at',
      header: 'Recorded On',
      render: (r) => <span className="text-gray-400 text-xs">{formatDate(r.created_at)}</span>,
    },
  ]

  const reportColumns: Column<any>[] = [
    {
      key: 'month',
      header: 'Month',
      sortable: true,
      render: (r) => <span className="font-bold text-gray-900">{r.month}</span>,
    },
    {
      key: 'batch_count',
      header: 'Batches',
      render: (r) => <span>{r.batch_count} runs</span>,
    },
    {
      key: 'total_kg',
      header: 'Finished Output',
      sortable: true,
      render: (r) => <span className="font-bold">{formatKg(r.total_kg)}</span>,
    },
    {
      key: 'total_labour_cost',
      header: 'Total Labour Paid',
      sortable: true,
      render: (r) => <span className="font-extrabold text-primary-900">{formatCurrency(r.total_labour_cost)}</span>,
    },
    {
      key: 'labour_cost_per_kg',
      header: 'Labour Cost / kg',
      render: (r) => (
        <span className="font-semibold text-primary-800">
          {formatCurrency(r.labour_cost_per_kg)} / kg
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-primary-900">Labour Management</h2>
          <p className="text-xs text-gray-500">
            Jaggery production labour rates (per 100 kg produced), rate revision history, and monthly payout analytics
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="btn-primary text-xs flex items-center gap-1.5 py-2 px-3 whitespace-nowrap bg-primary-700"
        >
          <Plus className="w-4 h-4" /> Revise Labour Rate
        </button>
      </div>

      {/* Current Active Rate Banner */}
      <div className="bg-cream-50 border-l-4 border-gold-500 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gold-400/20 text-gold-700 flex items-center justify-center">
            <HardHat className="w-6 h-6 text-gold-600" />
          </div>
          <div>
            <span className="text-xs text-gray-500 block">Current Standard Labour Wage</span>
            <span className="text-2xl font-black text-primary-900">
              {formatCurrency(currentRate)} <span className="text-sm font-medium text-gray-600">per 100 kg jaggery output</span>
            </span>
          </div>
        </div>

        <div className="text-xs text-gray-600 max-w-sm">
          <div className="flex items-center gap-1 font-semibold text-primary-800 mb-0.5">
            <AlertCircle className="w-3.5 h-3.5" /> Historical Cost Integrity
          </div>
          Rate changes apply strictly to future batches. All previously confirmed production batches retain their original labour rates.
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-4 text-sm font-medium">
        <button
          onClick={() => setActiveTab('rates')}
          className={`pb-2.5 px-1 border-b-2 transition-colors ${
            activeTab === 'rates'
              ? 'border-primary-600 text-primary-800 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Rate History & Changes
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`pb-2.5 px-1 border-b-2 transition-colors ${
            activeTab === 'reports'
              ? 'border-primary-600 text-primary-800 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Monthly Labour Payout Analytics
        </button>
      </div>

      {activeTab === 'rates' && (
        <DataTable
          columns={rateColumns}
          data={rates}
          searchPlaceholder="Search rate history..."
          emptyMessage="No labour rate records found."
        />
      )}

      {activeTab === 'reports' && (
        <DataTable
          columns={reportColumns}
          data={monthlyLabour}
          searchPlaceholder="Search monthly reports..."
          emptyMessage="No production data available for monthly labour calculation."
        />
      )}

      {/* Revise Rate Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-gray-900">Set New Labour Rate per 100 kg</h3>
            <p className="text-xs text-gray-500">
              Future production batches will calculate labour cost using this rate. Past confirmed runs will remain unchanged.
            </p>

            <form onSubmit={handleAddRate} className="space-y-4 pt-2">
              <div>
                <label className="form-label">New Rate per 100 kg (₹) *</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  required
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 220"
                  className="form-input text-lg font-bold"
                />
              </div>

              <div>
                <label className="form-label">Effective Date *</label>
                <input
                  type="date"
                  required
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">Reason / Agreement Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Diwali bonus adjustment, seasonal wage revision..."
                  className="form-input"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary text-xs"
                >
                  {submitting ? 'Activating...' : 'Activate New Rate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
