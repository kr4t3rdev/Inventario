import React from "react";
import Link from "next/link";

/**
 * @description Footer del landing con links de navegación y copyright.
 * @returns {JSX.Element} Footer
 */
export function LandingFooter(): React.JSX.Element {
	return (
		<footer className="border-t border-border/50 bg-muted/35">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-6 lg:flex-row lg:items-start lg:justify-between">
				<div className="max-w-md space-y-2">
					<p className="text-lg font-bold font-mono tracking-tight">
						Fina<span className="text-primary">nce</span>MDM
					</p>
					<p className="text-sm text-muted-foreground">
						Soluciones financieras inteligentes para empresas que quieren operar
						con más precisión, velocidad y visibilidad.
					</p>
				</div>

				<div className="grid gap-5 sm:grid-cols-2">
					<div className="space-y-2">
						<p className="text-sm font-semibold font-mono">Producto</p>
						<div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
							<Link
								href="#caracteristicas"
								className="hover:text-foreground hover:underline"
							>
								Características
							</Link>
							<Link
								href="#beneficios"
								className="hover:text-foreground hover:underline"
							>
								Beneficios
							</Link>
							<Link
								href="#precios"
								className="hover:text-foreground hover:underline"
							>
								Planes
							</Link>
						</div>
					</div>
					<div className="space-y-2">
						<p className="text-sm font-semibold font-mono">Acceso</p>
						<div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
							<Link
								href="/login"
								className="hover:text-foreground hover:underline"
							>
								Login
							</Link>
							<Link
								href="/register"
								className="hover:text-foreground hover:underline"
							>
								Registro
							</Link>
							<Link
								href="#contacto"
								className="hover:text-foreground hover:underline"
							>
								Contacto
							</Link>
						</div>
					</div>
				</div>
			</div>

			<div className="border-t border-border/50 py-4">
				<p className="text-center text-sm text-muted-foreground font-mono">
					© {new Date().getFullYear()} kr4t3r. Todos los derechos reservados.
				</p>
			</div>
		</footer>
	);
}
