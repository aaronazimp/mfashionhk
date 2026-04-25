

// Types for RPC `get_single_sku_details`
export interface SingleSkuImage {
  imageurl: string
  imageIndex: number
}

export interface SingleSkuColor {
  id: number
  color: string
  raw_quota: number
  total_available: number
  calculated_stock: number
  remaining_preorder_spots: number

  [key: string]: any
}

export interface SingleSkuVariation {
  size: string | null
  hip: string | null
  chest: string | null
  waist: string | null
  length: string | null
  colors: SingleSkuColor[]
  [key: string]: any
}

export interface SingleSkuDetails {
  id: number
  SKU: string
  type: string | null
  images: SingleSkuImage[]
  remark: string | null
  SKU_date: string | null
  created_at: string | null
  variations: SingleSkuVariation[]
  madeinkorea: boolean
  regular_price: number | null
  is_upsell_item: boolean
  reels_deadline: string | null
  reels_video_url: string | null
  special_discount: boolean
  shipping_surcharge: number | null
  is_discount_eligible: boolean
  [key: string]: any
}

// Type for RPC `get_sku_details_for_drawer(p_sku_id BIGINT)`
export interface SkuDetailsForDrawer {
  id: number
  SKU: string
  type: string | null
  images: Array<{
    url: string
    index: number
  }>
  remark?: string
  variations?: Array<{
    size?: string
    options: Array<{
      id: number
      color?: string
      stock?: number
      [key: string]: any
    }>
  }>
  madein_korea?: boolean
  regular_price?: number | null
  reels_deadline?: string | null
  shipping_surcharge?: number | null
  is_discount_eligible?: boolean
  [key: string]: any
}

// Types for RPC `get_cart_and_upsellitems(p_session_token TEXT)`
export interface CartRpcItem {
  SKU: string
  size?: string | null
  color?: string | null
  remark?: string | null
  sku_id?: number | string
  status?: string | null
  quantity?: number
  expires_at?: string | null
  main_image?: string | null
  cart_item_id?: string | null
  regular_price?: number | null
  effective_price?: number | null
  is_cart_addon?: boolean
  is_upsell_item?: boolean
  is_discount_eligible?: boolean
  [key: string]: any
}

export interface UpsellRpcItem {
  id: number | string
  SKU: string
  main_image?: string | null
  regular_price?: number | null
  is_discount_eligible?: boolean
  [key: string]: any
}

export interface CustomerProfileRpc {
  name?: string | null
  address?: string | null
  whatsapp?: string | null
  [key: string]: any
}

export interface GetCartAndUpsellItemsResponse {
  cart_items: CartRpcItem[]
  cart_total: number
  upsell_items: UpsellRpcItem[]
  customer_profile?: CustomerProfileRpc | null
  [key: string]: any
}

// Types for payment page RPC `get_payment_page_data(p_transaction_id TEXT)`
export interface PaymentPageItem {
  id: string
  price: number
  remark?: string | null
  status?: string
  quantity?: number
  sku_code?: string
  image_url?: string | null
  row_total?: number
  variation?: string | null
  is_in_current_txn?: boolean
  shipping_surcharge?: number | null
  [key: string]: any
}

export interface PaymentPageOrder {
  transaction_id?: string
  order_number?: string
  created_at?: string
  subtotal?: number
  shipping_fee?: number
  total_to_pay?: number
  customer_name?: string
  status?: string
  receipt_url?: string | null
  base64_image?: string | null
  whatsapp?: string | null
  payment_proof_url?: string | null
  deadline?: string | null
  payment_deadline?: string | null

  // `orders` groups items by original order number (RPC: "orders": {"order_number": [...]})
  orders?: Record<string, PaymentPageItem[]>

  // Discounts / original subtotal from RPC
  total_discount?: number
  original_subtotal?: number

  // Items grouped by original order number
  pay_now_groups?: Record<string, PaymentPageItem[]>

  items_pay_now?: PaymentPageItem[]
  items_waitlist?: PaymentPageItem[]
  items_cancelled?: PaymentPageItem[]

  // Legacy / convenience fields
  price?: number
  product_name?: string
  sku?: string
  sku_img_url?: string
  sku_code_snapshot?: string
  variation_snapshot?: string
  quantity?: number
  items?: Array<{
    id: string
    sku?: string
    price?: number
    quantity?: number
    variation?: string
    row_total?: number
    sku_img_url?: string
    status?: string
    expires_at?: string | null
    [key: string]: any
  }>

  [key: string]: any
}

// Shared `Product` type kept for compatibility with existing UI components.
export interface Product {
  id: string | number
  sku: string
  name: string
  price: number
  originalPrice?: number
  description?: string
  images: string[]
  colors: string[]
  sizes: string[]
  category?: string
  isNew?: boolean
  isSale?: boolean
  reelsUrl?: string | null
  videoUrl?: string | null
  deadline?: string | Date | null
  totalQuota?: number
  date?: string | Date | null
  madeInKorea?: boolean
  rawRpc?: any
  [key: string]: any
}

// Minimal stub for updating a product by SKU. This repository previously
// had an in-memory helper; keep a small stub so API routes that import
// `updateProductBySku` continue to compile. Implement proper persistence
// elsewhere as needed.
export function updateProductBySku(originalSku: string, update: Partial<Product>): Product | null {
  // No-op stub: return null to indicate SKU not found.
  return null
}


