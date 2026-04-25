"use client"
import React, { useState } from "react"
import ImageFullscreen from "./ImageFullscreen"

type Props = {
  src: string
  alt?: string
}

export default function PaymentProofViewer({ src, alt = "付款憑證" }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block max-w-[320px] w-full rounded-lg overflow-hidden"
        aria-label="打開付款憑證"
      >
        <img src={src} alt={alt} className="max-w-[320px] w-full object-contain rounded-lg shadow-md cursor-pointer" />
      </button>
      <ImageFullscreen src={src} alt={alt} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
