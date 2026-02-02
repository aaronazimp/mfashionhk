"use client"

import { useState } from "react"
import Image from "next/image"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Maximize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"

interface InvoiceViewerProps {
  url: string
  alt: string
}

export function InvoiceViewer({ url, alt }: InvoiceViewerProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
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

      <DialogContent className="max-w-[95vw] w-auto h-auto p-0 bg-transparent border-none shadow-none flex items-center justify-center outline-none sm:max-w-none" showCloseButton={true}>
        <div className="relative bg-white rounded-lg overflow-hidden shadow-2xl">
            {/* Accessibility requirement: DialogContent must contain a DialogTitle */}
             <DialogTitle className="sr-only">{alt}</DialogTitle>
             <Image
                src={url}
                alt={alt}
                width={1200}
                height={630}
                className="max-h-[85vh] w-auto max-w-[90vw] object-contain"
                unoptimized
            />
        </div>
      </DialogContent>
    </Dialog>
  )
}
