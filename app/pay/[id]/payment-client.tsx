"use client";

import { useEffect, useState, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { CreditCard, Banknote, QrCode, Smartphone, Loader2, CheckCircle2 } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { InvoiceViewer } from "@/components/invoice-viewer";
import { PaymentUploadForm } from "@/components/payment-upload-form";
import Link from "next/link";
import html2canvas from "html2canvas";

import { uploadInvoiceAndSave } from "../actions";

// Initialize Supabase client for client-side usage
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export interface Order {
  id: string;
  order_number?: string;
  created_at: string;
  sku: string;
  sku_id?: number;
  price: number;
  product_name: string;
  customer_name?: string;
  status: string;
  receipt_url?: string;
  sku_img_url?: string;
  base64_image?: string;
  sku_code_snapshot?: string;
  variation_snapshot?: string;
  quantity?: number;
  whatsapp?: string;
  payment_proof_url?: string;
  deadline?: string;
}

export default function PaymentClient({ order }: { order: Order }) {
  const [receiptUrl, setReceiptUrl] = useState<string | null>(order.receipt_url || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [skuImageBase64, setSkuImageBase64] = useState<string | null>(order.base64_image || null);
  const [showInvoice, setShowInvoice] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const hasGeneratedRef = useRef(false);

  const isPaymentSubmitted = ['paid', 'verified', 'completed'].includes(order.status) || !!order.payment_proof_url;
  
  // Pre-load image as Base64 to ensure html2canvas can capture it
  useEffect(() => {
    if (order.sku_img_url && !skuImageBase64) {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      // Use proxy to avoid CORS issues
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(order.sku_img_url)}`;
      img.src = proxyUrl;
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          // Resize if too large to prevent canvas errors/memory issues
          const MAX_SIZE = 800;
          let width = img.width;
          let height = img.height;
          
          if (width > MAX_SIZE || height > MAX_SIZE) {
             if (width > height) {
                 height = Math.round((height * MAX_SIZE) / width);
                 width = MAX_SIZE;
             } else {
                 width = Math.round((width * MAX_SIZE) / height);
                 height = MAX_SIZE;
             }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataURL = canvas.toDataURL("image/png");
            setSkuImageBase64(dataURL);
          }
        } catch (e) {
          console.warn("Failed to convert image to base64", e);
        }
      };
      img.onerror = (e) => {
        console.warn("Failed to load image for base64 conversion", e);
        // Set to empty string or keep null to signal we can proceed without image
        setSkuImageBase64("failed"); 
      };
    }
  }, [order.sku_img_url, skuImageBase64]);

  // Auto-Invoice Generation Hook
  useEffect(() => {
    const generateInvoice = async () => {
        if (isGenerating) return; 
        if (hasGeneratedRef.current) return;
        
        setIsGenerating(true);
        hasGeneratedRef.current = true;

        try {
            // Wait a moment for layout to settle and image to render
            await new Promise(resolve => setTimeout(resolve, 800));

            if (!invoiceRef.current) {
                console.error("Invoice template not found");
                return;
            }

            const canvas = await html2canvas(invoiceRef.current, {
                scale: 2, 
                useCORS: true,
                allowTaint: true,
                logging: true,
                backgroundColor: "#ffffff", 
                imageTimeout: 15000
            });

            // Convert canvas to blob
            const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
            if (!blob) throw new Error("Failed to create blob");

            // Define file path
            const fileName = `reel_invoice_${order.id}.png`;
            
            // Use Server Action to upload (Bypasses RLS)
            const formData = new FormData();
            formData.append('file', blob, fileName);
            formData.append('fileName', fileName);
            formData.append('orderId', order.id);

            const result = await uploadInvoiceAndSave(formData);

            if (result.error) {
                console.error("Server upload failed:", result.error);
                throw new Error(result.error);
            }

            const publicUrl = result.publicUrl;
            if (!publicUrl) throw new Error("No public URL returned");

            // Append timestamp to bust cache
            setReceiptUrl(`${publicUrl}?t=${Date.now()}`);

        } catch (error) {
            console.error("Error generating invoice:", error);
            hasGeneratedRef.current = false; // Allow retry on error
        } finally {
            setIsGenerating(false);
        }
    };

    // Trigger generation conditions
    const shouldGenerate = !receiptUrl && !isGenerating && !hasGeneratedRef.current;
    
    // Check if image is ready or failed (so we don't wait forever)
    // If there is no sku_img_url, we are ready.
    // If there IS a sku_img_url, we wait until skuImageBase64 is either the data string or "failed".
    const isImageReady = !order.sku_img_url || (order.sku_img_url && skuImageBase64);

    if (shouldGenerate && isImageReady) {
        generateInvoice();
    }
  }, [order.id, receiptUrl, isGenerating, order.sku_img_url, skuImageBase64]);


  // Construct PayMe link
  const payMeLink = `https://payme.hsbc/yourname/${(order.price || 0).toFixed(2)}`;

  return (
    <div className="min-h-screen bg-[#FFF4E5] flex flex-col items-center justify-center p-4">
      
      {/* Hidden Invoice Template - Modern Redesign (Chinese) */}
      <div 
        ref={invoiceRef}
        className="w-[800px] p-12 font-sans box-border"
        style={{ 
            position: 'absolute', 
            top: 0, 
            left: '-9999px', 
            zIndex: -100,
            backgroundColor: '#ffffff',
            color: '#111827',
            fontFamily: '"Microsoft JhengHei", "Heiti TC", sans-serif'
        }} 
      >
          {/* Header Section */}
          <div className="flex justify-between items-start mb-10">
              {/* Left: Brand */}
              <div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/m+logo_final_colorBG.png" alt="M Fashion" className="h-16 mb-4 object-contain" />
                  <div className="text-xl font-bold text-[#A87C73] mb-2 tracking-tight">MFashion</div>
                  <div className="text-sm text-[#6b7280]">荃灣南豐中心新之城2樓25號鋪</div>
                  <div className="flex items-center gap-1 text-sm text-[#6b7280] mt-3">
                    <svg viewBox="0 0 24 24" fill="#25D366" className="w-4 h-4 shrink-0">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    <span>+852 5729 0882</span>
                 </div>
              </div>
              
              {/* Right: Invoice Info */}
              <div className="text-right">
                <div className="text-sm uppercase tracking-widest text-[#A87C73] font-bold mb-1">發票 / 收據</div>
                <div className="text-xl font-black text-[#111827]">#{order.order_number || order.id.slice(0, 8).toUpperCase()}</div>
              </div>
          </div>

          {/* Customer & Info Block */}
          <div className="rounded-xl p-8 mb-10" style={{ backgroundColor: '#f9fafb' }}>
              <div className="grid grid-cols-2 gap-12">
                  {/* Col 1: Bill To */}
                  <div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-[#A87C73] mb-4">客戶</h3>
                      <div className="font-bold text-xl text-[#111827] mb-1">{order.customer_name || '訪客'}</div>
                      <div className="flex items-center gap-2 text-[#6b7280] font-medium">
                          <span className="leading-none">{order.whatsapp || '未提供聯絡電話'}</span>
                      </div>
                  </div>
                  
                  {/* Col 2: Order Details */}
                   <div className="flex flex-col items-end text-right">
                       <h3 className="text-xs font-bold uppercase tracking-widest text-[#A87C73] mb-4">訂單詳情</h3>
                       <div className="space-y-2">
                           <div className="flex items-center gap-4 justify-end">
                               <span className="text-[#6b7280]">日期</span>
                               <span className="font-medium text-[#111827]">
                                   {new Date().toLocaleDateString('zh-HK', { year: 'numeric', month: 'long', day: 'numeric'})}
                               </span>
                           </div>
                           <div className="flex items-center gap-4 justify-end">
                               <span className="text-[#6b7280]">付款方式</span>
                               <span className="font-medium text-[#111827]">網上支付 / PayMe / FPS</span>
                           </div>
                       </div>
                  </div>
              </div>
          </div>

          {/* Product Section */}
          <div className="mb-12">
              <h3 className="text-lg font-bold text-[#A87C73] mb-6 pb-4 border-b" style={{ borderColor: '#f3f4f6' }}>訂購項目</h3>
              
              {/* Modern Flex Row Item */}
              <div className="flex items-start py-4">
                  {/* Image */}
                  <div className="w-24 h-24 shrink-0 border bg-white shadow-sm flex items-center justify-center relative overflow-hidden" style={{ borderColor: '#e5e7eb', borderRadius: '8px' }}>
                      {/* Try Base64 -> Try Proxy -> Try Original -> Fallback Icon */}
                      {(skuImageBase64 && skuImageBase64 !== "failed") ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img 
                              src={skuImageBase64} 
                              alt="Product" 
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                      ) : (order.sku_img_url) ? (
                           /* eslint-disable-next-line @next/next/no-img-element */
                           <img 
                              src={`/api/proxy-image?url=${encodeURIComponent(order.sku_img_url)}`}
                              alt="Product" 
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                              crossOrigin="anonymous"
                          />
                      ) : (
                          <div className="text-[#9ca3af]">
                              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          </div>
                      )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 ml-6 pt-1">
                      <div className="font-bold text-xl text-[#111827] mb-2">{order.sku_code_snapshot || order.sku || order.product_name}</div>
                      <div className="flex flex-col gap-1 text-sm text-[#6b7280] font-medium">
                          <div>規格: <span className="text-[#111827]">{order.variation_snapshot || '單色 / One Size'}</span></div>
                          <div>數量: <span className="text-[#111827]">{order.quantity || 1}</span></div>
                      </div>
                  </div>

                  {/* Price */}
                  <div className="text-xl font-bold text-[#111827] tabular-nums pt-1">
                      HK$ {(order.price || 0).toFixed(2)}
                  </div>
              </div>
              {/* Divider */}
              <div className="border-b mt-4" style={{ borderColor: '#f3f4f6' }}></div>
          </div>

          {/* Footer & Totals */}
          <div className="flex flex-col items-end">
              <div className="text-right w-1/2 ">
                  <div className="flex justify-between items-center mb-6 text-[#6b7280] font-medium text-lg border-b pb-4" style={{ borderColor: '#f3f4f6' }}>
                      <span>小計</span>
                      <span>HK$ {(order.price || 0).toFixed(2)}</span>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                      <span className="text-[#6b7280] font-medium uppercase tracking-wide text-sm">總金額</span>
                      <span className="text-5xl font-black text-[#A87C73] tracking-tight tabular-nums">
                         HK$ {(order.price || 0).toFixed(2)}
                      </span>
                  </div>
              </div>
          </div>

          {/* Bottom Branding */}
          <div className="mt-20 pt-8 border-t flex justify-between text-sm text-[#9ca3af]" style={{ borderColor: '#f3f4f6' }}>
             <div>感謝您的惠顧</div>
             <div className="flex items-center gap-2">
                 <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-[#1877F2]">
                     <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036c-2.148 0-2.971.956-2.971 3.594v.376h3.428l-.348 3.667h-3.08v7.98h-4.844Z"></path>
                 </svg>
                 <span>m.plus.fashion.hk</span>
             </div>
          </div>
      </div>

      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-500">
        
        {/* Content Section */}
        <div className="p-6 md:p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-[#A87C73]">
              {isPaymentSubmitted ? "我們正確認你的訂單" : "確認付款"}
            </h1>
            {order.order_number && (
               <div className="inline-block px-3 py-1 bg-gray-100 text-[#A87C73] text-sm font-bold font-mono rounded-full mt-2 tracking-wide">
                   訂單號: {order.order_number}
               </div>
            )}
            <div className="flex flex-col items-center">
                {!isPaymentSubmitted && (
                  <p className="text-gray-500 mt-2 text-sm">
                    請完成購買 <span className="font-semibold text-gray-700">{order.product_name}</span>。
                  </p>
                )}
                  <button 
                        onClick={() => setShowInvoice(true)}
                        className="mt-3 bg-white hover:bg-gray-50 text-[#A87C73] text-xs font-bold py-2 px-4 rounded-full border border-[#A87C73]/30 shadow-sm transition-all flex items-center gap-2"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        查看訂單發票
                  </button>
                  {showInvoice && (
                     <InvoiceViewer 
                        url={receiptUrl} 
                        alt="Invoice" 
                        initiallyOpen={true} 
                        onClose={() => setShowInvoice(false)} 
                        downloadFileName={`Invoice-${order.order_number || order.id}.png`}
                        isLoading={!receiptUrl}
                     />
                  )}
            </div>
          </div>

          <div className="space-y-6">
            {!isPaymentSubmitted && (
             <>
             <Tabs defaultValue="payme" className="w-full">
               <TabsList className="grid w-full grid-cols-4 h-auto p-1 bg-gray-100/50 rounded-xl">
                <TabsTrigger value="payme" className="flex flex-col gap-1 py-3 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#E53535]">
                  <Smartphone className="w-5 h-5" />
                  PayMe
                </TabsTrigger>
                <TabsTrigger value="fps" className="flex flex-col gap-1 py-3 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#00ab4e]">
                  <Banknote className="w-5 h-5" />
                  轉數快
                </TabsTrigger>
                <TabsTrigger value="wallets" className="flex flex-col gap-1 py-3 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#00C250]">
                  <QrCode className="w-5 h-5" />
                  電子錢包
                </TabsTrigger>
                <TabsTrigger value="card" className="flex flex-col gap-1 py-3 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <CreditCard className="w-5 h-5" />
                  信用卡
                </TabsTrigger>
              </TabsList>
              
              <div className="mt-6 min-h-[180px]">
                {/* PayMe Option */}
                <TabsContent value="payme" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="bg-red-50/50 border border-red-100 rounded-xl p-4 text-center space-y-3">
                    <p className="text-sm text-gray-600">
                      點擊下方按鈕打開 PayMe 應用程式付款。
                    </p>
                    <Link
                      href={payMeLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full"
                    >
                      <button className="w-full bg-[#E53535] hover:bg-[#D62E2E] text-white font-bold py-3 px-4 rounded-xl shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2">
                         <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z" />
                         </svg>
                         PayMe HK${(order.price || 0).toFixed(2)}
                      </button>
                    </Link>
                  </div>
                </TabsContent>

                {/* FPS Option */}
                <TabsContent value="fps" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <Card className="bg-emerald-50/50 border-emerald-100 border-dashed">
                      <CardContent className="p-4 space-y-3 text-sm text-gray-600">
                          <div className="flex justify-between items-center border-b border-emerald-100 pb-2">
                             <span>快速支付系統 ID</span>
                             <span className="font-mono font-bold text-black text-base selection:bg-emerald-200">1234567</span>
                          </div>
                          <div className="flex justify-between items-center border-b border-emerald-100 pb-2">
                             <span>電話號碼</span>
                             <span className="font-mono font-bold text-black text-base selection:bg-emerald-200">+852 9123 4567</span>
                          </div>
                          <div className="flex justify-between items-center border-b border-emerald-100 pb-2">
                             <span>轉帳金額</span>
                             <span className="font-bold text-[#A87C73] text-lg">HKD ${(order.price || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                             <span>帳戶名稱</span>
                             <span className="font-bold text-black">M-Fashion Limited</span>
                          </div>
                      </CardContent>
                  </Card>
                </TabsContent>

                 {/* WeChat / Alipay Option */}
                <TabsContent value="wallets" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="space-y-3">
                         {/* WeChat Pay */}
                        <Link
                            href="weixin://" 
                            target="_blank"
                            className="block w-full"
                        >
                             <button className="w-full bg-[#00C250] hover:bg-[#00AC47] text-white font-bold py-3 px-4 rounded-xl shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2">
                                <span className="font-bold border border-white/40 rounded px-1">微</span>
                                WeChat Pay
                             </button>
                        </Link>

                         {/* AlipayHK */}
                         <Link
                            href="alipayhk://"
                            target="_blank"
                            className="block w-full"
                        >
                           <button className="w-full bg-[#00A3EE] hover:bg-[#008AC9] text-white font-bold py-3 px-4 rounded-xl shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2">
                                <span className="font-bold border border-white/40 rounded px-1">支</span>
                                AlipayHK
                           </button>
                        </Link>
                    </div>
                    <p className="text-xs text-center text-muted-foreground">
                        點擊按鈕開啟 App 支付 <span className="font-bold text-[#A87C73]">HKD ${(order.price || 0).toFixed(2)}</span>
                    </p>
                </TabsContent>
                
                 {/* Credit Card Option */}
                <TabsContent value="card" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                   <div className="p-6 bg-gray-50 rounded-xl border border-gray-100 text-center space-y-4">
                       <CreditCard className="w-12 h-12 mx-auto text-gray-300" />
                       <div className="space-y-2">
                         <h3 className="font-medium text-gray-900">信用卡支付</h3>
                         <p className="text-sm text-gray-500">
                             我們接受 Visa 和 MasterCard。
                         </p>
                       </div>
                       <button className="w-full bg-black text-white py-3 rounded-xl font-bold text-sm hover:bg-gray-800 transition-colors opacity-50 cursor-not-allowed">
                           支付 HKD ${(order.price || 0).toFixed(2)} (即將推出)
                       </button>
                   </div>
                </TabsContent>
              </div>
            </Tabs>

            <div className="relative pt-4">
              <div className="absolute inset-0 flex items-center pt-4">
                <span className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase pt-4">
                <span className="bg-white px-2 text-muted-foreground text-gray-400">
                  付款證明
                </span>
              </div>
            </div>
             </>
            )}

            {/* Check status or existing proof */}
            {isPaymentSubmitted ? (
                <div className="border border-green-200 bg-green-50 rounded-lg p-8 text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex justify-center">
                        <CheckCircle2 className="h-12 w-12 text-green-500" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-xl font-semibold text-green-900">已提交付款證明</h3>
                        <p className="text-green-700">我們已收到您的付款證明，感謝您的購買。</p>
                        {order.payment_proof_url && (
                             <div className="mt-4">
                                <a href={order.payment_proof_url} target="_blank" rel="noreferrer" className="text-xs text-green-600 underline hover:text-green-800">
                                    查看已上傳的證明
                                </a>
                             </div>
                        )}
                    </div>
                </div>
            ) : (
                <PaymentUploadForm orderId={order.id} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}