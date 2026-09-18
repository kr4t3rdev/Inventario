# AccountingCashFinancingApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**mobileGetAccountingCashDebts**](AccountingCashFinancingApi.md#mobileGetAccountingCashDebts) | **GET** /accounting/cash-debts | Consultar deudas de efectivo |
| [**mobileGetAccountingCashDebtsById**](AccountingCashFinancingApi.md#mobileGetAccountingCashDebtsById) | **GET** /accounting/cash-debts/{id} | Consultar deudas de efectivo |
| [**mobileGetAccountingCashDebtsStats**](AccountingCashFinancingApi.md#mobileGetAccountingCashDebtsStats) | **GET** /accounting/cash-debts/stats | Consultar indicadores de deudas de efectivo |
| [**mobileGetAccountingCashLoans**](AccountingCashFinancingApi.md#mobileGetAccountingCashLoans) | **GET** /accounting/cash-loans | Consultar préstamos de efectivo |
| [**mobileGetAccountingCashLoansById**](AccountingCashFinancingApi.md#mobileGetAccountingCashLoansById) | **GET** /accounting/cash-loans/{id} | Consultar préstamos de efectivo |
| [**mobileGetAccountingCashLoansByIdComprobante**](AccountingCashFinancingApi.md#mobileGetAccountingCashLoansByIdComprobante) | **GET** /accounting/cash-loans/{id}/comprobante | Descargar comprobante de préstamos de efectivo |
| [**mobileGetAccountingCashLoansByIdNestedHistory**](AccountingCashFinancingApi.md#mobileGetAccountingCashLoansByIdNestedHistory) | **GET** /accounting/cash-loans/{id}/history | Consultar historial de préstamos de efectivo |
| [**mobileGetAccountingCashLoansStats**](AccountingCashFinancingApi.md#mobileGetAccountingCashLoansStats) | **GET** /accounting/cash-loans/stats | Consultar indicadores de préstamos de efectivo |
| [**mobilePostAccountingCashDebts**](AccountingCashFinancingApi.md#mobilePostAccountingCashDebts) | **POST** /accounting/cash-debts | Registrar deudas de efectivo |
| [**mobilePostAccountingCashDebtsByIdPayments**](AccountingCashFinancingApi.md#mobilePostAccountingCashDebtsByIdPayments) | **POST** /accounting/cash-debts/{id}/payments | Registrar pago de deudas de efectivo |
| [**mobilePostAccountingCashLoans**](AccountingCashFinancingApi.md#mobilePostAccountingCashLoans) | **POST** /accounting/cash-loans | Registrar préstamos de efectivo |
| [**mobilePostAccountingCashLoansByIdPayments**](AccountingCashFinancingApi.md#mobilePostAccountingCashLoansByIdPayments) | **POST** /accounting/cash-loans/{id}/payments | Registrar pago de préstamos de efectivo |
| [**mobilePutAccountingCashDebtsById**](AccountingCashFinancingApi.md#mobilePutAccountingCashDebtsById) | **PUT** /accounting/cash-debts/{id} | Actualizar deudas de efectivo |
| [**mobilePutAccountingCashLoansById**](AccountingCashFinancingApi.md#mobilePutAccountingCashLoansById) | **PUT** /accounting/cash-loans/{id} | Actualizar préstamos de efectivo |


<a id="mobileGetAccountingCashDebts"></a>
# **mobileGetAccountingCashDebts**
> GetAccountingCashDebtsResponse mobileGetAccountingCashDebts(estado, proveedorId, moneda, page, limit)

Consultar deudas de efectivo

Lista deudas de efectivo con proveedores, sus vencimientos y saldos. Permite precisar la consulta mediante estado, proveedor, moneda, página, límite por página.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingCashFinancingApi()
val estado : kotlin.Boolean = true // kotlin.Boolean | Estado usado para filtrar resultados.
val proveedorId : kotlin.String = proveedorId_example // kotlin.String | Identificador del proveedor.
val moneda : kotlin.String = moneda_example // kotlin.String | Código de moneda.
val page : kotlin.Int = 56 // kotlin.Int | Página solicitada, comenzando en 1.
val limit : kotlin.Int = 56 // kotlin.Int | Cantidad máxima de elementos por página.
try {
    val result : GetAccountingCashDebtsResponse = apiInstance.mobileGetAccountingCashDebts(estado, proveedorId, moneda, page, limit)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingCashFinancingApi#mobileGetAccountingCashDebts")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingCashFinancingApi#mobileGetAccountingCashDebts")
    e.printStackTrace()
}
```

### Parameters
| **estado** | **kotlin.Boolean**| Estado usado para filtrar resultados. | [optional] |
| **proveedorId** | **kotlin.String**| Identificador del proveedor. | [optional] |
| **moneda** | **kotlin.String**| Código de moneda. | [optional] |
| **page** | **kotlin.Int**| Página solicitada, comenzando en 1. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **limit** | **kotlin.Int**| Cantidad máxima de elementos por página. | [optional] |

### Return type

[**GetAccountingCashDebtsResponse**](GetAccountingCashDebtsResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingCashDebtsById"></a>
# **mobileGetAccountingCashDebtsById**
> GetAccountingCashDebtsIdResponse mobileGetAccountingCashDebtsById(id)

Consultar deudas de efectivo

Devuelve la deuda identificada con proveedor, cuenta por pagar y pagos relacionados.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingCashFinancingApi()
val id : kotlin.String = id_example // kotlin.String | Identificador único del recurso.
try {
    val result : GetAccountingCashDebtsIdResponse = apiInstance.mobileGetAccountingCashDebtsById(id)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingCashFinancingApi#mobileGetAccountingCashDebtsById")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingCashFinancingApi#mobileGetAccountingCashDebtsById")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **id** | **kotlin.String**| Identificador único del recurso. | |

### Return type

[**GetAccountingCashDebtsIdResponse**](GetAccountingCashDebtsIdResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingCashDebtsStats"></a>
# **mobileGetAccountingCashDebtsStats**
> GetAccountingCashDebtsStatsResponse mobileGetAccountingCashDebtsStats()

Consultar indicadores de deudas de efectivo

Calcula cantidad, capital y saldo pendiente de las deudas de efectivo.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingCashFinancingApi()
try {
    val result : GetAccountingCashDebtsStatsResponse = apiInstance.mobileGetAccountingCashDebtsStats()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingCashFinancingApi#mobileGetAccountingCashDebtsStats")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingCashFinancingApi#mobileGetAccountingCashDebtsStats")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetAccountingCashDebtsStatsResponse**](GetAccountingCashDebtsStatsResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingCashLoans"></a>
# **mobileGetAccountingCashLoans**
> GetAccountingCashLoansResponse mobileGetAccountingCashLoans(estado, clienteId, moneda, page, limit)

Consultar préstamos de efectivo

Lista préstamos de efectivo otorgados a clientes, con vencimientos y saldos. Permite precisar la consulta mediante estado, cliente, moneda, página, límite por página.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingCashFinancingApi()
val estado : kotlin.Boolean = true // kotlin.Boolean | Estado usado para filtrar resultados.
val clienteId : kotlin.String = clienteId_example // kotlin.String | Identificador del cliente.
val moneda : kotlin.String = moneda_example // kotlin.String | Código de moneda.
val page : kotlin.Int = 56 // kotlin.Int | Página solicitada, comenzando en 1.
val limit : kotlin.Int = 56 // kotlin.Int | Cantidad máxima de elementos por página.
try {
    val result : GetAccountingCashLoansResponse = apiInstance.mobileGetAccountingCashLoans(estado, clienteId, moneda, page, limit)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingCashFinancingApi#mobileGetAccountingCashLoans")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingCashFinancingApi#mobileGetAccountingCashLoans")
    e.printStackTrace()
}
```

### Parameters
| **estado** | **kotlin.Boolean**| Estado usado para filtrar resultados. | [optional] |
| **clienteId** | **kotlin.String**| Identificador del cliente. | [optional] |
| **moneda** | **kotlin.String**| Código de moneda. | [optional] |
| **page** | **kotlin.Int**| Página solicitada, comenzando en 1. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **limit** | **kotlin.Int**| Cantidad máxima de elementos por página. | [optional] |

### Return type

[**GetAccountingCashLoansResponse**](GetAccountingCashLoansResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingCashLoansById"></a>
# **mobileGetAccountingCashLoansById**
> GetAccountingCashLoansIdResponse mobileGetAccountingCashLoansById(id)

Consultar préstamos de efectivo

Devuelve el préstamo identificado con cliente, cuenta por cobrar y pagos relacionados.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingCashFinancingApi()
val id : kotlin.String = id_example // kotlin.String | Identificador único del recurso.
try {
    val result : GetAccountingCashLoansIdResponse = apiInstance.mobileGetAccountingCashLoansById(id)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingCashFinancingApi#mobileGetAccountingCashLoansById")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingCashFinancingApi#mobileGetAccountingCashLoansById")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **id** | **kotlin.String**| Identificador único del recurso. | |

### Return type

[**GetAccountingCashLoansIdResponse**](GetAccountingCashLoansIdResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingCashLoansByIdComprobante"></a>
# **mobileGetAccountingCashLoansByIdComprobante**
> java.io.File mobileGetAccountingCashLoansByIdComprobante(id)

Descargar comprobante de préstamos de efectivo

Genera el comprobante PDF del registro solicitado, conservando sus importes y referencias contables.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingCashFinancingApi()
val id : kotlin.String = id_example // kotlin.String | Identificador único del recurso.
try {
    val result : java.io.File = apiInstance.mobileGetAccountingCashLoansByIdComprobante(id)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingCashFinancingApi#mobileGetAccountingCashLoansByIdComprobante")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingCashFinancingApi#mobileGetAccountingCashLoansByIdComprobante")
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

<a id="mobileGetAccountingCashLoansByIdNestedHistory"></a>
# **mobileGetAccountingCashLoansByIdNestedHistory**
> GetAccountingCashLoansIdHistoryResponse mobileGetAccountingCashLoansByIdNestedHistory(id)

Consultar historial de préstamos de efectivo

Devuelve los movimientos cronológicos asociados al registro solicitado para facilitar su trazabilidad.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingCashFinancingApi()
val id : kotlin.String = id_example // kotlin.String | Identificador único del recurso.
try {
    val result : GetAccountingCashLoansIdHistoryResponse = apiInstance.mobileGetAccountingCashLoansByIdNestedHistory(id)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingCashFinancingApi#mobileGetAccountingCashLoansByIdNestedHistory")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingCashFinancingApi#mobileGetAccountingCashLoansByIdNestedHistory")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **id** | **kotlin.String**| Identificador único del recurso. | |

### Return type

[**GetAccountingCashLoansIdHistoryResponse**](GetAccountingCashLoansIdHistoryResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingCashLoansStats"></a>
# **mobileGetAccountingCashLoansStats**
> GetAccountingCashLoansStatsResponse mobileGetAccountingCashLoansStats()

Consultar indicadores de préstamos de efectivo

Calcula cantidad, capital y saldo pendiente de los préstamos de efectivo.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingCashFinancingApi()
try {
    val result : GetAccountingCashLoansStatsResponse = apiInstance.mobileGetAccountingCashLoansStats()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingCashFinancingApi#mobileGetAccountingCashLoansStats")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingCashFinancingApi#mobileGetAccountingCashLoansStats")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetAccountingCashLoansStatsResponse**](GetAccountingCashLoansStatsResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobilePostAccountingCashDebts"></a>
# **mobilePostAccountingCashDebts**
> PostAccountingCashDebtsResponse mobilePostAccountingCashDebts(cashDebtCreateRequest, estado, proveedorId, moneda, page, limit)

Registrar deudas de efectivo

Registra financiamiento recibido de un proveedor, incrementa la cuenta bancaria y crea la cuenta por pagar.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingCashFinancingApi()
val cashDebtCreateRequest : CashDebtCreateRequest =  // CashDebtCreateRequest | 
val estado : kotlin.Boolean = true // kotlin.Boolean | Estado usado para filtrar resultados.
val proveedorId : kotlin.String = proveedorId_example // kotlin.String | Identificador del proveedor.
val moneda : kotlin.String = moneda_example // kotlin.String | Código de moneda.
val page : kotlin.Int = 56 // kotlin.Int | Página solicitada, comenzando en 1.
val limit : kotlin.Int = 56 // kotlin.Int | Cantidad máxima de elementos por página.
try {
    val result : PostAccountingCashDebtsResponse = apiInstance.mobilePostAccountingCashDebts(cashDebtCreateRequest, estado, proveedorId, moneda, page, limit)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingCashFinancingApi#mobilePostAccountingCashDebts")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingCashFinancingApi#mobilePostAccountingCashDebts")
    e.printStackTrace()
}
```

### Parameters
| **cashDebtCreateRequest** | [**CashDebtCreateRequest**](CashDebtCreateRequest.md)|  | |
| **estado** | **kotlin.Boolean**| Estado usado para filtrar resultados. | [optional] |
| **proveedorId** | **kotlin.String**| Identificador del proveedor. | [optional] |
| **moneda** | **kotlin.String**| Código de moneda. | [optional] |
| **page** | **kotlin.Int**| Página solicitada, comenzando en 1. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **limit** | **kotlin.Int**| Cantidad máxima de elementos por página. | [optional] |

### Return type

[**PostAccountingCashDebtsResponse**](PostAccountingCashDebtsResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobilePostAccountingCashDebtsByIdPayments"></a>
# **mobilePostAccountingCashDebtsByIdPayments**
> PostAccountingCashDebtsIdPaymentsResponse mobilePostAccountingCashDebtsByIdPayments(id, cashPaymentRequest)

Registrar pago de deudas de efectivo

Aplica un pago al saldo pendiente y registra sus efectos bancarios y contables.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingCashFinancingApi()
val id : kotlin.String = id_example // kotlin.String | Identificador único del recurso.
val cashPaymentRequest : CashPaymentRequest =  // CashPaymentRequest | 
try {
    val result : PostAccountingCashDebtsIdPaymentsResponse = apiInstance.mobilePostAccountingCashDebtsByIdPayments(id, cashPaymentRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingCashFinancingApi#mobilePostAccountingCashDebtsByIdPayments")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingCashFinancingApi#mobilePostAccountingCashDebtsByIdPayments")
    e.printStackTrace()
}
```

### Parameters
| **id** | **kotlin.String**| Identificador único del recurso. | |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **cashPaymentRequest** | [**CashPaymentRequest**](CashPaymentRequest.md)|  | |

### Return type

[**PostAccountingCashDebtsIdPaymentsResponse**](PostAccountingCashDebtsIdPaymentsResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobilePostAccountingCashLoans"></a>
# **mobilePostAccountingCashLoans**
> PostAccountingCashLoansResponse mobilePostAccountingCashLoans(cashLoanCreateRequest, estado, clienteId, moneda, page, limit)

Registrar préstamos de efectivo

Registra un préstamo a un cliente, descuenta fondos de la cuenta bancaria y crea la cuenta por cobrar.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingCashFinancingApi()
val cashLoanCreateRequest : CashLoanCreateRequest =  // CashLoanCreateRequest | 
val estado : kotlin.Boolean = true // kotlin.Boolean | Estado usado para filtrar resultados.
val clienteId : kotlin.String = clienteId_example // kotlin.String | Identificador del cliente.
val moneda : kotlin.String = moneda_example // kotlin.String | Código de moneda.
val page : kotlin.Int = 56 // kotlin.Int | Página solicitada, comenzando en 1.
val limit : kotlin.Int = 56 // kotlin.Int | Cantidad máxima de elementos por página.
try {
    val result : PostAccountingCashLoansResponse = apiInstance.mobilePostAccountingCashLoans(cashLoanCreateRequest, estado, clienteId, moneda, page, limit)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingCashFinancingApi#mobilePostAccountingCashLoans")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingCashFinancingApi#mobilePostAccountingCashLoans")
    e.printStackTrace()
}
```

### Parameters
| **cashLoanCreateRequest** | [**CashLoanCreateRequest**](CashLoanCreateRequest.md)|  | |
| **estado** | **kotlin.Boolean**| Estado usado para filtrar resultados. | [optional] |
| **clienteId** | **kotlin.String**| Identificador del cliente. | [optional] |
| **moneda** | **kotlin.String**| Código de moneda. | [optional] |
| **page** | **kotlin.Int**| Página solicitada, comenzando en 1. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **limit** | **kotlin.Int**| Cantidad máxima de elementos por página. | [optional] |

### Return type

[**PostAccountingCashLoansResponse**](PostAccountingCashLoansResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobilePostAccountingCashLoansByIdPayments"></a>
# **mobilePostAccountingCashLoansByIdPayments**
> PostAccountingCashLoansIdPaymentsResponse mobilePostAccountingCashLoansByIdPayments(id, cashPaymentRequest)

Registrar pago de préstamos de efectivo

Aplica un pago al saldo pendiente y registra sus efectos bancarios y contables.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingCashFinancingApi()
val id : kotlin.String = id_example // kotlin.String | Identificador único del recurso.
val cashPaymentRequest : CashPaymentRequest =  // CashPaymentRequest | 
try {
    val result : PostAccountingCashLoansIdPaymentsResponse = apiInstance.mobilePostAccountingCashLoansByIdPayments(id, cashPaymentRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingCashFinancingApi#mobilePostAccountingCashLoansByIdPayments")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingCashFinancingApi#mobilePostAccountingCashLoansByIdPayments")
    e.printStackTrace()
}
```

### Parameters
| **id** | **kotlin.String**| Identificador único del recurso. | |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **cashPaymentRequest** | [**CashPaymentRequest**](CashPaymentRequest.md)|  | |

### Return type

[**PostAccountingCashLoansIdPaymentsResponse**](PostAccountingCashLoansIdPaymentsResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobilePutAccountingCashDebtsById"></a>
# **mobilePutAccountingCashDebtsById**
> PutAccountingCashDebtsIdResponse mobilePutAccountingCashDebtsById(id, cashOperationUpdateRequest)

Actualizar deudas de efectivo

Actualiza vencimiento, tasa de interés u observaciones de la deuda identificada.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingCashFinancingApi()
val id : kotlin.String = id_example // kotlin.String | Identificador único del recurso.
val cashOperationUpdateRequest : CashOperationUpdateRequest =  // CashOperationUpdateRequest | 
try {
    val result : PutAccountingCashDebtsIdResponse = apiInstance.mobilePutAccountingCashDebtsById(id, cashOperationUpdateRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingCashFinancingApi#mobilePutAccountingCashDebtsById")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingCashFinancingApi#mobilePutAccountingCashDebtsById")
    e.printStackTrace()
}
```

### Parameters
| **id** | **kotlin.String**| Identificador único del recurso. | |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **cashOperationUpdateRequest** | [**CashOperationUpdateRequest**](CashOperationUpdateRequest.md)|  | |

### Return type

[**PutAccountingCashDebtsIdResponse**](PutAccountingCashDebtsIdResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobilePutAccountingCashLoansById"></a>
# **mobilePutAccountingCashLoansById**
> PutAccountingCashLoansIdResponse mobilePutAccountingCashLoansById(id, cashOperationUpdateRequest)

Actualizar préstamos de efectivo

Actualiza vencimiento, tasa de interés u observaciones del préstamo identificado.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingCashFinancingApi()
val id : kotlin.String = id_example // kotlin.String | Identificador único del recurso.
val cashOperationUpdateRequest : CashOperationUpdateRequest =  // CashOperationUpdateRequest | 
try {
    val result : PutAccountingCashLoansIdResponse = apiInstance.mobilePutAccountingCashLoansById(id, cashOperationUpdateRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingCashFinancingApi#mobilePutAccountingCashLoansById")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingCashFinancingApi#mobilePutAccountingCashLoansById")
    e.printStackTrace()
}
```

### Parameters
| **id** | **kotlin.String**| Identificador único del recurso. | |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **cashOperationUpdateRequest** | [**CashOperationUpdateRequest**](CashOperationUpdateRequest.md)|  | |

### Return type

[**PutAccountingCashLoansIdResponse**](PutAccountingCashLoansIdResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

