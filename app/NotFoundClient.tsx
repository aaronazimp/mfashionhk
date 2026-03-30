'use client'
import React from 'react'
import { useSearchParams } from 'next/navigation'

export default function NotFoundClient() {
  const params = useSearchParams()
  const q = params?.get('q')
  return (
    <div className="container mx-auto p-8 text-center">
      <h1 className="text-2xl font-semibold">找不到頁面</h1>
      {q ? <p className="mt-2 text-sm">搜尋: {q}</p> : null}
    </div>
  )
}
