// src/services/orderService.ts
import { supabase } from '@/lib/supabase'; // Adjust this path to your Supabase client

import type { OrderLineItem, OrderGroup, ActiveCustomerRecords, CustomerOrderHistoryResponse } from '@/types/order'
import type { CustomerOrdersResponse } from '@/types/orders'
import type { SingleSkuDetails } from '@/lib/products'


// Also in src/services/orderService.ts

/**
 * Fetches the deeply nested active orders for an array of customers.
 * @param customerIds - Array of Customer UUIDs
 * @param statusFilter - Optional status string (defaults to 'all')
 */
export async function fetchBulkCustomerOrders(
  customerIds: string[], 
  statusFilter: string = 'all'
): Promise<ActiveCustomerRecords[]> {
  
  // Safety check to prevent empty array errors
  if (!customerIds || customerIds.length === 0) return [];

  const { data, error } = await supabase.rpc('get_bulk_customer_active_orders', {
    p_customer_ids: customerIds,
    p_status_filter: statusFilter
  });

  if (error) {
    console.error("Error fetching bulk orders:", error);
    throw new Error(error.message);
  }

  // Supabase returns 'any', so we cast it to our beautiful TypeScript interface
  return data as ActiveCustomerRecords[];
}

/**
 * Fetch active orders for a single customer via RPC `get_customer_active_orders`.
 * Returns the raw RPC response (may be array-wrapped depending on supabase).
 */
export async function getCustomerActiveOrders(
  p_customer_id: string,
  p_priority_status?: string | null
): Promise<any> {
  const rpcArgs: Record<string, any> = { p_customer_id }
  if (typeof p_priority_status !== 'undefined') rpcArgs.p_priority_status = p_priority_status ?? null

  const { data, error } = await supabase.rpc('get_customer_active_orders', rpcArgs)

  if (error) {
    console.error('get_customer_active_orders RPC error:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Fetch all orders for a customer via RPC `get_all_customer_orders`.
 * Defaults `p_priority_status` to 'shipped'.
 */
export async function getAllCustomerOrders(
  p_customer_id: string,
  p_priority_status: string = 'shipped'
): Promise<any> {
  const rpcArgs: Record<string, any> = { p_customer_id }
  if (typeof p_priority_status !== 'undefined') rpcArgs.p_priority_status = p_priority_status ?? null

  const { data, error } = await supabase.rpc('get_all_customer_orders', rpcArgs)

  if (error) {
    console.error('get_all_customer_orders RPC error:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Fetch customer order history via RPC `get_customer_order_history(p_whatsapp TEXT, p_transaction_id TEXT)`.
 */
export async function getCustomerOrderHistory(
  p_whatsapp: string,
  p_transaction_id: string
): Promise<CustomerOrderHistoryResponse> {
  const { data, error } = await supabase.rpc('get_customer_order_history', {
    p_whatsapp,
    p_transaction_id,
  })

  if (error) {
    console.error('get_customer_order_history RPC error:', error)
    throw new Error(error.message)
  }

  return data as CustomerOrderHistoryResponse
}

/**
 * Fetch paginated full order history for a customer via RPC `get_customer_all_order_history(p_customer_id UUID, p_page INT, p_page_size INT)`.
 */
export async function getCustomerAllOrderHistory(
  p_customer_id: string,
  p_page: number = 1,
  p_page_size: number = 20
): Promise<CustomerOrdersResponse> {
  const { data, error } = await supabase.rpc('get_customer_all_order_history', {
    p_customer_id,
    p_page,
    p_page_size,
  })

  if (error) {
    console.error('get_customer_all_order_history RPC error:', error)
    throw new Error(error.message)
  }

  return data as CustomerOrdersResponse
}

/**
 * Fetch payment page data for a transaction via RPC `get_payment_page_data(p_transaction_id TEXT, p_whatsapp TEXT)`.
 */
export async function getPaymentPageData(
  p_transaction_id: string,
  
): Promise<any> {
  const { data, error } = await supabase.rpc('get_payment_page_data', {
    p_transaction_id,
  })

  if (error) {
    console.error('get_payment_page_data RPC error:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Call RPC to move allocated -> confirmed for a single customer
 */
export async function processAllocatedToConfirmed(
  customerId: string
): Promise<any> {
  const { data, error } = await supabase.rpc('process_allocated_to_confirmed', {
    p_customer_id: customerId,
  })

  if (error) {
    console.error('process_allocated_to_confirmed RPC error:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Revert previously processed customer back to allocated (best-effort)
 */
export async function revertAllocatedToConfirmed(
  customerId: string
): Promise<any> {
  const { data, error } = await supabase.rpc('revert_allocated_to_confirmed', {
    p_customer_id: customerId,
  })

  if (error) {
    console.error('revert_allocated_to_confirmed RPC error:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Reverse a confirmed order: either undo (revert the confirmation) or cancel the order.
 * RPC: reverse_confirmed_order(p_customer_id UUID, p_transaction_id TEXT, p_action TEXT)
 * p_action must be exactly 'undo' or 'cancel'
 */
export async function reverseConfirmedOrder(
  customerId: string,
  transactionId: string | null,
  action: 'undo' | 'cancel'
): Promise<any> {
  const { data, error } = await supabase.rpc('reverse_confirmed_order', {
    p_customer_id: customerId,
    p_transaction_id: transactionId ?? null,
    p_action: action,
  })

  if (error) {
    console.error('reverse_confirmed_order RPC error:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Cancel a single order item (reels_orders row) by id.
 * Sets `status = 'cancelled'` and `remark = '管理員手動取消'`.
 */
export async function cancelOrderItem(itemId: string): Promise<any> {
  const { data, error } = await supabase
    .from('reels_orders')
    .update({ status: 'cancelled', remark: '管理員手動取消' })
    .eq('id', itemId)

  if (error) {
    console.error('cancelOrderItem error:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Mark a single order item as `pre_pending_to_ship` in `reels_orders`.
 */
export async function markOrderItemPrePendingToShip(itemId: string): Promise<any> {
  // Debug: log the incoming id so we can trace why updates may not apply
  console.debug('[markOrderItemPrePendingToShip] called with itemId:', itemId)

  // Update the row by primary `id` column. `reels_orders.id` is required.
  const { data, error } = await supabase
    .from('reels_orders')
    .update({ status: 'pre_pending_to_ship' })
    .eq('id', itemId)

  // Debug: log the Supabase response for troubleshooting
  console.debug('[markOrderItemPrePendingToShip] supabase response:', { data, error })

  if (error) {
    console.error('markOrderItemPrePendingToShip error:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Mark a single order item back to `verified` in `reels_orders`.
 */
export async function markOrderItemVerified(itemId: string): Promise<any> {
  const { data, error } = await supabase
    .from('reels_orders')
    .update({ status: 'verified' })
  
    .eq('id', itemId)

  if (error) {
    console.error('markOrderItemVerified error:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Call RPC to bulk verify payments for a list of transaction ids.
 * RPC: bulk_verify_payments(p_transaction_ids TEXT[])
 */
export async function bulkVerifyPayments(
  transactionIds: string[]
): Promise<any> {
  if (!Array.isArray(transactionIds) || transactionIds.length === 0) return []
  const { data, error } = await supabase.rpc('bulk_verify_payments', {
    p_transaction_ids: transactionIds,
  })

  if (error) {
    console.error('bulk_verify_payments RPC error:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Move a list of transactions to `pending_to_ship` via RPC `bulk_move_to_pending_to_ship(p_transaction_ids TEXT[])`.
 */
export async function bulkMoveToPendingToShip(
  transactionIds: string[]
): Promise<any> {
  if (!Array.isArray(transactionIds) || transactionIds.length === 0) return []

  // Ensure all ids are strings and filter falsy values
  const ids = transactionIds.map((t) => (t == null ? '' : String(t))).filter(Boolean)
  console.debug('[bulkMoveToPendingToShip] calling RPC with', ids)

  const { data, error } = await supabase.rpc('bulk_move_to_pending_to_ship', {
    p_transaction_ids: ids,
  })

  // Log full RPC response for debugging (helps trace silent failures)
  console.debug('[bulkMoveToPendingToShip] supabase response:', { data, error })

  if (error) {
    console.error('bulk_move_to_pending_to_ship RPC error:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Mark a list of transactions as shipped via RPC `bulk_mark_as_shipped(p_transaction_ids TEXT[])`.
 */
export async function bulkMarkAsShipped(
  transactionIds: string[]
): Promise<any> {
  if (!Array.isArray(transactionIds) || transactionIds.length === 0) return []

  const ids = transactionIds.map((t) => (t == null ? '' : String(t))).filter(Boolean)
  console.debug('[bulkMarkAsShipped] calling RPC with', ids)

  const { data, error } = await supabase.rpc('bulk_mark_as_shipped', {
    p_transaction_ids: ids,
  })

  console.debug('[bulkMarkAsShipped] supabase response:', { data, error })

  if (error) {
    console.error('bulk_mark_as_shipped RPC error:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Search customer history with pagination and optional filter/search query.
 * RPC signature: search_customer_history(p_page INT, p_per_page INT, p_history_filter TEXT, p_search_query TEXT)
 */
export async function searchCustomerHistory(
  p_page: number,
  p_per_page: number,
  p_history_filter: string = 'all',
  p_search_query: string = ''
): Promise<any> {
  const { data, error } = await supabase.rpc('search_customer_history', {
    p_page,
    p_per_page,
    p_history_filter,
    p_search_query,
  })

  // Log full RPC response so callers can inspect returned payloads
  try {
    console.log('search_customer_history RPC response:', { data, error })
  } catch (e) {
    // ignore logging errors in strict runtimes
  }

  if (error) {
    console.error('search_customer_history RPC error:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Fetch reels SKUs with pagination, optional type filter and search query.
 * RPC: get_active_reels_skus(p_is_active BOOLEAN, p_type_filter TEXT DEFAULT 'all', p_search_query TEXT DEFAULT '', p_page INT DEFAULT 1, p_per_page INT DEFAULT 20)
 */
export async function getActiveReelsSkus(
  p_is_active: boolean = true,
  p_type_filter: string = 'all',
  p_search_query: string = '',
  p_page: number = 1,
  p_per_page: number = 20
): Promise<any> {
  const { data, error } = await supabase.rpc('get_active_reels_skus', {
    p_is_active,
    p_type_filter,
    p_search_query,
    p_page,
    p_per_page,
  })

  if (error) {
    console.error('get_active_reels_skus RPC error:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Fetch cart items and upsell items for a session via RPC `get_cart_and_upsellitems(p_session_token TEXT)`.
 */
export async function getCartAndUpsellItems(
  p_session_token: string
): Promise<any> {
  const { data, error } = await supabase.rpc('get_cart_and_upsellitems', {
    p_session_token,
  })

  if (error) {
    console.error('get_cart_and_upsellitems RPC error:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Submit cart to reels order via RPC `submit_cart_to_reels_order(p_session_token TEXT, p_customer_name TEXT, p_whatsapp TEXT, p_address TEXT)`
 */
export async function submitCartToReelsOrder(
  p_session_token: string | null,
  p_customer_name: string,
  p_whatsapp: string,
  p_address: string,
  client: any = supabase
): Promise<any> {
  const { data, error } = await client.rpc('submit_cart_to_reels_order', {
    p_session_token,
    p_customer_name,
    p_whatsapp,
    p_address,
  })

  if (error) {
    console.error('submit_cart_to_reels_order RPC error:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Add an item to cart via RPC `add_to_cart(p_session_token TEXT, p_sku_id BIGINT, p_variation_id BIGINT, p_qty INT)`.
 */
export async function addToCart(
  p_session_token: string,
  p_sku_id: number | string,
  p_variation_id: number | null = null,
  p_qty: number = 1
): Promise<any> {
  const id = typeof p_sku_id === 'string' ? Number(p_sku_id) : p_sku_id
  const { data, error } = await supabase.rpc('add_to_cart', {
    p_session_token,
    p_sku_id: id,
    p_variation_id: p_variation_id ?? null,
    p_qty,
  })

  if (error) {
    console.error('add_to_cart RPC error:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Fetch single SKU details via RPC `get_single_sku_details(p_sku_id BIGINT)`
 */
export async function getSingleSkuDetails(
  p_sku_id: number | string
): Promise<SingleSkuDetails> {
  const id = typeof p_sku_id === 'string' ? Number(p_sku_id) : p_sku_id
  const { data, error } = await supabase.rpc('get_single_sku_details', {
    p_sku_id: id,
  })

  if (error) {
    console.error('get_single_sku_details RPC error:', error)
    throw new Error(error.message)
  }

  return data as SingleSkuDetails
}

/**
 * Fetch restock allocation data for a SKU via RPC `get_restock_allocation_data(p_sku_id BIGINT)`.
 * Returns the raw RPC response (shape may be wrapped by Supabase).
 */
export async function getRestockAllocationData(
  p_sku_id: number | string
): Promise<any> {
  const id = typeof p_sku_id === 'string' ? Number(p_sku_id) : p_sku_id
  const { data, error } = await supabase.rpc('get_restock_allocation_data', {
    p_sku_id: id,
  })

  console.log('get_restock_allocation_data response (orderService)', { data, error })

  if (error) {
    console.error('get_restock_allocation_data RPC error:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Process bulk restock via RPC `process_bulk_restock(p_payload JSONB[])`.
 * Accepts an array of payload entries and returns the RPC result.
 */
export async function processBulkRestock(p_payload: any[]): Promise<any> {
  const { data, error } = await supabase.rpc('process_bulk_restock', {
    p_payload,
  })

  console.log('process_bulk_restock response (orderService)', { data, error })

  if (error) {
    console.error('process_bulk_restock RPC error:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Fetch SKU details for the product drawer via RPC `get_sku_details_for_drawer(p_sku_id BIGINT)`.
 * Returns the RPC response (shape depends on the DB function).
 */
export async function getSkuDetailsForDrawer(
  p_sku_id: number | string
): Promise<any> {
  const id = typeof p_sku_id === 'string' ? Number(p_sku_id) : p_sku_id
  const { data, error } = await supabase.rpc('get_sku_details_for_drawer', {
    p_sku_id: id,
  })

  if (error) {
    console.error('get_sku_details_for_drawer RPC error:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Fetch master order list with pagination and optional status/urgent filter.
 * Normalizes the RPC response into { rows, metadata, statusCounts }.
 */
export async function getMasterOrderList(
  p_status_filter: string = 'all',
  p_page: number = 1,
  p_per_page: number = 20,
  p_urgent_only: boolean = false
): Promise<{ rows: any[]; metadata: any | null; statusCounts: Record<string, number> | null }> {
  const { data: rpcData, error } = await supabase.rpc('get_master_order_list', {
    p_status_filter,
    p_page,
    p_per_page,
    p_urgent_only,
  });

  if (error) {
    console.error('get_master_order_list RPC error:', error);
    throw new Error(error.message);
  }

  const normalizeEntry = (c: any) => {
    const orders = Array.isArray(c.items) ? c.items : [];
    return {
      ...c,
      orders,
      matching_order_count: c.matching_action_count ?? orders.length,
    };
  };

  let rows: any[] = [];
  let m: any = null;
  let sc: Record<string, number> | null = null;

  if (rpcData && Array.isArray((rpcData as any).data)) {
    const raw = (rpcData as any).data;
    rows = Array.isArray(raw) ? raw.map(normalizeEntry) : [];
    m = (rpcData as any).metadata ?? null;
    sc = (rpcData as any).status_counts ?? null;
  } else {
    rows = [];
    m = null;
    sc = null;
  }

  return { rows, metadata: m, statusCounts: sc };
}

/**
 * Create a reels order while checking quota via RPC `create_reels_order_with_quota`.
 * Returns RPC response which should include `{ order_id, status }`.
 */
export async function createReelsOrderWithQuota(
  p_customer_name: string,
  p_whatsapp: string,
  p_email: string,
  p_sku_id: number,
  p_variation_id: number
): Promise<any> {
  const { data, error } = await supabase.rpc('create_reels_order_with_quota', {
    p_customer_name,
    p_whatsapp,
    p_email,
    p_sku_id,
    p_variation_id,
  })

  if (error) {
    console.error('create_reels_order_with_quota RPC error:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Fetch a single order's full details via RPC `get_single_order_details(p_customer_id UUID, p_reference_id TEXT)`.
 * Returns the RPC response or throws on error.
 */
export async function getSingleOrderDetails(
  p_customer_id: string,
  p_reference_id: string
): Promise<any> {
  const { data, error } = await supabase.rpc('get_single_order_details', {
    p_customer_id,
    p_reference_id,
  })

  if (error) {
    console.error('get_single_order_details RPC error:', error)
    throw new Error(error.message)
  }

  return data
}