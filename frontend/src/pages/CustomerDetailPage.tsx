import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, Mail, MapPin, Plus, FileText } from 'lucide-react'
import { useCustomer } from '../hooks/useCustomers'
import { formatCurrency, formatKg, formatDate, paymentBadgeClass } from '../lib/utils'

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data, isLoading } = useCustomer(id!)

  const customer = data?.customer
  const sales = data?.sales || []
  const payments = data?.payments || []

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading customer profile...</div>
  }

  if (!customer) {
    return (
      <div className="card text-center p-8 space-y-4">
        <p className="text-gray-500">Customer not found</p>
        <button onClick={() => navigate('/customers')} className="btn-secondary text-sm">
          Return to Customers
        </button>
      </div>
    )
  }

  const outstandingBalance =
    customer.outstanding ??
    ((customer.total_purchases || 0) - (customer.amount_paid || 0) + (customer.opening_balance || 0))

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/customers')}
          className="flex items-center text-sm font-medium text-gray-500 hover:text-primary-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Customers
        </button>

        <button
          onClick={() => navigate('/sales/new')}
          className="btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3"
        >
          <Plus className="w-4 h-4" /> Create Sale for Customer
        </button>
      </div>

      {/* Customer Header Card */}
      <div className="card space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-gray-100 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{customer.name}</h2>
            {customer.business_name && (
              <p className="text-sm font-semibold text-primary-800">{customer.business_name}</p>
            )}
            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 mt-2">
              {customer.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-gray-400" /> {customer.phone}
                </span>
              )}
              {customer.email && (
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-gray-400" /> {customer.email}
                </span>
              )}
              {customer.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" /> {customer.address}
                </span>
              )}
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs text-gray-500 block">Current Outstanding Balance</span>
            <span className={`text-2xl font-black ${outstandingBalance > 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {formatCurrency(outstandingBalance)}
            </span>
            {customer.credit_terms_days > 0 && (
              <span className="text-[11px] text-gray-400 block mt-0.5">
                Credit terms: {customer.credit_terms_days} days
              </span>
            )}
          </div>
        </div>

        {/* 3 Metric Pills */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-3 bg-cream-50 rounded-lg border border-cream-200">
            <span className="text-xs text-gray-500 block">Total Purchases</span>
            <span className="text-base font-bold text-gray-900">{formatCurrency(customer.total_purchases || 0)}</span>
          </div>
          <div className="p-3 bg-cream-50 rounded-lg border border-cream-200">
            <span className="text-xs text-gray-500 block">Total Paid</span>
            <span className="text-base font-bold text-green-700">{formatCurrency(customer.amount_paid || 0)}</span>
          </div>
          <div className="p-3 bg-cream-50 rounded-lg border border-cream-200">
            <span className="text-xs text-gray-500 block">Invoices Count</span>
            <span className="text-base font-bold text-primary-900">{sales.length} orders</span>
          </div>
        </div>
      </div>

      {/* Orders / Sales History */}
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-gray-800">Sales & Invoices History</h3>
        {sales.length === 0 ? (
          <p className="text-xs text-gray-400 py-3">No sales recorded for this customer yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-cream-100 text-gray-700 border-b">
                <tr>
                  <th className="py-2 px-3 text-left">Invoice #</th>
                  <th className="py-2 px-3 text-left">Date</th>
                  <th className="py-2 px-3 text-left">Product</th>
                  <th className="py-2 px-3 text-right">Quantity</th>
                  <th className="py-2 px-3 text-right">Total</th>
                  <th className="py-2 px-3 text-right">Paid</th>
                  <th className="py-2 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sales.map((s: any) => (
                  <tr
                    key={s.id}
                    onClick={() => navigate(`/sales/${s.id}`)}
                    className="hover:bg-cream-50 cursor-pointer"
                  >
                    <td className="py-2.5 px-3 font-mono font-bold text-primary-900">{s.invoice_number}</td>
                    <td className="py-2.5 px-3">{formatDate(s.sale_date)}</td>
                    <td className="py-2.5 px-3">{s.item_name}</td>
                    <td className="py-2.5 px-3 text-right">{formatKg(s.quantity_kg)}</td>
                    <td className="py-2.5 px-3 text-right font-bold">{formatCurrency(s.invoice_total)}</td>
                    <td className="py-2.5 px-3 text-right text-green-700 font-semibold">{formatCurrency(s.amount_paid || 0)}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={paymentBadgeClass(s.payment_status)}>{s.payment_status.toUpperCase()}</span>
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

