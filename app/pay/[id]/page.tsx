import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { Metadata, ResolvingMetadata } from "next";
import PaymentClient, { Order } from "./payment-client";

// Ensure we have the environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Initialize Supabase lazily or safely
const supabase = createClient(supabaseUrl, supabaseKey);

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

async function getOrder(id: string): Promise<Order | null> {
  if (!supabaseUrl || !supabaseKey) {
    console.warn("Supabase environment variables missing; cannot fetch orders in this environment.");
    return null;
  }

  // Call the server-side RPC which centralises payment-summary logic
  const { data, error } = await supabase.rpc("get_order_payment_summary", { p_order_number: id });
  if (error) {
    console.warn("RPC get_order_payment_summary error:", error);
    return null;
  }

  // Normalize RPC result: Supabase may return an array wrapper or object
  let payload: any = data;
  if (Array.isArray(payload)) {
    // Some RPC shapes return [{ get_order_payment_summary: { ... } }] or [ { ... } ]
    payload = payload[0] ?? null;
    if (payload && payload.get_order_payment_summary) payload = payload.get_order_payment_summary;
  }

  // If payload is a string, try parse JSON
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch (e) {
      console.warn('Failed to parse RPC JSON payload', e);
      return null;
    }
  }

  if (!payload) {
    console.warn('Empty payload from get_order_payment_summary');
    return null;
  }

  // Map RPC result into the `Order` shape expected by the client component.
  // Use the subtotal as the main `price`. Use the first "pay now" item for item-level fields where appropriate.
  const itemsPayNow = Array.isArray(payload.items_pay_now) ? payload.items_pay_now : [];
  const first = itemsPayNow[0] ?? null;

  const mapped: Order = {
    id: payload.order_number || id,
    order_number: payload.order_number || id,
    created_at: new Date().toISOString(),
    sku: first?.sku_code_snapshot || payload.order_number || "",
    sku_id: undefined,
    price: Number(payload.subtotal ?? payload.total_to_pay ?? 0),
    product_name: first?.sku_code_snapshot || "Order Items",
    customer_name: undefined,
    status: 'pending',
    receipt_url: undefined,
    sku_img_url: undefined,
    base64_image: undefined,
    sku_code_snapshot: first?.sku_code_snapshot,
    variation_snapshot: first?.variation_snapshot,
    quantity: first?.quantity,
    whatsapp: undefined,
    payment_proof_url: undefined,
    deadline: undefined,
  };

  return mapped;
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
  ogUrl.searchParams.set("name", order.product_name || "Order");

  return {
    title: `支付 ${order.product_name} - HK$${order.price}`,
    description: `完成訂單 #${order.order_number || order.id.slice(0, 8).toUpperCase()} 的付款`,
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

  // Check Expiry (Only for pending orders)
  if (order.deadline && order.status === 'pending') {
      const deadlineDate = new Date(order.deadline);
      const now = new Date();
      if (now > deadlineDate) {
           return (
              <div className="min-h-screen bg-[#FFF4E5] flex items-center justify-center p-4 font-sans">
                  <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md w-full space-y-6">
                        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <div className="space-y-2">
                             <h1 className="text-2xl font-bold text-gray-900">付款連結已過期</h1>
                             <h2 className="text-lg font-medium text-gray-500">Payment Deadline Expired</h2>
                        </div>
                        <p className="text-gray-500">
                            此訂單的付款期限已過。如果您需要協助，請聯繫我們的客戶服務。<br/>
                            This order payment link has expired.
                        </p>
                        <div className="pt-6 border-t border-gray-100">
                            <p className="text-xs text-gray-400 font-mono">Order ID: {order.order_number || order.id.slice(0, 8)}</p>
                        </div>
                  </div>
              </div>
          );
      }
  }

  return <PaymentClient order={order} />;
}
