# AccountingConfigurationApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**mobileDeleteAccountingPaymentTypesById**](AccountingConfigurationApi.md#mobileDeleteAccountingPaymentTypesById) | **DELETE** /accounting/payment-types/{id} | Eliminar tipos de pago |
| [**mobileGetAccountingExchangeMonedas**](AccountingConfigurationApi.md#mobileGetAccountingExchangeMonedas) | **GET** /accounting/exchange/monedas | Consultar monedas configuradas |
| [**mobileGetAccountingExchangeTasas**](AccountingConfigurationApi.md#mobileGetAccountingExchangeTasas) | **GET** /accounting/exchange/tasas | Consultar tasas de cambio |
| [**mobileGetAccountingLogs**](AccountingConfigurationApi.md#mobileGetAccountingLogs) | **GET** /accounting/logs | Consultar eventos de auditoría contable |
| [**mobileGetAccountingPaymentTypes**](AccountingConfigurationApi.md#mobileGetAccountingPaymentTypes) | **GET** /accounting/payment-types | Consultar tipos de pago |
| [**mobileGetAccountingPaymentTypesAvailableAccounts**](AccountingConfigurationApi.md#mobileGetAccountingPaymentTypesAvailableAccounts) | **GET** /accounting/payment-types/available-accounts | Consultar cuentas disponibles para tipos de pago |
| [**mobileGetAccountingPaymentTypesById**](AccountingConfigurationApi.md#mobileGetAccountingPaymentTypesById) | **GET** /accounting/payment-types/{id} | Consultar tipos de pago |
| [**mobilePutAccountingPaymentTypesById**](AccountingConfigurationApi.md#mobilePutAccountingPaymentTypesById) | **PUT** /accounting/payment-types/{id} | Actualizar tipos de pago |


<a id="mobileDeleteAccountingPaymentTypesById"></a>
# **mobileDeleteAccountingPaymentTypesById**
> DeleteAccountingPaymentTypesIdResponse mobileDeleteAccountingPaymentTypesById(id)

Eliminar tipos de pago

Elimina el medio de pago únicamente cuando no tiene conciliaciones asociadas.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingConfigurationApi()
val id : kotlin.String = id_example // kotlin.String | Identificador único del recurso.
try {
    val result : DeleteAccountingPaymentTypesIdResponse = apiInstance.mobileDeleteAccountingPaymentTypesById(id)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingConfigurationApi#mobileDeleteAccountingPaymentTypesById")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingConfigurationApi#mobileDeleteAccountingPaymentTypesById")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **id** | **kotlin.String**| Identificador único del recurso. | |

### Return type

[**DeleteAccountingPaymentTypesIdResponse**](DeleteAccountingPaymentTypesIdResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingExchangeMonedas"></a>
# **mobileGetAccountingExchangeMonedas**
> GetAccountingExchangeMonedasResponse mobileGetAccountingExchangeMonedas()

Consultar monedas configuradas

Devuelve el catálogo de monedas habilitadas para operaciones y reportes contables.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingConfigurationApi()
try {
    val result : GetAccountingExchangeMonedasResponse = apiInstance.mobileGetAccountingExchangeMonedas()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingConfigurationApi#mobileGetAccountingExchangeMonedas")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingConfigurationApi#mobileGetAccountingExchangeMonedas")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetAccountingExchangeMonedasResponse**](GetAccountingExchangeMonedasResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingExchangeTasas"></a>
# **mobileGetAccountingExchangeTasas**
> GetAccountingExchangeTasasResponse mobileGetAccountingExchangeTasas()

Consultar tasas de cambio

Devuelve las tasas de cambio vigentes e históricas utilizadas por contabilidad.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingConfigurationApi()
try {
    val result : GetAccountingExchangeTasasResponse = apiInstance.mobileGetAccountingExchangeTasas()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingConfigurationApi#mobileGetAccountingExchangeTasas")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingConfigurationApi#mobileGetAccountingExchangeTasas")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetAccountingExchangeTasasResponse**](GetAccountingExchangeTasasResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingLogs"></a>
# **mobileGetAccountingLogs**
> GetAccountingLogsResponse mobileGetAccountingLogs(entidad, limit, offset)

Consultar eventos de auditoría contable

Consulta la trazabilidad de acciones contables registrada por usuario y entidad. Permite precisar la consulta mediante entidad, límite por página, offset.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingConfigurationApi()
val entidad : kotlin.String = entidad_example // kotlin.String | Valor de entidad aceptado por el handler.
val limit : kotlin.Int = 56 // kotlin.Int | Cantidad máxima de elementos por página.
val offset : kotlin.String = offset_example // kotlin.String | Valor de offset aceptado por el handler.
try {
    val result : GetAccountingLogsResponse = apiInstance.mobileGetAccountingLogs(entidad, limit, offset)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingConfigurationApi#mobileGetAccountingLogs")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingConfigurationApi#mobileGetAccountingLogs")
    e.printStackTrace()
}
```

### Parameters
| **entidad** | **kotlin.String**| Valor de entidad aceptado por el handler. | [optional] |
| **limit** | **kotlin.Int**| Cantidad máxima de elementos por página. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **offset** | **kotlin.String**| Valor de offset aceptado por el handler. | [optional] |

### Return type

[**GetAccountingLogsResponse**](GetAccountingLogsResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingPaymentTypes"></a>
# **mobileGetAccountingPaymentTypes**
> GetAccountingPaymentTypesResponse mobileGetAccountingPaymentTypes(includeInactive, requiereCuenta)

Consultar tipos de pago

Lista los medios de pago configurados y su cuenta bancaria predeterminada. Permite precisar la consulta mediante includeInactive, requiereCuenta.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingConfigurationApi()
val includeInactive : kotlin.Boolean = true // kotlin.Boolean | Valor de includeInactive aceptado por el handler.
val requiereCuenta : kotlin.String = requiereCuenta_example // kotlin.String | Valor de requiereCuenta aceptado por el handler.
try {
    val result : GetAccountingPaymentTypesResponse = apiInstance.mobileGetAccountingPaymentTypes(includeInactive, requiereCuenta)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingConfigurationApi#mobileGetAccountingPaymentTypes")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingConfigurationApi#mobileGetAccountingPaymentTypes")
    e.printStackTrace()
}
```

### Parameters
| **includeInactive** | **kotlin.Boolean**| Valor de includeInactive aceptado por el handler. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **requiereCuenta** | **kotlin.String**| Valor de requiereCuenta aceptado por el handler. | [optional] |

### Return type

[**GetAccountingPaymentTypesResponse**](GetAccountingPaymentTypesResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingPaymentTypesAvailableAccounts"></a>
# **mobileGetAccountingPaymentTypesAvailableAccounts**
> GetAccountingPaymentTypesAvailableAccountsResponse mobileGetAccountingPaymentTypesAvailableAccounts(moneda, tipoCuenta)

Consultar cuentas disponibles para tipos de pago

Lista cuentas activas que pueden asociarse como cuenta predeterminada de un medio de pago. Permite precisar la consulta mediante moneda, tipoCuenta.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingConfigurationApi()
val moneda : kotlin.String = moneda_example // kotlin.String | Código de moneda.
val tipoCuenta : kotlin.String = tipoCuenta_example // kotlin.String | Valor de tipoCuenta aceptado por el handler.
try {
    val result : GetAccountingPaymentTypesAvailableAccountsResponse = apiInstance.mobileGetAccountingPaymentTypesAvailableAccounts(moneda, tipoCuenta)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingConfigurationApi#mobileGetAccountingPaymentTypesAvailableAccounts")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingConfigurationApi#mobileGetAccountingPaymentTypesAvailableAccounts")
    e.printStackTrace()
}
```

### Parameters
| **moneda** | **kotlin.String**| Código de moneda. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **tipoCuenta** | **kotlin.String**| Valor de tipoCuenta aceptado por el handler. | [optional] |

### Return type

[**GetAccountingPaymentTypesAvailableAccountsResponse**](GetAccountingPaymentTypesAvailableAccountsResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingPaymentTypesById"></a>
# **mobileGetAccountingPaymentTypesById**
> GetAccountingPaymentTypesIdResponse mobileGetAccountingPaymentTypesById(id)

Consultar tipos de pago

Devuelve el medio de pago identificado, sus conciliaciones asociadas y la cuenta predeterminada.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingConfigurationApi()
val id : kotlin.String = id_example // kotlin.String | Identificador único del recurso.
try {
    val result : GetAccountingPaymentTypesIdResponse = apiInstance.mobileGetAccountingPaymentTypesById(id)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingConfigurationApi#mobileGetAccountingPaymentTypesById")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingConfigurationApi#mobileGetAccountingPaymentTypesById")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **id** | **kotlin.String**| Identificador único del recurso. | |

### Return type

[**GetAccountingPaymentTypesIdResponse**](GetAccountingPaymentTypesIdResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobilePutAccountingPaymentTypesById"></a>
# **mobilePutAccountingPaymentTypesById**
> PutAccountingPaymentTypesIdResponse mobilePutAccountingPaymentTypesById(id, paymentTypeUpdateRequest)

Actualizar tipos de pago

Actualiza nombre, descripción, requisito de cuenta, cuenta predeterminada o estado activo del medio de pago.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingConfigurationApi()
val id : kotlin.String = id_example // kotlin.String | Identificador único del recurso.
val paymentTypeUpdateRequest : PaymentTypeUpdateRequest =  // PaymentTypeUpdateRequest | 
try {
    val result : PutAccountingPaymentTypesIdResponse = apiInstance.mobilePutAccountingPaymentTypesById(id, paymentTypeUpdateRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingConfigurationApi#mobilePutAccountingPaymentTypesById")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingConfigurationApi#mobilePutAccountingPaymentTypesById")
    e.printStackTrace()
}
```

### Parameters
| **id** | **kotlin.String**| Identificador único del recurso. | |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **paymentTypeUpdateRequest** | [**PaymentTypeUpdateRequest**](PaymentTypeUpdateRequest.md)|  | |

### Return type

[**PutAccountingPaymentTypesIdResponse**](PutAccountingPaymentTypesIdResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

