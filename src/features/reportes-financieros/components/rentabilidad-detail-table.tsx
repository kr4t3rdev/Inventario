"use client";

import { useMemo, useState } from "react";
import { FileIcon as FilePdf, FileText, ArrowUpDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "@/components/ui/pagination";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn, formatCurrency } from "@/lib/utils";
import { exportToPdf, exportToCsv } from "@/lib/export-utils";
import type { ProductoAnalisis } from "@/features/reportes-financieros/actions-rentabilidad-compra";


interface DetailTableProps {
	productos: ProductoAnalisis[];
	numeroFactura?: string;
}

type SortField =
	| "productoNombre"
	| "cantidadComprada"
	| "unidadesVendidas"
	| "ingresos"
	| "ganancia"
	| "margen"
	| "diasPromedioVenta";
type SortDir = "asc" | "desc";

/**
 * @description Tabla detalle del reporte de rentabilidad con exportación CSV/PDF.
 *
 * @param {DetailTableProps} props - Productos del análisis.
 * @returns {JSX.Element} Tabla paginada y ordenable con exportación.
 */
import { SURFACE_CARD_CLASS } from "@/features/reportes-financieros/lib/reporte-styles"

export function RentabilidadDetailTable({
	productos,
	numeroFactura,
}: DetailTableProps) {
	const [currentPage, setCurrentPage] = useState(1);
	const [pageSize, setPageSize] = useState(10);
	const [sortField, setSortField] = useState<SortField>("ganancia");
	const [sortDir, setSortDir] = useState<SortDir>("desc");

	const sorted = useMemo(() => {
		const sorted = [...productos].sort((a, b) => {
			const aVal = a[sortField] ?? 0;
			const bVal = b[sortField] ?? 0;
			if (typeof aVal === "string") {
				return sortDir === "asc"
					? aVal.localeCompare(bVal as string)
					: (bVal as string).localeCompare(aVal);
			}
			return sortDir === "asc"
				? (aVal as number) - (bVal as number)
				: (bVal as number) - (aVal as number);
		});
		return sorted;
	}, [productos, sortField, sortDir]);

	const totalPages = Math.ceil(sorted.length / pageSize);
	const startIndex = (currentPage - 1) * pageSize;
	const paginated = sorted.slice(startIndex, startIndex + pageSize);

	const toggleSort = (field: SortField) => {
		if (sortField === field) {
			setSortDir((d) => (d === "asc" ? "desc" : "asc"));
		} else {
			setSortField(field);
			setSortDir("desc");
		}
	};

	const handleExportCsv = () => {
		const data = productos.map((p) => ({
			Producto: p.productoNombre,
			"Cant. Comprada": p.cantidadComprada,
			"Costo Unit.": p.costoUnitario,
			"Costo Total": p.costTotal,
			"Cant. Vendida": p.unidadesVendidas,
			Ingresos: p.ingresos,
			"Costo Vendido": p.costoVendido,
			Ganancia: p.ganancia,
			Margen: `${p.margen.toFixed(1)}%`,
			"Stock Restante": p.stockRestante,
			"Días Prom.": p.diasPromedioVenta?.toFixed(1) ?? "N/A",
			Velocidad: `${p.velocidadVenta.toFixed(2)} unids/día`,
		}));
		exportToCsv(data, `Rentabilidad_${numeroFactura || "Compra"}`);
	};

	const handleExportPdf = () => {
		exportToPdf(
			productos,
			null,
			`Rentabilidad de Compra - ${numeroFactura || "Sin factura"}`,
		);
	};

	return (
		<div className="space-y-4">
			{/* Toolbar */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					{productos.length > 0 && (
						<span className="text-sm text-muted-foreground">
							{productos.length} producto(s)
						</span>
					)}
				</div>
				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm" onClick={handleExportPdf}>
						<FilePdf className="mr-2 h-4 w-4" />
						PDF
					</Button>
					<Button variant="outline" size="sm" onClick={handleExportCsv}>
						<FileText className="mr-2 h-4 w-4" />
						CSV
					</Button>
				</div>
			</div>

			{/* Tabla */}
			<div className="rounded-md border">
				<Table>
					<TableHeader className="bg-muted/50">
						<TableRow>
							<TableHead
								className="cursor-pointer"
								onClick={() => toggleSort("productoNombre")}
							>
								<span className="flex items-center gap-1">
									Producto
									<ArrowUpDown className="h-3 w-3" />
								</span>
							</TableHead>
							<TableHead
								className="cursor-pointer text-right"
								onClick={() => toggleSort("cantidadComprada")}
							>
								<span className="flex items-center justify-end gap-1">
									Comp.
									<ArrowUpDown className="h-3 w-3" />
								</span>
							</TableHead>
							<TableHead className="text-right">Costo U.</TableHead>
							<TableHead
								className="cursor-pointer text-right"
								onClick={() => toggleSort("unidadesVendidas")}
							>
								<span className="flex items-center justify-end gap-1">
									Vend.
									<ArrowUpDown className="h-3 w-3" />
								</span>
							</TableHead>
							<TableHead
								className="cursor-pointer text-right"
								onClick={() => toggleSort("ingresos")}
							>
								<span className="flex items-center justify-end gap-1">
									Ingresos
									<ArrowUpDown className="h-3 w-3" />
								</span>
							</TableHead>
							<TableHead
								className="cursor-pointer text-right"
								onClick={() => toggleSort("ganancia")}
							>
								<span className="flex items-center justify-end gap-1">
									Ganancia
									<ArrowUpDown className="h-3 w-3" />
								</span>
							</TableHead>
							<TableHead
								className="cursor-pointer text-right"
								onClick={() => toggleSort("margen")}
							>
								<span className="flex items-center justify-end gap-1">
									Margen
									<ArrowUpDown className="h-3 w-3" />
								</span>
							</TableHead>
							<TableHead className="text-right">Stock Rest.</TableHead>
							<TableHead
								className="cursor-pointer text-right"
								onClick={() => toggleSort("diasPromedioVenta")}
							>
								<span className="flex items-center justify-end gap-1">
									Días
									<ArrowUpDown className="h-3 w-3" />
								</span>
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{paginated.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={9}
									className="py-8 text-center text-muted-foreground"
								>
									No hay productos en esta compra
								</TableCell>
							</TableRow>
						) : (
							paginated.map((p) => (
								<TableRow
									key={p.productoId}
									className="hover:bg-muted/50 transition-colors"
								>
									<TableCell
										className="font-medium max-w-[200px] truncate"
										title={p.productoNombre}
									>
										{p.productoNombre}
									</TableCell>
									<TableCell className="text-right">
										{p.cantidadComprada}
									</TableCell>
									<TableCell className="text-right font-mono text-xs">
										{formatCurrency(p.costoUnitario)}
									</TableCell>
									<TableCell className="text-right">
										<Badge
											variant={p.unidadesVendidas > 0 ? "default" : "secondary"}
										>
											{p.unidadesVendidas}
										</Badge>
									</TableCell>
									<TableCell className="text-right font-mono text-xs">
										{formatCurrency(p.ingresos)}
									</TableCell>
									<TableCell
										className={cn(
											"text-right font-mono text-xs font-medium",
											p.ganancia >= 0 ? "text-green-600" : "text-red-600",
										)}
									>
										{formatCurrency(p.ganancia)}
									</TableCell>
									<TableCell className="text-right">
										<Badge
											variant={p.margen > 0 ? "default" : "destructive"}
											className="font-mono text-xs"
										>
											{p.margen.toFixed(1)}%
										</Badge>
									</TableCell>
									<TableCell className="text-right text-xs">
										{p.stockRestante > 0 ? (
											<span>
												{p.stockRestante}
												<span className="text-muted-foreground ml-1">
													({p.stockRestantePct.toFixed(0)}%)
												</span>
											</span>
										) : (
											<Badge variant="outline" className="text-xs">
												Agotado
											</Badge>
										)}
									</TableCell>
									<TableCell className="text-right text-xs">
										{p.diasPromedioVenta !== null
											? `${p.diasPromedioVenta.toFixed(0)}d`
											: "—"}
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>

			{/* Paginación */}
			{totalPages > 1 && (
				<div className="flex flex-col items-center justify-between gap-4 border-t px-4 py-4 md:flex-row">
					<div className="flex items-center gap-2">
						<span className="text-sm text-muted-foreground">
							Filas por página:
						</span>
						<Select
							value={String(pageSize)}
							onValueChange={(v) => {
								setPageSize(Number(v));
								setCurrentPage(1);
							}}
						>
							<SelectTrigger className="h-8 w-[70px]">
								<SelectValue placeholder={pageSize} />
							</SelectTrigger>
							<SelectContent side="top">
								{[5, 10, 20, 50].map((s) => (
									<SelectItem key={s} value={String(s)}>
										{s}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="flex items-center gap-1 text-sm text-muted-foreground">
						<span>
							Página {currentPage} de {totalPages}
						</span>
						<span className="ml-2">
							({startIndex + 1}–{Math.min(startIndex + pageSize, sorted.length)}{" "}
							de {sorted.length})
						</span>
					</div>

					<Pagination className="justify-end">
						<PaginationContent>
							<PaginationItem>
								<PaginationPrevious
									onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
								/>
							</PaginationItem>
							{Array.from({ length: totalPages }, (_, i) => i + 1).map(
								(page) => {
									if (
										totalPages <= 7 ||
										page === 1 ||
										page === totalPages ||
										(page >= currentPage - 1 && page <= currentPage + 1)
									) {
										return (
											<PaginationItem key={page}>
												<PaginationLink
													isActive={currentPage === page}
													onClick={() => setCurrentPage(page)}
												>
													{page}
												</PaginationLink>
											</PaginationItem>
										);
									}
									if (page === currentPage - 2 || page === currentPage + 2) {
										return (
											<PaginationItem key={page}>
												<PaginationEllipsis />
											</PaginationItem>
										);
									}
									return null;
								},
							)}
							<PaginationItem>
								<PaginationNext
									onClick={() =>
										setCurrentPage(Math.min(totalPages, currentPage + 1))
									}
								/>
							</PaginationItem>
						</PaginationContent>
					</Pagination>
				</div>
			)}
		</div>
	);
}
