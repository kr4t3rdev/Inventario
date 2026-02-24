'use client'
import dynamic from "next/dynamic"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { motion, type Variants } from "framer-motion"
import { 
  LayoutDashboard, 
  TrendingUp, 
  Sparkles,
  Activity,
  Zap
} from "lucide-react"
import {
  PageTransition,
  StaggerContainer,
  StaggerItem,
  AnimatedCard
} from "@/components/ui/animations"

// Lazy load heavy components
const SectionCards = dynamic(() => import("@/components/section-cards").then(mod => ({ default: mod.SectionCards })), {
  loading: () => (
    <motion.div 
      className="grid grid-cols-1 gap-4 px-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 lg:px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {[1, 2, 3, 4].map((i) => (
        <motion.div 
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="@container/card bg-card rounded-xl border p-4"
        >
          <div className="relative space-y-3">
            <div className="flex items-center gap-2">
              <motion.div
                className="h-4 w-4 rounded-full bg-muted"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
              />
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            </div>
            <div className="h-8 w-32 bg-muted rounded animate-pulse" />
            <div className="absolute right-0 top-0">
              <div className="h-6 w-16 bg-muted rounded-full animate-pulse" />
            </div>
            <div className="h-4 w-full bg-muted rounded animate-pulse" />
          </div>
        </motion.div>
      ))}
    </motion.div>
  )
})

const ChartAreaInteractive = dynamic(() => import("@/components/chart-area-interactive").then(mod => ({ default: mod.ChartAreaInteractive })), {
  loading: () => (
    <AnimatedCard className="h-[300px] w-full">
      <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-muted/30 to-muted/50 rounded-xl border-2 border-dashed border-muted-foreground/20">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            className="relative"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Activity className="h-5 w-5 text-primary" />
            </motion.div>
          </motion.div>
          <div className="text-center space-y-1">
            <span className="text-muted-foreground font-medium">Cargando gráfico...</span>
            <motion.div 
              className="flex justify-center gap-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {[0, 1, 2].map((dot) => (
                <motion.div
                  key={dot}
                  className="w-2 h-2 rounded-full bg-primary"
                  animate={{ y: [0, -5, 0] }}
                  transition={{
                    duration: 0.6,
                    repeat: Infinity,
                    delay: dot * 0.15
                  }}
                />
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </AnimatedCard>
  )
})

const TopProductsTable = dynamic(() => import("@/components/top-products-table").then(mod => ({ default: mod.TopProductsTable })), {
  loading: () => (
    <AnimatedCard className="h-[300px] w-full">
      <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-muted/30 to-muted/50 rounded-xl border-2 border-dashed border-muted-foreground/20">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            className="relative"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Zap className="h-5 w-5 text-primary" />
            </motion.div>
          </motion.div>
          <div className="text-center space-y-1">
            <span className="text-muted-foreground font-medium">Cargando productos...</span>
            <motion.div 
              className="flex justify-center gap-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {[0, 1, 2].map((dot) => (
                <motion.div
                  key={dot}
                  className="w-2 h-2 rounded-full bg-primary"
                  animate={{ y: [0, -5, 0] }}
                  transition={{
                    duration: 0.6,
                    repeat: Infinity,
                    delay: dot * 0.15
                  }}
                />
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </AnimatedCard>
  )
})

const StockDistributionChart = dynamic(() => import("@/components/stock-distribution-chart").then(mod => ({ default: mod.StockDistributionChart })), {
  loading: () => (
    <AnimatedCard className="h-[300px] w-full">
      <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-muted/30 to-muted/50 rounded-xl border-2 border-dashed border-muted-foreground/20">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            className="relative"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Sparkles className="h-5 w-5 text-primary" />
            </motion.div>
          </motion.div>
          <div className="text-center space-y-1">
            <span className="text-muted-foreground font-medium">Cargando distribución...</span>
            <motion.div 
              className="flex justify-center gap-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {[0, 1, 2].map((dot) => (
                <motion.div
                  key={dot}
                  className="w-2 h-2 rounded-full bg-primary"
                  animate={{ y: [0, -5, 0] }}
                  transition={{
                    duration: 0.6,
                    repeat: Infinity,
                    delay: dot * 0.15
                  }}
                />
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </AnimatedCard>
  )
})

const StockBajoTable = dynamic(() => import("@/components/stock-bajo-table").then(mod => ({ default: mod.StockBajoTable })), {
  loading: () => (
    <AnimatedCard className="h-[400px] w-full">
      <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-muted/30 to-muted/50 rounded-xl border-2 border-dashed border-muted-foreground/20">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            className="relative"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              className="w-12 h-12 border-4 border-destructive/30 border-t-destructive rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [1, 0.7, 1]
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Activity className="h-5 w-5 text-destructive" />
            </motion.div>
          </motion.div>
          <div className="text-center space-y-1">
            <span className="text-muted-foreground font-medium">Cargando alertas...</span>
            <motion.div 
              className="flex justify-center gap-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {[0, 1, 2].map((dot) => (
                <motion.div
                  key={dot}
                  className="w-2 h-2 rounded-full bg-destructive"
                  animate={{ y: [0, -5, 0] }}
                  transition={{
                    duration: 0.6,
                    repeat: Infinity,
                    delay: dot * 0.15
                  }}
                />
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </AnimatedCard>
  )
})

const TransferenciasStats = dynamic(() => import("@/components/transferencias-stats").then(mod => ({ default: mod.TransferenciasStats })), {
  loading: () => (
    <AnimatedCard className="h-[300px] w-full">
      <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-muted/30 to-muted/50 rounded-xl border-2 border-dashed border-muted-foreground/20">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            className="relative"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Activity className="h-5 w-5 text-primary" />
            </motion.div>
          </motion.div>
          <div className="text-center space-y-1">
            <span className="text-muted-foreground font-medium">Cargando transferencias...</span>
            <motion.div 
              className="flex justify-center gap-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {[0, 1, 2].map((dot) => (
                <motion.div
                  key={dot}
                  className="w-2 h-2 rounded-full bg-primary"
                  animate={{ y: [0, -5, 0] }}
                  transition={{
                    duration: 0.6,
                    repeat: Infinity,
                    delay: dot * 0.15
                  }}
                />
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </AnimatedCard>
  )
})

// Variantes de animación para el header
const headerIconVariants: Variants = {
  initial: { scale: 1, rotate: 0 },
  hover: { 
    scale: 1.05, 
    rotate: 5,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 10
    }
  }
}

const sparklesVariants: Variants = {
  animate: {
    rotate: 360,
    scale: [1, 1.2, 1],
    transition: {
      rotate: { duration: 18, repeat: Infinity, ease: "linear" },
      scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
    }
  }
}

const titleVariants: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15
    }
  }
}

/**
 * Página principal del Dashboard con animaciones avanzadas
 * 
 * @description Dashboard de entrada que muestra estadísticas, gráficos y alertas
 * @returns {JSX.Element} Página del Dashboard con transiciones y loaders animados
 */
export default function DashboardPage() {
  return (
    <SidebarProvider>
      <SidebarInset>
        <PageTransition className="relative min-h-screen w-full">
          {/* Background Decor con animaciones mejoradas */}
          <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
            <motion.div 
              className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl dark:bg-blue-500/5 mix-blend-multiply dark:mix-blend-screen"
              animate={{
                scale: [1, 1.1, 1],
                x: [0, 20, 0],
                y: [0, -20, 0],
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            <motion.div 
              className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl dark:bg-purple-500/5 mix-blend-multiply dark:mix-blend-screen"
              animate={{
                scale: [1, 1.15, 1],
                x: [0, -30, 0],
                y: [0, 30, 0],
              }}
              transition={{
                duration: 10,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1
              }}
            />
            <motion.div 
              className="absolute -bottom-8 left-1/3 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl dark:bg-emerald-500/5 mix-blend-multiply dark:mix-blend-screen"
              animate={{
                scale: [1, 1.2, 1],
                x: [0, 25, 0],
                y: [0, 15, 0],
              }}
              transition={{
                duration: 12,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 2
              }}
            />
          </div>

          <StaggerContainer className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
              <StaggerItem className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                {/* Header con animaciones mejoradas */}
                <motion.div 
                  className="flex items-center gap-3 px-4 lg:px-6"
                  variants={titleVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <motion.div 
                    className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg"
                    variants={headerIconVariants}
                    initial="initial"
                    whileHover="hover"
                  >
                    <LayoutDashboard className="h-6 w-6 text-white" />
                    <motion.div
                      variants={sparklesVariants}
                      animate="animate"
                      className="absolute -right-1 -top-1"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
                    </motion.div>
                    {/* Efecto de brillo */}
                    <motion.div
                      className="absolute inset-0 rounded-xl bg-gradient-to-tr from-transparent via-white/20 to-transparent"
                      animate={{
                        rotate: [0, 360],
                      }}
                      transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "linear"
                      }}
                      style={{ mixBlendMode: 'overlay' }}
                    />
                  </motion.div>
                  <div>
                    <motion.h1 
                      className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2, duration: 0.5 }}
                    >
                      Dashboard
                    </motion.h1>
                    <motion.p 
                      className="text-muted-foreground text-sm"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3, duration: 0.5 }}
                    >
                      Resumen de tu negocio
                    </motion.p>
                  </div>
                  
                  {/* Badge de estado */}
                  <motion.div
                    className="ml-auto hidden sm:flex items-center gap-2"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
                  >
                    <motion.div
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium"
                      animate={{ 
                        boxShadow: [
                          '0 0 0 0 rgba(16, 185, 129, 0)',
                          '0 0 0 4px rgba(16, 185, 129, 0.1)',
                          '0 0 0 0 rgba(16, 185, 129, 0)'
                        ]
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <motion.div
                        className="w-2 h-2 rounded-full bg-emerald-500"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                      Sistema Activo
                    </motion.div>
                  </motion.div>
                </motion.div>

                {/* Tarjetas de estadísticas principales */}
                <SectionCards />

                {/* Gráficos principales */}
                <motion.div 
                  className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 lg:px-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                >
                  <ChartAreaInteractive />
                  <TopProductsTable />
                </motion.div>

                {/* Distribución y análisis */}
                <motion.div 
                  className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 lg:px-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.5 }}
                >
                  <StockDistributionChart />
                  <TransferenciasStats />
                </motion.div>

                {/* Alertas y productos críticos */}
                <motion.div 
                  className="px-4 lg:px-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7, duration: 0.5 }}
                >
                  <StockBajoTable />
                </motion.div>
              </StaggerItem>
            </div>
          </StaggerContainer>
        </PageTransition>
      </SidebarInset>
    </SidebarProvider>
  )
}
