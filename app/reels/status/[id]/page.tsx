import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, Home } from "lucide-react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

// Ensure we have the environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

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

async function getOrder(id: string): Promise<Order | null> {
  if (!supabaseUrl || !supabaseKey) return null;

  const { data, error } = await supabase
    .from("reels_orders")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.warn("Error fetching order:", error);
    return null;
  }
  return data as Order;
}

export default async function WaitlistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrder(id);

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full rounded-2xl shadow-xl p-8 text-center space-y-6">
        <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-2">
          <Clock className="w-10 h-10 text-orange-600" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-zinc-900">已加入訂貨名單</h1>
          <p className="text-zinc-600">
            感謝您的登記！
          </p>
          <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-100 mt-4">
             <p className="text-sm text-zinc-500 mb-1">訂單編號</p>
             <p className="font-mono font-medium">{id}</p>
             {order && (
                <p className="text-sm font-medium text-zinc-900 mt-2">
                    {order.product_name}
                </p>
             )}
          </div>
          <p className="text-sm text-zinc-500 pt-2">
            我們已將您加入訂貨名單中。稍後請留意 WhatsApp 通知。
          </p>
        </div>

        <div className="pt-4">
          <Link href="/flash-sale">
            <Button className="w-full bg-[#A87C73] hover:bg-[#8f6a62] h-12 text-lg">
              繼續瀏覽商品
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
