import React, { Suspense } from 'react'
import NotFoundClient from './NotFoundClient'

export default function NotFoundPage() {
  return (
    <Suspense fallback={<div />}>
      <NotFoundClient />
    </Suspense>
  )
}
