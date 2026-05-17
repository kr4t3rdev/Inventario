"use client"

import { useState } from "react"
import { CapitalForm } from "./capital-form"
import { CapitalTable } from "./capital-table"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LazyMotion, m as motion, AnimatePresence } from "framer-motion"
import { Wallet, History, Plus } from "lucide-react"

export function CapitalPageClient() {
  const [activeTab, setActiveTab] = useState("list")

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  }
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 50, damping: 15 } }
  }

  return (
    <motion.div className="container mx-auto py-6 space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <motion.div className="flex items-center justify-between" variants={itemVariants}>
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight bg-linear-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent dark:from-white dark:to-slate-300">
            Inyección de Capital
          </h2>
          <p className="text-muted-foreground">Gestione el capital social y la deuda externa de la empresa.</p>
        </div>
        <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full"><Wallet className="h-6 w-6 text-slate-500" /></div>
      </motion.div>
      <Separator className="my-6" />
      <motion.div variants={itemVariants}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md bg-slate-100 dark:bg-slate-800/50 p-1">
            <TabsTrigger value="list" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:shadow-sm"><History className="h-4 w-4 mr-2" />Historial</TabsTrigger>
            <TabsTrigger value="new" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:shadow-sm"><Plus className="h-4 w-4 mr-2" />Nueva Inyección</TabsTrigger>
          </TabsList>
          <AnimatePresence mode="wait">
            <TabsContent key="list" value="list" className="mt-0"><CapitalTable /></TabsContent>
            <TabsContent key="new" value="new" className="mt-0">
              <CapitalForm onSuccess={() => setActiveTab("list")} />
            </TabsContent>
          </AnimatePresence>
        </Tabs>
      </motion.div>
    </motion.div>
  )
}
