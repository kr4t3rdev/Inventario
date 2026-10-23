
# CapitalInjectionCreateRequest

## Properties
| Name | Type | Description | Notes |
| ------------ | ------------- | ------------- | ------------- |
| **montoRecibido** | [**java.math.BigDecimal**](java.math.BigDecimal.md) |  |  |
| **tipo** | [**inline**](#Tipo) |  |  |
| **cuentaId** | **kotlin.String** |  |  |
| **moneda** | **kotlin.String** |  |  [optional] |
| **descripcion** | **kotlin.String** |  |  [optional] |
| **socio** | **kotlin.String** |  |  [optional] |
| **entidadPrestamista** | **kotlin.String** |  |  [optional] |
| **tasaInteres** | [**java.math.BigDecimal**](java.math.BigDecimal.md) |  |  [optional] |
| **tasaCambio** | [**java.math.BigDecimal**](java.math.BigDecimal.md) |  |  [optional] |
| **plazoMeses** | **kotlin.Int** |  |  [optional] |
| **fechaInicioPago** | [**java.time.OffsetDateTime**](java.time.OffsetDateTime.md) |  |  [optional] |
| **fechaOperacion** | [**java.time.OffsetDateTime**](java.time.OffsetDateTime.md) |  |  [optional] |
| **idempotencyKey** | **kotlin.String** | Clave opcional de idempotencia (1 a 64 caracteres). Si se proporciona también Idempotency-Key, prevalece esta propiedad. |  [optional] |


<a id="Tipo"></a>
## Enum: tipo
| Name | Value |
| ---- | ----- |
| tipo | CAPITAL_SOCIAL, DEUDA_EXTERNA |



