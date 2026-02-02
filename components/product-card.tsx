"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Product } from "@/lib/products";

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    className={className}
    fill="currentColor"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
)

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const [currentUrl, setCurrentUrl] = useState("");

  useEffect(() => {
    setCurrentUrl(`${window.location.origin}/product/${product.id}`);
  }, [product.id]);

  const whatsappLink = `https://wa.me/85257290882?text=${encodeURIComponent(
    `您好，我想諮詢以下商品：\n${currentUrl}`
  )}`;

  return (
    <Card className="group overflow-hidden border-0 bg-card shadow-sm transition-all hover:shadow-md h-full flex flex-col p-0 gap-0">
      <Link href={`/product/${product.id}`} target="_blank" rel="noopener noreferrer">
        <div className="relative aspect-[2/3] overflow-hidden">
          <Image
            src={product.images[0] || "/placeholder.svg"}
            alt={product.name}
            fill
            className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
          />
        </div>
      </Link>
      <CardContent className="p-3 flex flex-col flex-1">
        <div className="flex flex-wrap gap-1.5 mb-2 min-h-6">
          {product.isNew && (
            <Badge className="bg-primary text-primary-foreground">新品</Badge>
          )}
          {product.isSale && (
            <Badge variant="destructive">特價</Badge>
          )}
          {product.madeInKorea && (
            <Badge variant="outline" className="border-[#C4A59D] text-[#C4A59D]">🇰🇷 Made in Korea</Badge>
          )}
        </div>
        <Link href={`/product/${product.id}`} target="_blank" rel="noopener noreferrer">
          <span className="text-xs text-muted-foreground">上架日期: </span>{product.date && (
            <span className="text-xs text-muted-foreground mb-0.5">
              {product.date instanceof Date 
                ? product.date.toISOString().split('T')[0] 
                : new Date(product.date).toISOString().split('T')[0]}
            </span>
          )}
          <h3 className="font-medium text-sm text-foreground mb-1 hover:text-[#C4A59D] transition-colors truncate">
            貨號 {product.sku}
          </h3>
        </Link>
        <div className="flex flex-wrap items-baseline gap-1.5 mb-2">
          <span className="text-sm font-bold text-[#C4A59D]">
            HK${product.price.toLocaleString()}
          </span>
          {product.originalPrice && (
            <span className="text-xs text-muted-foreground line-through">
              HK${product.originalPrice.toLocaleString()}
            </span>
          )}
        </div>
        <Button asChild className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white h-9 text-sm">
          <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
            <WhatsAppIcon className="w-5 h-5 mr-2" />
            諮詢產品
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
