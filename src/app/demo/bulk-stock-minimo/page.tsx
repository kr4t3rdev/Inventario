"use client"

import { BulkStockMinimoManagerSimple } from "@/components/productos/bulk-stock-minimo-manager-simple"
import { Provider } from "react-redux"
import { store } from "@/lib/redux/store"

export default function DemoBulkStockMinimoPage() {
  return (
    <Provider store={store}>
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-6">Demo: Bulk Stock Mínimo Manager</h1>
        <BulkStockMinimoManagerSimple />
      </div>
    </Provider>
  )
}