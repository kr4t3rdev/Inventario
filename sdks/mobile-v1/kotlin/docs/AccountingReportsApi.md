# AccountingReportsApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**mobileGetAccountingAdvancesReportsCustomers**](AccountingReportsApi.md#mobileGetAccountingAdvancesReportsCustomers) | **GET** /accounting/advances/reports/customers | Consultar anticipos de clientes |
| [**mobileGetAccountingAdvancesReportsProviders**](AccountingReportsApi.md#mobileGetAccountingAdvancesReportsProviders) | **GET** /accounting/advances/reports/providers | Consultar anticipos a proveedores |
| [**mobileGetAccountingAdvancesReportsSummary**](AccountingReportsApi.md#mobileGetAccountingAdvancesReportsSummary) | **GET** /accounting/advances/reports/summary | Consultar resumen de anticipos |
| [**mobileGetAccountingReportsClientAccountAnalysis**](AccountingReportsApi.md#mobileGetAccountingReportsClientAccountAnalysis) | **GET** /accounting/reports/client-account-analysis | Consultar análisis de cuenta de cliente |
| [**mobileGetAccountingReportsExchange**](AccountingReportsApi.md#mobileGetAccountingReportsExchange) | **GET** /accounting/reports/exchange | Consultar reporte de cambio de moneda |
| [**mobileGetAccountingReportsExchangeImpact**](AccountingReportsApi.md#mobileGetAccountingReportsExchangeImpact) | **GET** /accounting/reports/exchange-impact | Consultar impacto de variaciones cambiarias |
| [**mobileGetAccountingReportsMovements**](AccountingReportsApi.md#mobileGetAccountingReportsMovements) | **GET** /accounting/reports/movements | Consultar movimientos contables |
| [**mobileGetAccountingReportsOverdueInvoices**](AccountingReportsApi.md#mobileGetAccountingReportsOverdueInvoices) | **GET** /accounting/reports/overdue-invoices | Consultar facturas vencidas |
| [**mobileGetAccountingReportsSummary**](AccountingReportsApi.md#mobileGetAccountingReportsSummary) | **GET** /accounting/reports/summary | Consultar resumen financiero |
| [**mobileGetAccountingReportsTransfers**](AccountingReportsApi.md#mobileGetAccountingReportsTransfers) | **GET** /accounting/reports/transfers | Consultar reporte de transferencias |


<a id="mobileGetAccountingAdvancesReportsCustomers"></a>
# **mobileGetAccountingAdvancesReportsCustomers**
> GetAccountingAdvancesReportsCustomersResponse mobileGetAccountingAdvancesReportsCustomers(clienteId, fechaInicio, fechaFin)

Consultar anticipos de clientes

Agrupa los anticipos recibidos de clientes para el período consultado. Permite precisar la consulta mediante cliente, fecha inicial, fecha final.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingReportsApi()
val clienteId : kotlin.String = clienteId_example // kotlin.String | Identificador del cliente.
val fechaInicio : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Inicio inclusivo del período consultado.
val fechaFin : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Fin inclusivo del período consultado.
try {
    val result : GetAccountingAdvancesReportsCustomersResponse = apiInstance.mobileGetAccountingAdvancesReportsCustomers(clienteId, fechaInicio, fechaFin)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingReportsApi#mobileGetAccountingAdvancesReportsCustomers")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingReportsApi#mobileGetAccountingAdvancesReportsCustomers")
    e.printStackTrace()
}
```

### Parameters
| **clienteId** | **kotlin.String**| Identificador del cliente. | [optional] |
| **fechaInicio** | **java.time.OffsetDateTime**| Inicio inclusivo del período consultado. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **fechaFin** | **java.time.OffsetDateTime**| Fin inclusivo del período consultado. | [optional] |

### Return type

[**GetAccountingAdvancesReportsCustomersResponse**](GetAccountingAdvancesReportsCustomersResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingAdvancesReportsProviders"></a>
# **mobileGetAccountingAdvancesReportsProviders**
> GetAccountingAdvancesReportsProvidersResponse mobileGetAccountingAdvancesReportsProviders(proveedorId, fechaInicio, fechaFin)

Consultar anticipos a proveedores

Agrupa los anticipos entregados a proveedores para el período consultado. Permite precisar la consulta mediante proveedor, fecha inicial, fecha final.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingReportsApi()
val proveedorId : kotlin.String = proveedorId_example // kotlin.String | Identificador del proveedor.
val fechaInicio : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Inicio inclusivo del período consultado.
val fechaFin : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Fin inclusivo del período consultado.
try {
    val result : GetAccountingAdvancesReportsProvidersResponse = apiInstance.mobileGetAccountingAdvancesReportsProviders(proveedorId, fechaInicio, fechaFin)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingReportsApi#mobileGetAccountingAdvancesReportsProviders")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingReportsApi#mobileGetAccountingAdvancesReportsProviders")
    e.printStackTrace()
}
```

### Parameters
| **proveedorId** | **kotlin.String**| Identificador del proveedor. | [optional] |
| **fechaInicio** | **java.time.OffsetDateTime**| Inicio inclusivo del período consultado. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **fechaFin** | **java.time.OffsetDateTime**| Fin inclusivo del período consultado. | [optional] |

### Return type

[**GetAccountingAdvancesReportsProvidersResponse**](GetAccountingAdvancesReportsProvidersResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingAdvancesReportsSummary"></a>
# **mobileGetAccountingAdvancesReportsSummary**
> GetAccountingAdvancesReportsSummaryResponse mobileGetAccountingAdvancesReportsSummary(tipo, fechaInicio, fechaFin)

Consultar resumen de anticipos

Resume importes y estados de anticipos de pago y cobro. Permite precisar la consulta mediante tipo, fecha inicial, fecha final.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingReportsApi()
val tipo : kotlin.String = tipo_example // kotlin.String | Tipo de registro solicitado.
val fechaInicio : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Inicio inclusivo del período consultado.
val fechaFin : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Fin inclusivo del período consultado.
try {
    val result : GetAccountingAdvancesReportsSummaryResponse = apiInstance.mobileGetAccountingAdvancesReportsSummary(tipo, fechaInicio, fechaFin)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingReportsApi#mobileGetAccountingAdvancesReportsSummary")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingReportsApi#mobileGetAccountingAdvancesReportsSummary")
    e.printStackTrace()
}
```

### Parameters
| **tipo** | **kotlin.String**| Tipo de registro solicitado. | [optional] |
| **fechaInicio** | **java.time.OffsetDateTime**| Inicio inclusivo del período consultado. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **fechaFin** | **java.time.OffsetDateTime**| Fin inclusivo del período consultado. | [optional] |

### Return type

[**GetAccountingAdvancesReportsSummaryResponse**](GetAccountingAdvancesReportsSummaryResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingReportsClientAccountAnalysis"></a>
# **mobileGetAccountingReportsClientAccountAnalysis**
> GetAccountingReportsClientAccountAnalysisResponse mobileGetAccountingReportsClientAccountAnalysis(clienteId)

Consultar análisis de cuenta de cliente

Analiza deuda, pagos, vencimientos y actividad de una cuenta de cliente. Permite precisar la consulta mediante cliente.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingReportsApi()
val clienteId : kotlin.String = clienteId_example // kotlin.String | Identificador del cliente.
try {
    val result : GetAccountingReportsClientAccountAnalysisResponse = apiInstance.mobileGetAccountingReportsClientAccountAnalysis(clienteId)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingReportsApi#mobileGetAccountingReportsClientAccountAnalysis")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingReportsApi#mobileGetAccountingReportsClientAccountAnalysis")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **clienteId** | **kotlin.String**| Identificador del cliente. | [optional] |

### Return type

[**GetAccountingReportsClientAccountAnalysisResponse**](GetAccountingReportsClientAccountAnalysisResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingReportsExchange"></a>
# **mobileGetAccountingReportsExchange**
> GetAccountingReportsExchangeResponse mobileGetAccountingReportsExchange(fechaInicio, fechaFin, monedaOrigen, monedaDestino, export)

Consultar reporte de cambio de moneda

Reúne tasas y conversiones monetarias para evaluar operaciones de cambio. Permite precisar la consulta mediante fecha inicial, fecha final, monedaOrigen, monedaDestino, formato de exportación.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingReportsApi()
val fechaInicio : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Inicio inclusivo del período consultado.
val fechaFin : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Fin inclusivo del período consultado.
val monedaOrigen : kotlin.String = monedaOrigen_example // kotlin.String | Valor de monedaOrigen aceptado por el handler.
val monedaDestino : kotlin.String = monedaDestino_example // kotlin.String | Valor de monedaDestino aceptado por el handler.
val export : kotlin.String = export_example // kotlin.String | Valor de export aceptado por el handler.
try {
    val result : GetAccountingReportsExchangeResponse = apiInstance.mobileGetAccountingReportsExchange(fechaInicio, fechaFin, monedaOrigen, monedaDestino, export)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingReportsApi#mobileGetAccountingReportsExchange")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingReportsApi#mobileGetAccountingReportsExchange")
    e.printStackTrace()
}
```

### Parameters
| **fechaInicio** | **java.time.OffsetDateTime**| Inicio inclusivo del período consultado. | [optional] |
| **fechaFin** | **java.time.OffsetDateTime**| Fin inclusivo del período consultado. | [optional] |
| **monedaOrigen** | **kotlin.String**| Valor de monedaOrigen aceptado por el handler. | [optional] |
| **monedaDestino** | **kotlin.String**| Valor de monedaDestino aceptado por el handler. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **export** | **kotlin.String**| Valor de export aceptado por el handler. | [optional] |

### Return type

[**GetAccountingReportsExchangeResponse**](GetAccountingReportsExchangeResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingReportsExchangeImpact"></a>
# **mobileGetAccountingReportsExchangeImpact**
> GetAccountingReportsExchangeImpactResponse mobileGetAccountingReportsExchangeImpact(fechaInicio, fechaFin, monedaBase, tipoAnalisis)

Consultar impacto de variaciones cambiarias

Calcula el efecto de las tasas aplicadas sobre movimientos y saldos convertidos. Permite precisar la consulta mediante fecha inicial, fecha final, monedaBase, tipoAnalisis.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingReportsApi()
val fechaInicio : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Inicio inclusivo del período consultado.
val fechaFin : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Fin inclusivo del período consultado.
val monedaBase : kotlin.String = monedaBase_example // kotlin.String | Valor de monedaBase aceptado por el handler.
val tipoAnalisis : kotlin.String = tipoAnalisis_example // kotlin.String | Valor de tipoAnalisis aceptado por el handler.
try {
    val result : GetAccountingReportsExchangeImpactResponse = apiInstance.mobileGetAccountingReportsExchangeImpact(fechaInicio, fechaFin, monedaBase, tipoAnalisis)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingReportsApi#mobileGetAccountingReportsExchangeImpact")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingReportsApi#mobileGetAccountingReportsExchangeImpact")
    e.printStackTrace()
}
```

### Parameters
| **fechaInicio** | **java.time.OffsetDateTime**| Inicio inclusivo del período consultado. | [optional] |
| **fechaFin** | **java.time.OffsetDateTime**| Fin inclusivo del período consultado. | [optional] |
| **monedaBase** | **kotlin.String**| Valor de monedaBase aceptado por el handler. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **tipoAnalisis** | **kotlin.String**| Valor de tipoAnalisis aceptado por el handler. | [optional] |

### Return type

[**GetAccountingReportsExchangeImpactResponse**](GetAccountingReportsExchangeImpactResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingReportsMovements"></a>
# **mobileGetAccountingReportsMovements**
> GetAccountingReportsMovementsResponse mobileGetAccountingReportsMovements(busqueda, fechaInicio, fechaFin, cuentaId, tipoMovimiento, moneda, page, limit, formato)

Consultar movimientos contables

Lista entradas y salidas contables y puede devolver su exportación CSV. Permite precisar la consulta mediante texto libre, fecha inicial, fecha final, cuenta bancaria, tipo de movimiento, moneda, página, límite por página, formato de exportación.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingReportsApi()
val busqueda : kotlin.String = busqueda_example // kotlin.String | Valor de busqueda aceptado por el handler.
val fechaInicio : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Inicio inclusivo del período consultado.
val fechaFin : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Fin inclusivo del período consultado.
val cuentaId : kotlin.String = cuentaId_example // kotlin.String | Identificador de la cuenta bancaria.
val tipoMovimiento : kotlin.String = tipoMovimiento_example // kotlin.String | Valor de tipoMovimiento aceptado por el handler.
val moneda : kotlin.String = moneda_example // kotlin.String | Código de moneda.
val page : kotlin.Int = 56 // kotlin.Int | Página solicitada, comenzando en 1.
val limit : kotlin.Int = 56 // kotlin.Int | Cantidad máxima de elementos por página.
val formato : kotlin.String = formato_example // kotlin.String | Valor de formato aceptado por el handler.
try {
    val result : GetAccountingReportsMovementsResponse = apiInstance.mobileGetAccountingReportsMovements(busqueda, fechaInicio, fechaFin, cuentaId, tipoMovimiento, moneda, page, limit, formato)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingReportsApi#mobileGetAccountingReportsMovements")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingReportsApi#mobileGetAccountingReportsMovements")
    e.printStackTrace()
}
```

### Parameters
| **busqueda** | **kotlin.String**| Valor de busqueda aceptado por el handler. | [optional] |
| **fechaInicio** | **java.time.OffsetDateTime**| Inicio inclusivo del período consultado. | [optional] |
| **fechaFin** | **java.time.OffsetDateTime**| Fin inclusivo del período consultado. | [optional] |
| **cuentaId** | **kotlin.String**| Identificador de la cuenta bancaria. | [optional] |
| **tipoMovimiento** | **kotlin.String**| Valor de tipoMovimiento aceptado por el handler. | [optional] |
| **moneda** | **kotlin.String**| Código de moneda. | [optional] |
| **page** | **kotlin.Int**| Página solicitada, comenzando en 1. | [optional] |
| **limit** | **kotlin.Int**| Cantidad máxima de elementos por página. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **formato** | **kotlin.String**| Valor de formato aceptado por el handler. | [optional] |

### Return type

[**GetAccountingReportsMovementsResponse**](GetAccountingReportsMovementsResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingReportsOverdueInvoices"></a>
# **mobileGetAccountingReportsOverdueInvoices**
> GetAccountingReportsOverdueInvoicesResponse mobileGetAccountingReportsOverdueInvoices()

Consultar facturas vencidas

Identifica facturas cuyo vencimiento pasó y que aún conservan saldo pendiente.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingReportsApi()
try {
    val result : GetAccountingReportsOverdueInvoicesResponse = apiInstance.mobileGetAccountingReportsOverdueInvoices()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingReportsApi#mobileGetAccountingReportsOverdueInvoices")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingReportsApi#mobileGetAccountingReportsOverdueInvoices")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetAccountingReportsOverdueInvoicesResponse**](GetAccountingReportsOverdueInvoicesResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingReportsSummary"></a>
# **mobileGetAccountingReportsSummary**
> GetAccountingReportsSummaryResponse mobileGetAccountingReportsSummary(fechaInicio, fechaFin, cuentaId, moneda, export)

Consultar resumen financiero

Consolida saldos, ingresos, egresos y actividad contable del período. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta bancaria, moneda, formato de exportación.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingReportsApi()
val fechaInicio : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Inicio inclusivo del período consultado.
val fechaFin : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Fin inclusivo del período consultado.
val cuentaId : kotlin.String = cuentaId_example // kotlin.String | Identificador de la cuenta bancaria.
val moneda : kotlin.String = moneda_example // kotlin.String | Código de moneda.
val export : kotlin.String = export_example // kotlin.String | Valor de export aceptado por el handler.
try {
    val result : GetAccountingReportsSummaryResponse = apiInstance.mobileGetAccountingReportsSummary(fechaInicio, fechaFin, cuentaId, moneda, export)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingReportsApi#mobileGetAccountingReportsSummary")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingReportsApi#mobileGetAccountingReportsSummary")
    e.printStackTrace()
}
```

### Parameters
| **fechaInicio** | **java.time.OffsetDateTime**| Inicio inclusivo del período consultado. | [optional] |
| **fechaFin** | **java.time.OffsetDateTime**| Fin inclusivo del período consultado. | [optional] |
| **cuentaId** | **kotlin.String**| Identificador de la cuenta bancaria. | [optional] |
| **moneda** | **kotlin.String**| Código de moneda. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **export** | **kotlin.String**| Valor de export aceptado por el handler. | [optional] |

### Return type

[**GetAccountingReportsSummaryResponse**](GetAccountingReportsSummaryResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingReportsTransfers"></a>
# **mobileGetAccountingReportsTransfers**
> GetAccountingReportsTransfersResponse mobileGetAccountingReportsTransfers(fechaInicio, fechaFin, cuentaOrigenId, cuentaDestinoId, moneda, page, limit, realizadoPor, export)

Consultar reporte de transferencias

Analiza transferencias por cuentas, monedas y responsable, con exportación opcional. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta de origen, cuenta de destino, moneda, página, límite por página, usuario responsable, formato de exportación.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingReportsApi()
val fechaInicio : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Inicio inclusivo del período consultado.
val fechaFin : java.time.OffsetDateTime = 2013-10-20T19:20:30+01:00 // java.time.OffsetDateTime | Fin inclusivo del período consultado.
val cuentaOrigenId : kotlin.String = cuentaOrigenId_example // kotlin.String | Valor de cuentaOrigenId aceptado por el handler.
val cuentaDestinoId : kotlin.String = cuentaDestinoId_example // kotlin.String | Valor de cuentaDestinoId aceptado por el handler.
val moneda : kotlin.String = moneda_example // kotlin.String | Código de moneda.
val page : kotlin.Int = 56 // kotlin.Int | Página solicitada, comenzando en 1.
val limit : kotlin.Int = 56 // kotlin.Int | Cantidad máxima de elementos por página.
val realizadoPor : kotlin.String = realizadoPor_example // kotlin.String | Valor de realizadoPor aceptado por el handler.
val export : kotlin.String = export_example // kotlin.String | Valor de export aceptado por el handler.
try {
    val result : GetAccountingReportsTransfersResponse = apiInstance.mobileGetAccountingReportsTransfers(fechaInicio, fechaFin, cuentaOrigenId, cuentaDestinoId, moneda, page, limit, realizadoPor, export)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingReportsApi#mobileGetAccountingReportsTransfers")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingReportsApi#mobileGetAccountingReportsTransfers")
    e.printStackTrace()
}
```

### Parameters
| **fechaInicio** | **java.time.OffsetDateTime**| Inicio inclusivo del período consultado. | [optional] |
| **fechaFin** | **java.time.OffsetDateTime**| Fin inclusivo del período consultado. | [optional] |
| **cuentaOrigenId** | **kotlin.String**| Valor de cuentaOrigenId aceptado por el handler. | [optional] |
| **cuentaDestinoId** | **kotlin.String**| Valor de cuentaDestinoId aceptado por el handler. | [optional] |
| **moneda** | **kotlin.String**| Código de moneda. | [optional] |
| **page** | **kotlin.Int**| Página solicitada, comenzando en 1. | [optional] |
| **limit** | **kotlin.Int**| Cantidad máxima de elementos por página. | [optional] |
| **realizadoPor** | **kotlin.String**| Valor de realizadoPor aceptado por el handler. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **export** | **kotlin.String**| Valor de export aceptado por el handler. | [optional] |

### Return type

[**GetAccountingReportsTransfersResponse**](GetAccountingReportsTransfersResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

