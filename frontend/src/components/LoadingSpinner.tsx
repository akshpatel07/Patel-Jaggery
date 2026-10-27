import React from 'react'

interface LoadingSpinnerProps {
  message?: string
  size?: 'sm' | 'md' | 'lg'
}

export default function LoadingSpinner({ message = 'Loading...', size = 'md' }: LoadingSpinnerProps) {
  const sizeClass = size === 'sm' ? 'w-6 h-6' : size === 'lg' ? 'w-12 h-12' : 'w-8 h-8'

  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <div className={`${sizeClass} border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin`} />
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  )
}
