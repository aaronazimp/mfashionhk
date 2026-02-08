import React from 'react'
import FlashSaleClient from './FlashSaleClient'

export default function Page() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-black" />}>
      <FlashSaleClient />
    </React.Suspense>
  )
}

