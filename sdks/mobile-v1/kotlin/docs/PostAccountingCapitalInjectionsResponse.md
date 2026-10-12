
# PostAccountingCapitalInjectionsResponse

## Properties
| Name | Type | Description | Notes |
| ------------ | ------------- | ------------- | ------------- |
| **id** | **kotlin.String** |  |  |
| **tipo** | [**inline**](#Tipo) |  |  |
| **montoRecibido** | **kotlin.String** | Decimal serializado como texto. |  |
| **moneda** | **kotlin.String** |  |  |
| **cuentaId** | **kotlin.String** |  |  |
| **fechaRegistro** | [**java.time.OffsetDateTime**](java.time.OffsetDateTime.md) |  |  |
| **createdAt** | [**java.time.OffsetDateTime**](java.time.OffsetDateTime.md) |  |  |
| **updatedAt** | [**java.time.OffsetDateTime**](java.time.OffsetDateTime.md) |  |  |
| **tenantId** | **kotlin.String** |  |  [optional] |
| **tasaInteres** | **kotlin.String** |  |  [optional] |
| **montoInteres** | **kotlin.String** |  |  [optional] |
| **montoTotalDeuda** | **kotlin.String** |  |  [optional] |
| **saldoPendiente** | **kotlin.String** |  |  [optional] |
| **plazoMeses** | **kotlin.Int** |  |  [optional] |
| **fechaInicioPago** | [**java.time.OffsetDateTime**](java.time.OffsetDateTime.md) |  |  [optional] |
| **socio** | **kotlin.String** |  |  [optional] |
| **entidadPrestamista** | **kotlin.String** |  |  [optional] |
| **estado** | **kotlin.String** |  |  [optional] |
| **descripcion** | **kotlin.String** |  |  [optional] |


<a id="Tipo"></a>
## Enum: tipo
| Name | Value |
| ---- | ----- |
| tipo | CAPITAL_SOCIAL, DEUDA_EXTERNA |



