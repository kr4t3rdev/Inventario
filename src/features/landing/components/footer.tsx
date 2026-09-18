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

				<div className="flex flex-wrap items-center gap-2 text-sm">
					<Link href="#demo-pos" className="rounded-md bg-primary px-3 py-2 font-semibold text-primary-foreground hover:bg-primary/90">
						Ver demo POS
					</Link>
					<Link href="#precios" className="rounded-md border border-border px-3 py-2 font-semibold hover:bg-muted">
						Ver planes
					</Link>
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
							<Link
								href="#faq"
								className="hover:text-foreground hover:underline"
							>
								Preguntas frecuentes
							</Link>
							<Link
								href="/docs"
								className="hover:text-foreground hover:underline"
							>
								Documentación
							</Link>
						</div>
					</div>
					<div className="space-y-2">
						<p className="text-sm font-semibold font-mono">Acceso</p>
						<div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
							<Link
								href="/login"
								className="hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							>
								Iniciar sesión
							</Link>
							<Link
								href="/register"
								className="hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							>
								Registrarse
							</Link>
							<Link
								href="#contacto"
								className="hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
