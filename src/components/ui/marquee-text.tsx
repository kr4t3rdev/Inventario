"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";

/** @description Item individual del marquee con icono opcional, label y link opcional */
export type MarqueeItem = {
	icon?: React.ReactNode;
	label?: string;
	href?: string;
};

/**
 * @description Texto scrolleando infinito horizontal (marquee).
 *              Usado en la landing para mostrar features, stats, keywords o tech stack.
 * @param {{ text?: string; items?: MarqueeItem[]; speed?: number; direction?: 'left' | 'right'; className?: string; iconSize?: number }} props
 * @returns {JSX.Element} Marquee animado
 */
export function MarqueeText({
	text,
	items,
	speed = 30,
	direction = "left",
	className = "",
	iconSize = 14,
}: {
	text?: string;
	items?: MarqueeItem[];
	speed?: number;
	direction?: "left" | "right";
	className?: string;
	iconSize?: number;
}): React.JSX.Element {
	const reduceMotion = useReducedMotion();
	const scrollDuration = reduceMotion ? speed * 4 : speed;

	const iconPx = `${iconSize * 4}px`;

	let content: React.ReactNode;

	if (items) {
		const repeated = [...items, ...items, ...items, ...items];
		const hasLabels = items.some((item) => item.label && item.label.length > 0);

		const itemClassName = hasLabels
			? "inline-flex flex-col items-center gap-2"
			: "inline-flex items-center gap-1.5";

		const wrapperClassName = hasLabels
			? "inline-flex items-center gap-16"
			: "inline-flex items-center gap-24";

		content = (
			<span className={wrapperClassName}>
				{repeated.map((item, i) => {
					const content = (
						<>
							{item.icon && (
								<motion.span
									className="flex items-center justify-center"
									style={{
										width: iconPx,
										height: iconPx,
									}}
									animate={{
										y: reduceMotion ? 0 : [0, -5, 0],
										rotate: reduceMotion ? 0 : [0, 5, -5, 0],
									}}
									transition={{
										y: {
											duration: 3 + (i % items.length) * 0.2,
											repeat: Infinity,
											ease: "easeInOut",
										},
										rotate: {
											duration: 4 + (i % items.length) * 0.3,
											repeat: Infinity,
											ease: "easeInOut",
										},
									}}
									whileHover={{ scale: 1.2, filter: "brightness(1.3)" }}
								>
									{React.isValidElement(item.icon)
										? React.cloneElement(
												item.icon as React.ReactElement<{
													style?: React.CSSProperties;
												}>,
												{
													style: { width: "100%", height: "100%" },
												},
											)
										: item.icon}
								</motion.span>
							)}
							{item.label && (
								<span className="text-[10px] font-mono text-muted-foreground/60 leading-tight">
									{item.label}
								</span>
							)}
						</>
					);

					const wrapped = item.href ? (
						<a
							key={`${item.label ?? "icon"}-${i}`}
							href={item.href}
							target="_blank"
							rel="noreferrer"
							className="transition-opacity hover:opacity-80"
						>
							<span className={itemClassName}>{content}</span>
						</a>
					) : (
						<span
							key={`${item.label ?? "icon"}-${i}`}
							className={itemClassName}
						>
							{content}
						</span>
					);

					return wrapped;
				})}
			</span>
		);
	} else {
		content = (
			<span className="text-muted-foreground/40 font-mono text-sm tracking-[0.2em] uppercase">
				{`${text}  •  ${text}  •  ${text}  •  ${text}  •  `}
			</span>
		);
	}

	return (
		<div className={`overflow-hidden whitespace-nowrap ${className}`}>
			<motion.div
				className="inline-block"
				animate={{
					x: direction === "left" ? ["0%", "-100%"] : ["-100%", "0%"],
				}}
				transition={{
					x: {
						repeat: Infinity,
						repeatType: "loop",
						duration: scrollDuration,
						ease: "linear",
					},
				}}
			>
				{content}
			</motion.div>
		</div>
	);
}
