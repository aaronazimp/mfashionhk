import * as React from 'react'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from './pagination'

type Props = {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}

export default function PaginationControls({ currentPage, totalPages, onPageChange, className }: Props) {
  if (totalPages <= 1) return null

  const handleClick = (e: React.MouseEvent, page: number) => {
    e.preventDefault()
    if (page < 1 || page > totalPages) return
    onPageChange(page)
  }

  return (
    <div className={className}>
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e: React.MouseEvent) => handleClick(e, currentPage - 1)}
              className={currentPage <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
            />
          </PaginationItem>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
            const isNearCurrent = Math.abs(page - currentPage) <= 1
            const isFirst = page === 1
            const isLast = page === totalPages

            if (!isNearCurrent && !isFirst && !isLast) {
              if (page === currentPage - 2 || page === currentPage + 2) {
                return (
                  <PaginationItem key={page}>
                    <PaginationEllipsis />
                  </PaginationItem>
                )
              }
              return null
            }

            return (
              <PaginationItem key={page}>
                <PaginationLink
                  href="#"
                  isActive={page === currentPage}
                  onClick={(e: React.MouseEvent) => handleClick(e, page)}
                  className="cursor-pointer"
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            )
          })}

          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(e: React.MouseEvent) => handleClick(e, currentPage + 1)}
              className={currentPage >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}
