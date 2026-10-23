/**
 * @description Ruta legacy de configuración fiscal.
 * La configuración fiscal se unificó dentro de Mi Empresa (misma pantalla,
 * sección "Facturación fiscal"): esta ruta solo redirige allí para no
 * romper enlaces guardados.
 */
import { redirect } from "next/navigation"

export const metadata = { title: "Facturación fiscal - FinanceMDM" }

export default function ConfiguracionFiscalPage() {
	redirect("/busy/configuracion/mi-empresa#facturacion-fiscal")
}
