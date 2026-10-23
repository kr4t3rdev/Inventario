
# CashPaymentRequest

## Properties
| Name | Type | Description | Notes |
| ------------ | ------------- | ------------- | ------------- |
| **monto** | [**java.math.BigDecimal**](java.math.BigDecimal.md) |  |  |
| **cuentaId** | **kotlin.String** |  |  |
| **tipoPagoId** | **kotlin.String** |  |  |
| **moneda** | **kotlin.String** |  |  [optional] |
| **tasaCambio** | [**java.math.BigDecimal**](java.math.BigDecimal.md) |  |  [optional] |
| **observaciones** | **kotlin.String** |  |  [optional] |
| **idempotencyKey** | **kotlin.String** | Clave opcional de idempotencia (1 a 64 caracteres). Si también se envía Idempotency-Key en el encabezado, prevalece esta propiedad. |  [optional] |
| **fechaOperacion** | **kotlin.String** | Fecha explícita de operación: fecha ISO 8601 (YYYY-MM-DD) o timestamp ISO 8601 con zona horaria. Si se omite, se conserva la fecha actual. |  [optional] |



