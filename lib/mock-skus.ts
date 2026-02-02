import type { Product } from './products';

// Helper function to generate mock products
const generateMockProducts = (count: number): Product[] => {
  const products: Product[] = [];
  const categories = ['連衣裙', '外套', '上衣', '褲裝', '裙子', '飾品'];
  const colors = ['白色', '黑色', '粉色', '藍色', '紅色', '駝色', '灰色', '米色', '綠色', '紫色'];
  const sizes = ['XS', 'S', 'M', 'L', 'XL'];
  const materials = ['棉', '麻', '絲', '羊毛', '聚酯纖維'];

  for (let i = 0; i < count; i++) {
    const id = (100 + i).toString();
    const sku = `TEST-2026-${String(i + 1).padStart(3, '0')}`;
    const category = categories[i % categories.length];
    // Use deterministic price calculation instead of random to avoid hydration mismatch
    const basePrice = 500 + ((i * 137) % 3000);
    const hasDiscount = i % 3 === 0; // Every 3rd item is on sale

    products.push({
      id,
      sku,
      name: `測試款 ${category} ${String.fromCharCode(65 + (i % 26))}${i}`,
      price: hasDiscount ? Math.floor(basePrice * 0.8) : basePrice,
      originalPrice: hasDiscount ? basePrice : undefined,
      description: `這是一件精美的${category}，採用優質${materials[i % materials.length]}製作。編號 ${i + 1}`,
      images: [`/placeholder.svg?height=600&width=400&text=${category}+${i+1}`],
      colors: [colors[i % colors.length], colors[(i + 3) % colors.length]],
      sizes: sizes.slice(i % 2, (i % 2) + 3),
      category,
      isNew: i < 5,
      isSale: hasDiscount,
    });
  }
  return products;
};

export const mockSkus: Product[] = generateMockProducts(50);

export default mockSkus;
