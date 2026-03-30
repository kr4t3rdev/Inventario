# Proposal: Sistema inicial de categorías (categorías en 0)

## Intent
Definir dos modos de configuración de catálogo para creación de productos: (1) clasificador oficial importado (`Clas.exe`) con código EAN generado; (2) estructura libre definida por usuario sin generación automática de código de negocio/EAN.

## Scope
### In Scope
- Opción 1: documentar y aplicar estructura oficial en `src/lib/category-mapping.ts` usando campos del clasificador (`proveedor`, `seccion`, `especificos`, `surtido`).
- Regla de negocio: `surtido` (0000-9999) se reinicia al cambiar `proveedor` (00-99).
- Opción 2: habilitar configuración de catálogo personalizada y desactivar lógica de generación de código/EAN en formulario de producto.
- Ajustar UI en catálogo/producto para comunicar claramente qué modo está activo.

### Out of Scope
- Migración histórica de productos existentes.
- Reemplazo del formato oficial de `Clas.exe`.

## Approach
Agregar bandera de modo de clasificación en configuración de catálogo. Si modo = `clasificador_oficial`, usar mapping + generación EAN por segmentos. Si modo = `estructura_usuario`, mantener categorías/subcategorías manuales y ocultar/bloquear campos/preview de código de negocio y EAN en alta de producto.

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/category-mapping.ts` | Modified | Definición de secciones/específicos alineados a `Clas.exe`. |
| `src/app/busy/configuracion/catalogo/page.tsx` | Modified | Selector entre opción oficial y opción usuario. |
| `src/components/productos/productos-form.tsx` | Modified | Comportamiento condicional de generación/visualización de código. |
| `src/lib/ean13-utils.ts` | Modified | Aplicar reinicio de surtido por proveedor. |

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Inconsistencia entre archivo importado y mapping interno | Medium | Validación al importar + pruebas unitarias de mapping. |
| Usuarios confusos por cambio de modo | Medium | Mensajes explícitos en configuración y formulario. |

## Rollback Plan
Revertir bandera de modo a `clasificador_oficial` por defecto y restaurar comportamiento actual de `productos-form` y utilidades EAN.

## Dependencies
- Archivo oficial `Clas.exe` para tabla de secciones/específicos.

## Success Criteria
- [ ] Existen dos opciones visibles y persistidas en configuración de catálogo.
- [ ] En modo oficial se genera código con `surtido` reiniciando por proveedor.
- [ ] En modo usuario NO se genera código/EAN automáticamente en alta de producto.
