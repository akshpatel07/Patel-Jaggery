import React, { useState } from 'react'
import { Download } from 'lucide-react'
import {
  useProfitLossReport,
  useProductionCostReport,
  useSalesByCustomerReport,
  useSalesByProductReport,
  useStockValuationReport,
  useLabourReport,
  useElectricityReport,
} from '../hooks/useReports'
import DataTable, { Column } from '../components/DataTable'
import { formatCurrency, formatKg, formatTonne, formatDate } from '../lib/utils'

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<
    'pnl' | 'production' | 'customers' | 'products' | 'stock' | 'labour' | 'electricity'
  >('pnl')

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  // Report Queries
  const { data: pnlData, isLoading: pnlLoading } = useProfitLossReport(from, to)
  const { data: prodData, isLoading: prodLoading } = useProductionCostReport(from, to)
  const { data: custData, isLoading: custLoading } = useSalesByCustomerReport(from, to)
  const { data: prodSaleData, isLoading: prodSaleLoading } = useSalesByProductReport(from, to)
  const { data: stockData } = useStockValuationReport()
  const { data: labourData, isLoading: labourLoading } = useLabourReport(from, to)
  const { data: elecData, isLoading: elecLoading } = useElectricityReport(from, to)

  const handleExport = (type: string) => {
    const token = localStorage.getItem('token')
    window.open(`/api/reports/export?type=${type}&token=${token}`, '_blank')
  }

  const prodColumns: Column<any>[] = [
    {
      key: 'batch_number',
      header: 'Batch #',
      render: (r: any) => <span className="font-mono font-bold text-primary-900">{r.batch_number}</span>,
    },
    {
      key: 'production_date',
      header: 'Date',
      render: (r: any) => <span>{formatDate(r.production_date)}</span>,
    },
    {
      key: 'sugarcane_consumed_tonnes',
      header: 'Cane (MT)',
      render: (r: any) => <span>{formatTonne(r.sugarcane_consumed_tonnes)}</span>,
    },
    {
      key: 'finished_quantity_kg',
      header: 'Output (kg)',
      render: (r: any) => <span className="font-bold">{formatKg(r.finished_quantity_kg)}</span>,
    },
    {
      key: 'yield_percentage',
      header: 'Yield %',
      render: (r: any) => (
        <span className="font-semibold text-amber-800">
          {r.yield_percentage ? `${Number(r.yield_percentage).toFixed(1)}%` : '-'}
        </span>
      ),
    },
    {
      key: 'sugarcane_cost',
      header: 'Sugarcane',
      render: (r: any) => <span>{formatCurrency(r.sugarcane_cost)}</span>,
    },
    {
      key: 'labour_cost',
      header: 'Labour',
      render: (r: any) => <span>{formatCurrency(r.labour_cost || 0)}</span>,
    },
    {
      key: 'electricity_amount',
      header: 'Electricity',
      render: (r: any) => <span>{formatCurrency(r.electricity_amount || 0)}</span>,
    },
    {
      key: 'total_direct_cost',
      header: 'Direct Total',
      render: (r: any) => <span className="font-bold">{formatCurrency(r.total_direct_cost)}</span>,
    },
    {
      key: 'allocated_overhead',
      header: 'Allocated Fixed',
      render: (r: any) => <span>{formatCurrency(r.allocated_overhead || 0)}</span>,
    },
    {
      key: 'cost_per_kg',
      header: 'Cost / kg',
      render: (r: any) => (
        <span className="font-black text-primary-800">{formatCurrency(r.cost_per_kg || 0)}</span>
      ),
    },
  ]

  const customerColumns: Column<any>[] = [
    {
      key: 'name',
      header: 'Customer Name',
      render: (r: any) => (
        <div>
          <span className="font-bold text-gray-900">{r.name}</span>
          {r.business_name && <span className="block text-xs text-gray-500">{r.business_name}</span>}
        </div>
      ),
    },
    {
      key: 'invoice_count',
      header: 'Orders',
      render: (r: any) => <span>{r.invoice_count} invoices</span>,
    },
    {
      key: 'total_qty_kg',
      header: 'Total Sold',
      render: (r: any) => <span className="font-semibold">{formatKg(r.total_qty_kg)}</span>,
    },
    {
      key: 'total_sales',
      header: 'Total Revenue',
      render: (r: any) => <span className="font-bold text-gray-900">{formatCurrency(r.total_sales)}</span>,
    },
    {
      key: 'total_paid',
      header: 'Amount Paid',
      render: (r: any) => <span className="font-semibold text-green-700">{formatCurrency(r.total_paid)}</span>,
    },
    {
      key: 'outstanding',
      header: 'Outstanding',
      render: (r: any) => (
        <span className={`font-bold ${r.outstanding > 0 ? 'text-red-600' : 'text-gray-400'}`}>
          {formatCurrency(r.outstanding)}
        </span>
      ),
    },
    {
      key: 'gross_profit',
      header: 'Gross Profit',
      render: (r: any) => (
        <span className="font-bold text-primary-800">{formatCurrency(r.gross_profit)}</span>
      ),
    },
  ]

  const productColumns: Column<any>[] = [
    {
      key: 'item_name',
      header: 'Product Name',
      render: (r: any) => <span className="font-bold text-gray-900">{r.item_name}</span>,
    },
    {
      key: 'orders_count',
      header: 'Orders Count',
      render: (r: any) => <span>{r.orders_count} sales</span>,
    },
    {
      key: 'total_qty_kg',
      header: 'Total Volume',
      render: (r: any) => <span className="font-bold">{formatKg(r.total_qty_kg)}</span>,
    },
    {
      key: 'avg_price_per_kg',
      header: 'Avg Price / kg',
      render: (r: any) => <span>{formatCurrency(r.avg_price_per_kg)}</span>,
    },
    {
      key: 'total_revenue',
      header: 'Total Revenue',
      render: (r: any) => <span className="font-bold text-gray-900">{formatCurrency(r.total_revenue)}</span>,
    },
    {
      key: 'total_cogs',
      header: 'COGS',
      render: (r: any) => <span>{formatCurrency(r.total_cogs)}</span>,
    },
    {
      key: 'gross_profit',
      header: 'Gross Profit',
      render: (r: any) => (
        <span className="font-black text-primary-800">{formatCurrency(r.gross_profit)}</span>
      ),
    },
  ]

  const rawValColumns: Column<any>[] = [
    { key: 'name', header: 'Material Name', render: (r: any) => <span className="font-semibold">{r.name}</span> },
    { key: 'stock', header: 'Quantity in Stock', render: (r: any) => <span>{r.stock} {r.unit}</span> },
    { key: 'unit_cost', header: 'Weighted Avg Cost', render: (r: any) => <span>{formatCurrency(r.unit_cost)}</span> },
    { key: 'total_value', header: 'Asset Value (₹)', render: (r: any) => <span className="font-bold text-gray-900">{formatCurrency(r.total_value)}</span> },
  ]

  const finValColumns: Column<any>[] = [
    { key: 'name', header: 'Finished Product', render: (r: any) => <span className="font-semibold">{r.name}</span> },
    { key: 'stock', header: 'Available (kg)', render: (r: any) => <span>{formatKg(r.stock)}</span> },
    { key: 'unit_cost', header: 'Mfg Cost / kg', render: (r: any) => <span>{formatCurrency(r.unit_cost)}</span> },
    { key: 'total_value', header: 'Asset Value (₹)', render: (r: any) => <span className="font-bold text-gray-900">{formatCurrency(r.total_value)}</span> },
  ]

  const labourColumns: Column<any>[] = [
    { key: 'month', header: 'Month', render: (r: any) => <span className="font-bold">{r.month}</span> },
    { key: 'batch_count', header: 'Batches Processed', render: (r: any) => <span>{r.batch_count}</span> },
    { key: 'total_kg', header: 'Finished Output', render: (r: any) => <span className="font-bold">{formatKg(r.total_kg)}</span> },
    { key: 'total_labour_cost', header: 'Labour Payout', render: (r: any) => <span className="font-extrabold text-primary-900">{formatCurrency(r.total_labour_cost)}</span> },
    { key: 'labour_cost_per_kg', header: 'Labour Cost / kg', render: (r: any) => <span className="font-semibold text-primary-800">{formatCurrency(r.labour_cost_per_kg)}</span> },
  ]

  const elecColumns: Column<any>[] = [
    { key: 'month', header: 'Month', render: (r: any) => <span className="font-bold">{r.month}</span> },
    { key: 'batch_count', header: 'Batches Powered', render: (r: any) => <span>{r.batch_count}</span> },
    { key: 'total_electricity_cost', header: 'Electricity Cost', render: (r: any) => <span className="font-extrabold text-primary-900">{formatCurrency(r.total_electricity_cost)}</span> },
    { key: 'electricity_cost_per_kg', header: 'Electricity Cost / kg', render: (r: any) => <span className="font-semibold text-primary-800">{formatCurrency(r.electricity_cost_per_kg)}</span> },
  ]

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-primary-900">Cost & Profitability Reports</h2>
          <p className="text-xs text-gray-500">
            Real-time financial P&L, batch-wise manufacturing cost audit, stock asset valuation, and performance analytics
          </p>
        </div>

        {/* Global Date Filter & Export */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="form-input py-1.5 px-2 text-xs w-auto"
          />
          <span className="text-gray-400">to</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="form-input py-1.5 px-2 text-xs w-auto"
          />
          {(from || to) && (
            <button
              onClick={() => {
                setFrom('')
                setTo('')
              }}
              className="text-primary-600 hover:underline px-1"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => handleExport(activeTab === 'production' ? 'production' : 'sales')}
            className="btn-secondary py-1.5 px-3 flex items-center gap-1.5 text-xs ml-2"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-gray-200 gap-4 text-xs font-medium pb-px">
        {[
          { id: 'pnl', label: 'Profit & Loss Statement' },
          { id: 'production', label: 'Batch Cost & Yields' },
          { id: 'customers', label: 'Sales by Customer' },
          { id: 'products', label: 'Sales by Product' },
          { id: 'stock', label: 'Stock Valuation (Asset)' },
          { id: 'labour', label: 'Labour Cost Report' },
          { id: 'electricity', label: 'Electricity Report' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`pb-2.5 px-1 whitespace-nowrap border-b-2 transition-colors ${
              activeTab === t.id
                ? 'border-primary-600 text-primary-900 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 1. PROFIT & LOSS TAB */}
      {activeTab === 'pnl' && (
        <div className="space-y-6">
          {pnlLoading ? (
            <div className="card text-center p-8 text-gray-400">Loading Profit & Loss...</div>
          ) : (
            <div className="card space-y-6">
              <div className="border-b pb-4 flex justify-between items-center">
                <div>
                  <h3 className="text-base font-bold text-gray-900">SweetHarvest Statement of Profit & Loss</h3>
                  <p className="text-xs text-gray-500">
                    Period: {pnlData?.period?.from || 'Start'} to {pnlData?.period?.to || 'Current'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-500 block">Net Operating Profit</span>
                  <span
                    className={`text-2xl font-black ${
                      (pnlData?.net_operating_profit || 0) >= 0 ? 'text-green-700' : 'text-red-600'
                    }`}
                  >
                    {formatCurrency(pnlData?.net_operating_profit || 0)}
                  </span>
                </div>
              </div>

              {/* P&L Statement Structure */}
              <div className="space-y-4 text-xs">
                {/* 1. Revenue */}
                <div>
                  <h4 className="font-bold text-gray-700 text-xs uppercase tracking-wider mb-2">
                    1. Operating Revenue
                  </h4>
                  <div className="space-y-1.5 pl-3 border-l-2 border-primary-500">
                    <div className="flex justify-between py-1 border-b border-gray-50 text-gray-600">
                      <span>Gross Sales ({formatKg(pnlData?.revenue?.total_sold_kg || 0)} sold)</span>
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(pnlData?.revenue?.gross_sales || 0)}
                      </span>
                    </div>
                    {(pnlData?.revenue?.discounts || 0) > 0 && (
                      <div className="flex justify-between py-1 border-b border-gray-50 text-green-700">
                        <span>Less: Discounts allowed</span>
                        <span>-{formatCurrency(pnlData.revenue.discounts)}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-1 font-bold text-primary-950 bg-cream-50 px-2 rounded">
                      <span>Net Operating Revenue:</span>
                      <span>{formatCurrency(pnlData?.revenue?.net_sales || 0)}</span>
                    </div>
                  </div>
                </div>

                {/* 2. COGS & Gross Profit */}
                <div>
                  <h4 className="font-bold text-gray-700 text-xs uppercase tracking-wider mb-2">
                    2. Cost of Goods Sold
                  </h4>
                  <div className="space-y-1.5 pl-3 border-l-2 border-amber-500">
                    <div className="flex justify-between py-1 border-b border-gray-50 text-gray-600">
                      <span>Cost of Manufactured Jaggery Sold (COGS):</span>
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(pnlData?.cost_of_goods_sold || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 font-bold text-base text-primary-900 bg-primary-50 px-2 rounded">
                      <span>Gross Profit:</span>
                      <span>
                        {formatCurrency(pnlData?.gross_profit || 0)}
                        <span className="text-xs font-normal text-gray-500 ml-2">
                          ({Number(pnlData?.gross_margin_percent || 0).toFixed(1)}% margin)
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Operating Expenses */}
                <div>
                  <h4 className="font-bold text-gray-700 text-xs uppercase tracking-wider mb-2">
                    3. Other Operating & Administrative Expenses
                  </h4>
                  <div className="space-y-1.5 pl-3 border-l-2 border-rose-400">
                    {pnlData?.operating_expenses?.items?.length > 0 ? (
                      pnlData.operating_expenses.items.map((item: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex justify-between py-1 border-b border-gray-50 text-gray-600"
                        >
                          <span>
                            {item.category} ({item.classification})
                          </span>
                          <span className="font-medium text-gray-900">{formatCurrency(item.amount)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-400 py-1">No independent operating expenses recorded in this period.</p>
                    )}
                    <div className="flex justify-between py-1 font-semibold text-gray-900 bg-cream-50 px-2 rounded">
                      <span>Total Operating Expenses:</span>
                      <span>{formatCurrency(pnlData?.operating_expenses?.total || 0)}</span>
                    </div>
                  </div>
                </div>

                {/* 4. Net Operating Profit */}
                <div className="pt-2 border-t-2 border-gray-200">
                  <div className="flex justify-between items-center py-3 bg-cream-200/80 px-4 rounded-xl">
                    <div>
                      <span className="text-sm font-black text-primary-950 block">NET OPERATING PROFIT</span>
                      <span className="text-[11px] text-gray-500">Gross Profit minus Operating Expenses</span>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-xl font-black ${
                          (pnlData?.net_operating_profit || 0) >= 0 ? 'text-green-800' : 'text-red-600'
                        }`}
                      >
                        {formatCurrency(pnlData?.net_operating_profit || 0)}
                      </span>
                      <span className="text-xs text-gray-600 block">
                        Net Margin: {Number(pnlData?.net_margin_percent || 0).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. PRODUCTION COST TAB */}
      {activeTab === 'production' && (
        <DataTable
          columns={prodColumns}
          data={prodData?.batches || []}
          loading={prodLoading}
          searchPlaceholder="Search batches..."
          emptyMessage="No confirmed production runs."
        />
      )}

      {/* 3. SALES BY CUSTOMER */}
      {activeTab === 'customers' && (
        <DataTable
          columns={customerColumns}
          data={custData?.customers || []}
          loading={custLoading}
          searchPlaceholder="Search customer..."
          emptyMessage="No customer sales found."
        />
      )}

      {/* 4. SALES BY PRODUCT */}
      {activeTab === 'products' && (
        <DataTable
          columns={productColumns}
          data={prodSaleData?.products || []}
          loading={prodSaleLoading}
          searchPlaceholder="Search products..."
          emptyMessage="No product sales found."
        />
      )}

      {/* 5. STOCK VALUATION */}
      {activeTab === 'stock' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card bg-cream-50 p-4 border-l-4 border-primary-600">
              <span className="text-xs text-gray-500 block">Raw Materials Stock Value</span>
              <span className="text-xl font-bold text-primary-900">
                {formatCurrency(stockData?.total_raw_material_value || 0)}
              </span>
            </div>
            <div className="card bg-cream-50 p-4 border-l-4 border-gold-500">
              <span className="text-xs text-gray-500 block">Finished Jaggery Stock Value</span>
              <span className="text-xl font-bold text-gold-800">
                {formatCurrency(stockData?.total_finished_goods_value || 0)}
              </span>
            </div>
            <div className="card bg-cream-100 p-4 border-l-4 border-green-600">
              <span className="text-xs text-gray-500 block">Combined Total Inventory Assets</span>
              <span className="text-2xl font-black text-green-800">
                {formatCurrency(stockData?.total_combined_stock_value || 0)}
              </span>
            </div>
          </div>

          <div className="card space-y-4">
            <h4 className="font-bold text-gray-800 text-sm">Raw Materials Valuation (Weighted Average)</h4>
            <DataTable
              columns={rawValColumns}
              data={stockData?.raw_materials || []}
              searchable={false}
            />
          </div>

          <div className="card space-y-4">
            <h4 className="font-bold text-gray-800 text-sm">Finished Jaggery Valuation</h4>
            <DataTable
              columns={finValColumns}
              data={stockData?.finished_goods || []}
              searchable={false}
            />
          </div>
        </div>
      )}

      {/* 6. LABOUR REPORT */}
      {activeTab === 'labour' && (
        <DataTable
          columns={labourColumns}
          data={labourData?.monthly_labour || []}
          loading={labourLoading}
          searchPlaceholder="Search labour months..."
          emptyMessage="No labour reports available."
        />
      )}

      {/* 7. ELECTRICITY REPORT */}
      {activeTab === 'electricity' && (
        <DataTable
          columns={elecColumns}
          data={elecData?.monthly_electricity || []}
          loading={elecLoading}
          searchPlaceholder="Search electricity..."
          emptyMessage="No electricity consumption data available."
        />
      )}
    </div>
  )
}

