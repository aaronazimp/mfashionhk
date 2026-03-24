"use client";

import React, { useState, useEffect } from "react";
import { ImmersiveFeed } from "@/components/immersive-feed";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ProductModal from "@/components/ProductModal";
import { Spinner } from '@/components/ui/spinner'

export default function Page() {
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalId, setModalId] = useState<string | undefined>(undefined);

  useEffect(() => {
    async function fetchProducts() {
      const { data, error } = await supabase
        .from('SKU_details')
        .select('id, reels_video_url')
        .eq('is_reels_active', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching products:', error);
      }

      if (data) {
        const formattedProducts = data
          .map((item: any) => ({
            id: String(item.id),
            reelsUrl: item.reels_video_url ? `/api/proxy-video?url=${encodeURIComponent(item.reels_video_url)}` : null,
          }))
          .filter((product: any) => Boolean(product.reelsUrl));
        setProducts(formattedProducts);
      }
      setLoading(false);
    }

    fetchProducts();
  }, []);

  const handleRegister = (product: any) => {
    router.push(`/product/${product.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Spinner className="h-8 w-8 text-white" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black">
        <ImmersiveFeed 
            products={products} 
            onRegister={handleRegister} 
        />
        {/* navigation links now go to product page instead of opening a modal */}
    </main>
  );
}

