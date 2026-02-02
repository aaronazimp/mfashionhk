"use client";

import { useState, use, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { Header } from "@/components/header";
import { Product } from "@/lib/products";
import { supabase } from "@/lib/supabase";
import { MessageCircle, ChevronLeft, ChevronRight, ArrowLeft, Loader2 } from "lucide-react";

interface SizeMeasurement {
  chest?: string;
  waist?: string;
  hip?: string;
  length?: string;
}

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState(0);
  const [selectedSize, setSelectedSize] = useState(0);
  const [currentUrl, setCurrentUrl] = useState("");
  const [sizeMeasurements, setSizeMeasurements] = useState<Record<string, SizeMeasurement>>({});

  useEffect(() => {
    setCurrentUrl(window.location.href);
  }, []);

  useEffect(() => {
    async function fetchProduct() {
      setLoading(true);
      const { data, error } = await supabase
        .from('SKU_details')
        .select(`
          *,
          SKU_variations (
            color,
            size,
            hip,
            waist,
            length,
            chest
          ),
          SKU_images (
            imageurl,
            imageIndex
          )
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching product:', error);
        setProduct(null);
      } else if (data) {
          const variations = data.SKU_variations || [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const uniqueColors = Array.from(new Set(variations.map((v: any) => v.color).filter(Boolean))) as string[];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const uniqueSizes = Array.from(new Set(variations.map((v: any) => v.size).filter(Boolean))) as string[];
          
          const measurements: Record<string, SizeMeasurement> = {};
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          variations.forEach((v: any) => {
            if (v.size && !measurements[v.size]) {
              measurements[v.size] = {
                chest: v.chest,
                waist: v.waist,
                hip: v.hip,
                length: v.length
              };
            }
          });
          setSizeMeasurements(measurements);

          const images = data.SKU_images
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ?.sort((a: any, b: any) => (a.imageIndex || 0) - (b.imageIndex || 0))
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((img: any) => img.imageurl) || [];

          setProduct({
            id: data.id.toString(),
            sku: data.SKU,
            name: data.SKU, // Fallback to SKU as name
            price: data.regular_price || 0,
            originalPrice: undefined,
            description: data.remark || "",
            images: images.length > 0 ? images : ["/placeholder.svg"],
            colors: uniqueColors,
            sizes: uniqueSizes,
            category: data.type || "其他",
            isNew: false, 
            isSale: !!data.special_discount,
            madeInKorea: data.madeinkorea,
            date: data.SKU_date ? new Date(data.SKU_date) : (data.created_at ? new Date(data.created_at) : undefined)
          });
      }
      setLoading(false);
    }
    fetchProduct();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#C4A59D]" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">商品未找到</h1>
          <Button asChild>
            <Link href="/">返回首頁</Link>
          </Button>
        </main>
      </div>
    );
  }

  const whatsappLink = `https://wa.me/85212345678?text=${encodeURIComponent(
    `您好，我想諮詢以下商品：${currentUrl}`
  )}`;

  const nextImage = () => {
    setSelectedImage((prev) => (prev + 1) % product.images.length);
  };

  const prevImage = () => {
    setSelectedImage((prev) =>
      prev === 0 ? product.images.length - 1 : prev - 1
    );
  };

  const currentSizeName = product.sizes[selectedSize];
  const currentMeasurements = sizeMeasurements[currentSizeName];

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 pt-8 pb-32">
        {/* Breadcrumb */}
        <div className="mb-6">
          <button
            onClick={() => window.close()}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-[#C4A59D] transition-colors bg-transparent border-0 p-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            關閉頁面
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Image Gallery */}
          <div className="space-y-4">
            <Dialog>
              <DialogTrigger asChild>
                <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted cursor-zoom-in group">
                  <Image
                    src={product.images[selectedImage] || "/placeholder.svg"}
                    alt={product.name}
                    fill
                    className="object-cover object-top transition-transform duration-300 group-hover:scale-105"
                  />
                  {product.images.length > 1 && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          prevImage();
                        }}
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 flex items-center justify-center hover:bg-white transition-colors z-10"
                      >
                        <ChevronLeft className="w-5 h-5" />
                        <span className="sr-only">上一張</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          nextImage();
                        }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 flex items-center justify-center hover:bg-white transition-colors z-10"
                      >
                        <ChevronRight className="w-5 h-5" />
                        <span className="sr-only">下一張</span>
                      </button>
                    </>
                  )}
                  <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
                    {product.isNew && (
                      <Badge className="bg-[#C4A59D] text-white">
                        新品
                      </Badge>
                    )}
                    {product.isSale && <Badge variant="destructive">特價</Badge>}
                    {product.madeInKorea && (
                      <Badge variant="outline" className="border-[#C4A59D] text-[#C4A59D] bg-white/90">
                        🇰🇷 Made in Korea
                      </Badge>
                    )}
                  </div>
                </div>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] h-[90vh] p-0 border-none bg-black/90">
                 <div className="sr-only">
                    <DialogTitle>{product.name} - Full View</DialogTitle>
                 </div>
                 <div className="relative w-full h-full flex items-center justify-center">
                   <Image 
                     src={product.images[selectedImage] || "/placeholder.svg"} 
                     alt={product.name} 
                     fill 
                     className="object-contain" 
                     sizes="95vw"
                   />
                   <button
                        onClick={(e) => {
                          e.stopPropagation();
                          prevImage();
                        }}
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                      >
                        <ChevronLeft className="w-8 h-8" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          nextImage();
                        }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                      >
                        <ChevronRight className="w-8 h-8" />
                      </button>
                 </div>
              </DialogContent>
            </Dialog>
            {/* Thumbnails */}
            {product.images.length > 1 && (
              <div className="flex gap-2">
                {product.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`relative w-20 h-24 rounded-md overflow-hidden border-2 transition-colors ${
                      selectedImage === index
                        ? "border-[#C4A59D]"
                        : "border-transparent"
                    }`}
                  >
                    <Image
                      src={image || "/placeholder.svg"}
                      alt={`${product.name} ${index + 1}`}
                      fill
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                {product.date && (
                  <p className="text-sm text-foreground">
                    <span className="font-medium">上架日期：</span>
                    {product.date instanceof Date 
                      ? product.date.toISOString().split('T')[0] 
                      : new Date(product.date).toISOString().split('T')[0]}
                  </p>
                )}
                <div className="flex gap-2">
                  {product.isSale && <Badge variant="destructive">特價</Badge>}
                  {product.madeInKorea && (
                    <Badge variant="outline" className="border-[#C4A59D] text-[#C4A59D]">
                      🇰🇷 Made in Korea
                    </Badge>
                  )}
                </div>
              </div>
              <h1 className="text-xl font-bold text-foreground mb-4">
                貨號: {product.sku}
              </h1>
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold text-[#C4A59D]">
                  HK${product.price.toLocaleString()}
                </span>
                {product.originalPrice && (
                  <span className="text-xl text-muted-foreground line-through">
                    HK${product.originalPrice.toLocaleString()}
                  </span>
                )}
              </div>
            </div>

            <p className="text-muted-foreground leading-relaxed">
              {product.description}
            </p>

            {/* Color Selection */}
            <div>
              <h3 className="text-sm font-medium text-foreground mb-3">
                顏色：{product.colors[selectedColor]}
              </h3>
              <div className="flex flex-wrap gap-2">
                {product.colors.map((color, index) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(index)}
                    className={`px-4 py-2 rounded-md border text-sm transition-colors ${
                      selectedColor === index
                        ? "border-[#C4A59D] bg-[#C4A59D]/10 text-[#C4A59D]"
                        : "border-border text-foreground hover:border-[#C4A59D] hover:text-[#C4A59D]"
                    }`}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>

            {/* Size Selection */}
            <div>
              <h3 className="text-sm font-medium text-foreground mb-3">
                尺寸：{product.sizes[selectedSize]}
              </h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {product.sizes.map((size, index) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(index)}
                    className={`w-12 h-12 rounded-md border text-sm font-medium transition-colors ${
                      selectedSize === index
                        ? "border-[#C4A59D] bg-[#C4A59D] text-white"
                        : "border-border text-foreground hover:border-[#C4A59D] hover:text-[#C4A59D]"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>

               {/* Measurements Display */}
               {currentMeasurements && (
                <div className="bg-muted/50 rounded-lg p-4 text-sm mt-3">
                  <h4 className="font-medium text-foreground mb-2">尺寸詳情 (cm):</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {currentMeasurements.chest && (
                       <div className="flex justify-between">
                         <span className="text-muted-foreground">胸圍:</span>
                         <span className="font-medium">{currentMeasurements.chest}</span>
                       </div>
                    )}
                    {currentMeasurements.waist && (
                       <div className="flex justify-between">
                         <span className="text-muted-foreground">腰圍:</span>
                         <span className="font-medium">{currentMeasurements.waist}</span>
                       </div>
                    )}
                    {currentMeasurements.hip && (
                       <div className="flex justify-between">
                         <span className="text-muted-foreground">臀圍:</span>
                         <span className="font-medium">{currentMeasurements.hip}</span>
                       </div>
                    )}
                    {currentMeasurements.length && (
                       <div className="flex justify-between">
                         <span className="text-muted-foreground">衣長:</span>
                         <span className="font-medium">{currentMeasurements.length}</span>
                       </div>
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </main>

      {/* Sticky WhatsApp Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur border-t border-border z-50">
        <Button
          asChild
          size="lg"
          className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white"
        >
          <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="w-5 h-5 mr-2" />
            WhatsApp 諮詢
          </a>
        </Button>
      </div>
    </div>
  );
}
