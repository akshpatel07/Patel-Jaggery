import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'

export default function SupplierFormPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [gstin, setGstin] = useState('')
  const [openingBalance, setOpeningBalance] = useState<number | ''>(0)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Supplier name is required')
      return
    }

    try {
      setLoading(true)
      await api.post('/suppliers', {
        name: name.trim(),
        business_name: businessName.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        gstin: gstin.trim() || null,
        opening_balance: Number(openingBalance) || 0,
        notes: notes.trim() || null,
      })
      toast.success('Supplier created successfully')
      navigate('/suppliers')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create supplier')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/suppliers')}
          className="flex items-center text-sm font-medium text-gray-500 hover:text-primary-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Suppliers
        </button>
        <h2 className="text-xl font-bold text-primary-900">Add Sugarcane Supplier</h2>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Farmer / Supplier Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Balasaheb Shinde"
                className="form-input"
              />
            </div>

            <div>
              <label className="form-label">Farm / Farm Firm Name</label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Shinde Agro Farms"
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
                placeholder="e.g. 9822012345"
                className="form-input"
              />
            </div>

            <div>
              <label className="form-label">Opening Payable Balance (₹)</label>
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
            <label className="form-label">Address / Village / Field Location</label>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Village, Taluka, District..."
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">GSTIN (Optional)</label>
            <input
              type="text"
              value={gstin}
              onChange={(e) => setGstin(e.target.value)}
              placeholder="e.g. 27AAAAA0000A1Z5"
              className="form-input uppercase"
            />
          </div>

          <div>
            <label className="form-label">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Sugarcane variety, harvesting season, weighing scale agreement..."
              className="form-input"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex items-center gap-2 py-2 px-6"
            >
              <Save className="w-4 h-4" /> Save Supplier
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

