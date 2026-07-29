'use client';

import type { ReactNode } from 'react';

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';

interface PosDemoDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description: string;
	className?: string;
	children: ReactNode;
}

/**
 * @description Wrapper compartido para los diálogos interactivos de la demo POS.
 * @param {PosDemoDialogProps} props - Estado, contenido y textos accesibles del diálogo.
 * @returns {JSX.Element} Diálogo POS con encabezado accesible.
 */
export function PosDemoDialog({
	open,
	onOpenChange,
	title,
	description,
	className,
	children,
}: PosDemoDialogProps): React.JSX.Element {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className={className}>
				<DialogHeader className="sr-only">
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				{children}
			</DialogContent>
		</Dialog>
	);
}
