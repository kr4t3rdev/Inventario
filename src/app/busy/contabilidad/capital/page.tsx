'use client'

import { CapitalForm } from "@/components/contabilidad/capital/capital-form"
import { CapitalTable } from "@/components/contabilidad/capital/capital-table"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Wallet, History, Plus } from "lucide-react"

export default function InyeccionCapitalPage() {
  const [activeTab, setActiveTab] = useState("list")

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { 
      opacity: 1, 
      y: 0,
      transition: { type: "spring" as const, stiffness: 50, damping: 15 }
    }
  }

  return (
    <motion.div 
      className="container mx-auto py-6 space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div className="flex items-center justify-between" variants={itemVariants}>
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent dark:from-white dark:to-slate-300">
            Inyección de Capital
          </h2>
          <p className="text-muted-foreground">
            Gestione el capital social y la deuda externa de la empresa.
          </p>
        </div>
        <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full">
          <Wallet className="h-6 w-6 text-slate-500 dark:text-slate-400" />
        </div>
      </motion.div>

      <Separator className="my-6" />

      <motion.div variants={itemVariants}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md bg-slate-100 dark:bg-slate-800/50 p-1">
            <TabsTrigger 
              value="list"
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:shadow-sm transition-all duration-200"
            >
              <div className="flex items-center gap-2">
                <History className="h-4 w-4" />
                <span>Historial</span>
              </div>
            </TabsTrigger>
            <TabsTrigger 
              value="new"
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:shadow-sm transition-all duration-200"
            >
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                <span>Nueva Inyección</span>
              </div>
            </TabsTrigger>
          </TabsList>
          
          <AnimatePresence mode="wait">
            <TabsContent value="list" className="mt-0">
              <motion.div
                key="list"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <CapitalTable />
              </motion.div>
            </TabsContent>
            
            <TabsContent value="new" className="mt-0">
              <motion.div
                key="new"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="max-w-2xl mx-auto"
              >
                <CapitalForm onSuccess={() => setActiveTab("list")}/>
              </motion.div>
            </TabsContent>
          </AnimatePresence>
        </Tabs>
      </motion.div>
    </motion.div>
  )
}
