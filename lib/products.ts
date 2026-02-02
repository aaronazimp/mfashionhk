export interface Product {
  id: string;
  sku: string;
  name: string;
  price: number;
  originalPrice?: number;
  description: string;
  images: string[];
  colors: string[];
  sizes: string[];
  category: string;
  isNew?: boolean;
  isSale?: boolean;
  reelsUrl?: string; // Instagram Reels URL
  videoUrl?: string; // YouTube/Other Video URL
  deadline?: string; // Order deadline
  totalQuota?: number;
  date?: Date; // Added for SKU_date
  madeInKorea?: boolean;
}

import mockSkus from './mock-skus';

export const products: Product[] = [
  {
    id: "1",
    sku: "20260124M01",
    name: "優雅絲綢連衣裙",
    price: 1280,
    originalPrice: 1680,
    description: "採用頂級絲綢面料，優雅垂墜的剪裁設計，適合各種正式場合。柔軟舒適的質感，展現女性的優雅氣質。",
    images: [
      "/placeholder.svg?height=600&width=400",
      "/placeholder.svg?height=600&width=400",
      "/placeholder.svg?height=600&width=400",
    ],
    colors: ["米白", "藕粉", "淺灰"],
    sizes: ["S", "M", "L", "XL"],
    category: "連衣裙",
    isNew: true,
    isSale: true,
  },
  {
    id: "2",
    sku: "20260124M02",
    name: "經典羊絨大衣",
    price: 3680,
    description: "100%純羊絨，經典雙排扣設計，保暖舒適，展現都市時尚風格。",
    images: [
      "/placeholder.svg?height=600&width=400",
      "/placeholder.svg?height=600&width=400",
    ],
    colors: ["駝色", "黑色", "深藍"],
    sizes: ["S", "M", "L"],
    category: "外套",
    isNew: true,
  },
  {
    id: "3",
    sku: "20260124M03",
    name: "法式蕾絲上衣",
    price: 880,
    description: "精緻蕾絲工藝，透氣舒適，展現女性柔美氣質。",
    images: [
      "/placeholder.svg?height=600&width=400",
      "/placeholder.svg?height=600&width=400",
    ],
    colors: ["白色", "黑色"],
    sizes: ["S", "M", "L", "XL"],
    category: "上衣",
  },
  {
    id: "4",
    sku: "20260124M04",
    name: "高腰闊腿褲",
    price: 980,
    originalPrice: 1280,
    description: "高腰設計拉長腿部線條，闊腿剪裁舒適優雅。",
    images: [
      "/placeholder.svg?height=600&width=400",
      "/placeholder.svg?height=600&width=400",
    ],
    colors: ["黑色", "卡其", "深灰"],
    sizes: ["S", "M", "L", "XL"],
    category: "褲裝",
    isSale: true,
  },
  {
    id: "5",
    sku: "20260124M05",
    name: "印花雪紡裙",
    price: 780,
    description: "輕盈雪紡面料，優美印花設計，飄逸動人。",
    images: [
      "/placeholder.svg?height=600&width=400",
      "/placeholder.svg?height=600&width=400",
    ],
    colors: ["碎花", "純色"],
    sizes: ["S", "M", "L"],
    category: "裙裝",
  },
  {
    id: "6",
    sku: "20260124M06",
    name: "簡約針織衫",
    price: 680,
    description: "柔軟針織面料，百搭款式，四季皆宜。",
    images: [
      "/placeholder.svg?height=600&width=400",
      "/placeholder.svg?height=600&width=400",
    ],
    colors: ["米白", "淺粉", "淺藍", "黑色"],
    sizes: ["S", "M", "L", "XL"],
    category: "上衣",
    isNew: true,
  },
];

export function getProductById(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

export function getProductBySku(sku: string): Product | undefined {
  return products.find((p) => p.sku === sku);
}

export function updateProductBySku(sku: string, update: Partial<Product>): Product | undefined {
  const p = getProductBySku(sku);
  if (!p) return undefined;
  Object.assign(p, update);
  return p;
}

// In development, include mock SKUs to make testing easier
if (process.env.NODE_ENV !== 'production') {
  try {
    products.push(...mockSkus);
  } catch (e) {
    // ignore
  }
}
