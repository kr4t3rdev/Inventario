
# ExpenseReconciliationRequest

## Properties
| Name | Type | Description | Notes |
| ------------ | ------------- | ------------- | ------------- |
| **tipoGasto** | [**inline**](#TipoGasto) |  |  |
| **monto** | [**java.math.BigDecimal**](java.math.BigDecimal.md) |  |  |
| **descripcion** | **kotlin.String** |  |  |
| **pgId** | **kotlin.String** |  |  [optional] |
| **gastosDEId** | **kotlin.String** |  |  [optional] |
| **gastoCompraId** | **kotlin.String** |  |  [optional] |
| **referenciaId** | **kotlin.String** |  |  [optional] |
| **cuentaId** | **kotlin.String** |  |  [optional] |
| **tipoPagoId** | **kotlin.String** |  |  [optional] |
| **moneda** | **kotlin.String** |  |  [optional] |
| **tasaCambio** | [**java.math.BigDecimal**](java.math.BigDecimal.md) |  |  [optional] |
| **periodo** | **kotlin.String** |  |  [optional] |
| **observaciones** | **kotlin.String** |  |  [optional] |
| **estado** | [**inline**](#Estado) |  |  [optional] |
| **cuentaPorPagarId** | **kotlin.String** |  |  [optional] |
| **numeroTransaccion** | **kotlin.String** |  |  [optional] |
| **distribucion** | [**kotlin.collections.List&lt;ExpenseDistributionRequest&gt;**](ExpenseDistributionRequest.md) |  |  [optional] |


<a id="TipoGasto"></a>
## Enum: tipoGasto
| Name | Value |
| ---- | ----- |
| tipoGasto | salario, gastoDE, compra |


<a id="Estado"></a>
## Enum: estado
| Name | Value |
| ---- | ----- |
| estado | PENDIENTE, PAGADA, PARCIAL |



