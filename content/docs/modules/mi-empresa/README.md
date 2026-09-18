# Mi Empresa

> Configura la identidad operativa del tenant: datos legales, beneficiario, cuenta bancaria, logo y comportamiento EAN-13.

## Qué hace

Este módulo guarda la información base que el resto del sistema reutiliza en documentos, impresiones y reglas de negocio. No es solo una ficha descriptiva: también define si la empresa usa EAN-13 y, por lo tanto, cambia el comportamiento de categorías y productos.

## Datos que controla

- nombre comercial y propietario
- dirección, teléfono y email
- NIT y licencia de operación
- logo de la empresa
- cuenta bancaria principal / beneficiario documental
- flag `usaCodigoEan13`

## Cuándo usarlo

- Cuando necesitás corregir los datos que salen en facturas, ofertas o impresiones.
- Cuando querés cambiar la cuenta bancaria asociada a la empresa.
- Cuando vas a activar o desactivar el modo EAN-13 del tenant.

## Reglas importantes

- El acceso está protegido por la feature `mi-empresa`.
- Al activar `usaCodigoEan13`, el catálogo de productos y categorías cambia de comportamiento.
- Al desactivarlo, el histórico se conserva, pero la UI vuelve al modo normal de catálogo.
- La cuenta bancaria elegida y los datos legales se usan en documentos impresos.

## Qué conviene cuidar

- No trates este módulo como una pantalla aislada: impacta documentos, productos y configuración comercial.
- Un cambio en EAN-13 tiene consecuencias funcionales, no solo de etiquetas.
- Si el logo o los datos bancarios están mal, el error se replica en impresiones y comprobantes.

## Relación con otros módulos

- **Productos**: consume `usaCodigoEan13` para cambiar validaciones y columnas.
- **Categorías**: adapta labels y lógica CLAS.
- **Facturas / Ofertas / Documentos**: usan nombre, propietario, cuenta y datos legales.

## Referencias útiles

- `src/app/busy/configuracion/mi-empresa/page.tsx`
- `src/features/mi-empresa/actions.ts`
- `src/features/mi-empresa/services/mi-empresa-service.ts`
- `src/features/mi-empresa/components/mi-empresa-form.tsx`

## En una frase

Define quién es la empresa dentro del sistema y cómo se comporta su catálogo y su documentación.
