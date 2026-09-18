'use client'

import { LazyMotion, m as motion } from "framer-motion"
import { EmpleadoForm } from "@/features/empleados"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Users } from "lucide-react"
import Link from "next/link"

export default function NuevaEmpleadoPage() {
  return (
        <motion.div
          className="container mx-auto py-6 px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            className="mb-6"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <motion.div
              className="flex items-center gap-3 mb-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              {/* <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button variant="outline" size="icon" asChild className="dark:border-slate-700/10 dark:hover:bg-slate-800/10">
                  <Link href="/busy/empleados">
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                </Button>
              </motion.div> */}
              {/* <motion.div
                className="w-10 h-10 bg-linear-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <Users className="h-5 w-5 text-white" />
              </motion.div> */}

            </motion.div>
            {/* <motion.p
              className="text-muted-foreground dark:text-slate-400 ml-14"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              Ingrese los datos para registrar un nuevo empleado
            </motion.p> */}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <EmpleadoForm />
          </motion.div>
        </motion.div>
  )
}
