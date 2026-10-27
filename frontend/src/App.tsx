import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'

// Pages
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import PurchasesPage from './pages/PurchasesPage'
import PurchaseFormPage from './pages/PurchaseFormPage'
import PurchaseDetailPage from './pages/PurchaseDetailPage'
import RawMaterialsPage from './pages/RawMaterialsPage'
import ProductionPage from './pages/ProductionPage'
import ProductionFormPage from './pages/ProductionFormPage'
import ProductionDetailPage from './pages/ProductionDetailPage'
import FinishedGoodsPage from './pages/FinishedGoodsPage'
import SalesPage from './pages/SalesPage'
import SaleFormPage from './pages/SaleFormPage'
import SaleDetailPage from './pages/SaleDetailPage'
import CustomersPage from './pages/CustomersPage'
import CustomerFormPage from './pages/CustomerFormPage'
import CustomerDetailPage from './pages/CustomerDetailPage'
import SuppliersPage from './pages/SuppliersPage'
import SupplierFormPage from './pages/SupplierFormPage'
import SupplierDetailPage from './pages/SupplierDetailPage'
import LabourPage from './pages/LabourPage'
import ElectricityPage from './pages/ElectricityPage'
import ExpensesPage from './pages/ExpensesPage'
import ReportsPage from './pages/ReportsPage'
import InvoicesPage from './pages/InvoicesPage'
import SettingsPage from './pages/SettingsPage'
import UsersPage from './pages/UsersPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center text-primary-800">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!user && !localStorage.getItem('token')) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Protected App Routes inside persistent sidebar Layout */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />

          {/* Sugarcane Purchases */}
          <Route path="purchases" element={<PurchasesPage />} />
          <Route path="purchases/new" element={<PurchaseFormPage />} />
          <Route path="purchases/:id" element={<PurchaseDetailPage />} />

          {/* Raw Materials */}
          <Route path="raw-materials" element={<RawMaterialsPage />} />

          {/* Production */}
          <Route path="production" element={<ProductionPage />} />
          <Route path="production/new" element={<ProductionFormPage />} />
          <Route path="production/:id" element={<ProductionDetailPage />} />

          {/* Finished Goods */}
          <Route path="finished-goods" element={<FinishedGoodsPage />} />

          {/* Sales & Orders */}
          <Route path="sales" element={<SalesPage />} />
          <Route path="sales/new" element={<SaleFormPage />} />
          <Route path="sales/:id" element={<SaleDetailPage />} />

          {/* Customers */}
          <Route path="customers" element={<CustomersPage />} />
          <Route path="customers/new" element={<CustomerFormPage />} />
          <Route path="customers/:id" element={<CustomerDetailPage />} />

          {/* Suppliers */}
          <Route path="suppliers" element={<SuppliersPage />} />
          <Route path="suppliers/new" element={<SupplierFormPage />} />
          <Route path="suppliers/:id" element={<SupplierDetailPage />} />

          {/* Labour & Utilities */}
          <Route path="labour" element={<LabourPage />} />
          <Route path="electricity" element={<ElectricityPage />} />

          {/* Expenses */}
          <Route path="expenses" element={<ExpensesPage />} />

          {/* Reports & Invoices */}
          <Route path="reports" element={<ReportsPage />} />
          <Route path="invoices" element={<InvoicesPage />} />

          {/* Settings & Admin */}
          <Route path="settings" element={<SettingsPage />} />
          <Route path="users" element={<UsersPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  )
}

