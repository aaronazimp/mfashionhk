import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { CreditCard, Banknote, QrCode, Smartphone } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { InvoiceViewer } from "@/components/invoice-viewer";
import { PaymentUploadForm } from "@/components/payment-upload-form";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Metadata, ResolvingMetadata } from "next";

// Ensure we have the environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Initialize Supabase lazily or safely
const supabase = createClient(supabaseUrl, supabaseKey);

interface Order {
  id: string;
  created_at: string;
  sku: string;
  price: number;
  product_name: string;
  customer_name?: string;
  status: string;
}

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

async function getOrder(id: string): Promise<Order | null> {
  if (!supabaseUrl || !supabaseKey) {
    console.warn("Supabase environment variables missing. Returning mock data for dev.");
    return {
      id,
      created_at: new Date().toISOString(),
      sku: "MOCK-DEV-ITEM",
      price: 128.50,
      product_name: "Premium Mock Product",
      customer_name: "Dev User",
      status: "pending",
    };
  }

  const { data, error } = await supabase
    .from("reels_orders")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.warn("Error fetching order (dev mode fallback):", error);
    return {
      id,
      created_at: new Date().toISOString(),
      sku: "MOCK-DEV-ITEM",
      price: 128.50,
      product_name: "Premium Mock Product",
      customer_name: "Dev User",
      status: "pending",
    };
  }
  return data as Order;
}

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  const order = await getOrder(id);

  if (!order) {
    return {
      title: "找不到訂單",
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const ogUrl = new URL(`${baseUrl}/api/og/invoice`);
  ogUrl.searchParams.set("sku", order.sku || "");
  ogUrl.searchParams.set("price", order.price?.toString() || "0");
  ogUrl.searchParams.set("name", order.product_name || "Orde");

  return {
    title: `支付 ${order.product_name} - HK$${order.price}`,
    description: `完成訂單 #${order.id} 的付款`,
    openGraph: {
      title: `發票: ${order.product_name}`,
      description: `總計: HK$${order.price}`,
      images: [
        {
          url: ogUrl.toString(),
          width: 1200,
          height: 630,
          alt: `${order.product_name} 的發票`,
        },
      ],
    },
  };
}

export default async function PaymentPage({ params }: Props) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  const order = await getOrder(id);

  if (!order) {
    // Fallback or Not Found Page
    return notFound();
  }

  // Generate the OG image URL for the page preview as well
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const ogUrl = new URL(`${baseUrl}/api/og/invoice`);
  ogUrl.searchParams.set("sku", order.sku || "");
  ogUrl.searchParams.set("price", order.price?.toString() || "0");
  ogUrl.searchParams.set("name", order.product_name || "Order");

  // Construct PayMe link
  // NOTE: Replace 'yourname' with the actual PayMe identifier
  const payMeLink = `https://payme.hsbc/yourname/${order.price}`;

  return (
    <div className="min-h-screen bg-[#FFF4E5] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-500">
        
        {/* Top Section: Invoice Image */}
        <InvoiceViewer url={ogUrl.toString()} alt="Invoice Preview" />

        {/* Content Section */}
        <div className="p-6 md:p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-[#A87C73]">
              確認付款
            </h1>
            <p className="text-gray-500 mt-2 text-sm">
              請完成購買 <span className="font-semibold text-gray-700">{order.product_name}</span>。
            </p>
          </div>

          <div className="space-y-6">
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
                         PayMe HKS{(order.price || 0).toFixed(2)}
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

            <PaymentUploadForm orderId={order.id} />
          </div>
        </div>
        
        <div className="bg-gray-50 px-6 py-4 text-center text-xs text-gray-400">
            訂單號: {order.id}
        </div>
      </div>
    </div>
  );
}
