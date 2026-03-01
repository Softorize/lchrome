import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  className?: string;
}

const variantClasses = {
  default: 'bg-gray-700 text-gray-300',
  success: 'bg-green-900 text-green-300',
  warning: 'bg-yellow-900 text-yellow-300',
  error: 'bg-red-900 text-red-300',
  info: 'bg-blue-900 text-blue-300',
};

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
        ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
