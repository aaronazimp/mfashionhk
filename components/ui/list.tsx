import React from 'react'

type ListProps = {
  children?: React.ReactNode
  className?: string
}

export const List: React.FC<ListProps> = ({ children, className }) => {
  return <div className={className ?? 'space-y-4'}>{children}</div>
}

type ListItemProps = {
  id?: string
  header?: React.ReactNode
  subtitle?: React.ReactNode
  left?: React.ReactNode
  right?: React.ReactNode
  isOpen?: boolean
  onToggle?: () => void
  onClick?: () => void
  className?: string
  children?: React.ReactNode
}

export const ListItem: React.FC<ListItemProps> = ({ id, header, subtitle, left, right, isOpen, onToggle, onClick, className, children }) => {
  return (
    <div id={id} className={`bg-white rounded-4xl shadow p-4 cursor-pointer ${className ?? ''}`} onClick={onToggle}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {left}
          {header}
        </div>
        <div className="flex items-center gap-2">
          {right}
        </div>
      </div>
      {isOpen && (
        <div className="mt-4 text-xs space-y-2">
          {children}
        </div>
      )}
    </div>
  )
}

export default List
