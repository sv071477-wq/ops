"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationControlsProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  color?: string;
}

export function PaginationControls({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 25, 50],
  color = "#0b5cab",
}: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validPage = Math.min(Math.max(1, currentPage), totalPages);

  if (totalItems === 0) return null;

  const startItem = (validPage - 1) * pageSize + 1;
  const endItem = Math.min(validPage * pageSize, totalItems);

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (validPage > 3) pages.push("...");
      const start = Math.max(2, validPage - 1);
      const end = Math.min(totalPages - 1, validPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (validPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
        padding: "12px 18px",
        background: "#fafcff",
        borderTop: "1px solid var(--border-subtle)",
        fontSize: "0.8rem",
        color: "var(--text-dim)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span>
          Showing <strong>{startItem}</strong> to <strong>{endItem}</strong> of <strong>{totalItems}</strong> entries
        </span>

        {onPageSizeChange && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              style={{
                padding: "3px 8px",
                borderRadius: 6,
                border: "1px solid var(--border-subtle)",
                background: "#fff",
                fontSize: "0.78rem",
                fontWeight: 600,
                color: "var(--text-main)",
                cursor: "pointer",
              }}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button
          onClick={() => onPageChange(validPage - 1)}
          disabled={validPage <= 1}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            padding: "4px 8px",
            borderRadius: 6,
            border: "1px solid var(--border-subtle)",
            background: validPage <= 1 ? "#f1f5f9" : "#fff",
            color: validPage <= 1 ? "#94a3b8" : "var(--text-main)",
            cursor: validPage <= 1 ? "not-allowed" : "pointer",
            fontSize: "0.78rem",
            fontWeight: 600,
            transition: "all 0.15s",
          }}
          title="Previous Page"
        >
          <ChevronLeft size={14} />
          <span>Prev</span>
        </button>

        {getPageNumbers().map((p, idx) => {
          if (p === "...") {
            return (
              <span key={`dots-${idx}`} style={{ padding: "0 4px", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                ...
              </span>
            );
          }
          const isCurrent = p === validPage;
          return (
            <button
              key={p}
              onClick={() => onPageChange(Number(p))}
              style={{
                minWidth: 28,
                height: 28,
                padding: "0 6px",
                borderRadius: 6,
                border: isCurrent ? `1px solid ${color}` : "1px solid transparent",
                background: isCurrent ? color : "transparent",
                color: isCurrent ? "#fff" : "var(--text-main)",
                cursor: isCurrent ? "default" : "pointer",
                fontSize: "0.78rem",
                fontWeight: isCurrent ? 800 : 600,
                transition: "all 0.15s",
              }}
            >
              {p}
            </button>
          );
        })}

        <button
          onClick={() => onPageChange(validPage + 1)}
          disabled={validPage >= totalPages}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            padding: "4px 8px",
            borderRadius: 6,
            border: "1px solid var(--border-subtle)",
            background: validPage >= totalPages ? "#f1f5f9" : "#fff",
            color: validPage >= totalPages ? "#94a3b8" : "var(--text-main)",
            cursor: validPage >= totalPages ? "not-allowed" : "pointer",
            fontSize: "0.78rem",
            fontWeight: 600,
            transition: "all 0.15s",
          }}
          title="Next Page"
        >
          <span>Next</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
