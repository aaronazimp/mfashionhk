"use client"

import React, { useState, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Upload, X, Loader2, CheckCircle2, CloudUpload } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { submitPaymentProof } from "@/app/actions"
import Image from "next/image"

export function PaymentUploadForm({ orderId }: { orderId: string }) {
  const { toast } = useToast()
  
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    
    const droppedFiles = e.dataTransfer.files
    if (droppedFiles && droppedFiles.length > 0) {
      validateAndSetFile(droppedFiles[0])
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0])
    }
  }

  const validateAndSetFile = (selectedFile: File) => {
    // Validate file type
    if (!selectedFile.type.startsWith('image/')) {
      toast({
        variant: "destructive",
        title: "檔案格式錯誤",
        description: "請上傳圖片檔案 (PNG, JPG, JPEG)。",
      })
      return
    }

    // Validate file size (5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "檔案過大",
        description: "檔案大小必須小於 5MB。",
      })
      return
    }

    setFile(selectedFile)
    
    // Create preview URL
    const objectUrl = URL.createObjectURL(selectedFile)
    setPreviewUrl(objectUrl)
  }

  const clearFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setFile(null)
    setPreviewUrl(null)
  }

  const handleSubmit = async () => {
    if (!file) return

    setIsUploading(true)
    try {
      const timestamp = Date.now()
      const fileExt = file.name.split('.').pop()
      const filePath = `proofs/${orderId}_${timestamp}.${fileExt}`

      // 1. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(filePath, file)

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`)
      }

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('payment-proofs')
        .getPublicUrl(filePath)

      // 3. Call Server Action
      const result = await submitPaymentProof(orderId, publicUrl)

      if (result.error) {
        throw new Error(result.error)
      }

      setIsSuccess(true)
      toast({
        title: "付款證明已提交",
        description: "您的付款證明已成功上傳。",
        className: "bg-green-50 border-green-200 text-green-800",
      })

    } catch (error: any) {
      console.error('Submission error:', error)
      toast({
        variant: "destructive",
        title: "錯誤",
        description: error.message || "提交付款證明失敗。",
      })
    } finally {
      setIsUploading(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="border border-green-200 bg-green-50 rounded-lg p-8 text-center space-y-4">
        <div className="flex justify-center">
          <CheckCircle2 className="h-12 w-12 text-green-500" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-green-900">付款證明已提交！</h3>
          <p className="text-green-700">感謝您的付款證明，我們將盡快確認。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* File Drop Zone */}
      {!file ? (
        <div
          className={`
            border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
            ${isDragOver 
              ? 'border-primary bg-primary/5' 
              : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById('payment-proof-upload')?.click()}
        >
          <input 
            id="payment-proof-upload" 
            type="file" 
            className="hidden" 
            accept="image/*"
            onChange={handleFileSelect}
          />
          <div className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <CloudUpload className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">點擊或拖曳上傳</p>
              <p className="text-xs text-muted-foreground">支援 PNG, JPG, JPEG (最大 5MB)</p>
            </div>
          </div>
        </div>
      ) : (
        /* Image Preview State */
        <div className="relative border rounded-xl overflow-hidden bg-muted/30">
          <div className="absolute top-2 right-2 z-10">
            <Button
              variant="destructive"
              size="icon"
              className="h-8 w-8 rounded-full shadow-sm"
              onClick={(e) => {
                e.stopPropagation()
                clearFile()
              }}
              disabled={isUploading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-col items-center p-4 gap-4">
             <div className="relative aspect-[3/4] w-full max-w-[200px] rounded-lg overflow-hidden border shadow-sm bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={previewUrl!} 
                  alt="Preview" 
                  className="object-cover w-full h-full"
                />
             </div>
             <p className="text-sm font-medium text-muted-foreground truncate max-w-full px-4">
                {file.name}
             </p>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <Button 
        className="w-full" 
        size="lg"
        onClick={handleSubmit}
        disabled={!file || isUploading}
      >
        {isUploading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            上傳中...
          </>
        ) : (
          "我已付款"
        )}
      </Button>
    </div>
  )
}

