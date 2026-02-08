"use client"

import { useState } from "react"
import Image from "next/image"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Maximize2, Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"

interface InvoiceViewerProps {
  url?: string | null
  alt: string
  initiallyOpen?: boolean
  onClose?: () => void
  downloadFileName?: string
  isLoading?: boolean
}

export function InvoiceViewer({ url, alt, initiallyOpen = false, onClose, downloadFileName, isLoading: externalLoading }: InvoiceViewerProps) {
  const [isOpen, setIsOpen] = useState(initiallyOpen)
  const [imageLoading, setImageLoading] = useState(true)

  const isLoading = externalLoading || (!!url && imageLoading)

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      onClose?.()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {!initiallyOpen && url && (
      <div 
        className="relative w-full aspect-[1.91/1] bg-gray-50 border-b group cursor-pointer overflow-hidden"
        onClick={() => setIsOpen(true)}
      >
        <Image
            src={url}
            alt={alt}
            fill
            className="object-contain p-2 transition-transform duration-300 group-hover:scale-105"
            priority
            unoptimized
        />
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full shadow-md bg-white/80 hover:bg-white backdrop-blur-sm">
                <Maximize2 className="h-4 w-4 text-gray-700" />
            </Button>
        </div>
        
         <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
             <span className="text-[10px] bg-black/75 text-white px-2 py-1 rounded-full backdrop-blur-sm font-medium">點擊放大</span>
         </div>
      </div>
      )}

      <DialogContent className="max-w-[95vw] w-auto h-auto p-0 bg-transparent border-none shadow-none flex flex-col items-center justify-center outline-none sm:max-w-none gap-6" showCloseButton={true}>
        <div className="relative bg-white rounded-lg overflow-hidden shadow-2xl shrink-0 min-w-[300px] min-h-[200px] flex items-center justify-center">
            {/* Accessibility requirement: DialogContent must contain a DialogTitle */}
             <DialogTitle className="sr-only">{alt}</DialogTitle>
             
             {isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-20 gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-[#A87C73]" />
                    <p className="text-sm font-medium text-gray-400 tracking-wide">載入中...</p>
                </div>
             )}

             {url && (
             <Image
                src={url}
                alt={alt}
                width={1200}
                height={630}
                className={`max-h-[70vh] w-auto max-w-[90vw] object-contain transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
                unoptimized
                onLoadingComplete={() => setImageLoading(false)}
            />
             )}
        </div>
        {!isLoading && downloadFileName && url && (
              <a 
                href={url} 
                download={downloadFileName} 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-6 py-3 bg-white hover:bg-gray-100 text-gray-900 font-bold rounded-full shadow-lg transition-transform hover:scale-105 flex items-center gap-2"
                title="Download Invoice"
              >
                  <Download className="w-4 h-4" />
                  <span className="text-sm">下載發票</span>
              </a>
            )}
      </DialogContent>
    </Dialog>
  )
}
