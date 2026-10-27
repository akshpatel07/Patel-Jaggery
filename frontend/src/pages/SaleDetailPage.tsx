import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CreditCard, XCircle, Printer, FileText, CheckCircle2 } from 'lucide-react'
import { useSale, useCancelSale } from '../hooks/useSales'
import PaymentModal from '../components/PaymentModal'
import ConfirmModal from '../components/ConfirmModal'
import { formatCurrency, formatKg, formatDate, paymentBadgeClass, statusBadgeClass } from '../lib/utils'

export default function SaleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data, isLoading } = useSale(id!)
  const cancelMutation = useCancelSale()

  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)

  const sale = data?.sale
  const payments = data?.payments || []

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading invoice details...</div>
  }

  if (!sale) {
    return (
      <div className="card text-center p-8 space-y-4">
        <p className="text-gray-500">Invoice not found</p>
        <button onClick={() => navigate('/sales')} className="btn-secondary text-sm">
          Return to Sales
        </button>
      </div>
    )
  }

  const balanceDue = Math.max(0, sale.invoice_total - (sale.amount_paid || 0))
  const grossProfit = sale.cost_of_goods_sold !== null ? sale.invoice_total - sale.cost_of_goods_sold : null

  const handlePrint = () => {
    window.print()
  }

  const confirmCancel = async () => {
    await cancelMutation.mutateAsync(sale.id)
    setCancelModalOpen(false)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Bar (hidden during print) */}
      <div className="flex items-center justify-between print:hidden">
        <button
          onClick={() => navigate('/sales')}
          className="flex items-center text-sm font-medium text-gray-500 hover:text-primary-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Sales
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
          >
            <Printer className="w-4 h-4" /> Print Invoice
          </button>
          {sale.status === 'confirmed' && balanceDue > 0 && (
            <button
              onClick={() => setPaymentModalOpen(true)}
              className="btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3 bg-amber-600 hover:bg-amber-700"
            >
              <CreditCard className="w-4 h-4" /> Record Payment
            </button>
          )}
          {sale.status === 'confirmed' && (
            <button
              onClick={() => setCancelModalOpen(true)}
              className="btn-danger text-xs flex items-center gap-1.5 py-1.5 px-3"
            >
              <XCircle className="w-4 h-4" /> Cancel Sale
            </button>
          )}
        </div>
      </div>

      {/* INVOICE CARD (Printable) */}
      <div className="card space-y-6 p-8 print:border-none print:shadow-none">
        {/* Invoice Header */}
        <div className="flex justify-between items-start border-b pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-primary-900 tracking-tight">SweetHarvest</span>
              <span className="text-xs px-2 py-0.5 rounded bg-cream-200 text-primary-900 font-semibold">
                JAGGERY INVOICE
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Direct Manufacturer of Pure Cane Jaggery</p>
            <p className="text-xs text-gray-500">Maharashtra, India</p>
          </div>

          <div className="text-right space-y-1">
            <h3 className="text-xl font-bold font-mono text-gray-900">{sale.invoice_number}</h3>
            <p className="text-xs text-gray-500">Date: {formatDate(sale.sale_date)}</p>
            <div className="flex justify-end gap-1.5 pt-1">
              <span className={statusBadgeClass(sale.status)}>{sale.status.toUpperCase()}</span>
              <span className={paymentBadgeClass(sale.payment_status)}>{sale.payment_status.toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* Billed To */}
        <div className="grid grid-cols-2 gap-6 text-xs">
          <div>
            <h5 className="font-bold text-gray-500 uppercase tracking-wider mb-1">Billed To:</h5>
            <p className="text-sm font-bold text-gray-900">{sale.customer_name || 'Cash Customer'}</p>
            {sale.customer_business && <p className="text-gray-600">{sale.customer_business}</p>}
            {sale.customer_phone && <p className="text-gray-600">Phone: {sale.customer_phone}</p>}
            {sale.customer_address && <p className="text-gray-600">{sale.customer_address}</p>}
            {sale.customer_gstin && <p className="text-gray-600 font-mono">GSTIN: {sale.customer_gstin}</p>}
          </div>

          <div className="text-right space-y-1">
            <h5 className="font-bold text-gray-500 uppercase tracking-wider mb-1">Payment Status:</h5>
            <p className="text-xs text-gray-600">Total Billed: <strong className="text-gray-900">{formatCurrency(sale.invoice_total)}</strong></p>
            <p className="text-xs text-gray-600">Amount Paid: <strong className="text-green-700">{formatCurrency(sale.amount_paid || 0)}</strong></p>
            <p className="text-sm font-bold text-red-600">Balance Due: {formatCurrency(balanceDue)}</p>
          </div>
        </div>

        {/* Invoice Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-cream-100 text-gray-700 border-y">
              <tr>
                <th className="py-2.5 px-3 text-left">Description</th>
                <th className="py-2.5 px-3 text-right">Quantity</th>
                <th className="py-2.5 px-3 text-right">Rate / kg</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="py-3 px-3">
                  <span className="font-bold text-gray-900 block text-sm">{sale.item_name}</span>
                  <span className="text-gray-500 text-[11px]">Pure Organic Sugarcane Jaggery</span>
                </td>
                <td className="py-3 px-3 text-right font-semibold">{formatKg(sale.quantity_kg)}</td>
                <td className="py-3 px-3 text-right">{formatCurrency(sale.price_per_kg)}</td>
                <td className="py-3 px-3 text-right font-bold">{formatCurrency(sale.subtotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Totals Section */}
        <div className="flex justify-end pt-2">
          <div className="w-64 space-y-1.5 text-xs">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal:</span>
              <span>{formatCurrency(sale.subtotal)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between text-green-700">
                <span>Discount:</span>
                <span>-{formatCurrency(sale.discount)}</span>
              </div>
            )}
            {sale.tax_amount > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Tax:</span>
                <span>+{formatCurrency(sale.tax_amount)}</span>
              </div>
            )}
            {sale.delivery_charges > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Delivery Charges:</span>
                <span>+{formatCurrency(sale.delivery_charges)}</span>
              </div>
            )}
            <div className="border-t pt-2 flex justify-between font-extrabold text-sm text-primary-950">
              <span>Total Invoice Amount:</span>
              <span>{formatCurrency(sale.invoice_total)}</span>
            </div>
            <div className="flex justify-between font-bold text-green-700 pt-1">
              <span>Amount Paid:</span>
              <span>{formatCurrency(sale.amount_paid || 0)}</span>
            </div>
            <div className="flex justify-between font-bold text-red-600">
              <span>Balance Outstanding:</span>
              <span>{formatCurrency(balanceDue)}</span>
            </div>
          </div>
        </div>

        {/* Business Profitability Breakdown (Confidential - Hidden on print) */}
        {grossProfit !== null && (
          <div className="bg-cream-50 p-4 rounded-xl border border-gold-300 text-xs space-y-2 print:hidden">
            <h5 className="font-bold text-primary-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span>Owner Profitability Metrics (Internal Only)</span>
            </h5>
            <div className="grid grid-cols-3 gap-4 pt-1">
              <div>
                <span className="text-gray-500 block">Cost of Goods Sold (COGS):</span>
                <span className="font-bold text-gray-900">{formatCurrency(sale.cost_of_goods_sold)}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Gross Profit Realized:</span>
                <span className="font-bold text-green-700">{formatCurrency(grossProfit)}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Gross Profit Margin:</span>
                <span className="font-bold text-primary-800">
                  {sale.invoice_total > 0 ? `${((grossProfit / sale.invoice_total) * 100).toFixed(1)}%` : '0%'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Payment History */}
        <div className="space-y-3 pt-4 border-t">
          <h5 className="font-bold text-gray-700 text-xs">Payment Receipts</h5>
          {payments.length === 0 ? (
            <p className="text-xs text-gray-400">No payment transactions recorded for this invoice yet.</p>
          ) : (
            <div className="divide-y divide-gray-100 text-xs">
              {payments.map((p: any) => (
                <div key={p.id} className="py-2 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-gray-900">{formatCurrency(p.amount)}</span>
                    <span className="text-gray-500 ml-2">via {p.payment_method || 'Cash'}</span>
                    {p.notes && <p className="text-gray-400 text-[11px] mt-0.5">{p.notes}</p>}
                  </div>
                  <span className="text-gray-500">{formatDate(p.payment_date)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <PaymentModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        id={sale.id}
        type="sale"
        title={`Record Customer Payment for ${sale.invoice_number}`}
        maxAmount={balanceDue}
      />

      <ConfirmModal
        open={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={confirmCancel}
        title="Cancel Sale & Restore Stock"
        message="Are you sure you want to cancel this invoice? This will reverse the recorded revenue and return the sold quantity back to finished goods stock."
        confirmText="Yes, Cancel Invoice"
        confirmVariant="danger"
        loading={cancelMutation.isPending}
      />
    </div>
  )
}

