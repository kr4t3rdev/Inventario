# AccountingReconciliationApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**mobileGetAccountingReconciliationExpenses**](AccountingReconciliationApi.md#mobileGetAccountingReconciliationExpenses) | **GET** /accounting/reconciliation/expenses | Consultar conciliación de gastos |
| [**mobileGetAccountingReconciliationExpensesHistory**](AccountingReconciliationApi.md#mobileGetAccountingReconciliationExpensesHistory) | **GET** /accounting/reconciliation/expenses-history | Consultar historial de conciliaciones de gastos |
| [**mobileGetAccountingReconciliationExpensesNestedHistory**](AccountingReconciliationApi.md#mobileGetAccountingReconciliationExpensesNestedHistory) | **GET** /accounting/reconciliation/expenses/history | Consultar historial paginado de conciliaciones de gastos |
| [**mobileGetAccountingReconciliationSales**](AccountingReconciliationApi.md#mobileGetAccountingReconciliationSales) | **GET** /accounting/reconciliation/sales | Consultar conciliación de ventas |
| [**mobileGetAccountingReconciliationSalesHistory**](AccountingReconciliationApi.md#mobileGetAccountingReconciliationSalesHistory) | **GET** /accounting/reconciliation/sales-history | Consultar historial de conciliaciones de ventas |
| [**mobileGetAccountingReconciliationSalesNestedHistory**](AccountingReconciliationApi.md#mobileGetAccountingReconciliationSalesNestedHistory) | **GET** /accounting/reconciliation/sales/history | Consultar historial paginado de conciliaciones de ventas |
| [**mobileGetAccountingReconciliationServices**](AccountingReconciliationApi.md#mobileGetAccountingReconciliationServices) | **GET** /accounting/reconciliation/services | Consultar conciliación de servicios |
| [**mobileGetAccountingReconciliationServicesHistory**](AccountingReconciliationApi.md#mobileGetAccountingReconciliationServicesHistory) | **GET** /accounting/reconciliation/services-history | Consultar historial de conciliaciones de servicios |
| [**mobileGetAccountingReconciliationServicesNestedHistory**](AccountingReconciliationApi.md#mobileGetAccountingReconciliationServicesNestedHistory) | **GET** /accounting/reconciliation/services/history | Consultar historial paginado de conciliaciones de servicios |
| [**mobileGetAccountingReconciliationStats**](AccountingReconciliationApi.md#mobileGetAccountingReconciliationStats) | **GET** /accounting/reconciliation/stats | Consultar panel de conciliaciones |
| [**mobilePostAccountingReconciliationExpenses**](AccountingReconciliationApi.md#mobilePostAccountingReconciliationExpenses) | **POST** /accounting/reconciliation/expenses | Registrar conciliación de gastos |
| [**mobilePostAccountingReconciliationSales**](AccountingReconciliationApi.md#mobilePostAccountingReconciliationSales) | **POST** /accounting/reconciliation/sales | Registrar conciliación de ventas |
| [**mobilePostAccountingReconciliationServices**](AccountingReconciliationApi.md#mobilePostAccountingReconciliationServices) | **POST** /accounting/reconciliation/services | Registrar conciliación de servicios |


<a id="mobileGetAccountingReconciliationExpenses"></a>
# **mobileGetAccountingReconciliationExpenses**
> GetAccountingReconciliationExpensesResponse mobileGetAccountingReconciliationExpenses(tipoGasto, fechaDesde, fechaHasta, page, limit)

Consultar conciliación de gastos

Lista gastos pendientes de conciliación bancaria. Permite precisar la consulta mediante tipoGasto, fecha inicial, fecha final, página, límite por página.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingReconciliationApi()
val tipoGasto : kotlin.String = tipoGasto_example // kotlin.String | Valor de tipoGasto aceptado por el handler.
val fechaDesde : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Valor de fechaDesde aceptado por el handler.
val fechaHasta : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Valor de fechaHasta aceptado por el handler.
val page : kotlin.Int = 56 // kotlin.Int | Página solicitada, comenzando en 1.
val limit : kotlin.Int = 56 // kotlin.Int | Cantidad máxima de elementos por página.
try {
    val result : GetAccountingReconciliationExpensesResponse = apiInstance.mobileGetAccountingReconciliationExpenses(tipoGasto, fechaDesde, fechaHasta, page, limit)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingReconciliationApi#mobileGetAccountingReconciliationExpenses")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingReconciliationApi#mobileGetAccountingReconciliationExpenses")
    e.printStackTrace()
}
```

### Parameters
| **tipoGasto** | **kotlin.String**| Valor de tipoGasto aceptado por el handler. | [optional] |
| **fechaDesde** | **java.time.OffsetDateTime**| Valor de fechaDesde aceptado por el handler. | [optional] |
| **fechaHasta** | **java.time.OffsetDateTime**| Valor de fechaHasta aceptado por el handler. | [optional] |
| **page** | **kotlin.Int**| Página solicitada, comenzando en 1. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **limit** | **kotlin.Int**| Cantidad máxima de elementos por página. | [optional] |

### Return type

[**GetAccountingReconciliationExpensesResponse**](GetAccountingReconciliationExpensesResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingReconciliationExpensesHistory"></a>
# **mobileGetAccountingReconciliationExpensesHistory**
> GetAccountingReconciliationExpensesHistoryResponse mobileGetAccountingReconciliationExpensesHistory(tipoGasto, cuentaId, fechaDesde, fechaHasta, periodo, reconciliadoPor, page, limit)

Consultar historial de conciliaciones de gastos

Devuelve el historial completo de conciliaciones de gastos. Permite precisar la consulta mediante tipoGasto, cuenta bancaria, fecha inicial, fecha final, periodo, reconciliadoPor, página, límite por página.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingReconciliationApi()
val tipoGasto : kotlin.String = tipoGasto_example // kotlin.String | Valor de tipoGasto aceptado por el handler.
val cuentaId : kotlin.String = cuentaId_example // kotlin.String | Identificador de la cuenta bancaria.
val fechaDesde : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Valor de fechaDesde aceptado por el handler.
val fechaHasta : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Valor de fechaHasta aceptado por el handler.
val periodo : kotlin.String = periodo_example // kotlin.String | Valor de periodo aceptado por el handler.
val reconciliadoPor : kotlin.String = reconciliadoPor_example // kotlin.String | Valor de reconciliadoPor aceptado por el handler.
val page : kotlin.Int = 56 // kotlin.Int | Página solicitada, comenzando en 1.
val limit : kotlin.Int = 56 // kotlin.Int | Cantidad máxima de elementos por página.
try {
    val result : GetAccountingReconciliationExpensesHistoryResponse = apiInstance.mobileGetAccountingReconciliationExpensesHistory(tipoGasto, cuentaId, fechaDesde, fechaHasta, periodo, reconciliadoPor, page, limit)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingReconciliationApi#mobileGetAccountingReconciliationExpensesHistory")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingReconciliationApi#mobileGetAccountingReconciliationExpensesHistory")
    e.printStackTrace()
}
```

### Parameters
| **tipoGasto** | **kotlin.String**| Valor de tipoGasto aceptado por el handler. | [optional] |
| **cuentaId** | **kotlin.String**| Identificador de la cuenta bancaria. | [optional] |
| **fechaDesde** | **java.time.OffsetDateTime**| Valor de fechaDesde aceptado por el handler. | [optional] |
| **fechaHasta** | **java.time.OffsetDateTime**| Valor de fechaHasta aceptado por el handler. | [optional] |
| **periodo** | **kotlin.String**| Valor de periodo aceptado por el handler. | [optional] |
| **reconciliadoPor** | **kotlin.String**| Valor de reconciliadoPor aceptado por el handler. | [optional] |
| **page** | **kotlin.Int**| Página solicitada, comenzando en 1. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **limit** | **kotlin.Int**| Cantidad máxima de elementos por página. | [optional] |

### Return type

[**GetAccountingReconciliationExpensesHistoryResponse**](GetAccountingReconciliationExpensesHistoryResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingReconciliationExpensesNestedHistory"></a>
# **mobileGetAccountingReconciliationExpensesNestedHistory**
> GetAccountingReconciliationExpensesHistoryResponse mobileGetAccountingReconciliationExpensesNestedHistory(tipoGasto, cuentaId, fechaDesde, fechaHasta, periodo, reconciliadoPor, page, limit)

Consultar historial paginado de conciliaciones de gastos

Devuelve conciliaciones de gastos con estadísticas y control de página. Permite precisar la consulta mediante tipoGasto, cuenta bancaria, fecha inicial, fecha final, periodo, reconciliadoPor, página, límite por página.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingReconciliationApi()
val tipoGasto : kotlin.String = tipoGasto_example // kotlin.String | Valor de tipoGasto aceptado por el handler.
val cuentaId : kotlin.String = cuentaId_example // kotlin.String | Identificador de la cuenta bancaria.
val fechaDesde : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Valor de fechaDesde aceptado por el handler.
val fechaHasta : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Valor de fechaHasta aceptado por el handler.
val periodo : kotlin.String = periodo_example // kotlin.String | Valor de periodo aceptado por el handler.
val reconciliadoPor : kotlin.String = reconciliadoPor_example // kotlin.String | Valor de reconciliadoPor aceptado por el handler.
val page : kotlin.Int = 56 // kotlin.Int | Página solicitada, comenzando en 1.
val limit : kotlin.Int = 56 // kotlin.Int | Cantidad máxima de elementos por página.
try {
    val result : GetAccountingReconciliationExpensesHistoryResponse = apiInstance.mobileGetAccountingReconciliationExpensesNestedHistory(tipoGasto, cuentaId, fechaDesde, fechaHasta, periodo, reconciliadoPor, page, limit)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingReconciliationApi#mobileGetAccountingReconciliationExpensesNestedHistory")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingReconciliationApi#mobileGetAccountingReconciliationExpensesNestedHistory")
    e.printStackTrace()
}
```

### Parameters
| **tipoGasto** | **kotlin.String**| Valor de tipoGasto aceptado por el handler. | [optional] |
| **cuentaId** | **kotlin.String**| Identificador de la cuenta bancaria. | [optional] |
| **fechaDesde** | **java.time.OffsetDateTime**| Valor de fechaDesde aceptado por el handler. | [optional] |
| **fechaHasta** | **java.time.OffsetDateTime**| Valor de fechaHasta aceptado por el handler. | [optional] |
| **periodo** | **kotlin.String**| Valor de periodo aceptado por el handler. | [optional] |
| **reconciliadoPor** | **kotlin.String**| Valor de reconciliadoPor aceptado por el handler. | [optional] |
| **page** | **kotlin.Int**| Página solicitada, comenzando en 1. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **limit** | **kotlin.Int**| Cantidad máxima de elementos por página. | [optional] |

### Return type

[**GetAccountingReconciliationExpensesHistoryResponse**](GetAccountingReconciliationExpensesHistoryResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingReconciliationSales"></a>
# **mobileGetAccountingReconciliationSales**
> GetAccountingReconciliationSalesResponse mobileGetAccountingReconciliationSales(fechaInicio, fechaFin, puntoDeVentaId, page, limit)

Consultar conciliación de ventas

Lista ventas que todavía no tienen conciliación bancaria. Permite precisar la consulta mediante fecha inicial, fecha final, punto de venta, página, límite por página.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingReconciliationApi()
val fechaInicio : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Inicio inclusivo del período consultado.
val fechaFin : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Fin inclusivo del período consultado.
val puntoDeVentaId : kotlin.String = puntoDeVentaId_example // kotlin.String | Valor de puntoDeVentaId aceptado por el handler.
val page : kotlin.Int = 56 // kotlin.Int | Página solicitada, comenzando en 1.
val limit : kotlin.Int = 56 // kotlin.Int | Cantidad máxima de elementos por página.
try {
    val result : GetAccountingReconciliationSalesResponse = apiInstance.mobileGetAccountingReconciliationSales(fechaInicio, fechaFin, puntoDeVentaId, page, limit)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingReconciliationApi#mobileGetAccountingReconciliationSales")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingReconciliationApi#mobileGetAccountingReconciliationSales")
    e.printStackTrace()
}
```

### Parameters
| **fechaInicio** | **java.time.OffsetDateTime**| Inicio inclusivo del período consultado. | [optional] |
| **fechaFin** | **java.time.OffsetDateTime**| Fin inclusivo del período consultado. | [optional] |
| **puntoDeVentaId** | **kotlin.String**| Valor de puntoDeVentaId aceptado por el handler. | [optional] |
| **page** | **kotlin.Int**| Página solicitada, comenzando en 1. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **limit** | **kotlin.Int**| Cantidad máxima de elementos por página. | [optional] |

### Return type

[**GetAccountingReconciliationSalesResponse**](GetAccountingReconciliationSalesResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingReconciliationSalesHistory"></a>
# **mobileGetAccountingReconciliationSalesHistory**
> GetAccountingReconciliationSalesHistoryResponse mobileGetAccountingReconciliationSalesHistory(fechaDesde, fechaInicio, fechaHasta, fechaFin, cuentaId)

Consultar historial de conciliaciones de ventas

Devuelve el historial completo de conciliaciones de ventas. Permite precisar la consulta mediante fecha inicial, fecha inicial, fecha final, fecha final, cuenta bancaria.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingReconciliationApi()
val fechaDesde : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Valor de fechaDesde aceptado por el handler.
val fechaInicio : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Inicio inclusivo del período consultado.
val fechaHasta : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Valor de fechaHasta aceptado por el handler.
val fechaFin : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Fin inclusivo del período consultado.
val cuentaId : kotlin.String = cuentaId_example // kotlin.String | Identificador de la cuenta bancaria.
try {
    val result : GetAccountingReconciliationSalesHistoryResponse = apiInstance.mobileGetAccountingReconciliationSalesHistory(fechaDesde, fechaInicio, fechaHasta, fechaFin, cuentaId)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingReconciliationApi#mobileGetAccountingReconciliationSalesHistory")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingReconciliationApi#mobileGetAccountingReconciliationSalesHistory")
    e.printStackTrace()
}
```

### Parameters
| **fechaDesde** | **java.time.OffsetDateTime**| Valor de fechaDesde aceptado por el handler. | [optional] |
| **fechaInicio** | **java.time.OffsetDateTime**| Inicio inclusivo del período consultado. | [optional] |
| **fechaHasta** | **java.time.OffsetDateTime**| Valor de fechaHasta aceptado por el handler. | [optional] |
| **fechaFin** | **java.time.OffsetDateTime**| Fin inclusivo del período consultado. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **cuentaId** | **kotlin.String**| Identificador de la cuenta bancaria. | [optional] |

### Return type

[**GetAccountingReconciliationSalesHistoryResponse**](GetAccountingReconciliationSalesHistoryResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingReconciliationSalesNestedHistory"></a>
# **mobileGetAccountingReconciliationSalesNestedHistory**
> GetAccountingReconciliationSalesHistoryResponse mobileGetAccountingReconciliationSalesNestedHistory(fechaInicio, fechaFin, cuentaId)

Consultar historial paginado de conciliaciones de ventas

Devuelve conciliaciones de ventas con estadísticas y control de página. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta bancaria.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingReconciliationApi()
val fechaInicio : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Inicio inclusivo del período consultado.
val fechaFin : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Fin inclusivo del período consultado.
val cuentaId : kotlin.String = cuentaId_example // kotlin.String | Identificador de la cuenta bancaria.
try {
    val result : GetAccountingReconciliationSalesHistoryResponse = apiInstance.mobileGetAccountingReconciliationSalesNestedHistory(fechaInicio, fechaFin, cuentaId)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingReconciliationApi#mobileGetAccountingReconciliationSalesNestedHistory")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingReconciliationApi#mobileGetAccountingReconciliationSalesNestedHistory")
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

[**GetAccountingReconciliationSalesHistoryResponse**](GetAccountingReconciliationSalesHistoryResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingReconciliationServices"></a>
# **mobileGetAccountingReconciliationServices**
> GetAccountingReconciliationServicesResponse mobileGetAccountingReconciliationServices(fechaDesde, fechaHasta, page, limit)

Consultar conciliación de servicios

Lista servicios vendidos pendientes de distribuir entre cuentas bancarias. Permite precisar la consulta mediante fecha inicial, fecha final, página, límite por página.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingReconciliationApi()
val fechaDesde : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Valor de fechaDesde aceptado por el handler.
val fechaHasta : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Valor de fechaHasta aceptado por el handler.
val page : kotlin.Int = 56 // kotlin.Int | Página solicitada, comenzando en 1.
val limit : kotlin.Int = 56 // kotlin.Int | Cantidad máxima de elementos por página.
try {
    val result : GetAccountingReconciliationServicesResponse = apiInstance.mobileGetAccountingReconciliationServices(fechaDesde, fechaHasta, page, limit)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingReconciliationApi#mobileGetAccountingReconciliationServices")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingReconciliationApi#mobileGetAccountingReconciliationServices")
    e.printStackTrace()
}
```

### Parameters
| **fechaDesde** | **java.time.OffsetDateTime**| Valor de fechaDesde aceptado por el handler. | [optional] |
| **fechaHasta** | **java.time.OffsetDateTime**| Valor de fechaHasta aceptado por el handler. | [optional] |
| **page** | **kotlin.Int**| Página solicitada, comenzando en 1. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **limit** | **kotlin.Int**| Cantidad máxima de elementos por página. | [optional] |

### Return type

[**GetAccountingReconciliationServicesResponse**](GetAccountingReconciliationServicesResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingReconciliationServicesHistory"></a>
# **mobileGetAccountingReconciliationServicesHistory**
> GetAccountingReconciliationServicesHistoryResponse mobileGetAccountingReconciliationServicesHistory(fechaDesde, fechaHasta, cuentaId)

Consultar historial de conciliaciones de servicios

Devuelve el historial completo de conciliaciones de servicios. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta bancaria.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingReconciliationApi()
val fechaDesde : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Valor de fechaDesde aceptado por el handler.
val fechaHasta : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Valor de fechaHasta aceptado por el handler.
val cuentaId : kotlin.String = cuentaId_example // kotlin.String | Identificador de la cuenta bancaria.
try {
    val result : GetAccountingReconciliationServicesHistoryResponse = apiInstance.mobileGetAccountingReconciliationServicesHistory(fechaDesde, fechaHasta, cuentaId)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingReconciliationApi#mobileGetAccountingReconciliationServicesHistory")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingReconciliationApi#mobileGetAccountingReconciliationServicesHistory")
    e.printStackTrace()
}
```

### Parameters
| **fechaDesde** | **java.time.OffsetDateTime**| Valor de fechaDesde aceptado por el handler. | [optional] |
| **fechaHasta** | **java.time.OffsetDateTime**| Valor de fechaHasta aceptado por el handler. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **cuentaId** | **kotlin.String**| Identificador de la cuenta bancaria. | [optional] |

### Return type

[**GetAccountingReconciliationServicesHistoryResponse**](GetAccountingReconciliationServicesHistoryResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingReconciliationServicesNestedHistory"></a>
# **mobileGetAccountingReconciliationServicesNestedHistory**
> GetAccountingReconciliationServicesHistoryResponse mobileGetAccountingReconciliationServicesNestedHistory(fechaDesde, fechaHasta, cuentaId)

Consultar historial paginado de conciliaciones de servicios

Devuelve conciliaciones de servicios con estadísticas y control de página. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta bancaria.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingReconciliationApi()
val fechaDesde : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Valor de fechaDesde aceptado por el handler.
val fechaHasta : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Valor de fechaHasta aceptado por el handler.
val cuentaId : kotlin.String = cuentaId_example // kotlin.String | Identificador de la cuenta bancaria.
try {
    val result : GetAccountingReconciliationServicesHistoryResponse = apiInstance.mobileGetAccountingReconciliationServicesNestedHistory(fechaDesde, fechaHasta, cuentaId)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingReconciliationApi#mobileGetAccountingReconciliationServicesNestedHistory")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingReconciliationApi#mobileGetAccountingReconciliationServicesNestedHistory")
    e.printStackTrace()
}
```

### Parameters
| **fechaDesde** | **java.time.OffsetDateTime**| Valor de fechaDesde aceptado por el handler. | [optional] |
| **fechaHasta** | **java.time.OffsetDateTime**| Valor de fechaHasta aceptado por el handler. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **cuentaId** | **kotlin.String**| Identificador de la cuenta bancaria. | [optional] |

### Return type

[**GetAccountingReconciliationServicesHistoryResponse**](GetAccountingReconciliationServicesHistoryResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingReconciliationStats"></a>
# **mobileGetAccountingReconciliationStats**
> GetAccountingReconciliationStatsResponse mobileGetAccountingReconciliationStats()

Consultar panel de conciliaciones

Resume pendientes, conciliaciones completadas hoy, eficiencia y actividad reciente por módulo.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingReconciliationApi()
try {
    val result : GetAccountingReconciliationStatsResponse = apiInstance.mobileGetAccountingReconciliationStats()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingReconciliationApi#mobileGetAccountingReconciliationStats")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingReconciliationApi#mobileGetAccountingReconciliationStats")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetAccountingReconciliationStatsResponse**](GetAccountingReconciliationStatsResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobilePostAccountingReconciliationExpenses"></a>
# **mobilePostAccountingReconciliationExpenses**
> PostAccountingReconciliationExpensesResponse mobilePostAccountingReconciliationExpenses(expenseReconciliationRequest, tipoGasto, fechaDesde, fechaHasta, page, limit)

Registrar conciliación de gastos

Distribuye el importe de un gasto entre una o varias cuentas y registra su pago contable.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingReconciliationApi()
val expenseReconciliationRequest : ExpenseReconciliationRequest =  // ExpenseReconciliationRequest | 
val tipoGasto : kotlin.String = tipoGasto_example // kotlin.String | Valor de tipoGasto aceptado por el handler.
val fechaDesde : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Valor de fechaDesde aceptado por el handler.
val fechaHasta : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Valor de fechaHasta aceptado por el handler.
val page : kotlin.Int = 56 // kotlin.Int | Página solicitada, comenzando en 1.
val limit : kotlin.Int = 56 // kotlin.Int | Cantidad máxima de elementos por página.
try {
    val result : PostAccountingReconciliationExpensesResponse = apiInstance.mobilePostAccountingReconciliationExpenses(expenseReconciliationRequest, tipoGasto, fechaDesde, fechaHasta, page, limit)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingReconciliationApi#mobilePostAccountingReconciliationExpenses")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingReconciliationApi#mobilePostAccountingReconciliationExpenses")
    e.printStackTrace()
}
```

### Parameters
| **expenseReconciliationRequest** | [**ExpenseReconciliationRequest**](ExpenseReconciliationRequest.md)|  | |
| **tipoGasto** | **kotlin.String**| Valor de tipoGasto aceptado por el handler. | [optional] |
| **fechaDesde** | **java.time.OffsetDateTime**| Valor de fechaDesde aceptado por el handler. | [optional] |
| **fechaHasta** | **java.time.OffsetDateTime**| Valor de fechaHasta aceptado por el handler. | [optional] |
| **page** | **kotlin.Int**| Página solicitada, comenzando en 1. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **limit** | **kotlin.Int**| Cantidad máxima de elementos por página. | [optional] |

### Return type

[**PostAccountingReconciliationExpensesResponse**](PostAccountingReconciliationExpensesResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobilePostAccountingReconciliationSales"></a>
# **mobilePostAccountingReconciliationSales**
> PostAccountingReconciliationSalesResponse mobilePostAccountingReconciliationSales(saleReconciliationRequest, fechaInicio, fechaFin, puntoDeVentaId, page, limit)

Registrar conciliación de ventas

Abona una venta en la cuenta y medio de pago indicados, respetando el importe conciliable.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingReconciliationApi()
val saleReconciliationRequest : SaleReconciliationRequest =  // SaleReconciliationRequest | 
val fechaInicio : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Inicio inclusivo del período consultado.
val fechaFin : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Fin inclusivo del período consultado.
val puntoDeVentaId : kotlin.String = puntoDeVentaId_example // kotlin.String | Valor de puntoDeVentaId aceptado por el handler.
val page : kotlin.Int = 56 // kotlin.Int | Página solicitada, comenzando en 1.
val limit : kotlin.Int = 56 // kotlin.Int | Cantidad máxima de elementos por página.
try {
    val result : PostAccountingReconciliationSalesResponse = apiInstance.mobilePostAccountingReconciliationSales(saleReconciliationRequest, fechaInicio, fechaFin, puntoDeVentaId, page, limit)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingReconciliationApi#mobilePostAccountingReconciliationSales")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingReconciliationApi#mobilePostAccountingReconciliationSales")
    e.printStackTrace()
}
```

### Parameters
| **saleReconciliationRequest** | [**SaleReconciliationRequest**](SaleReconciliationRequest.md)|  | |
| **fechaInicio** | **java.time.OffsetDateTime**| Inicio inclusivo del período consultado. | [optional] |
| **fechaFin** | **java.time.OffsetDateTime**| Fin inclusivo del período consultado. | [optional] |
| **puntoDeVentaId** | **kotlin.String**| Valor de puntoDeVentaId aceptado por el handler. | [optional] |
| **page** | **kotlin.Int**| Página solicitada, comenzando en 1. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **limit** | **kotlin.Int**| Cantidad máxima de elementos por página. | [optional] |

### Return type

[**PostAccountingReconciliationSalesResponse**](PostAccountingReconciliationSalesResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobilePostAccountingReconciliationServices"></a>
# **mobilePostAccountingReconciliationServices**
> PostAccountingReconciliationServicesResponse mobilePostAccountingReconciliationServices(serviceReconciliationRequest, fechaDesde, fechaHasta, page, limit)

Registrar conciliación de servicios

Distribuye el total de un servicio entre las cuentas y medios de pago enviados.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingReconciliationApi()
val serviceReconciliationRequest : ServiceReconciliationRequest =  // ServiceReconciliationRequest | 
val fechaDesde : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Valor de fechaDesde aceptado por el handler.
val fechaHasta : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Valor de fechaHasta aceptado por el handler.
val page : kotlin.Int = 56 // kotlin.Int | Página solicitada, comenzando en 1.
val limit : kotlin.Int = 56 // kotlin.Int | Cantidad máxima de elementos por página.
try {
    val result : PostAccountingReconciliationServicesResponse = apiInstance.mobilePostAccountingReconciliationServices(serviceReconciliationRequest, fechaDesde, fechaHasta, page, limit)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingReconciliationApi#mobilePostAccountingReconciliationServices")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingReconciliationApi#mobilePostAccountingReconciliationServices")
    e.printStackTrace()
}
```

### Parameters
| **serviceReconciliationRequest** | [**ServiceReconciliationRequest**](ServiceReconciliationRequest.md)|  | |
| **fechaDesde** | **java.time.OffsetDateTime**| Valor de fechaDesde aceptado por el handler. | [optional] |
| **fechaHasta** | **java.time.OffsetDateTime**| Valor de fechaHasta aceptado por el handler. | [optional] |
| **page** | **kotlin.Int**| Página solicitada, comenzando en 1. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **limit** | **kotlin.Int**| Cantidad máxima de elementos por página. | [optional] |

### Return type

[**PostAccountingReconciliationServicesResponse**](PostAccountingReconciliationServicesResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

