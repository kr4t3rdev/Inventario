'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, MousePointerClick } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PvDemoInteractive } from '@/features/landing/components/pos-demo/pv-demo';

/**
 * @description Sección del landing que muestra el POS interactivo del producto.
 *              Header con eyebrow + título + subtítulo + CTA, y debajo el device-frame
 *              con la demo embebida. Pensada para insertarse entre el hero y los stats.
 * @param {{ reduceMotion?: boolean }} props - Preferencia de movimiento del usuario.
 * @returns {JSX.Element} Sección "Probá el POS en vivo" del landing.
 */
export function LandingPosDemoSection({ reduceMotion = false }: { reduceMotion?: boolean }) {
	return (
		<section id="demo-pos" className="flex flex-col gap-10 scroll-mt-24">
			{/* Header */}
			<motion.div
				initial={reduceMotion ? false : { y: 30 }}
				whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
				viewport={{ once: true, amount: 0.3 }}
				transition={reduceMotion ? undefined : { type: 'spring', stiffness: 120, damping: 20 }}
				className="flex flex-col gap-4 text-center"
			>
				<div className="flex justify-center">
					<span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary font-mono">
						<MousePointerClick className="h-3.5 w-3.5" />
						Demo interactiva en vivo
					</span>
				</div>

				<h2 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl font-mono leading-[1.1] tracking-display">
					Probá el punto de venta antes de registrarte
				</h2>

				<p className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-lg">
					Es la interfaz real del POS que usan los negocios en producción: búsqueda,
					filtros, vistas, scanner de código de barras, carrito editable, descuentos,
					formas de pago y ticket. Sin formularios, sin compromiso — directo en tu navegador.
				</p>

				<div className="flex flex-wrap justify-center gap-2 pt-1">
					<Badge variant="outline" className="font-mono text-xs">
						6 productos demo
					</Badge>
					<Badge variant="outline" className="font-mono text-xs">
						3 vistas disponibles
					</Badge>
					<Badge variant="outline" className="font-mono text-xs">
						Sin iniciar sesión
					</Badge>
					<Badge variant="outline" className="font-mono text-xs">
						Datos de demostración
					</Badge>
				</div>
			</motion.div>

			{/* Device frame con la demo */}
			<motion.div
				initial={reduceMotion ? false : { y: 40 }}
				whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
				viewport={{ once: true, amount: 0.15 }}
				transition={reduceMotion ? undefined : { type: 'spring', stiffness: 120, damping: 20, delay: 0.1 }}
				className="relative"
			>
				<div className="relative rounded-asymmetric-tl-br border border-primary/20 bg-card p-2 shadow-xl shadow-primary/10 glow-primary">
					{/* Browser chrome bar */}
					<div className="flex items-center gap-1.5 px-3 py-2 mb-1">
						<span className="h-3 w-3 rounded-full bg-red-500/70" />
						<span className="h-3 w-3 rounded-full bg-yellow-500/70" />
						<span className="h-3 w-3 rounded-full bg-emerald-500/70" />
						<div className="ml-3 flex-1 max-w-md">
							<div className="rounded-md border border-border/60 bg-muted/40 px-3 py-1 font-mono text-[10px] text-muted-foreground">
								app.financemdm.com/busy/sales/pos — demo pública
							</div>
						</div>
					</div>

					{/* Demo content */}
					<div className="rounded-2xl bg-background p-4 md:p-6">
						<PvDemoInteractive reduceMotion={reduceMotion} />
					</div>
				</div>
			</motion.div>

			{/* CTA al pie de la sección */}
			<motion.div
				initial={reduceMotion ? false : { y: 20 }}
				whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
				viewport={{ once: true, amount: 0.5 }}
				transition={reduceMotion ? undefined : { duration: 0.4, delay: 0.2 }}
				className="flex flex-col items-center gap-3 text-center"
			>
				<p className="text-sm text-muted-foreground font-mono">
					Esta demostración funciona con datos de demostración. La configuración de tu tenant depende
					del plan aprobado y del alta administrativa.
				</p>
				<div className="flex flex-wrap items-center justify-center gap-3">
					<motion.div
						whileHover={reduceMotion ? undefined : { scale: 1.03 }}
						whileTap={reduceMotion ? undefined : { scale: 0.98 }}
					>
						<Button asChild size="lg" className="group cursor-pointer gap-2">
							<Link href="/register">
								Registrarse
								<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
							</Link>
						</Button>
					</motion.div>
					<motion.div
						whileHover={reduceMotion ? undefined : { scale: 1.03 }}
						whileTap={reduceMotion ? undefined : { scale: 0.98 }}
					>
						<Button asChild size="lg" variant="outline" className="cursor-pointer">
							<Link href="#precios">
								Ver planes
							</Link>
						</Button>
					</motion.div>
				</div>
			</motion.div>
		</section>
	);
}
