import React from 'react'
import { Button } from "@/components/ui/button"

export function PaymentUploadForm({ orderId }: { orderId: string }) {
  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center space-y-4">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">上傳付款證明</h3>
        <p className="text-sm text-muted-foreground">請上傳您的付款截圖以確認訂單。</p>
      </div>
      {/* Placeholder for actual file upload logic */}
      <label htmlFor="file-upload" className="cursor-pointer">
        <div className="flex flex-col items-center gap-2">
            <Button variant="outline" className="text-muted-foreground">選擇文件</Button>
            <input id="file-upload" type="file" className="hidden" accept="image/*" />
        </div>
      </label>
    </div>
  )
}
