"use client"

import { useState } from "react"
import { LazyMotion, m as motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Settings, Loader2 } from "lucide-react"

export function BulkStockMinimoManagerSimple() {
  const [isLoading, setIsLoading] = useState(false)

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card className="overflow-hidden border-dashed bg-linear-to-br from-primary/[0.05] via-background to-purple/[0.08] dark:from-primary/10 dark:to-purple/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <motion.div
              className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-primary to-purple text-white shadow-md"
              whileHover={{ scale: 1.05, rotate: 3 }}
            >
              <Settings className="h-5 w-5" />
            </motion.div>
            Gestión Masiva de Stock Mínimo (Simple Test)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Componente de validación visual.</p>
            <Button onClick={() => setIsLoading(!isLoading)} disabled={isLoading} className="gap-2">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                "Test Button"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
