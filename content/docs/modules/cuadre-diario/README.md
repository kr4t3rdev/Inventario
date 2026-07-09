# Cuadre Diario

> Resume por día ingresos, gastos, turnos, arqueos, métodos de pago y variación contra el día anterior.

## Qué hace

Este módulo arma una fotografía diaria del negocio cruzando ventas de productos, ventas de servicios, gastos operativos, compras, salarios, turnos y arqueos. No es solo un reporte visual: consolida lo que pasó en caja durante una fecha específica.

## Qué incluye

- ingresos del día
- gastos del día
- diferencia neta
- variación respecto a ayer
- detalle de ventas y servicios
- detalle de gastos y movimientos
- resumen por método de pago
- turnos y arqueos del día

## Cuándo usarlo

- Cuando necesitás un cierre ejecutivo rápido del día.
- Cuando querés detectar si ventas y gastos dejaron una diferencia sana o preocupante.
- Cuando soporte o gerencia necesita revisar caja sin navegar varios módulos.

## Reglas importantes

- El acceso depende de la feature `cuadre-diario`.
- Mezcla información de ventas, servicios, compras, salarios, turnos y arqueos.
- Calcula variación diaria contra el día anterior.
- El método de pago se normaliza para la UI del reporte.

## Qué conviene cuidar

- Si un total luce raro, conviene revisar primero el módulo fuente y no asumir error del cuadre.
- Este módulo resume lo ya registrado; no corrige inconsistencias por sí mismo.

## Referencias útiles

- `src/app/busy/cuadre/page.tsx`
- `src/features/cuadre-diario/actions.ts`

## En una frase

Te da el cierre operativo del día combinando ventas, gastos y caja en una sola vista.
