# Debug: variation_id Not Passed to Restock Modal

## Issue Summary
The restock modal is not receiving the `variation_id` parameter correctly when the "補貨" (Restock) button is clicked.

## Root Cause Analysis

### 1. **Data Flow Path**
```
Supabase (reels_orders table)
  → variation_id field
  → Supabase SELECT query
  → mapSupabaseOrderToRegistration()
  → Registration object with variationId property
  → Button click: orders[0]?.variationId
  → setRestockSku(variationId.toString())
  → RestockModal receives sku prop
```

### 2. **Current Findings**

✅ **What's Working:**
- `variation_id` IS being selected from Supabase in the main query (line 143 in page.tsx)
- The mapping function correctly converts it: `Number(order.variation_id)`
- Registration type has the field: `variationId?: number`

❌ **The Problem:**
- **Most likely**: `variation_id` is **NULL** in the Supabase database for orders
- This causes `variationId` to be `undefined` in the Registration object
- The type check `typeof variationId === 'number'` fails, preventing modal from opening
- Console error logs: "Invalid variationId for [variation type]"

### 3. **Verification Steps**

**Check console logs for:**
1. "[Orders Mapping] Missing variation_id for order:" - indicates NULL variation_id in DB
2. "One-size restock button:" or "Regular variation restock button:" - shows firstOrder details
3. "Invalid variationId" error messages - confirms variationId is undefined/null

## The Fix Applied

### Added Comprehensive Debug Logging

**In `/lib/orders.ts` (mapSupabaseOrderToRegistration):**
- Logs when `variation_id` is missing or null
- Shows all variation-related keys in the order object
- Helps identify if Supabase is even returning the field

**In `/app/admin/orders/page.tsx` (Button click handlers):**
- Enhanced logs showing full order details (id, sku, variation, variationId)
- Shows the type of variationId and count of orders
- More detailed error messages when variationId is invalid

## Next Steps to Resolve

1. **Check the database directly:**
   ```sql
   SELECT id, sku_id, variation_id FROM reels_orders LIMIT 10;
   ```
   - If `variation_id` is NULL, you need to populate it
   - If it's returning, check if it's a number vs string type

2. **Check if variation_id should come from relationship:**
   - May need to join with variations table instead
   - Check Supabase schema for variations table structure

3. **Fallback approach:**
   - If variations don't have IDs, use variation_snapshot as identifier
   - Modify RestockModal to accept variation string instead of ID

4. **Real-time sync issue:**
   - The realtime UPDATE query uses `*` which should include all fields
   - But verify variation_id is populated for new records

## Files Modified

1. `/Users/tessali/v0-mfashion/lib/orders.ts`
   - Enhanced mapSupabaseOrderToRegistration with debug logging

2. `/Users/tessali/v0-mfashion/app/admin/orders/page.tsx`
   - Enhanced button click handlers with detailed console logs
   - Line ~755 (One-size restock button)
   - Line ~803 (Regular variation restock button)

## How to Use Debug Info

1. Open the orders page in browser
2. Open DevTools → Console tab
3. Look for "[Orders Mapping] Missing variation_id" warnings
4. Click a restock button
5. Check logs for the "One-size restock button" or "Regular variation restock button" messages
6. Review the `firstOrder` object to see if `variationId` is present and numeric

## Related Components

- **RestockModal**: `/Users/tessali/v0-mfashion/components/restock-modal.tsx`
  - Expects `sku` prop to be `variation_id` as a string
  - Uses `parseInt(sku)` to convert to number
  - Calls `supabase.rpc('get_waitlist_orders', { p_variation_id: variationId })`

- **Supabase Function**: Likely `get_waitlist_orders`
  - Needs a valid `p_variation_id` parameter
  - Should fetch orders matching that variation_id
