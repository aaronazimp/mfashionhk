"use client";

import React, { useState, useEffect } from "react";
import { ImmersiveFeed } from "@/components/immersive-feed";
import { Product } from "@/lib/products";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ProductModal from "@/components/ProductModal";

export default function FlashSaleClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalId, setModalId] = useState<string | undefined>(undefined);

  useEffect(() => {
    async function fetchProducts() {
      const { data, error } = await supabase
        .from('SKU_details')
        .select(`
          *,
          SKU_variations (
            reels_quota
          )
        `)
        .eq('is_reels_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching products:', error);
      }

      if (data) {
        const formattedProducts: Product[] = data.map((item: any) => {
           const variations = item.SKU_variations || [];
           const totalQuota = variations.reduce((sum: number, v: any) => sum + (v.reels_quota || 0), 0);

           const uniqueColors: string[] = [];  
           const uniqueSizes: string[] = [];
           
           return {
              id: item.id.toString(),
              sku: item.SKU,
              name: item.SKU,
              price: item.regular_price,
              description: item.video_caption || item.remark || "",
              images: item.imageurl ? [item.imageurl] : [],
              colors: uniqueColors,
              sizes: uniqueSizes,
              category: "Flash Sale",
              reelsUrl: item.reels_video_url,
              videoUrl: item.feature_video,
              deadline: item.reels_deadline,
              totalQuota: totalQuota,
           };
        });
        setProducts(formattedProducts);
      }
      setLoading(false);
    }

    fetchProducts();
  }, []);

  const handleRegister = (product: any) => {
    setModalId(product.id);
    router.push(`/flash-sale?modal=${product.id}`);
  };

  useEffect(() => {
    const modal = searchParams?.get?.('modal');
    if (modal) setModalId(modal);
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black">
        <ImmersiveFeed 
            products={products} 
            onRegister={handleRegister} 
        />
        {modalId && (
          <ProductModal id={modalId} open={true} onClose={() => {
            setModalId(undefined);
            router.push('/flash-sale');
          }} />
        )}
    </main>
  );
}
