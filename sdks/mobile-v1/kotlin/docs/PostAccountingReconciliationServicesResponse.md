
# PostAccountingReconciliationServicesResponse

## Properties
| Name | Type | Description | Notes |
| ------------ | ------------- | ------------- | ------------- |
| **reconciliacionId** | **kotlin.String** |  |  [optional] |
| **cuentaId** | **kotlin.String** |  |  [optional] |
| **tipoPagoId** | **kotlin.String** |  |  [optional] |
| **monto** | [**java.math.BigDecimal**](java.math.BigDecimal.md) |  |  [optional] |
| **moneda** | **kotlin.String** |  |  [optional] |
| **tasaCambio** | [**java.math.BigDecimal**](java.math.BigDecimal.md) |  |  [optional] |
| **montoConvertido** | [**java.math.BigDecimal**](java.math.BigDecimal.md) |  |  [optional] |
| **fechaReconciliacion** | [**java.time.OffsetDateTime**](java.time.OffsetDateTime.md) |  |  [optional] |
| **replayed** | **kotlin.Boolean** | Indica si se devolvió una conciliación existente para la misma clave idempotente. |  [optional] |
| **observaciones** | **kotlin.String** |  |  [optional] |



