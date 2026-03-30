import React, { Suspense } from 'react'
import NotFoundClient from '../../NotFoundClient'

export default function Page404() {
  return (
    <Suspense fallback={<div />}>
      <NotFoundClient />
    </Suspense>
  )
}
