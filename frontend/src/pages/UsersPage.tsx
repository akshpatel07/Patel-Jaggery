import React, { useState } from 'react'
import { Plus, UserCheck, Shield, History } from 'lucide-react'
import { useUsers, useAuditLog, useCreateUser, useUpdateUser } from '../hooks/useUsers'
import DataTable, { Column } from '../components/DataTable'
import { formatDate } from '../lib/utils'
import toast from 'react-hot-toast'

export default function UsersPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'audit'>('users')
  const { data: userData, refetch: refetchUsers } = useUsers()
  const { data: auditData } = useAuditLog()
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()

  // New User Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'owner' | 'accountant' | 'production_manager' | 'staff'>('staff')
  const [submitting, setSubmitting] = useState(false)

  const users = (userData as any)?.users || (Array.isArray(userData) ? userData : [])
  const logs = (auditData as any)?.logs || (Array.isArray(auditData) ? auditData : [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !password) {
      toast.error('All fields are required')
      return
    }

    try {
      setSubmitting(true)
      await createUser.mutateAsync({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
      })
      setModalOpen(false)
      setName('')
      setEmail('')
      setPassword('')
      refetchUsers()
    } catch (err) {
      // handled
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (u: any) => {
    try {
      await updateUser.mutateAsync({
        id: u.id,
        is_active: u.is_active ? 0 : 1,
      })
      refetchUsers()
    } catch (err) {
      // handled
    }
  }

  const userColumns: Column<any>[] = [
    {
      key: 'name',
      header: 'User Name',
      sortable: true,
      render: (r) => <span className="font-bold text-gray-900">{r.name}</span>,
    },
    {
      key: 'email',
      header: 'Email / Username',
      render: (r) => <span className="text-gray-600 font-mono text-xs">{r.email}</span>,
    },
    {
      key: 'role',
      header: 'Role & Permissions',
      render: (r) => {
        const roleLabels: Record<string, string> = {
          owner: 'Owner / Administrator',
          accountant: 'Accountant (Purchases & Sales)',
          production_manager: 'Production Manager',
          staff: 'Operational Staff',
        }
        return (
          <span className="font-semibold text-xs px-2 py-0.5 bg-cream-200 text-primary-900 rounded font-mono">
            {roleLabels[r.role] || r.role}
          </span>
        )
      },
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (r) => (
        <span className={r.is_active ? 'badge-green' : 'badge-gray'}>
          {r.is_active ? 'ACTIVE' : 'DEACTIVATED'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <button
          onClick={() => handleToggleActive(r)}
          className="text-xs text-primary-700 hover:underline font-medium"
        >
          {r.is_active ? 'Deactivate' : 'Activate'}
        </button>
      ),
    },
  ]

  const auditColumns: Column<any>[] = [
    {
      key: 'created_at',
      header: 'Timestamp',
      sortable: true,
      render: (r) => <span className="text-xs text-gray-500">{formatDate(r.created_at)}</span>,
    },
    {
      key: 'user_name',
      header: 'Actor',
      render: (r) => <span className="font-semibold text-primary-900">{r.user_name || 'System'}</span>,
    },
    {
      key: 'action',
      header: 'Action',
      render: (r) => (
        <span className="text-xs font-mono font-bold px-2 py-0.5 bg-gray-100 rounded text-gray-800">
          {r.action.toUpperCase()}
        </span>
      ),
    },
    {
      key: 'entity_type',
      header: 'Entity',
      render: (r) => <span className="text-xs font-mono uppercase text-gray-600">{r.entity_type}</span>,
    },
    {
      key: 'details',
      header: 'Details Snapshot',
      render: (r) => <span className="text-[11px] font-mono text-gray-500 truncate max-w-sm block">{r.details || '-'}</span>,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-primary-900">User Management & Audit Trails</h2>
          <p className="text-xs text-gray-500">
            Role-based access control (Owner, Accountant, Production Manager, Staff) and non-repudiation audit logs
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="btn-primary text-xs flex items-center gap-1.5 py-2 px-3 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /> Add User Account
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-4 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-2.5 px-1 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'users'
              ? 'border-primary-600 text-primary-900 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" /> Staff Accounts
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-2.5 px-1 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'audit'
              ? 'border-primary-600 text-primary-900 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <History className="w-3.5 h-3.5" /> Security & Audit Log
        </button>
      </div>

      {activeTab === 'users' && (
        <DataTable
          columns={userColumns}
          data={users}
          searchPlaceholder="Search users..."
          emptyMessage="No user accounts found."
        />
      )}

      {activeTab === 'audit' && (
        <DataTable
          columns={auditColumns}
          data={logs}
          searchPlaceholder="Search audit trails..."
          emptyMessage="No audit logs recorded."
        />
      )}

      {/* Add User Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-gray-900">Add New Team Member</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sunil Jadhav"
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">Email Address *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. sunil@sweetharvest.com"
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">Password *</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">Assigned Role *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="form-select"
                >
                  <option value="owner">Owner / Administrator (Full Access)</option>
                  <option value="accountant">Accountant (Sales, Purchases, Payments, P&L)</option>
                  <option value="production_manager">Production Manager (Batches, Raw Materials)</option>
                  <option value="staff">Staff (Operational View & Entry)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary text-xs"
                >
                  {submitting ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
