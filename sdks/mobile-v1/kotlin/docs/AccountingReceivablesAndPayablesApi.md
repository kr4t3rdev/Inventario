# AccountingReceivablesAndPayablesApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**mobileGetAccountingAccountsPayable**](AccountingReceivablesAndPayablesApi.md#mobileGetAccountingAccountsPayable) | **GET** /accounting/accounts-payable | Consultar cuentas por pagar |
| [**mobileGetAccountingAccountsReceivable**](AccountingReceivablesAndPayablesApi.md#mobileGetAccountingAccountsReceivable) | **GET** /accounting/accounts-receivable | Consultar cuentas por cobrar |
| [**mobileGetAccountingAccountsReceivableMetrics**](AccountingReceivablesAndPayablesApi.md#mobileGetAccountingAccountsReceivableMetrics) | **GET** /accounting/accounts-receivable/metrics | Consultar métricas de cuentas por cobrar |


<a id="mobileGetAccountingAccountsPayable"></a>
# **mobileGetAccountingAccountsPayable**
> GetAccountingAccountsPayableResponse mobileGetAccountingAccountsPayable(search, estado, tipo, page, limit)

Consultar cuentas por pagar

Lista obligaciones con proveedores y muestra saldos, estado y métricas de pago. Permite precisar la consulta mediante texto de búsqueda, estado, tipo, página, límite por página.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingReceivablesAndPayablesApi()
val search : kotlin.String = search_example // kotlin.String | Texto de búsqueda aplicado por el servicio.
val estado : kotlin.Boolean = true // kotlin.Boolean | Estado usado para filtrar resultados.
val tipo : kotlin.String = tipo_example // kotlin.String | Tipo de registro solicitado.
val page : kotlin.Int = 56 // kotlin.Int | Página solicitada, comenzando en 1.
val limit : kotlin.Int = 56 // kotlin.Int | Cantidad máxima de elementos por página.
try {
    val result : GetAccountingAccountsPayableResponse = apiInstance.mobileGetAccountingAccountsPayable(search, estado, tipo, page, limit)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingReceivablesAndPayablesApi#mobileGetAccountingAccountsPayable")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingReceivablesAndPayablesApi#mobileGetAccountingAccountsPayable")
    e.printStackTrace()
}
```

### Parameters
| **search** | **kotlin.String**| Texto de búsqueda aplicado por el servicio. | [optional] |
| **estado** | **kotlin.Boolean**| Estado usado para filtrar resultados. | [optional] |
| **tipo** | **kotlin.String**| Tipo de registro solicitado. | [optional] |
| **page** | **kotlin.Int**| Página solicitada, comenzando en 1. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **limit** | **kotlin.Int**| Cantidad máxima de elementos por página. | [optional] |

### Return type

[**GetAccountingAccountsPayableResponse**](GetAccountingAccountsPayableResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingAccountsReceivable"></a>
# **mobileGetAccountingAccountsReceivable**
> GetAccountingAccountsReceivableResponse mobileGetAccountingAccountsReceivable(search, estado, clienteId, page, limit)

Consultar cuentas por cobrar

Lista obligaciones de clientes y sus saldos pendientes dentro del tenant. Permite precisar la consulta mediante texto de búsqueda, estado, cliente, página, límite por página.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingReceivablesAndPayablesApi()
val search : kotlin.String = search_example // kotlin.String | Texto de búsqueda aplicado por el servicio.
val estado : kotlin.Boolean = true // kotlin.Boolean | Estado usado para filtrar resultados.
val clienteId : kotlin.String = clienteId_example // kotlin.String | Identificador del cliente.
val page : kotlin.Int = 56 // kotlin.Int | Página solicitada, comenzando en 1.
val limit : kotlin.Int = 56 // kotlin.Int | Cantidad máxima de elementos por página.
try {
    val result : GetAccountingAccountsReceivableResponse = apiInstance.mobileGetAccountingAccountsReceivable(search, estado, clienteId, page, limit)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingReceivablesAndPayablesApi#mobileGetAccountingAccountsReceivable")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingReceivablesAndPayablesApi#mobileGetAccountingAccountsReceivable")
    e.printStackTrace()
}
```

### Parameters
| **search** | **kotlin.String**| Texto de búsqueda aplicado por el servicio. | [optional] |
| **estado** | **kotlin.Boolean**| Estado usado para filtrar resultados. | [optional] |
| **clienteId** | **kotlin.String**| Identificador del cliente. | [optional] |
| **page** | **kotlin.Int**| Página solicitada, comenzando en 1. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **limit** | **kotlin.Int**| Cantidad máxima de elementos por página. | [optional] |

### Return type

[**GetAccountingAccountsReceivableResponse**](GetAccountingAccountsReceivableResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingAccountsReceivableMetrics"></a>
# **mobileGetAccountingAccountsReceivableMetrics**
> GetAccountingAccountsReceivableMetricsResponse mobileGetAccountingAccountsReceivableMetrics()

Consultar métricas de cuentas por cobrar

Calcula los importes agregados y estados de las cuentas por cobrar.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingReceivablesAndPayablesApi()
try {
    val result : GetAccountingAccountsReceivableMetricsResponse = apiInstance.mobileGetAccountingAccountsReceivableMetrics()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingReceivablesAndPayablesApi#mobileGetAccountingAccountsReceivableMetrics")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingReceivablesAndPayablesApi#mobileGetAccountingAccountsReceivableMetrics")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetAccountingAccountsReceivableMetricsResponse**](GetAccountingAccountsReceivableMetricsResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

