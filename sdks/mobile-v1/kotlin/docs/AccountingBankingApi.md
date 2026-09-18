# AccountingBankingApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**mobileGetAccountingBankAccounts**](AccountingBankingApi.md#mobileGetAccountingBankAccounts) | **GET** /accounting/bank-accounts | Consultar cuentas bancarias |
| [**mobileGetAccountingBankAccountsById**](AccountingBankingApi.md#mobileGetAccountingBankAccountsById) | **GET** /accounting/bank-accounts/{id} | Consultar cuentas bancaria |
| [**mobileGetAccountingBankAccountsByIdNestedHistory**](AccountingBankingApi.md#mobileGetAccountingBankAccountsByIdNestedHistory) | **GET** /accounting/bank-accounts/{id}/history | Consultar historial de cuentas bancarias |
| [**mobileGetAccountingBankAdjustments**](AccountingBankingApi.md#mobileGetAccountingBankAdjustments) | **GET** /accounting/bank-adjustments | Consultar ajustes bancarios |
| [**mobileGetAccountingBankTransfers**](AccountingBankingApi.md#mobileGetAccountingBankTransfers) | **GET** /accounting/bank-transfers | Consultar transferencias bancarias |
| [**mobileGetAccountingBankTransfersById**](AccountingBankingApi.md#mobileGetAccountingBankTransfersById) | **GET** /accounting/bank-transfers/{id} | Consultar transferencias bancaria |
| [**mobileGetAccountingBankTransfersByIdComprobante**](AccountingBankingApi.md#mobileGetAccountingBankTransfersByIdComprobante) | **GET** /accounting/bank-transfers/{id}/comprobante | Descargar comprobante de transferencias bancarias |
| [**mobilePostAccountingBankAdjustments**](AccountingBankingApi.md#mobilePostAccountingBankAdjustments) | **POST** /accounting/bank-adjustments | Registrar ajustes bancarios |
| [**mobilePostAccountingBankTransfers**](AccountingBankingApi.md#mobilePostAccountingBankTransfers) | **POST** /accounting/bank-transfers | Registrar transferencias bancarias |
| [**mobilePostAccountingBankTransfersValidate**](AccountingBankingApi.md#mobilePostAccountingBankTransfersValidate) | **POST** /accounting/bank-transfers/validate | Validar transferencia bancaria |


<a id="mobileGetAccountingBankAccounts"></a>
# **mobileGetAccountingBankAccounts**
> GetAccountingBankAccountsResponse mobileGetAccountingBankAccounts()

Consultar cuentas bancarias

Lista las cuentas bancarias activas disponibles para operaciones contables.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingBankingApi()
try {
    val result : GetAccountingBankAccountsResponse = apiInstance.mobileGetAccountingBankAccounts()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingBankingApi#mobileGetAccountingBankAccounts")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingBankingApi#mobileGetAccountingBankAccounts")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetAccountingBankAccountsResponse**](GetAccountingBankAccountsResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingBankAccountsById"></a>
# **mobileGetAccountingBankAccountsById**
> GetAccountingBankAccountsIdResponse mobileGetAccountingBankAccountsById(id)

Consultar cuentas bancaria

Devuelve datos, saldo y moneda de la cuenta bancaria identificada.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingBankingApi()
val id : kotlin.String = id_example // kotlin.String | Identificador único del recurso.
try {
    val result : GetAccountingBankAccountsIdResponse = apiInstance.mobileGetAccountingBankAccountsById(id)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingBankingApi#mobileGetAccountingBankAccountsById")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingBankingApi#mobileGetAccountingBankAccountsById")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **id** | **kotlin.String**| Identificador único del recurso. | |

### Return type

[**GetAccountingBankAccountsIdResponse**](GetAccountingBankAccountsIdResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingBankAccountsByIdNestedHistory"></a>
# **mobileGetAccountingBankAccountsByIdNestedHistory**
> GetAccountingBankAccountsIdHistoryResponse mobileGetAccountingBankAccountsByIdNestedHistory(id, fechaInicio, fechaFin, tipoMovimiento, page, limit)

Consultar historial de cuentas bancarias

Devuelve los movimientos cronológicos asociados al registro solicitado para facilitar su trazabilidad.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingBankingApi()
val id : kotlin.String = id_example // kotlin.String | Identificador único del recurso.
val fechaInicio : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Inicio inclusivo del período consultado.
val fechaFin : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Fin inclusivo del período consultado.
val tipoMovimiento : kotlin.String = tipoMovimiento_example // kotlin.String | Valor de tipoMovimiento aceptado por el handler.
val page : kotlin.Int = 56 // kotlin.Int | Página solicitada, comenzando en 1.
val limit : kotlin.Int = 56 // kotlin.Int | Cantidad máxima de elementos por página.
try {
    val result : GetAccountingBankAccountsIdHistoryResponse = apiInstance.mobileGetAccountingBankAccountsByIdNestedHistory(id, fechaInicio, fechaFin, tipoMovimiento, page, limit)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingBankingApi#mobileGetAccountingBankAccountsByIdNestedHistory")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingBankingApi#mobileGetAccountingBankAccountsByIdNestedHistory")
    e.printStackTrace()
}
```

### Parameters
| **id** | **kotlin.String**| Identificador único del recurso. | |
| **fechaInicio** | **java.time.OffsetDateTime**| Inicio inclusivo del período consultado. | [optional] |
| **fechaFin** | **java.time.OffsetDateTime**| Fin inclusivo del período consultado. | [optional] |
| **tipoMovimiento** | **kotlin.String**| Valor de tipoMovimiento aceptado por el handler. | [optional] |
| **page** | **kotlin.Int**| Página solicitada, comenzando en 1. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **limit** | **kotlin.Int**| Cantidad máxima de elementos por página. | [optional] |

### Return type

[**GetAccountingBankAccountsIdHistoryResponse**](GetAccountingBankAccountsIdHistoryResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingBankAdjustments"></a>
# **mobileGetAccountingBankAdjustments**
> GetAccountingBankAdjustmentsResponse mobileGetAccountingBankAdjustments(cuentaId, tipo, fechaInicio, fechaFin, page, limit)

Consultar ajustes bancarios

Lista ingresos y egresos manuales registrados sobre cuentas bancarias. Permite precisar la consulta mediante cuenta bancaria, tipo, fecha inicial, fecha final, página, límite por página.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingBankingApi()
val cuentaId : kotlin.String = cuentaId_example // kotlin.String | Identificador de la cuenta bancaria.
val tipo : kotlin.String = tipo_example // kotlin.String | Tipo de registro solicitado.
val fechaInicio : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Inicio inclusivo del período consultado.
val fechaFin : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Fin inclusivo del período consultado.
val page : kotlin.Int = 56 // kotlin.Int | Página solicitada, comenzando en 1.
val limit : kotlin.Int = 56 // kotlin.Int | Cantidad máxima de elementos por página.
try {
    val result : GetAccountingBankAdjustmentsResponse = apiInstance.mobileGetAccountingBankAdjustments(cuentaId, tipo, fechaInicio, fechaFin, page, limit)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingBankingApi#mobileGetAccountingBankAdjustments")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingBankingApi#mobileGetAccountingBankAdjustments")
    e.printStackTrace()
}
```

### Parameters
| **cuentaId** | **kotlin.String**| Identificador de la cuenta bancaria. | [optional] |
| **tipo** | **kotlin.String**| Tipo de registro solicitado. | [optional] |
| **fechaInicio** | **java.time.OffsetDateTime**| Inicio inclusivo del período consultado. | [optional] |
| **fechaFin** | **java.time.OffsetDateTime**| Fin inclusivo del período consultado. | [optional] |
| **page** | **kotlin.Int**| Página solicitada, comenzando en 1. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **limit** | **kotlin.Int**| Cantidad máxima de elementos por página. | [optional] |

### Return type

[**GetAccountingBankAdjustmentsResponse**](GetAccountingBankAdjustmentsResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingBankTransfers"></a>
# **mobileGetAccountingBankTransfers**
> GetAccountingBankTransfersResponse mobileGetAccountingBankTransfers(fechaInicio, fechaFin, cuentaId)

Consultar transferencias bancarias

Lista transferencias entre cuentas con importes de origen, destino y tasa aplicada. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta bancaria.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingBankingApi()
val fechaInicio : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Inicio inclusivo del período consultado.
val fechaFin : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Fin inclusivo del período consultado.
val cuentaId : kotlin.String = cuentaId_example // kotlin.String | Identificador de la cuenta bancaria.
try {
    val result : GetAccountingBankTransfersResponse = apiInstance.mobileGetAccountingBankTransfers(fechaInicio, fechaFin, cuentaId)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingBankingApi#mobileGetAccountingBankTransfers")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingBankingApi#mobileGetAccountingBankTransfers")
    e.printStackTrace()
}
```

### Parameters
| **fechaInicio** | **java.time.OffsetDateTime**| Inicio inclusivo del período consultado. | [optional] |
| **fechaFin** | **java.time.OffsetDateTime**| Fin inclusivo del período consultado. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **cuentaId** | **kotlin.String**| Identificador de la cuenta bancaria. | [optional] |

### Return type

[**GetAccountingBankTransfersResponse**](GetAccountingBankTransfersResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingBankTransfersById"></a>
# **mobileGetAccountingBankTransfersById**
> GetAccountingBankTransfersIdResponse mobileGetAccountingBankTransfersById(id)

Consultar transferencias bancaria

Devuelve importes, cuentas, moneda, tasa y comprobante de la transferencia identificada.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingBankingApi()
val id : kotlin.String = id_example // kotlin.String | Identificador único del recurso.
try {
    val result : GetAccountingBankTransfersIdResponse = apiInstance.mobileGetAccountingBankTransfersById(id)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingBankingApi#mobileGetAccountingBankTransfersById")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingBankingApi#mobileGetAccountingBankTransfersById")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **id** | **kotlin.String**| Identificador único del recurso. | |

### Return type

[**GetAccountingBankTransfersIdResponse**](GetAccountingBankTransfersIdResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingBankTransfersByIdComprobante"></a>
# **mobileGetAccountingBankTransfersByIdComprobante**
> java.io.File mobileGetAccountingBankTransfersByIdComprobante(id)

Descargar comprobante de transferencias bancarias

Genera el comprobante PDF del registro solicitado, conservando sus importes y referencias contables.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingBankingApi()
val id : kotlin.String = id_example // kotlin.String | Identificador único del recurso.
try {
    val result : java.io.File = apiInstance.mobileGetAccountingBankTransfersByIdComprobante(id)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingBankingApi#mobileGetAccountingBankTransfersByIdComprobante")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingBankingApi#mobileGetAccountingBankTransfersByIdComprobante")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **id** | **kotlin.String**| Identificador único del recurso. | |

### Return type

[**java.io.File**](java.io.File.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobilePostAccountingBankAdjustments"></a>
# **mobilePostAccountingBankAdjustments**
> PostAccountingBankAdjustmentsResponse mobilePostAccountingBankAdjustments(bankAdjustmentRequest, cuentaId, tipo, fechaInicio, fechaFin, page, limit)

Registrar ajustes bancarios

Registra un ingreso o egreso manual y actualiza el saldo de la cuenta bancaria seleccionada.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingBankingApi()
val bankAdjustmentRequest : BankAdjustmentRequest =  // BankAdjustmentRequest | 
val cuentaId : kotlin.String = cuentaId_example // kotlin.String | Identificador de la cuenta bancaria.
val tipo : kotlin.String = tipo_example // kotlin.String | Tipo de registro solicitado.
val fechaInicio : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Inicio inclusivo del período consultado.
val fechaFin : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Fin inclusivo del período consultado.
val page : kotlin.Int = 56 // kotlin.Int | Página solicitada, comenzando en 1.
val limit : kotlin.Int = 56 // kotlin.Int | Cantidad máxima de elementos por página.
try {
    val result : PostAccountingBankAdjustmentsResponse = apiInstance.mobilePostAccountingBankAdjustments(bankAdjustmentRequest, cuentaId, tipo, fechaInicio, fechaFin, page, limit)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingBankingApi#mobilePostAccountingBankAdjustments")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingBankingApi#mobilePostAccountingBankAdjustments")
    e.printStackTrace()
}
```

### Parameters
| **bankAdjustmentRequest** | [**BankAdjustmentRequest**](BankAdjustmentRequest.md)|  | |
| **cuentaId** | **kotlin.String**| Identificador de la cuenta bancaria. | [optional] |
| **tipo** | **kotlin.String**| Tipo de registro solicitado. | [optional] |
| **fechaInicio** | **java.time.OffsetDateTime**| Inicio inclusivo del período consultado. | [optional] |
| **fechaFin** | **java.time.OffsetDateTime**| Fin inclusivo del período consultado. | [optional] |
| **page** | **kotlin.Int**| Página solicitada, comenzando en 1. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **limit** | **kotlin.Int**| Cantidad máxima de elementos por página. | [optional] |

### Return type

[**PostAccountingBankAdjustmentsResponse**](PostAccountingBankAdjustmentsResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobilePostAccountingBankTransfers"></a>
# **mobilePostAccountingBankTransfers**
> PostAccountingBankTransfersResponse mobilePostAccountingBankTransfers(bankTransferCreateRequest, fechaInicio, fechaFin, cuentaId)

Registrar transferencias bancarias

Transfiere fondos entre dos cuentas, aplicando conversión cuando las monedas son diferentes.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingBankingApi()
val bankTransferCreateRequest : BankTransferCreateRequest =  // BankTransferCreateRequest | 
val fechaInicio : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Inicio inclusivo del período consultado.
val fechaFin : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Fin inclusivo del período consultado.
val cuentaId : kotlin.String = cuentaId_example // kotlin.String | Identificador de la cuenta bancaria.
try {
    val result : PostAccountingBankTransfersResponse = apiInstance.mobilePostAccountingBankTransfers(bankTransferCreateRequest, fechaInicio, fechaFin, cuentaId)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingBankingApi#mobilePostAccountingBankTransfers")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingBankingApi#mobilePostAccountingBankTransfers")
    e.printStackTrace()
}
```

### Parameters
| **bankTransferCreateRequest** | [**BankTransferCreateRequest**](BankTransferCreateRequest.md)|  | |
| **fechaInicio** | **java.time.OffsetDateTime**| Inicio inclusivo del período consultado. | [optional] |
| **fechaFin** | **java.time.OffsetDateTime**| Fin inclusivo del período consultado. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **cuentaId** | **kotlin.String**| Identificador de la cuenta bancaria. | [optional] |

### Return type

[**PostAccountingBankTransfersResponse**](PostAccountingBankTransfersResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobilePostAccountingBankTransfersValidate"></a>
# **mobilePostAccountingBankTransfersValidate**
> PostAccountingBankTransfersValidateResponse mobilePostAccountingBankTransfersValidate(bankTransferValidationRequest)

Validar transferencia bancaria

Comprueba cuentas, monedas, saldo e importes antes de registrar una transferencia.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingBankingApi()
val bankTransferValidationRequest : BankTransferValidationRequest =  // BankTransferValidationRequest | 
try {
    val result : PostAccountingBankTransfersValidateResponse = apiInstance.mobilePostAccountingBankTransfersValidate(bankTransferValidationRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingBankingApi#mobilePostAccountingBankTransfersValidate")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingBankingApi#mobilePostAccountingBankTransfersValidate")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **bankTransferValidationRequest** | [**BankTransferValidationRequest**](BankTransferValidationRequest.md)|  | |

### Return type

[**PostAccountingBankTransfersValidateResponse**](PostAccountingBankTransfersValidateResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

