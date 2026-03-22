"use client";

import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Product } from "@/lib/products";

interface RestockSkuCardProps {
  product: Product;
  restockCount: number;
  onOpen?: (product: Product, restockCount: number) => void;
}

export default function RestockSkuCard({ product, restockCount, onOpen }: RestockSkuCardProps) {
  return (
    <Card
      onClick={() => onOpen?.(product, restockCount)}
      className="group relative overflow-hidden border-0 bg-card shadow-sm hover:shadow-md h-auto flex flex-col p-0 cursor-pointer"
    >
      <Link
        href={`/product/${product.id}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          if (onOpen) {
            e.preventDefault();
            e.stopPropagation();
            onOpen?.(product, restockCount);
          } else {
            e.stopPropagation();
          }
        }}
      >
        <div className="relative aspect-[2/3] sm:aspect-[4/5] overflow-hidden">
          <Image
            src={product.images?.[0] || "/placeholder.svg"}
            alt={product.name}
            fill
            className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
          />
        </div>
      </Link>

      <CardContent className="py-0 px-3  flex items-center justify-center flex-col">
        <div className="w-full">
          <h3 className="font-semibold text-md text-black text-center leading-none pb-2">{product.sku}</h3>
        </div>
      </CardContent>

      {restockCount >= 1 && (
        <div className="absolute top-2 right-2">
          <Badge className="bg-primary text-white text-sm">需補貨 {restockCount}</Badge>
        </div>
      )}
    </Card>
  );
}
