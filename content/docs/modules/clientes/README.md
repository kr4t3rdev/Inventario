# Clientes

> Mantiene el catálogo de clientes del tenant con datos de contacto, cuentas y referencias contractuales.

## Qué hace

Este módulo centraliza las contrapartes comerciales del lado cliente. Guarda nombre, dirección, teléfono, logo, cuentas y número de contrato, y luego otros módulos como ventas, facturas, ofertas y contratos reutilizan esos datos.

## Qué incluye

- listado de clientes
- alta, edición y borrado
- logo del cliente
- cuentas CUP y USD
- número de contrato asociado
- uso posterior en ventas y documentos

## Cuándo usarlo

- Cuando necesitás registrar una nueva contraparte comercial.
- Cuando una venta, oferta o contrato requiere seleccionar cliente.
- Cuando querés mantener actualizados datos de contacto y cuenta.

## Reglas importantes

- El acceso depende de la feature `clientes`.
- El catálogo es tenant-scoped.
- El logo puede manejarse como asset administrado.
- El número de contrato puede ser actualizado indirectamente por el módulo de contratos.

## Qué conviene cuidar

- Si los datos del cliente están incompletos, después fallan o empobrecen documentos comerciales.
- No trates este módulo como solo “contactos”: también tiene impacto contractual y documental.

## Rutas y referencias

- `/busy/cliente`
- `/busy/cliente/new`
- `/busy/cliente/update/[id]`
- `src/features/clientes/actions.ts`

## En una frase

Es la libreta comercial del tenant para vender, facturar y contratar con datos consistentes.
