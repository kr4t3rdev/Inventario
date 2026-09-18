# Referidos

> Gestiona el programa de afiliados: códigos de referido, comisiones, créditos sobre licencias y perks especiales.

## Qué hace

Este módulo permite que un tenant refiera a otro y obtenga beneficios cuando ese referido se convierte en cliente real. El sistema sigue todo el recorrido: generación del código, registro del referido, confirmación de pago, ledger de comisiones y asignación de perks.

## Qué incluye

- generar o consultar el código de referido del tenant
- ver dashboard del programa de afiliados
- registrar un referido a partir de un código
- confirmar el pago del tenant referido
- calcular crédito disponible para aplicar a licencias
- asignar perks por hitos alcanzados
- solicitar y revisar perks personalizados

## Reglas importantes

- Solo tenants elegibles y con licencia activa pueden participar plenamente.
- El crédito no es lo mismo que el perk: uno descuenta precio, el otro habilita beneficios concretos.
- La confirmación del referido impacta comisiones y saldo disponible.
- Admin y tenant ven el mismo dominio, pero con paneles distintos.

## Vistas disponibles

- `/busy/referidos`: dashboard del tenant con código, ventas confirmadas, crédito y perks.
- `/admin/referidos`: conciliación global de referidos, ledger y asignación manual de perks.

## Cuándo usarlo

- Cuando una empresa quiere compartir su código de referido.
- Cuando soporte o admin necesita confirmar un pago referido.
- Cuando querés revisar crédito disponible antes de renovar una licencia.
- Cuando hace falta asignar un perk pendiente o auditar el ledger.

## Qué conviene cuidar

- Conviene revisar el ledger y los perks pendientes para que el programa no quede desalineado con pagos reales.
- Si se rompe el flujo de referido, también se afecta la conversión comercial del producto.

## Rutas y referencias

- `/busy/referidos`
- `/admin/referidos`
- `src/features/affiliate/actions.ts`
- `src/features/affiliate/components/affiliate-dashboard-page.tsx`
- `src/app/busy/referidos/page.tsx`
- `src/app/admin/referidos/page.tsx`

## Relación con otros módulos

- **Licencias**: los créditos pueden reducir el costo final de una renovación o compra.
- **Admin**: concentra conciliación, confirmaciones y perks.
- **Landing/Auth**: el código de referido puede entrar en el flujo de registro.

## En una frase

Convierte recomendaciones comerciales en crédito, comisiones y beneficios trazables.
