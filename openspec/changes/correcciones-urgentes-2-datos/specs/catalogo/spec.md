# Delta spec — catálogo (guard de PV + cascadas no destructivas)

## MODIFIED Requirement: Borrado de punto de venta

El sistema DEBE impedir eliminar un punto de venta que tenga registros
asociados, con un error de negocio que incluya los conteos por tipo, y DEBE
permitir eliminar un punto de venta sin asociaciones.

#### Scenario: PV con productos no se elimina

- **WHEN** `deletePuntoDeVentaAction` se ejecuta sobre un PV con 3 productos
  asociados (y cualquier otra asociación en 0)
- **THEN** la action falla con código `PUNTO_VENTA_EN_USO`, el mensaje
  menciona `3 producto(s)` y `prisma.puntoDeVenta.delete` no se invoca.

#### Scenario: PV con traza financiera no se elimina

- **WHEN** el PV tiene ventas, turnos, arqueos o transferencias (origen o
  destino) asociadas
- **THEN** la action falla con `PUNTO_VENTA_EN_USO` y el mensaje incluye los
  conteos de cada categoría afectada.

#### Scenario: PV vacío se elimina

- **WHEN** el PV no tiene productos, ventas, turnos, arqueos ni
  transferencias asociadas
- **THEN** la action elimina el PV y retorna éxito.

## MODIFIED Requirement: Integridad referencial del catálogo en schema

El schema DEBE garantizar que ninguna eliminación en cascada pueda destruir
productos:

#### Scenario: cascadas destructivas prohibidas

- **WHEN** se inspecciona `prisma/schema.prisma`
- **THEN** `Producto.puntoDeVenta` usa `onDelete: SetNull`,
  `Producto.categoria` usa `onDelete: Restrict` y `Categoria.parent` usa
  `onDelete: Restrict`; un test de contrato estático falla si alguna de las
  tres vuelve a declarar `onDelete: Cascade`.
