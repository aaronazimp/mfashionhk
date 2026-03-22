import React from 'react'
import * as Lucide from 'lucide-react'

export default function EmptyWidget({ message = '暫無資料', className = '' }: { message?: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center p-6 text-center text-gray-500 ${className}`}>
      <Lucide.Inbox className="w-10 h-10 mb-3 text-gray-400" />
      <div className="text-sm font-medium">{message}</div>
    </div>
  )
}
