"use client"

import React from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/**
 * Consistent data table component that matches inventory-management styling
 * Extends the base shadcn/ui Table component with consistent styling
 */

export interface DataTableProps extends React.HTMLAttributes<HTMLTableElement> {
  children: React.ReactNode
}

export function DataTable({ children, className = "", ...props }: DataTableProps) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-lightBorder">
      <div
        className="overflow-auto max-h-[calc(100vh-250px)]"
        style={{ scrollbarWidth: "thin" }}
      >
        <Table className={`w-full font-urbanist min-w-[800px] ${className}`} {...props}>
          {children}
        </Table>
      </div>
    </div>
  )
}

export function DataTableHeader({ children, className = "", ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <TableHeader className={`sticky top-0 z-10 bg-white ${className}`} {...props}>
      {children}
    </TableHeader>
  )
}

export function DataTableRow({ children, className = "", ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <TableRow 
      className={`border-b border-lightBorder/60 hover:bg-gray-50/70 transition-colors ${className}`}
      {...props}
    >
      {children}
    </TableRow>
  )
}

export function DataTableHeaderRow({ children, className = "", ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <TableRow 
      className={`border-b border-lightBorder/70 ${className}`}
      {...props}
    >
      {children}
    </TableRow>
  )
}

export function DataTableHeaderCell({ children, className = "", ...props }: React.HTMLAttributes<HTMLTableCellElement>) {
  return (
    <TableHead 
      className={`py-3 text-sm font-medium text-gray-600 ${className}`}
      {...props}
    >
      {children}
    </TableHead>
  )
}

export function DataTableCell({ children, className = "", ...props }: React.HTMLAttributes<HTMLTableCellElement>) {
  return (
    <TableCell 
      className={`py-3 px-4 ${className}`}
      {...props}
    >
      {children}
    </TableCell>
  )
}

export function DataTableBody({ children, className = "", ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <TableBody 
      className={`divide-y divide-gray-200 ${className}`}
      {...props}
    >
      {children}
    </TableBody>
  )
}
