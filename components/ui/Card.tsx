import { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: boolean
}

export function Card({ padding = true, className = '', children, ...props }: CardProps) {
  return (
    <div
      className={`bg-harvest-surface rounded-lg shadow-sm border border-harvest-bg ${padding ? 'p-6' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`pb-4 mb-4 border-b border-harvest-bg ${className}`} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({ className = '', children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={`text-xl font-serif text-harvest-dark ${className}`} {...props}>
      {children}
    </h2>
  )
}
