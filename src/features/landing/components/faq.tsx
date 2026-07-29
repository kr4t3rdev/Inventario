"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";

import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { FAQ_ITEMS } from "@/features/landing/data";
import { SpringSection } from "@/features/landing/utils";

/**
 * @description Sección de preguntas frecuentes con acordeón animado.
 * @returns {JSX.Element} FAQ accordion
 */
export function LandingFaq(): React.JSX.Element {
	const reduceMotion = useReducedMotion();
	return (
		<section id="faq" className="space-y-10 scroll-mt-24">
			<SpringSection reduceMotion={Boolean(reduceMotion)} className="mx-auto max-w-3xl space-y-3 text-center">
				<span className="inline-flex rounded-full border border-cyan-accent bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-accent font-mono">
					FAQ
				</span>
				<h2 className="text-4xl font-bold tracking-tight sm:text-5xl font-mono leading-[1.05] tracking-display">
					Preguntas frecuentes
				</h2>
				<p className="text-muted-foreground sm:text-lg">
					Todo lo que necesitás saber antes de dar el próximo paso.
				</p>
			</SpringSection>

			<motion.div
				initial={reduceMotion ? false : { y: 20 }}
				whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
				viewport={{ once: true, amount: 0.15 }}
				transition={reduceMotion ? undefined : { type: "spring", stiffness: 120, damping: 20 }}
				className="mx-auto max-w-3xl"
			>
				<Accordion type="single" collapsible className="space-y-3">
					{FAQ_ITEMS.map((item, index) => (
						<motion.div
							key={item.question}
							initial={reduceMotion ? false : { y: 12 }}
							whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
							viewport={{ once: true, amount: 0.1 }}
							transition={reduceMotion ? undefined : {
								type: "spring",
								stiffness: 120,
								damping: 20,
								delay: index * 0.05,
							}}
						>
							<AccordionItem
								value={`item-${index}`}
								className="rounded-xl border border-border/60 bg-card/60 px-5"
							>
								<AccordionTrigger className="text-left font-medium font-mono text-sm hover:no-underline">
									{item.question}
								</AccordionTrigger>
								<AccordionContent className="text-sm text-muted-foreground">
									{item.answer}
								</AccordionContent>
							</AccordionItem>
						</motion.div>
					))}
				</Accordion>
			</motion.div>
		</section>
	);
}
