import SkuEditor from '@/components/sku-editor';
import { getProductBySku, Product } from '@/lib/products';
import Link from 'next/link';

type Props = {
  params: { sku: string };
};

export default async function Page({ params }: Props) {
  const { sku } = await params as any;
  const product = getProductBySku(sku);

  if (!product) {
    return (
      <div className="min-h-screen p-6">
        <h1 className="text-xl font-semibold">SKU 未找到</h1>
        <p className="mt-2 text-sm text-gray-600">找不到 SKU: {sku}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 text-[#111827]">
       <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-3 md:px-6 md:py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <nav className="inline-flex gap-1 md:gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200 w-full md:w-auto">
            <Link href="/admin/orders" className="flex-1 md:flex-initial px-2 md:px-4 py-2 md:py-2 rounded text-xs md:text-sm text-[#111827] text-center md:text-left hover:bg-white/50 transition-colors">處理訂單</Link>
            <Link href="/admin/upload" className="flex-1 md:flex-initial px-2 md:px-4 py-2 md:py-2 rounded text-xs md:text-sm text-[#111827] text-center md:text-left hover:bg-white/50 transition-colors">上傳 SKU</Link>
             <Link href="/admin/skus" className="flex-1 md:flex-initial px-2 md:px-4 py-2 md:py-2 rounded text-xs md:text-sm font-medium bg-[#C4A59D] text-white text-center md:text-left hover:bg-[#C4A59D]/90 transition-colors">管理 SKUs</Link>
            <Link href="/admin/best-sellers" className="flex-1 md:flex-initial px-2 md:px-4 py-2 md:py-2 rounded text-xs md:text-sm text-[#111827] text-center md:text-left hover:bg-white/50 transition-colors">熱賣 SKU</Link>
          </nav>
        </div>
      </header>
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">SKU 檢視與編輯</h1>
          <p className="text-sm text-gray-600">編輯 SKU: {product.sku}</p>
        </div>
        <Link href={`/flash-sale?sku=${product.sku}`} target="_blank" className="text-sm text-blue-600 hover:underline">
          查看預覽頁面
        </Link>
      </header>

      <SkuEditor initialProduct={product} />
    </div>
    </div>
  );
}
