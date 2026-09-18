
# SaleCreateRequest

## Properties
| Name | Type | Description | Notes |
| ------------ | ------------- | ------------- | ------------- |
| **puntoDeVentaId** | **kotlin.String** |  |  |
| **items** | [**kotlin.collections.List&lt;SaleItemRequest&gt;**](SaleItemRequest.md) |  |  |
| **clienteId** | **kotlin.String** |  |  [optional] |
| **empleadoId** | **kotlin.String** |  |  [optional] |
| **descuento** | **kotlin.Int** |  |  [optional] |
| **observaciones** | **kotlin.String** |  |  [optional] |
| **turnoId** | **kotlin.String** |  |  [optional] |
| **metodoPago** | **kotlin.String** |  |  [optional] |
| **montoEfectivo** | [**java.math.BigDecimal**](java.math.BigDecimal.md) |  |  [optional] |
| **montoTarjeta** | [**java.math.BigDecimal**](java.math.BigDecimal.md) |  |  [optional] |
| **montoTransferencia** | [**java.math.BigDecimal**](java.math.BigDecimal.md) |  |  [optional] |
| **montoCredito** | [**java.math.BigDecimal**](java.math.BigDecimal.md) |  |  [optional] |
| **tipoVencimiento** | [**inline**](#TipoVencimiento) |  |  [optional] |
| **fechaVencimiento** | **kotlin.String** |  |  [optional] |
| **cuentaBancariaId** | **kotlin.String** |  |  [optional] |


<a id="TipoVencimiento"></a>
## Enum: tipoVencimiento
| Name | Value |
| ---- | ----- |
| tipoVencimiento | contra_pago, fecha, plazo,  |



