"use client"

import { BulkStockMinimoManagerSimple } from "@/features/productos/components/bulk-stock-minimo-manager-simple"

export default function DemoBulkStockMinimoPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Demo: Bulk Stock Mínimo Manager</h1>
      <BulkStockMinimoManagerSimple />
    </div>
  )
}