import React, { useState } from 'react'
import { Plus, Receipt, Filter, Trash2 } from 'lucide-react'
import { useExpenses, useExpenseCategories } from '../hooks/useExpenses'
import DataTable, { Column } from '../components/DataTable'
import { formatCurrency, formatDate, paymentBadgeClass } from '../lib/utils'
import toast from 'react-hot-toast'
import api from '../lib/api'

export default function ExpensesPage() {
  const [categoryFilter, setCategoryFilter] = useState('')
  const [classificationFilter, setClassificationFilter] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const { data: catData } = useExpenseCategories()
  const { data, isLoading, refetch } = useExpenses({
    ...(categoryFilter ? { category: categoryFilter } : {}),
    ...(classificationFilter ? { classification: classificationFilter } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  })

  // Add Expense Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10))
  const [category, setCategory] = useState('Transportation')
  const [classification, setClassification] = useState('other')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState<number | ''>('')
  const [vendor, setVendor] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [paymentStatus, setPaymentStatus] = useState('paid')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const expenses = data?.expenses || []
  const summary = data?.summary || { total_amount: 0, total_paid: 0, total_unpaid: 0 }
  const categories = catData?.categories || []
  const classifications = catData?.classifications || ['direct', 'overhead', 'selling', 'admin', 'other']

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim() || !amount || Number(amount) <= 0) {
      toast.error('Description and positive amount are required')
      return
    }

    try {
      setSubmitting(true)
      await api.post('/expenses', {
        expense_date: expenseDate,
        category,
        classification,
        description: description.trim(),
        amount: Number(amount),
        vendor: vendor.trim() || null,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        notes: notes.trim() || null,
      })
      toast.success('Expense recorded successfully')
      setModalOpen(false)
      setDescription('')
      setAmount('')
      setVendor('')
      setNotes('')
      refetch()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to record expense')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense entry?')) return
    try {
      await api.delete(`/expenses/${id}`)
      toast.success('Expense removed')
      refetch()
    } catch (err: any) {
      toast.error('Failed to delete expense')
    }
  }

  const columns: Column<any>[] = [
    {
      key: 'expense_date',
      header: 'Date',
      sortable: true,
      render: (r) => <span>{formatDate(r.expense_date)}</span>,
    },
    {
      key: 'category',
      header: 'Category',
      sortable: true,
      render: (r) => (
        <span className="font-semibold text-primary-900 bg-cream-100 px-2 py-0.5 rounded text-xs">
          {r.category}
        </span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (r) => (
        <div>
          <span className="font-medium text-gray-900">{r.description}</span>
          {r.vendor && <span className="block text-[11px] text-gray-500">Vendor: {r.vendor}</span>}
        </div>
      ),
    },
    {
      key: 'classification',
      header: 'Classification',
      render: (r) => (
        <span className="text-xs uppercase font-mono px-2 py-0.5 bg-gray-100 rounded text-gray-700">
          {r.classification}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      render: (r) => <span className="font-extrabold text-gray-900">{formatCurrency(r.amount)}</span>,
    },
    {
      key: 'payment_status',
      header: 'Payment',
      render: (r) => (
        <div>
          <span className={paymentBadgeClass(r.payment_status)}>{r.payment_status.toUpperCase()}</span>
          {r.payment_method && <span className="block text-[10px] text-gray-400 mt-0.5">{r.payment_method}</span>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <button
          onClick={() => handleDelete(r.id)}
          className="text-gray-400 hover:text-red-600 p-1 rounded"
          title="Delete Expense"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-primary-900">Operating Expenses</h2>
          <p className="text-xs text-gray-500">
            Record and classify all operational, administrative, selling, and factory expenses
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="btn-primary text-xs flex items-center gap-1.5 py-2 px-3 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /> Record New Expense
        </button>
      </div>

      {/* Expense Summary Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card bg-white p-4 border-l-4 border-primary-600">
          <span className="text-xs text-gray-500 block">Total Expenses (Filtered)</span>
          <span className="text-2xl font-black text-primary-900">{formatCurrency(summary.total_amount)}</span>
        </div>
        <div className="card bg-white p-4 border-l-4 border-green-600">
          <span className="text-xs text-gray-500 block">Total Paid</span>
          <span className="text-2xl font-black text-green-700">{formatCurrency(summary.total_paid)}</span>
        </div>
        <div className="card bg-white p-4 border-l-4 border-red-500">
          <span className="text-xs text-gray-500 block">Unpaid / Accrued</span>
          <span className="text-2xl font-black text-red-600">{formatCurrency(summary.total_unpaid)}</span>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-gray-100 shadow-sm text-xs">
        <Filter className="w-4 h-4 text-gray-400" />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="form-select py-1 px-2 text-xs w-auto"
        >
          <option value="">All Categories</option>
          {categories.map((c: string) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          value={classificationFilter}
          onChange={(e) => setClassificationFilter(e.target.value)}
          className="form-select py-1 px-2 text-xs w-auto"
        >
          <option value="">All Classifications</option>
          {classifications.map((cl: string) => (
            <option key={cl} value={cl}>{cl.toUpperCase()}</option>
          ))}
        </select>

        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="form-input py-1 px-2 text-xs w-auto"
        />
        <span className="text-gray-400">to</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="form-input py-1 px-2 text-xs w-auto"
        />

        {(categoryFilter || classificationFilter || from || to) && (
          <button
            onClick={() => {
              setCategoryFilter('')
              setClassificationFilter('')
              setFrom('')
              setTo('')
            }}
            className="text-primary-600 hover:underline ml-auto"
          >
            Clear Filters
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={expenses}
        loading={isLoading}
        searchPlaceholder="Search description or vendor..."
        emptyMessage="No expenses recorded."
      />

      {/* Record Expense Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-gray-900">Record Operating Expense</h3>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Expense Date *</label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 1500"
                    className="form-input font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="form-select"
                  >
                    {categories.map((c: string) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Classification *</label>
                  <select
                    value={classification}
                    onChange={(e) => setClassification(e.target.value)}
                    className="form-select"
                  >
                    {classifications.map((cl: string) => (
                      <option key={cl} value={cl}>{cl.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Description / Particulars *</label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Diesel for generator, crusher belt repair, jute bag twine"
                  className="form-input"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="form-label text-xs">Vendor / Paid To</label>
                  <input
                    type="text"
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    placeholder="e.g. Bharat Petroleum"
                    className="form-input text-xs"
                  />
                </div>

                <div>
                  <label className="form-label text-xs">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="form-select text-xs"
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI / GPay</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="form-label text-xs">Payment Status</label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                    className="form-select text-xs"
                  >
                    <option value="paid">Paid</option>
                    <option value="unpaid">Unpaid / Due</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label text-xs">Notes / Voucher Ref</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Bill number, receipt reference..."
                  className="form-input text-xs"
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
                  {submitting ? 'Saving...' : 'Post Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

