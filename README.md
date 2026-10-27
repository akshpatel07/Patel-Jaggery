# 🌾 SweetHarvest — Jaggery Manufacturing & Business Management Application

**SweetHarvest** is a full-featured, production-ready enterprise management system built specifically for sugarcane jaggery manufacturing operations in India.

It tracks the complete end-to-end workflow: purchasing sugarcane, monitoring raw inventory, running production batches with exact yield and cost-per-kg calculations, tracking finished goods, generating sales invoices, recording expenses, and computing net business profitability.

---

## 🌟 Key Modules (All 15 Fully Implemented)

1. **Dashboard**
   - 16 real-time KPI metrics (Sugarcane purchased & consumed, cane stock, jaggery produced & sold, warehouse stock, sales revenue, direct manufacturing costs, average cost/kg, gross profit, net operating profit, receivables, payables).
   - Time filters: Today, This Week, This Month, This Financial Year (April–March), Custom date range.
   - Recharts visual analytics: Monthly production vs sales, cost per kg trend line, revenue over time, expense breakdown.
   - Operational alerts: Low raw material stock, finished stock thresholds, unpaid customer invoices, unpaid supplier bills, draft batches.

2. **Sugarcane Purchase Management**
   - Landed cost calculation: `Base Cost (MT × Rate) + Transport + Loading + Other Expenses`.
   - Automatic raw material inventory addition on purchase confirmation.
   - Purchase payments tracking & supplier balance ledger.
   - Purchase cancellation with automatic inventory reversal.

3. **Raw Material Inventory**
   - Sugarcane, sugar, lime, and custom configurable processing inputs.
   - Multi-unit tracking: metric tonnes, kg, litres, bags.
   - Movement history (purchases, production consumption, adjustments, wastage).
   - Weighted average inventory valuation.

4. **Production Management (Manufacturing Engine)**
   - Batch numbers, shift descriptions, sugarcane input (tonnes).
   - Additional ingredient consumption (sugar, lime, packaging).
   - Finished jaggery output in kilograms (mandatory for batch confirmation).
   - Mass-based yield % calculation: `(Jaggery output kg ÷ (Sugarcane tonnes × 1,000)) × 100`.
   - Labour cost calculation based on output: `(Finished kg ÷ 100) × Labour Rate per 100 kg`.
   - Electricity calculation:
     - **Method A**: Fixed amount per run.
     - **Method B**: Daily rate × Production days.
     - **Method C**: Utility bill allocation.
   - Direct manufacturing cost per kg live preview.
   - Proportional allocation of the monthly ₹30,000 fixed business expense.
   - Fully allocated cost per kg calculation.
   - Batch cancellation with inventory rollback.

5. **Finished Goods Inventory**
   - Multiple jaggery product types: Jaggery Blocks, Jaggery Powder, Liquid Jaggery (Kakvi).
   - Real-time stock availability in kilograms.
   - Movement history (production in, sales out, damage/samples deduction).
   - Total inventory asset valuation based on actual manufacturing cost.

6. **Sales & Commercial Invoices**
   - Sequential invoice generation: `SH-YYYY-NNN`.
   - Finished goods stock validation before sale confirmation (prevents negative stock).
   - Upfront payments, partial payments, credit sales.
   - Cost of Goods Sold (COGS) automatically calculated using batch-weighted manufacturing cost.
   - Real-time gross profit calculation on every invoice.
   - Printable invoice layout with business details and terms.

7. **Customers**
   - Customer master, business name, phone, address, GSTIN, credit terms.
   - Complete sales history and payment statement ledger.
   - Outstanding receivables tracking.

8. **Suppliers & Farmers**
   - Sugarcane grower directory with contact details.
   - Landed purchase history and payment records.
   - Outstanding payables balance.

9. **Labour Management**
   - Default wage rate per 100 kg produced (default: ₹200 / 100 kg).
   - Rate revision history with effective dates (past batches retain historical rates).
   - Monthly labour payout analytics and cost per kg trends.

10. **Electricity & Utilities**
    - Utility bill entry (bill number, billing period, amount).
    - Prevents double-counting between production allocations and general expenses.
    - Monthly electricity expenditure reports.

11. **Operating Expenses**
    - Expense classification: Direct, Overhead, Selling & Distribution, Admin, Other.
    - Expense categories: Transportation, Fuel, Repairs, Packaging, Salaries, Rent, Electricity, Admin, Bank Charges, Taxes, Misc.
    - Date filtering and expense analytics.

12. **Cost & Profitability Reports**
    - Full Statement of Profit & Loss (Net Sales - COGS = Gross Profit - Operating Expenses = Net Profit).
    - Batch-by-batch manufacturing cost audit report.
    - Sales by customer & sales by product profitability.
    - Raw material and finished goods asset valuation statement.
    - 1-click CSV/Excel export for all reports.

13. **Invoices**
    - Commercial invoice registry with print and payment tracking.

14. **Settings**
    - Business name, address, currency (₹), financial year start, invoice prefix.
    - Monthly fixed business overhead configuration (₹30,000).
    - Default labour and electricity calculation preferences.

15. **User Management & Audit Trails**
    - Role-based permissions: Owner, Accountant, Production Manager, Staff.
    - System audit log recording all financial and stock changes.

---

## 🛠️ Technology Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide React, Recharts, TanStack React Query.
- **Backend**: Node.js, Express, TypeScript, native `node:sqlite` (DatabaseSync).
- **Database**: SQLite (single-file `sweetharvest.db`, zero-config, portable).
- **Design Theme**: Earthy Jaggery Theme — Forest Green (`#2d5016`), Warm Cream (`#fdf8f0`), White cards, Golden/Brown accents.

---

## 🚀 How to Run Locally

```bash
# 1. Install dependencies
cd backend && npm install
cd ../frontend && npm install

# 2. Start application
cd ..
.\start-local.bat
# or:
cd backend && npm run dev
```

Visit: `http://localhost:3001` (or frontend dev server on `http://localhost:5173`)

### Initial Login
Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the environment before the first production start. The password must be at least 12 characters. No default credentials are created or published.

---

## ☁️ Deploying to Microsoft Azure (Personal Use, No Domain Required)

See [`AZURE_DEPLOYMENT_GUIDE.md`](./AZURE_DEPLOYMENT_GUIDE.md) for full instructions, including required `JWT_SECRET`, `ADMIN_PASSWORD`, and persistent `DB_PATH` settings, or run the automated script:

```powershell
.\deploy-to-azure.ps1
```

This will automatically create your Azure App Service instance and host SweetHarvest at:
`https://<your-app-name>.azurewebsites.net`
