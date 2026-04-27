export interface WaitlistOrder {
  // new RPC uses `id` (uuid) but keep `order_id` for backwards-compat
  id?: string
  order_id?: string
  created_at: string
  order_number?: string
  customer_name?: string | null
  // new field names from RPC
  quantity?: number
  quantity_needed?: number
  sku_id?: number
  variation_id?: number
  whatsapp?: string | null
  transaction_id?: string | null
  sku_code_snapshot?: string | null
  variation_snapshot?: string | null
  [key: string]: any
}

export interface RestockColor {
  color: string
  // number of items ordered for this color/variation (RPC)
  ordered_qty?: number
  // quota assigned for reels
  reels_quota: number
  // aggregated orders count for this variation (RPC)
  orders_count?: number
  variation_id: number
  // current physical stock for this variation
  current_stock: number
  waitlist_count?: number
  // available quantity reported by RPC (may be 0)
  available_qty?: number
  // quantity currently on the waitlist for this variation
  waitlist_qty?: number
  // quantity already confirmed for this variation
  confirmed_qty?: number
  // counts of orders on waitlist / confirmed
  waitlist_orders_count?: number
  confirmed_orders_count?: number
    calculated_stock?: number
    total_waitlist_orders?: number
    remaining_preorder_spots?: number
  [key: string]: any
}

export interface RestockSize {
  size: string
  colors: RestockColor[]
}

export interface RestockSku {
  sizes: RestockSize[]
  sku_code: string
  main_preview_image?: string | null
  total_orders_count?: number
  // new RPC field name for total ordered across SKU
  total_sku_ordered?: number
  // keep legacy field for backwards-compat
  total_sku_waitlist?: number
  total_variation_count?: number
  [key: string]: any
}

// Backwards-compatible representation for places that expect a single variation
export interface RestockVariation {
  variation_id: number
  // remaining available preorder spots reported by RPC
  remaining_preorder_spots?: number
  size?: string
  color: string
  // current physical stock for this variation (RPC)
  current_stock: number
  // SKU id for this variation (RPC)
  sku_id?: number
  // optional raw/quota fields returned by processBulkRestock
  raw_quota?: number
  raw_stock?: number
  total_available?: number
  total_waitlist_orders?: number
  // number of items ordered for this variation (RPC)
  ordered_qty?: number
  // aggregated orders count for this variation (RPC)
  orders_count?: number
  // available quantity reported by RPC
  available_qty?: number
  // quantity currently on the waitlist for this variation
  waitlist_qty?: number
  // quantity already confirmed for this variation
  confirmed_qty?: number
  // counts of orders on waitlist / confirmed
  waitlist_orders_count?: number
  confirmed_orders_count?: number
  current_quota?: number

  reels_quota?: number
  waitlist_count?: number
  // keep legacy aliases for older UI code
  // `id` is a string in UI code (use string to avoid casting at call sites)
  id: string
  currentQty?: number
  waitlist?: number
  waitlistOrders?: any[]
  // newer field matching RPC
  waitlist_orders?: WaitlistOrder[]
  // calculated stock value mapped from server responses
  calculated_stock?: number
}

// Wrapper shape returned by the RPC: an array of objects each containing
// `get_restock_allocation_data` with the allocation payload.
export interface RestockAllocationData {
  sizes: RestockSize[]
  sku_code: string
  main_preview_image?: string | null
  // counts across the SKU
  total_variation_count?: number
  total_sku_waitlist_qty?: number
  total_sku_confirmed_qty?: number
  total_waitlist_orders_count?: number
  total_confirmed_orders_count?: number
  // array of waitlist orders returned by RPC
  waitlist_orders?: WaitlistOrder[]
  [key: string]: any
}

export interface RestockAllocationItem {
  get_restock_allocation_data: RestockAllocationData
}

export type RestockAllocationResponse = RestockAllocationItem[]

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
  is_waitlist_item?: boolean
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
  is_customer_created?: boolean
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





// Pagination metadata used by multiple RPC responses
export interface PaginationMetadata {
  per_page?: number
  total_pages?: number
  current_page?: number
  result_range?: string
  total_results?: number
  total_customers?: number
}

// Shape of a single master-order list row returned by `get_master_order_list` RPC
export interface MasterOrderItem {
  order_number?: string
  status?: string | null
  transaction_id?: string | null
  order_total?: number | null
  payment_deadline?: string | null
  is_customer_created?: boolean
  [key: string]: any
}

export interface MasterOrderRow {
  customer_id?: string | null
  phone?: string | null
  customer_name?: string | null
  // RPC sometimes returns `items`; we normalise them into `orders`
  items?: MasterOrderItem[]
  orders?: MasterOrderItem[]
  matching_action_count?: number | null
  matching_order_count?: number | null
  [key: string]: any
}

// Normalised response from `get_master_order_list`
export interface MasterOrderListResponse {
  data: MasterOrderRow[]
  metadata?: PaginationMetadata
  status_counts?: Record<string, number>
}

// New customer transactions output shape (matches provided example)
export interface TransactionOrder {
  items: OrderLineItem[]
  order_total?: number
  order_number?: string
  order_status?: string
  order_item_count?: number
  [key: string]: any
}

export interface Transaction {
  orders: TransactionOrder[]
  total_items?: number
  total_orders?: number
  transaction_id?: string
  payment_proof_url?: string | null
  transaction_total?: number
  transaction_status?: string
  transaction_group_id?: string
  [key: string]: any
}

export interface BulkCustomerOrderRecord {
  transactions: Transaction[]
  customer_info: {
    phone?: string | null
    customer_id?: string | null
    customer_name?: string | null
  }
  // Optional shape returned by some RPCs / UI code: map of buckets to orders
  orders_by_status?: Record<string, any>
}

// Backwards-compatible alias: map `ActiveCustomerRecords` to the newer `RpcResponse`
export type ActiveCustomerRecords = RpcResponse



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
  is_waitlist_item?: boolean
  waitlist_filled_at?: string | null
  restock_notified_at?: string | null
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
  madeinkorea: boolean
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
  is_waitlist_item?: boolean
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
    phone?: string | null
    customer_id?: string | null
    customer_name?: string | null
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
  // some RPC responses (bulk endpoints) include transaction lists
  transactions?: Transaction[]
  [key: string]: any
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
  payment_proof_url?: string | null
}

/**
 * Response shape for RPC `get_customer_all_order_history(p_customer_id UUID, p_page INT, p_page_size INT)`
 */
export interface CustomerAllOrderHistoryResponse {
  data: CustomerOrderHistoryEntry[] | CustomerOrderHistoryItem[]
  metadata?: {
    per_page?: number
    total_pages?: number
    current_page?: number
    total_results?: number
  }
  success?: boolean
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

