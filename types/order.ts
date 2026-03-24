export interface RestockVariation {
  // RPC output shape (required fields)
  variation_id: number
  size: string
  color: string
  current_stock: number
  current_quota?: number

  // Optional UI/backwards-compatible aliases
  // `id` may be present for components that expect a string id
  id: string
  // legacy quantity field used across the UI
  currentQty?: number
  waitlist?: number
  waitlistOrders?: any[]
}

export interface OrderLineItem {
  line_item_id?: string
  created_at?: string
  customer_name_snapshot?: string
  whatsapp_snapshot?: string
  email?: string | null
  sku_id?: number | null
  variation_id?: number | null
  sku_code_snapshot?: string | null
  variation_snapshot?: string | null
  price?: number
  status?: string
  payment_proof_url?: string | null
  payment_method?: string | null
  verified_at?: string | null
  remark?: string | null
  payment_deadline?: string | null
  deadline?: string | null
  receipt_url?: string | null
  order_number?: string
  quantity?: number
  qty?: number
  shipment_id?: string | null
  confirmed_at?: string | null
  paid_at?: string | null
  transaction_id?: string | null
  shipped_at?: string | null
  customer_id?: string
  sku_code?: string
  variation_text?: string
  main_image?: string | null
  // UI-friendly aliases
  thumbnail?: string | null
  imageUrl?: string | null
}

export interface OrderGroup {
  order_number?: string
  order_total?: number
  order_total_amount?: number
  transaction_id?: string | null
  payment_deadline?: string | null
  status?: string
  payment_proof_url?: string | null
  items?: OrderLineItem[]
}

// New types to match the `search_customer_history` RPC / UI usage


export interface TimelineGroup {
  group_id?: string
  group_date?: string
  group_type?: string | null
  group_status?: string | null
  group_total?: number | null
  shipment_id?: string | null
  group_id_type?: string | null
}

export interface SearchCustomerHistoryResponse {
  data: Array<{
    phone?: string | null
    customer_id?: string | null
    customer_name?: string | null
    timeline_groups?: TimelineGroup[]
    has_more_history?: boolean
    total_matching_groups?: number | null
  }>
  metadata?: {
    per_page?: number
    total_pages?: number
    current_page?: number
    result_range?: string
    total_results?: number
  }
  status_counts?: Record<string, number>
}



export interface ActiveCustomerRecords {
  customer_info: {
    phone?: string | null
    customer_id?: string | null
    customer_name?: string | null
  }
  // RPC shape: maps status -> object containing orders array and status_total
  orders_by_status: Record<string, {
    orders: OrderGroup[]
    status_total: number
  }>
}

// Backwards-compat alias (updated name preferred)
export type BulkCustomerOrderRecord = ActiveCustomerRecords

// UI component types used by `OrderCard`
export type OCItem = {
  price?: number
  status?: string
  item_id?: string
  remarks?: string | null
  remark?: string | null
  quantity?: number
  sku_code?: string
  sku?: string
  thumbnail?: string | null
  imageUrl?: string | null
  variation?: string
}

export type OCOrder = {
  order_number?: string
  order_total_items?: number
  order_total_amount?: number
  order_total?: number
  order_status?: string
  items?: OCItem[]
}

export default {} as const

// Types for RPC `get_active_reels_skus`
export interface ActiveReelsSkuItem {
  id: number
  SKU: string
  type: string | null
  thumbnail: string | null
  created_at: string
  regular_price: number | null
  is_upsell_item: boolean
  reels_deadline: string | null
  reels_video_url: string | null
  shipping_surcharge: number | null
  is_discount_eligible: boolean
  [key: string]: any
}

export interface ActiveReelsSkusResponse {
  data: ActiveReelsSkuItem[]
  metadata: {
    per_page: number
    total_pages: number
    current_page: number
    result_range: string
    total_results: number
  }
}

// Shared RPC / UI types used across order modals
export type Item = {
  price?: number
  status?: string
  item_id?: string
  line_item_id?: string
  sku_id?: number
  variation_id?: number
  remark?: string | null
  remarks?: string | null
  quantity?: number
  sku_code?: string
  thumbnail?: string | null
  main_image?: string | null
  variation?: string | null
  variation_text?: string | null
}

export type Order = {
  order_number?: string
  order_total_items?: number
  order_total_amount?: number
  order_total?: number
  order_status?: string
  transaction_id?: string
  items?: Item[]
}

export type RpcResponse = {
  orders?: Order[]
  orders_by_status?: Record<string, any[]>
  action_blocks?: any[]
  summary?: any
  customer_info?: {
    phone?: string
    customer_id?: string
    customer_name?: string
  }
  whatsapp?: string
  customer_name?: string
  grand_total_items?: number
  grand_total_amount?: number
  // total amount for waitlist / aggregated groups
  order_total?: number
  // optional ordering/priority list from RPC
  status_priority?: string[]
  total_orders_count?: number
}

/**
 * Response shape for RPC `get_customer_order_history` used by the order-history page
 */
export interface CustomerOrderHistoryItem {
  id: string
  price: number
  status: string
  quantity: number
  sku_code: string
  image_url: string
  variation: string
  created_at: string
  order_number: string
  transaction_id: string
  payment_deadline?: string | null
  requires_payment: boolean
}

export interface CustomerOrderHistoryEntry {
  base_order_no: string
  items: CustomerOrderHistoryItem[]
}

export interface CustomerOrderHistoryResponse {
  history: CustomerOrderHistoryEntry[]
  success: boolean
  whatsapp: string
  total_orders: number
  customer_name: string
  transaction_id?: string | null
}

// Response shape for RPC `get_single_order_details(p_customer_id UUID, p_reference_id TEXT)`
export interface SingleOrderLineItem {
  price?: number
  remark?: string | null
  status?: string | null
  quantity?: number
  sku_code?: string | null
  main_image?: string | null
  line_item_id?: string
  variation_text?: string | null
  [key: string]: any
}

export interface SingleOrder {
  items: SingleOrderLineItem[]
  order_total?: number
  order_number?: string
  order_item_count?: number
  [key: string]: any
}

export interface SingleOrderDetailsResponse {
  orders: SingleOrder[]
  summary?: {
    total_orders?: number
    [key: string]: any
  }
  reference_id?: string
  customer_info?: {
    phone?: string | null
    customer_id?: string | null
    customer_name?: string | null
  }
}

