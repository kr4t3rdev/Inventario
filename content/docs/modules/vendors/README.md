# Proveedores (Vendors)

> Mantiene el catálogo de proveedores y les asigna código secuencial reutilizable en flujos de compra y EAN-13.

## Qué hace

Este módulo registra proveedores del tenant con datos de contacto, cuentas y branding, pero además les asigna `vendorCode` secuencial. Ese código no es menor: se reutiliza para lógica documental y para generación de EAN-13 en productos cuando aplica.

## Qué incluye

- listado de proveedores
- alta, edición y borrado
- código secuencial por proveedor
- derivación de código EAN-13 por proveedor
- logo, contacto y cuentas

## Cuándo usarlo

- Cuando necesitás crear o mantener proveedores para compras.
- Cuando productos EAN-13 requieren proveedor con código válido.
- Cuando querés ordenar la base de abastecimiento del tenant.

## Reglas importantes

- Cada proveedor recibe `vendorCode` automáticamente.
- A partir de ese código se puede generar el código EAN-13 del proveedor.
- El catálogo es tenant-scoped.
- El logo puede administrarse como asset externo.

## Qué conviene cuidar

- Si un proveedor queda mal configurado, el flujo EAN-13 y algunas compras pierden consistencia.
- Conviene no editar estos datos sin revisar su uso en productos y compras.

## Rutas y referencias

- `/busy/vendor`
- `/busy/vendor/new`
- `/busy/vendor/update/[id]`
- `src/features/vendors/actions.ts`
- `src/lib/vendor-code-utils.ts`

## En una frase

Es la base de abastecimiento del tenant y una pieza clave del modo EAN-13.
