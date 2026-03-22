"use client"

import React, { useState } from 'react'
import type { TimelineGroup, SearchCustomerHistoryResponse } from '@/types/order'

type CustomerHistoryRow = SearchCustomerHistoryResponse['data'][number] & {
  orders?: any[]
  matching_order_count?: number
  matching_action_count?: number
}
import * as Lucide from 'lucide-react'
import { HeaderTabMenu } from '@/components/header-tab-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { List, ListItem } from '@/components/ui/list'
import { ListStatusLabel, ListStatusBg } from '@/lib/orderStatus'
import EmptyWidget from '../../../../components/EmptyWidget'
import OrderDetailsModal from '@/components/order-details-modal-history'
import { searchCustomerHistory } from '@/lib/orderService'
import { useEffect, useRef } from 'react'
import PaginationControls from '@/components/ui/pagination-controls'

const FILTERS = [
  
  { key: 'shipped', label: '已完成' },
  { key: 'cancelled', label: '已取消' },
  { key: 'processing', label: '處理中' },
  { key: 'all', label: '顯示全部' },
]

export default function OrdersHistoryPage() {
  const [filter, setFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [page, setPage] = useState<number>(1)
  const [loading, setLoading] = useState<boolean>(false)
  const [rows, setRows] = useState<CustomerHistoryRow[]>([])
  const [meta, setMeta] = useState<any | null>(null)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({})
  const perPage = 12
  const mountedRef = useRef(true)
  const skipEffectRef = useRef(false)
  const [modalOpen, setModalOpen] = useState<boolean>(false)
  const [modalCustomerId, setModalCustomerId] = useState<string | null>(null)
  const [modalReferenceId, setModalReferenceId] = useState<string | null>(null)

  const toggleExpanded = (id?: string | number) => {
    const key = String(id ?? 'unknown')
    setExpandedIds((p) => ({ ...p, [key]: !p[key] }))
  }

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // call search immediately when user selects a filter chip
  const applyFilter = async (key: string) => {
    setFilter(key)
    setPage(1)
    skipEffectRef.current = true
    setLoading(true)
    try {
      const rpcData: any = await searchCustomerHistory(1, perPage, key === 'all' ? 'all' : key, searchTerm || '')
      let outRows: any[] = []
      let m: any = null
      if (rpcData && Array.isArray(rpcData.data)) {
        const raw = rpcData.data
        const normalizeEntry = (c: any) => {
          const orders = Array.isArray(c.items) ? c.items : []
          return {
            ...c,
            orders,
            matching_order_count: c.matching_action_count ?? orders.length,
          }
        }
        outRows = Array.isArray(raw) ? raw.map(normalizeEntry) : []
        m = rpcData.metadata ?? null
      }
      if (mountedRef.current) {
        setRows(outRows)
        setMeta(m)
        const pages = (m && m.total_pages) ? Number(m.total_pages) : 1
        setTotalPages(pages)
      }
    } catch (e) {
      console.error('searchCustomerHistory error', e)
      if (mountedRef.current) {
        setRows([])
        setMeta(null)
        setTotalPages(1)
      }
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    if (skipEffectRef.current) {
      skipEffectRef.current = false
      return
    }
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const doFetch = async () => {
      setLoading(true)
      try {
      const rpcData: any = await searchCustomerHistory(page, perPage, filter === 'all' ? 'all' : filter, searchTerm || '')
        let outRows: any[] = []
        let m: any = null
        if (rpcData && Array.isArray(rpcData.data)) {
          const raw = rpcData.data
          const normalizeEntry = (c: any) => {
            const orders = Array.isArray(c.items) ? c.items : []
            return {
              ...c,
              orders,
              matching_order_count: c.matching_action_count ?? orders.length,
            }
          }
          outRows = Array.isArray(raw) ? raw.map(normalizeEntry) : []
          m = rpcData.metadata ?? null
        }
        if (!cancelled && mountedRef.current) {
          setRows(outRows)
          setMeta(m)
          const pages = (m && m.total_pages) ? Number(m.total_pages) : 1
          setTotalPages(pages)
        }
      } catch (e) {
        console.error('searchCustomerHistory error', e)
        if (!cancelled && mountedRef.current) {
          setRows([])
          setMeta(null)
          setTotalPages(1)
        }
      } finally {
        if (!cancelled && mountedRef.current) setLoading(false)
      }
    }

    // debounce searches
    timer = setTimeout(() => { doFetch() }, 300)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [filter, searchTerm, page])

  return (
    <div className="flex flex-col min-h-screen pt-8">
      <div className="pt-4">
        <HeaderTabMenu active="history" />
        
      </div>
      
      <div className="mt-4 flex-1 px-4">
        <div className="mb-3">
          <div className="relative max-w-md">
            <Lucide.Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
            <Input
              placeholder="搜尋訂單、姓名或編號..."
              className="pl-10 bg-white border-gray-200"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? 'default' : 'outline'}
              onClick={() => setFilter(f.key)}
              className="rounded-full"
            >
              {f.label}
            </Button>
          ))}
        </div>

        <List>
          {loading && rows.length === 0 && (
            <EmptyWidget message="載入中..." />
          )}

          {!loading && rows.length === 0 && (
            <EmptyWidget message={`暫無資料`} />
          )}

          {!loading && rows.length > 0 && (
            <>
              {rows.map((cust, idx) => (
                <ListItem
                  key={cust.customer_id ?? cust.phone ?? idx}
                  isOpen={!!expandedIds[String(cust.customer_id ?? cust.phone ?? idx)]}
                  onToggle={() => toggleExpanded(cust.customer_id ?? cust.phone ?? idx)}
                  header={
                    <div>
                      <div className="font-medium">
                        {cust.customer_name || '未命名'} <span className="text-sm text-black">| {cust.phone || '—'}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{cust.total_matching_groups ?? cust.matching_order_count ?? (cust.orders || []).length}張訂單</div>
                    </div>
                  }
                  right={
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); toggleExpanded(cust.customer_id ?? cust.phone ?? idx) }}
                      className="rounded-full"
                    >
                      <Lucide.ChevronDown className={`h-4 w-4 transform ${expandedIds[String(cust.customer_id ?? cust.phone ?? idx)] ? 'rotate-180' : ''}`} />
                    </Button>
                  }
                >
                  <div className="mt-3 space-y-2">
                    {expandedIds[String(cust.customer_id ?? cust.phone ?? idx)] && (
                      <>
                        {Array.isArray(cust.timeline_groups) && cust.timeline_groups.length > 0 ? (
                          <div className="mt-2 space-y-3">
                            {cust.timeline_groups.map((g: any) => {
                              const statusKey = g.group_status ?? g.group_type
                              const bg = ListStatusBg[statusKey] || 'bg-yellow-50'
                              return (
                                <div
                                  key={g.group_id}
                                  className={`flex items-center justify-between py-2 px-4 text-sm cursor-pointer ${bg} rounded-full`}
                                  onClick={(e) => { e.stopPropagation(); setModalCustomerId(cust.customer_id ?? null); setModalReferenceId(g.group_id ?? null); setModalOpen(true) }}
                                >
                                  <div className="flex flex-col">
                                    <div className="text-[9px] text-gray-500">交易號碼</div>
                                    <div className="text-sm font-semibold text-black">{g.group_id}</div>
                                  </div>
                                  <div className="text-sm text-gray-700">{ListStatusLabel[statusKey] || statusKey}</div>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="mt-2 text-sm text-gray-500">無交易記錄</div>
                        )}

                        {cust.has_more_history && (
                          <div className="flex justify-center mt-2">
                            <Button size="sm" variant="ghost" className="text-xs" onClick={(e) => { e.stopPropagation(); /* load more per-customer history if implemented */ }}>
                              顯示更多
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </ListItem>
              ))}
            </>
          )}
        </List>

      </div>

      {totalPages >= 1 && (
        <div className="pb-6">
          <div className="flex justify-center items-end">
            <PaginationControls currentPage={page} totalPages={totalPages} onPageChange={(p) => setPage(p)} />
          </div>
        </div>
      )}
      <OrderDetailsModal open={modalOpen} onOpenChange={(v) => setModalOpen(v)} customerId={modalCustomerId} referenceId={modalReferenceId} />
    </div>
  )
}
