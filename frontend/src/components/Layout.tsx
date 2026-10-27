import React, { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Wheat, Package, Factory, Store, ShoppingCart,
  Users, Truck, HardHat, Zap, Receipt, BarChart3, FileText,
  Settings, UserCog, LogOut, Menu, X, Bell, ChevronRight, Leaf
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/utils'

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/purchases', icon: Wheat, label: 'Sugarcane Purchases' },
  { to: '/raw-materials', icon: Package, label: 'Raw Materials' },
  { to: '/production', icon: Factory, label: 'Production' },
  { to: '/finished-goods', icon: Store, label: 'Finished Goods' },
  { to: '/sales', icon: ShoppingCart, label: 'Sales & Orders' },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/suppliers', icon: Truck, label: 'Suppliers' },
  { to: '/labour', icon: HardHat, label: 'Labour Management' },
  { to: '/electricity', icon: Zap, label: 'Electricity & Utilities' },
  { to: '/expenses', icon: Receipt, label: 'Expenses' },
  { to: '/reports', icon: BarChart3, label: 'Cost & Profit Reports' },
  { to: '/invoices', icon: FileText, label: 'Invoices' },
  { to: '/settings', icon: Settings, label: 'Settings' },
  { to: '/users', icon: UserCog, label: 'User Management' },
]

const PAGE_NAMES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/purchases': 'Sugarcane Purchases',
  '/purchases/new': 'New Purchase',
  '/raw-materials': 'Raw Material Inventory',
  '/production': 'Production Management',
  '/production/new': 'New Batch',
  '/finished-goods': 'Finished Goods',
  '/sales': 'Sales & Orders',
  '/sales/new': 'New Sale',
  '/customers': 'Customers',
  '/customers/new': 'New Customer',
  '/suppliers': 'Suppliers',
  '/suppliers/new': 'New Supplier',
  '/labour': 'Labour Management',
  '/electricity': 'Electricity & Utilities',
  '/expenses': 'Expenses',
  '/reports': 'Reports',
  '/invoices': 'Invoices',
  '/settings': 'Settings',
  '/users': 'User Management',
}

function getPageName(pathname: string): string {
  if (PAGE_NAMES[pathname]) return PAGE_NAMES[pathname]
  if (pathname.match(/\/purchases\/\d+/)) return 'Purchase Details'
  if (pathname.match(/\/production\/\d+/)) return 'Batch Details'
  if (pathname.match(/\/sales\/\d+/)) return 'Sale Details'
  if (pathname.match(/\/customers\/\d+/)) return 'Customer Details'
  if (pathname.match(/\/suppliers\/\d+/)) return 'Supplier Details'
  return 'SweetHarvest'
}

export default function Layout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const pageName = getPageName(location.pathname)
  const roleColors: Record<string, string> = {
    owner: 'bg-gold-400 text-white',
    manager: 'bg-blue-500 text-white',
    operator: 'bg-green-500 text-white',
    accountant: 'bg-purple-500 text-white'
  }

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={cn('flex flex-col h-full bg-primary-600', mobile ? 'w-64' : 'w-64')}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-primary-500">
        <div className="w-9 h-9 bg-gold-400 rounded-lg flex items-center justify-center flex-shrink-0">
          <Leaf className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-white font-bold text-base leading-tight truncate">SweetHarvest</p>
          <p className="text-primary-200 text-xs truncate">Jaggery Business</p>
        </div>
        {mobile && (
          <button className="ml-auto text-primary-200 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => mobile && setSidebarOpen(false)}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group',
              isActive
                ? 'bg-primary-700 text-white'
                : 'text-primary-100 hover:bg-primary-700 hover:text-white'
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User info */}
      <div className="border-t border-primary-500 p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-bold">{user?.name?.[0]?.toUpperCase() ?? 'U'}</span>
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.name}</p>
            <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', roleColors[user?.role ?? 'operator'])}>{user?.role}</span>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 text-primary-200 hover:text-white text-sm w-full py-1.5 px-2 rounded hover:bg-primary-700 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-cream-100">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col w-64 flex-shrink-0 shadow-lg">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-64 flex flex-col shadow-xl">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-100 shadow-sm px-4 md:px-6 py-3 flex items-center gap-4 flex-shrink-0">
          <button
            className="md:hidden p-1.5 rounded-lg hover:bg-gray-100"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>

          <div className="flex items-center gap-2 text-sm text-gray-500 min-w-0">
            <span className="hidden sm:block text-gray-400">SweetHarvest</span>
            <ChevronRight className="hidden sm:block w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="font-semibold text-primary-800 truncate">{pageName}</span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors" onClick={() => navigate('/dashboard')}>
              <Bell className="w-5 h-5 text-gray-500" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-gray-700">{user?.name}</p>
              <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
