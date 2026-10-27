import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Wheat, Factory, ShoppingCart, TrendingUp, AlertTriangle,
  Plus, DollarSign, Package, Clock, Users, ArrowUpRight
} from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { useDashboardSummary, useDashboardCharts, useDashboardAlerts } from '../hooks/useDashboard'
import StatCard from '../components/StatCard'
import { formatCurrency, formatKg, formatTonne, formatDate } from '../lib/utils'

const PIE_COLORS = ['#2d5016', '#4d9e1a', '#8fc85b', '#b8860b', '#d4a017', '#8b5e3c', '#6b4423', '#3b82f6', '#ec4899', '#6366f1']

export default function DashboardPage() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState<string>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const { data: summary, isLoading: summaryLoading } = useDashboardSummary(
    period,
    period === 'custom' ? customFrom : undefined,
    period === 'custom' ? customTo : undefined
  )
  const { data: charts, isLoading: chartsLoading } = useDashboardCharts(period)
  const { data: alerts } = useDashboardAlerts()

  return (
    <div className="space-y-6">
      {/* Top Controls: Period Filters & Quick Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'today', label: 'Today' },
            { id: 'week', label: 'This Week' },
            { id: 'month', label: 'This Month' },
            { id: 'year', label: 'This Financial Year' },
            { id: 'custom', label: 'Custom Range' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setPeriod(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                period === tab.id
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-cream-50 text-gray-700 hover:bg-cream-200'
              }`}
            >
              {tab.label}
            </button>
          ))}

          {period === 'custom' && (
            <div className="flex items-center gap-2 mt-2 sm:mt-0">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="form-input text-xs py-1 px-2"
              />
              <span className="text-gray-400 text-xs">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="form-input text-xs py-1 px-2"
              />
            </div>
          )}
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate('/purchases/new')}
            className="btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3"
          >
            <Plus className="w-4 h-4" /> New Purchase
          </button>
          <button
            onClick={() => navigate('/production/new')}
            className="btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3 bg-gold-600 hover:bg-gold-700"
          >
            <Factory className="w-4 h-4" /> New Batch
          </button>
          <button
            onClick={() => navigate('/sales/new')}
            className="btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3 bg-brown-500 hover:bg-brown-600"
          >
            <ShoppingCart className="w-4 h-4" /> Record Sale
          </button>
          <button
            onClick={() => navigate('/expenses')}
            className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
          >
            <Plus className="w-4 h-4" /> Add Expense
          </button>
        </div>
      </div>

      {/* Real-time Business Alerts Bar */}
      {alerts && (
        (alerts.low_raw_material?.length > 0 ||
         alerts.low_finished_stock?.length > 0 ||
         alerts.draft_batches?.length > 0 ||
         alerts.unpaid_invoices?.length > 0) && (
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <span>Operational Attention Needed</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs text-amber-900 pt-1">
              {alerts.low_raw_material?.length > 0 && (
                <div className="bg-white/70 p-2.5 rounded-lg border border-amber-200">
                  <span className="font-bold">{alerts.low_raw_material.length} Low Raw Material Stock:</span>{' '}
                  {alerts.low_raw_material.map((m: any) => `${m.name} (${m.current_stock} ${m.unit})`).join(', ')}
                </div>
              )}
              {alerts.low_finished_stock?.length > 0 && (
                <div className="bg-white/70 p-2.5 rounded-lg border border-amber-200">
                  <span className="font-bold">{alerts.low_finished_stock.length} Low Finished Stock:</span>{' '}
                  {alerts.low_finished_stock.map((f: any) => `${f.name} (${f.current_stock} kg)`).join(', ')}
                </div>
              )}
              {alerts.draft_batches?.length > 0 && (
                <div className="bg-white/70 p-2.5 rounded-lg border border-amber-200">
                  <span className="font-bold">{alerts.draft_batches.length} Unconfirmed Production Batches</span>
                </div>
              )}
              {alerts.unpaid_invoices?.length > 0 && (
                <div className="bg-white/70 p-2.5 rounded-lg border border-amber-200">
                  <span className="font-bold">{alerts.unpaid_invoices.length} Pending Customer Invoices</span>
                </div>
              )}
            </div>
          </div>
        )
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Sugarcane In / Consumed / Stock */}
        <StatCard
          label="Sugarcane Stock"
          value={summary ? formatTonne(summary.current_sugarcane_stock_tonnes) : '0 MT'}
          subValue={`Purchased: ${formatTonne(summary?.total_sugarcane_purchased_tonnes ?? 0)} | Consumed: ${formatTonne(summary?.total_sugarcane_consumed_tonnes ?? 0)}`}
          icon={<Wheat className="w-5 h-5" />}
          accentColor="border-primary-600"
          loading={summaryLoading}
        />

        {/* Finished Goods Produced / Stock */}
        <StatCard
          label="Finished Jaggery Stock"
          value={summary ? formatKg(summary.current_finished_jaggery_stock_kg) : '0 kg'}
          subValue={`Produced: ${formatKg(summary?.total_jaggery_produced_kg ?? 0)} | Sold: ${formatKg(summary?.total_jaggery_sold_kg ?? 0)}`}
          icon={<Package className="w-5 h-5" />}
          accentColor="border-gold-500"
          loading={summaryLoading}
        />

        {/* Manufacturing Cost & Cost per kg */}
        <StatCard
          label="Avg Manufacturing Cost"
          value={summary ? `${formatCurrency(summary.average_manufacturing_cost_per_kg)} / kg` : '₹0.00 / kg'}
          subValue={`Total Mfg Cost: ${formatCurrency(summary?.total_manufacturing_cost ?? 0)}`}
          icon={<Factory className="w-5 h-5" />}
          accentColor="border-brown-500"
          loading={summaryLoading}
        />

        {/* Revenue */}
        <StatCard
          label="Sales Revenue"
          value={summary ? formatCurrency(summary.total_sales_revenue) : '₹0.00'}
          subValue={`COGS: ${formatCurrency(summary?.cost_of_goods_sold ?? 0)}`}
          icon={<DollarSign className="w-5 h-5" />}
          accentColor="border-green-600"
          loading={summaryLoading}
        />

        {/* Gross Profit */}
        <StatCard
          label="Gross Profit"
          value={summary ? formatCurrency(summary.gross_profit) : '₹0.00'}
          subValue={summary?.total_sales_revenue ? `${((summary.gross_profit / summary.total_sales_revenue) * 100).toFixed(1)}% Gross Margin` : undefined}
          icon={<TrendingUp className="w-5 h-5" />}
          accentColor="border-emerald-500"
          loading={summaryLoading}
        />

        {/* Estimated Net Profit */}
        <StatCard
          label="Estimated Net Profit"
          value={summary ? formatCurrency(summary.estimated_net_profit) : '₹0.00'}
          subValue={`Other Expenses: ${formatCurrency(summary?.other_business_expenses ?? 0)}`}
          icon={<ArrowUpRight className="w-5 h-5" />}
          accentColor={summary && summary.estimated_net_profit >= 0 ? 'border-teal-500' : 'border-red-500'}
          loading={summaryLoading}
        />

        {/* Outstanding Receivables */}
        <StatCard
          label="Customer Receivables"
          value={summary ? formatCurrency(summary.outstanding_customer_payments) : '₹0.00'}
          subValue="Unpaid invoices"
          icon={<Users className="w-5 h-5" />}
          accentColor="border-amber-500"
          loading={summaryLoading}
        />

        {/* Outstanding Payables */}
        <StatCard
          label="Supplier Payables"
          value={summary ? formatCurrency(summary.outstanding_supplier_payments) : '₹0.00'}
          subValue={`Fixed Overhead: ${formatCurrency(summary?.monthly_fixed_expenses ?? 0)}/mo`}
          icon={<Clock className="w-5 h-5" />}
          accentColor="border-rose-500"
          loading={summaryLoading}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Production vs Sales Bar Chart */}
        <div className="card">
          <h3 className="text-base font-semibold text-gray-800 mb-4">Production vs. Sales (kg)</h3>
          <div className="h-72">
            {chartsLoading ? (
              <div className="h-full flex items-center justify-center text-gray-400">Loading charts...</div>
            ) : charts?.prod_vs_sales?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.prod_vs_sales}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" stroke="#888888" fontSize={12} />
                  <YAxis stroke="#888888" fontSize={12} />
                  <Tooltip formatter={(value: any) => [`${value} kg`, '']} />
                  <Legend />
                  <Bar dataKey="produced_kg" name="Produced (kg)" fill="#2d5016" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="sold_kg" name="Sold (kg)" fill="#b8860b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                No production or sales records for this period
              </div>
            )}
          </div>
        </div>

        {/* Manufacturing Cost Per Kg Trend */}
        <div className="card">
          <h3 className="text-base font-semibold text-gray-800 mb-4">Manufacturing Cost per kg Trend (₹)</h3>
          <div className="h-72">
            {chartsLoading ? (
              <div className="h-full flex items-center justify-center text-gray-400">Loading charts...</div>
            ) : charts?.cost_per_kg_trend?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.cost_per_kg_trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="batch_number" stroke="#888888" fontSize={11} />
                  <YAxis stroke="#888888" fontSize={12} unit="₹" />
                  <Tooltip formatter={(value: any) => [`₹${Number(value).toFixed(2)}`, 'Cost/kg']} />
                  <Line
                    type="monotone"
                    dataKey="cost_per_kg"
                    stroke="#8b5e3c"
                    strokeWidth={2}
                    dot={{ fill: '#8b5e3c', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                No confirmed production batches recorded yet
              </div>
            )}
          </div>
        </div>

        {/* Sales Revenue Trend */}
        <div className="card">
          <h3 className="text-base font-semibold text-gray-800 mb-4">Monthly Sales Revenue (₹)</h3>
          <div className="h-72">
            {chartsLoading ? (
              <div className="h-full flex items-center justify-center text-gray-400">Loading charts...</div>
            ) : charts?.sales_revenue?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.sales_revenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" stroke="#888888" fontSize={12} />
                  <YAxis stroke="#888888" fontSize={12} />
                  <Tooltip formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Revenue']} />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#4d9e1a"
                    strokeWidth={3}
                    dot={{ fill: '#4d9e1a', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                No confirmed sales recorded yet
              </div>
            )}
          </div>
        </div>

        {/* Expense Category Breakdown Pie */}
        <div className="card">
          <h3 className="text-base font-semibold text-gray-800 mb-4">Expense Breakdown by Category</h3>
          <div className="h-72">
            {chartsLoading ? (
              <div className="h-full flex items-center justify-center text-gray-400">Loading charts...</div>
            ) : charts?.expense_breakdown?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.expense_breakdown}
                    dataKey="amount"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(entry) => `${entry.category}: ₹${entry.amount}`}
                    labelLine={false}
                  >
                    {charts.expense_breakdown.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Amount']} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                No expenses recorded yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

