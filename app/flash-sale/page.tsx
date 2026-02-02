"use client";

import React, { useState, useEffect } from "react";
import { ImmersiveFeed } from "@/components/immersive-feed";
import { Product } from "@/lib/products";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function FlashSalePage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

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
           // Calculate total quota from variations
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
    console.log("Registering for product:", product);
    // Navigate to flash sale detail page
    router.push(`/flash-sale/${product.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black">
        {/* Pass the products to the ImmersiveFeed component */}
        <ImmersiveFeed 
            products={products} 
            onRegister={handleRegister} 
        />
    </main>
  );
}

