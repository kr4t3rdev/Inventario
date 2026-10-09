
# BankAdjustmentRequest

## Properties
| Name | Type | Description | Notes |
| ------------ | ------------- | ------------- | ------------- |
| **cuentaId** | **kotlin.String** |  |  |
| **tipo** | [**inline**](#Tipo) |  |  |
| **monto** | [**java.math.BigDecimal**](java.math.BigDecimal.md) |  |  |
| **descripcion** | **kotlin.String** |  |  |
| **motivo** | **kotlin.String** |  |  |
| **moneda** | **kotlin.String** |  |  [optional] |
| **idempotencyKey** | **kotlin.String** | Clave opcional para repetir la misma operación sin duplicarla. |  [optional] |


<a id="Tipo"></a>
## Enum: tipo
| Name | Value |
| ---- | ----- |
| tipo | ingreso, egreso |



