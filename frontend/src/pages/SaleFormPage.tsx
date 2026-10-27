import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Calculator, Save, CheckCircle2, AlertTriangle, Plus } from 'lucide-react'
import { useCustomers } from '../hooks/useCustomers'
import { useFinishedGoods } from '../hooks/useFinishedGoods'
import { formatCurrency, formatKg } from '../lib/utils'
import toast from 'react-hot-toast'
import api from '../lib/api'

export default function SaleFormPage() {
  const navigate = useNavigate()
  const { data: custData } = useCustomers()
  const { data: goodsData } = useFinishedGoods()

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [customerId, setCustomerId] = useState('')
  const [itemId, setItemId] = useState('')
  const [quantity, setQuantity] = useState<number | ''>('')
  const [pricePerKg, setPricePerKg] = useState<number | ''>('')
  const [discount, setDiscount] = useState<number | ''>(0)
  const [taxAmount, setTaxAmount] = useState<number | ''>(0)
  const [deliveryCharges, setDeliveryCharges] = useState<number | ''>(0)
  const [amountPaid, setAmountPaid] = useState<number | ''>(0)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const customers = custData?.customers || []
  const products = goodsData?.items || []

  const selectedProduct = products.find((p: any) => p.id === itemId)
  const availableStock = selectedProduct?.current_stock || 0

  // Live calculations
  const qty = Number(quantity) || 0
  const rate = Number(pricePerKg) || 0
  const subtotal = qty * rate
  const disc = Number(discount) || 0
  const tax = Number(taxAmount) || 0
  const delivery = Number(deliveryCharges) || 0
  const invoiceTotal = subtotal - disc + tax + delivery
  const paid = Number(amountPaid) || 0
  const balance = Math.max(0, invoiceTotal - paid)

  const isStockInsufficient = qty > availableStock

  const handleSubmit = async (shouldConfirm: boolean) => {
    if (!date) {
      toast.error('Please select sale date')
      return
    }
    if (!itemId) {
      toast.error('Please select a finished product')
      return
    }
    if (qty <= 0) {
      toast.error('Quantity must be greater than 0 kg')
      return
    }
    if (rate <= 0) {
      toast.error('Price per kg must be greater than 0')
      return
    }
    if (shouldConfirm && isStockInsufficient) {
      toast.error(`Insufficient stock! Available: ${availableStock} kg, Required: ${qty} kg`)
      return
    }

    try {
      setIsSubmitting(true)
      const res = await api.post('/sales', {
        sale_date: date,
        customer_id: customerId || null,
        item_id: itemId,
        quantity_kg: qty,
        price_per_kg: rate,
        discount: disc,
        tax_amount: tax,
        delivery_charges: delivery,
        notes: notes.trim() || null,
      })

      const saleId = res.data?.sale?.id
      if (!saleId) throw new Error('Failed to create sale')

      // If initial payment entered
      if (paid > 0) {
        await api.post(`/sales/${saleId}/payment`, {
          payment_date: date,
          amount: paid,
          payment_method: paymentMethod,
          notes: 'Initial payment with invoice',
        })
      }

      // If confirm requested
      if (shouldConfirm) {
        await api.post(`/sales/${saleId}/confirm`)
        toast.success(`Sale confirmed! ${formatKg(qty)} deducted from finished stock.`)
      } else {
        toast.success('Sale saved as Draft')
      }

      navigate(`/sales/${saleId}`)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to process sale')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/sales')}
          className="flex items-center text-sm font-medium text-gray-500 hover:text-primary-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Sales
        </button>
        <h2 className="text-xl font-bold text-primary-900">Record Jaggery Sale / Invoice</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Form: 2 Cols */}
        <div className="md:col-span-2 space-y-6">
          <div className="card space-y-4">
            <h3 className="text-sm font-semibold text-gray-800 border-b pb-2">Customer & Date</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Sale Date *</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="form-input"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="form-label mb-0">Customer</label>
                  <button
                    type="button"
                    onClick={() => navigate('/customers/new')}
                    className="text-xs text-primary-600 hover:underline flex items-center"
                  >
                    <Plus className="w-3 h-3 mr-0.5" /> Add Customer
                  </button>
                </div>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="form-select"
                >
                  <option value="">Walk-in Cash Customer</option>
                  {customers.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.business_name ? `(${c.business_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="card space-y-4">
            <h3 className="text-sm font-semibold text-gray-800 border-b pb-2">Product & Pricing</h3>

            <div>
              <label className="form-label">Finished Jaggery Product *</label>
              <select
                required
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
                className="form-select font-medium"
              >
                <option value="">Select Jaggery Product</option>
                {products.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — Current Available: {p.current_stock || 0} kg (Cost: {formatCurrency(p.avg_cost_per_kg || 0)}/kg)
                  </option>
                ))}
              </select>
              {selectedProduct && (
                <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                  <span>Available stock in warehouse:</span>
                  <strong className={availableStock < 50 ? 'text-amber-600' : 'text-primary-800'}>
                    {formatKg(availableStock)}
                  </strong>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Quantity Sold (kg) *</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 600"
                  className="form-input text-base font-bold"
                />
              </div>

              <div>
                <label className="form-label">Selling Price per kg (₹) *</label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  required
                  value={pricePerKg}
                  onChange={(e) => setPricePerKg(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 60.00"
                  className="form-input text-base font-bold"
                />
              </div>
            </div>

            {isStockInsufficient && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>
                  Entered quantity ({qty} kg) exceeds available stock ({availableStock} kg). Production confirmation is required before this sale can be confirmed.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div>
                <label className="form-label text-xs">Discount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="form-input text-xs"
                />
              </div>

              <div>
                <label className="form-label text-xs">Tax (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={taxAmount}
                  onChange={(e) => setTaxAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="form-input text-xs"
                />
              </div>

              <div>
                <label className="form-label text-xs">Delivery Charges (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={deliveryCharges}
                  onChange={(e) => setDeliveryCharges(e.target.value === '' ? '' : Number(e.target.value))}
                  className="form-input text-xs"
                />
              </div>
            </div>

            <div>
              <label className="form-label text-xs">Invoice Notes & Delivery Details</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Vehicle number, dispatch address, terms..."
                className="form-input text-xs"
              />
            </div>
          </div>

          <div className="card space-y-4">
            <h3 className="text-sm font-semibold text-gray-800 border-b pb-2">Upfront Payment (Optional)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Amount Paid Now (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value === '' ? '' : Number(e.target.value))}
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="form-select"
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                  <option value="upi">UPI (GPay/PhonePe/Paytm)</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Summary & Actions */}
        <div className="space-y-6">
          <div className="card bg-cream-50 border border-gold-400/50 sticky top-4 space-y-4">
            <div className="flex items-center gap-2 text-primary-900 font-bold border-b border-gold-300 pb-2">
              <Calculator className="w-5 h-5 text-gold-600" />
              <span>Invoice Preview</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Quantity:</span>
                <span className="font-semibold text-gray-900">{formatKg(qty)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Price / kg:</span>
                <span className="font-semibold text-gray-900">{formatCurrency(rate)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Subtotal:</span>
                <span className="font-semibold text-gray-900">{formatCurrency(subtotal)}</span>
              </div>
              {disc > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Discount:</span>
                  <span>-{formatCurrency(disc)}</span>
                </div>
              )}
              {tax > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Taxes:</span>
                  <span>+{formatCurrency(tax)}</span>
                </div>
              )}
              {delivery > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Delivery Charges:</span>
                  <span>+{formatCurrency(delivery)}</span>
                </div>
              )}

              <div className="border-t border-gold-300 pt-3 flex justify-between items-baseline">
                <span className="font-bold text-sm text-gray-900">Invoice Total:</span>
                <span className="font-extrabold text-base text-primary-900">{formatCurrency(invoiceTotal)}</span>
              </div>

              {paid > 0 && (
                <div className="flex justify-between text-green-700 pt-1">
                  <span>Amount Paid:</span>
                  <span className="font-semibold">{formatCurrency(paid)}</span>
                </div>
              )}

              <div className="flex justify-between text-red-600 font-bold pt-1">
                <span>Balance Due:</span>
                <span>{formatCurrency(balance)}</span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                disabled={isSubmitting || qty <= 0 || rate <= 0 || isStockInsufficient}
                onClick={() => handleSubmit(true)}
                className="w-full btn-primary flex justify-center items-center gap-2 py-2.5 font-bold text-sm shadow-md disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" /> Confirm & Issue Invoice
              </button>

              <button
                type="button"
                disabled={isSubmitting || qty <= 0 || rate <= 0}
                onClick={() => handleSubmit(false)}
                className="w-full btn-secondary flex justify-center items-center gap-2 py-2 text-xs font-semibold"
              >
                <Save className="w-3.5 h-3.5" /> Save as Draft
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

