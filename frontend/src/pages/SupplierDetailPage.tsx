import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, MapPin, Plus } from 'lucide-react'
import { useSupplier } from '../hooks/useSuppliers'
import { formatCurrency, formatTonne, formatDate, paymentBadgeClass } from '../lib/utils'

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data, isLoading } = useSupplier(id!)

  const supplier = data?.supplier
  const purchases = data?.purchases || []
  const payments = data?.payments || []

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading supplier profile...</div>
  }

  if (!supplier) {
    return (
      <div className="card text-center p-8 space-y-4">
        <p className="text-gray-500">Supplier not found</p>
        <button onClick={() => navigate('/suppliers')} className="btn-secondary text-sm">
          Return to Suppliers
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/suppliers')}
          className="flex items-center text-sm font-medium text-gray-500 hover:text-primary-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Suppliers
        </button>

        <button
          onClick={() => navigate('/purchases/new')}
          className="btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3"
        >
          <Plus className="w-4 h-4" /> Record Purchase from Farmer
        </button>
      </div>

      <div className="card space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-gray-100 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{supplier.name}</h2>
            {supplier.business_name && (
              <p className="text-sm font-semibold text-primary-800">{supplier.business_name}</p>
            )}
            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 mt-2">
              {supplier.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-gray-400" /> {supplier.phone}
                </span>
              )}
              {supplier.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" /> {supplier.address}
                </span>
              )}
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs text-gray-500 block">Outstanding Balance Payable</span>
            <span className={`text-2xl font-black ${supplier.outstanding_balance > 0 ? 'text-amber-800' : 'text-gray-900'}`}>
              {formatCurrency(supplier.outstanding_balance || 0)}
            </span>
          </div>
        </div>
      </div>

      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-gray-800">Sugarcane Purchase History</h3>
        {purchases.length === 0 ? (
          <p className="text-xs text-gray-400 py-3">No purchases recorded from this supplier yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-cream-100 text-gray-700 border-b">
                <tr>
                  <th className="py-2 px-3 text-left">Ref #</th>
                  <th className="py-2 px-3 text-left">Date</th>
                  <th className="py-2 px-3 text-right">Quantity</th>
                  <th className="py-2 px-3 text-right">Rate / Tonne</th>
                  <th className="py-2 px-3 text-right">Total Landed Cost</th>
                  <th className="py-2 px-3 text-center">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {purchases.map((p: any) => (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/purchases/${p.id}`)}
                    className="hover:bg-cream-50 cursor-pointer"
                  >
                    <td className="py-2.5 px-3 font-mono font-bold text-primary-900">{p.reference_number || p.id.slice(0, 8)}</td>
                    <td className="py-2.5 px-3">{formatDate(p.purchase_date)}</td>
                    <td className="py-2.5 px-3 text-right">{formatTonne(p.quantity_tonnes)}</td>
                    <td className="py-2.5 px-3 text-right">{formatCurrency(p.rate_per_tonne)}</td>
                    <td className="py-2.5 px-3 text-right font-bold">{formatCurrency(p.total_landed_cost)}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={paymentBadgeClass(p.payment_status)}>{p.payment_status.toUpperCase()}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

