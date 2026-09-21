import React from 'react';
import Button from './Button';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  itemLabel?: string;
  onPageChange: (page: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  itemLabel = 'items',
  onPageChange,
  className = ''
}) => {
  const safeTotalPages = Math.max(1, totalPages);
  const safeCurrentPage = Math.min(Math.max(1, currentPage), safeTotalPages);

  const startItem = totalItems === 0 ? 0 : (safeCurrentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(safeCurrentPage * itemsPerPage, totalItems);

  // Generate visible page numbers
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (safeTotalPages <= 7) {
      for (let i = 1; i <= safeTotalPages; i++) pages.push(i);
    } else {
      if (safeCurrentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', safeTotalPages);
      } else if (safeCurrentPage >= safeTotalPages - 3) {
        pages.push(1, '...', safeTotalPages - 4, safeTotalPages - 3, safeTotalPages - 2, safeTotalPages - 1, safeTotalPages);
      } else {
        pages.push(1, '...', safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1, '...', safeTotalPages);
      }
    }
    return pages;
  };

  return (
    <div
      className={`
        p-space-md flex flex-col sm:flex-row items-center justify-between gap-space-sm
        bg-surface-container-lowest border-t border-surface-container-low select-none
        ${className}
      `.trim()}
    >
      <span className="font-body-sm text-body-sm text-on-surface-variant order-2 sm:order-1">
        Showing <span className="font-semibold text-on-surface">{startItem}</span> to{' '}
        <span className="font-semibold text-on-surface">{endItem}</span> of{' '}
        <span className="font-semibold text-on-surface">{totalItems}</span> {itemLabel}
      </span>

      <div className="flex items-center gap-1 order-1 sm:order-2">
        <Button
          variant="ghost"
          size="icon-sm"
          startIcon="chevron_left"
          disabled={safeCurrentPage <= 1}
          onClick={() => onPageChange(safeCurrentPage - 1)}
          aria-label="Previous page"
        />

        {getPageNumbers().map((item, idx) => {
          if (item === '...') {
            return (
              <span
                key={`ellipsis-${idx}`}
                className="w-8 h-8 flex items-center justify-center text-xs text-outline"
              >
                ...
              </span>
            );
          }

          const pageNum = Number(item);
          const isActive = safeCurrentPage === pageNum;

          return (
            <button
              key={pageNum}
              type="button"
              onClick={() => onPageChange(pageNum)}
              className={`
                w-8 h-8 flex items-center justify-center rounded-lg text-sm font-semibold transition-colors cursor-pointer
                ${
                  isActive
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }
              `.trim()}
            >
              {pageNum}
            </button>
          );
        })}

        <Button
          variant="ghost"
          size="icon-sm"
          startIcon="chevron_right"
          disabled={safeCurrentPage >= safeTotalPages}
          onClick={() => onPageChange(safeCurrentPage + 1)}
          aria-label="Next page"
        />
      </div>
    </div>
  );
};

export default Pagination;
