"use client"

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type Props = {
  transactionId?: string;
}

export default function OrderNotFoundDialog({ transactionId }: Props) {
  const [open, setOpen] = useState(true)
  const router = useRouter()

  useEffect(() => {
    setOpen(true)
  }, [])

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) router.push('/'); }}> 
      <DialogContent className="max-w-[90vw]">
        <DialogHeader>
          <DialogTitle>找不到訂單</DialogTitle>
        </DialogHeader>

        <div className="text-sm text-gray-700 mt-2">
          {transactionId ? (
            <div>交易編號 {transactionId} 未能找到。請檢查連結或聯絡客服。</div>
          ) : (
            <div>找不到此訂單。請檢查連結或聯絡客服。</div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => router.push('/flash-sale')}>返回主頁</Button>
          
        </div>

        <DialogClose className="sr-only">Close</DialogClose>
      </DialogContent>
    </Dialog>
  )
}
