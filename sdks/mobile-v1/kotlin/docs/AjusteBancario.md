
# AjusteBancario

## Properties
| Name | Type | Description | Notes |
| ------------ | ------------- | ------------- | ------------- |
| **ajusteId** | **kotlin.String** |  |  |
| **tenantId** | **kotlin.String** |  |  |
| **cuentaId** | **kotlin.String** |  |  |
| **tipo** | [**inline**](#Tipo) |  |  |
| **monto** | **kotlin.String** | Decimal serializado como texto. |  |
| **moneda** | **kotlin.String** |  |  |
| **descripcion** | **kotlin.String** |  |  |
| **motivo** | **kotlin.String** |  |  |
| **realizadoPor** | **kotlin.String** |  |  |
| **fechaOperacion** | [**java.time.OffsetDateTime**](java.time.OffsetDateTime.md) |  |  |
| **createdAt** | [**java.time.OffsetDateTime**](java.time.OffsetDateTime.md) |  |  |
| **updatedAt** | [**java.time.OffsetDateTime**](java.time.OffsetDateTime.md) |  |  |
| **tasaCambio** | **kotlin.String** |  |  [optional] |
| **montoConvertido** | **kotlin.String** |  |  [optional] |


<a id="Tipo"></a>
## Enum: tipo
| Name | Value |
| ---- | ----- |
| tipo | ingreso, egreso |



