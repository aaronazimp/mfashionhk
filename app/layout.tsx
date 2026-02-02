import React from "react"
import type { Metadata } from 'next'
import { Merriweather } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const merriweather = Merriweather({ 
  weight: ['300', '400', '700', '900'],
  subsets: ["latin"],
  variable: '--font-merriweather',
});

export const metadata: Metadata = {
  title: 'M+ Fashion | 時尚精品',
  description: '探索 M+ Fashion 的最新時尚精品系列',
  generator: 'v0.app',
  icons: {
    icon: '/m+logo_final_colorBG.png',
    apple: '/m+logo_final_colorBG.png',
  },
  openGraph: {
    images: [
      {
        url: '/m+logo_final_colorBG.png',
        width: 1200,
        height: 630,
        alt: 'M+ Fashion',
      },
    ],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-TW">
      <body className={`${merriweather.variable} font-sans antialiased`}>
        {children}
        
        <Analytics />
      </body>
    </html>
  )
}
