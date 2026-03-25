// Types for RPC `get_customer_all_order_history` response

export interface OrderSummary {
  item_count: number
  order_date: string
  order_total: number
  shipment_id: string | null
  order_number: string
  current_status: string
  transaction_id: string | null
}

export interface OrdersMetadata {
  showing_to: number
  total_pages: number
  current_page: number
  showing_from: number
  total_results: number
}

export interface CustomerInfo {
  whatsapp: string
  customer_id: string
  customer_name: string
  default_address?: string | null
}

export interface LifetimeStats {
  total_spent: number
  total_cancelled: number
  total_order_count: number
}

export interface HistoryRecord {
  group_id: string
  group_date: string
  group_type: 'transaction' | 'order' | 'shipment' | string
  item_count: number
  group_total: number
  shipment_id: string | null
  order_numbers: string[]
  dominant_status: string
  transaction_ids: string[]
}

export interface CustomerOrdersResponse {
  metadata: OrdersMetadata
  customer_info: CustomerInfo
  lifetime_stats: LifetimeStats
  history_records: HistoryRecord[]
}

export default {} as const
