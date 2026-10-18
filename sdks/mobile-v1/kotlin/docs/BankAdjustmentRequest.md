
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
| **tasaCambio** | [**java.math.BigDecimal**](java.math.BigDecimal.md) |  |  [optional] |
| **fechaOperacion** | [**java.time.OffsetDateTime**](java.time.OffsetDateTime.md) |  |  [optional] |


<a id="Tipo"></a>
## Enum: tipo
| Name | Value |
| ---- | ----- |
| tipo | ingreso, egreso |



