import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { useCreateCustomer } from '../hooks/useCustomers'
import toast from 'react-hot-toast'
import api from '../lib/api'

export default function CustomerFormPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [gstin, setGstin] = useState('')
  const [creditTerms, setCreditTerms] = useState<number | ''>(15)
  const [openingBalance, setOpeningBalance] = useState<number | ''>(0)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Customer name is required')
      return
    }

    try {
      setLoading(true)
      await api.post('/customers', {
        name: name.trim(),
        business_name: businessName.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        gstin: gstin.trim() || null,
        credit_terms_days: Number(creditTerms) || 0,
        opening_balance: Number(openingBalance) || 0,
        notes: notes.trim() || null,
      })
      toast.success('Customer added successfully')
      navigate('/customers')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add customer')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/customers')}
          className="flex items-center text-sm font-medium text-gray-500 hover:text-primary-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Customers
        </button>
        <h2 className="text-xl font-bold text-primary-900">Add New Customer</h2>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Contact Person Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ramesh Patil"
                className="form-input"
              />
            </div>

            <div>
              <label className="form-label">Business / Shop Name</label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Patil Sweet Mart"
                className="form-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Mobile Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                className="form-input"
              />
            </div>

            <div>
              <label className="form-label">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. patil@example.com"
                className="form-input"
              />
            </div>
          </div>

          <div>
            <label className="form-label">Address & Delivery Location</label>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Shop #, Market Yard, City, PIN..."
              className="form-input"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="form-label">GSTIN (Optional)</label>
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                placeholder="27ABCDE1234F1Z5"
                className="form-input uppercase"
              />
            </div>

            <div>
              <label className="form-label">Credit Terms (Days)</label>
              <input
                type="number"
                min="0"
                value={creditTerms}
                onChange={(e) => setCreditTerms(e.target.value === '' ? '' : Number(e.target.value))}
                className="form-input"
              />
            </div>

            <div>
              <label className="form-label">Opening Balance (₹)</label>
              <input
                type="number"
                step="0.01"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value === '' ? '' : Number(e.target.value))}
                className="form-input"
              />
            </div>
          </div>

          <div>
            <label className="form-label">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Preferred delivery transport, payment preferences..."
              className="form-input"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex items-center gap-2 py-2 px-6"
            >
              <Save className="w-4 h-4" /> Save Customer
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

