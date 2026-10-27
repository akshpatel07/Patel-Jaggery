// Format currency as ₹1,23,456.78 (Indian number format)
export function formatCurrency(amount: number): string {
  if (amount === null || amount === undefined) return '₹0.00'
  return '₹' + new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

// Format weight in kg
export function formatKg(kg: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(kg) + ' kg'
}

// Format weight in metric tonnes
export function formatTonne(t: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(t) + ' MT'
}

// Format number with Indian separators
export function formatNumber(n: number, decimals = 2): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: decimals }).format(n)
}

// Format date as DD Mon YYYY for display
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Format datetime
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Payment status badge class
export function paymentBadgeClass(status: string): string {
  if (status === 'paid') return 'badge-green'
  if (status === 'partial') return 'badge-yellow'
  return 'badge-red'
}

// Status badge
export function statusBadgeClass(status: string): string {
  if (status === 'confirmed') return 'badge-green'
  if (status === 'active') return 'badge-green'
  if (status === 'draft') return 'badge-yellow'
  if (status === 'cancelled') return 'badge-red'
  if (status === 'inactive') return 'badge-red'
  if (status === 'low') return 'badge-yellow'
  if (status === 'critical') return 'badge-red'
  if (status === 'ok') return 'badge-green'
  return 'badge-gray'
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

// Truncate text
export function truncate(text: string, max = 30): string {
  if (!text) return ''
  return text.length > max ? text.substring(0, max) + '...' : text
}
