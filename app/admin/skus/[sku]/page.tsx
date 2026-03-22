import SkuEditor from '@/components/sku-editor';
import type { SingleSkuDetails } from '@/lib/products';
import { getSingleSkuDetails } from '@/lib/orderService';
import Link from 'next/link';


type Props = {
  params: { sku: string };
};

export default async function Page({ params }: Props) {
  const { sku } = await params as any;

  let rpcProduct: SingleSkuDetails | undefined = undefined
  // Attempt to call RPC using numeric SKU param (if numeric)
  const candidateId = Number(sku)
  if (!Number.isNaN(candidateId) && candidateId > 0) {
    try {
      const rpcRes = await getSingleSkuDetails(candidateId)
      // Normalize RPC response: handle array-wrapped responses and empty objects
      let candidate: any = rpcRes
      if (Array.isArray(rpcRes)) candidate = rpcRes[0]
      if (candidate && typeof candidate === 'object' && Object.keys(candidate).length > 0 && (candidate.SKU || typeof candidate.id !== 'undefined')) {
        rpcProduct = candidate as SingleSkuDetails
      } else {
        // treat empty object/array as no-data -> rpcProduct remains undefined
      }
    } catch (err) {
      console.error('Failed to load single sku details:', err)
    }
  } else {
    // invalid numeric sku param; skipping RPC
  }
  if (!rpcProduct) {
    const EmptyWidget = (await import('@/components/EmptyWidget')).default
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <EmptyWidget message={`找不到 SKU: ${sku}`} className="w-full max-w-lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 text-[#111827]">
      <header className="bg-white mt-4 px-4 py-3 md:px-6 md:py-4">
        <div className="max-w-6xl mx-auto flex items-center">
          <Link href="/admin/skus" className="inline-flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            返回
          </Link>
        </div>
      </header>
    <div className="max-w-[90vw] mx-auto">
     

      <SkuEditor initialProduct={rpcProduct} />
    </div>
    </div>
  );
}
