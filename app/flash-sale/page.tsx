import dynamic from 'next/dynamic'

const FlashSaleClient = dynamic(() => import('./FlashSaleClient'), { ssr: false })

export default function Page() {
  return <FlashSaleClient />
}

