# AccountingCapitalApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**mobileGetAccountingCapitalInjections**](AccountingCapitalApi.md#mobileGetAccountingCapitalInjections) | **GET** /accounting/capital-injections | Consultar inyecciones de capital |
| [**mobilePostAccountingCapitalInjections**](AccountingCapitalApi.md#mobilePostAccountingCapitalInjections) | **POST** /accounting/capital-injections | Registrar inyecciones de capital |
| [**mobilePostAccountingCapitalInjectionsByIdPayments**](AccountingCapitalApi.md#mobilePostAccountingCapitalInjectionsByIdPayments) | **POST** /accounting/capital-injections/{id}/payments | Registrar pago de inyecciones de capital |


<a id="mobileGetAccountingCapitalInjections"></a>
# **mobileGetAccountingCapitalInjections**
> GetAccountingCapitalInjectionsResponse mobileGetAccountingCapitalInjections(tipo)

Consultar inyecciones de capital

Lista aportes de capital registrados para el tenant. Permite precisar la consulta mediante tipo.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingCapitalApi()
val tipo : kotlin.String = tipo_example // kotlin.String | Tipo de registro solicitado.
try {
    val result : GetAccountingCapitalInjectionsResponse = apiInstance.mobileGetAccountingCapitalInjections(tipo)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingCapitalApi#mobileGetAccountingCapitalInjections")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingCapitalApi#mobileGetAccountingCapitalInjections")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **tipo** | **kotlin.String**| Tipo de registro solicitado. | [optional] |

### Return type

[**GetAccountingCapitalInjectionsResponse**](GetAccountingCapitalInjectionsResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobilePostAccountingCapitalInjections"></a>
# **mobilePostAccountingCapitalInjections**
> PostAccountingCapitalInjectionsResponse mobilePostAccountingCapitalInjections(capitalInjectionCreateRequest, idempotencyKey, tipo)

Registrar inyecciones de capital

Registra un aporte de capital y lo vincula con la cuenta bancaria indicada cuando corresponde. Para idempotencia, acepta idempotencyKey en el cuerpo o Idempotency-Key en el encabezado. Si ambos están presentes, prevalece el valor del cuerpo. La clave debe ser una cadena de 1 a 64 caracteres; se eliminan espacios al inicio y al final.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingCapitalApi()
val capitalInjectionCreateRequest : CapitalInjectionCreateRequest =  // CapitalInjectionCreateRequest |
val idempotencyKey : kotlin.String = idempotencyKey_example // kotlin.String | Clave opcional de idempotencia. Se usa solo cuando idempotencyKey no está presente en el cuerpo; el valor del cuerpo tiene precedencia.
val tipo : kotlin.String = tipo_example // kotlin.String | Tipo de registro solicitado.
try {
    val result : PostAccountingCapitalInjectionsResponse = apiInstance.mobilePostAccountingCapitalInjections(capitalInjectionCreateRequest, idempotencyKey, tipo)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingCapitalApi#mobilePostAccountingCapitalInjections")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingCapitalApi#mobilePostAccountingCapitalInjections")
    e.printStackTrace()
}
```

### Parameters
| **capitalInjectionCreateRequest** | [**CapitalInjectionCreateRequest**](CapitalInjectionCreateRequest.md)|  | |
| **idempotencyKey** | **kotlin.String**| Clave opcional de idempotencia. Se usa solo cuando idempotencyKey no está presente en el cuerpo; el valor del cuerpo tiene precedencia. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **tipo** | **kotlin.String**| Tipo de registro solicitado. | [optional] |

### Return type

[**PostAccountingCapitalInjectionsResponse**](PostAccountingCapitalInjectionsResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobilePostAccountingCapitalInjectionsByIdPayments"></a>
# **mobilePostAccountingCapitalInjectionsByIdPayments**
> PostAccountingCapitalInjectionsIdPaymentsResponse mobilePostAccountingCapitalInjectionsByIdPayments(id, capitalPaymentRequest)

Registrar pago de inyecciones de capital

Aplica un pago al saldo pendiente y registra sus efectos bancarios y contables.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingCapitalApi()
val id : kotlin.String = id_example // kotlin.String | Identificador único del recurso.
val capitalPaymentRequest : CapitalPaymentRequest =  // CapitalPaymentRequest |
try {
    val result : PostAccountingCapitalInjectionsIdPaymentsResponse = apiInstance.mobilePostAccountingCapitalInjectionsByIdPayments(id, capitalPaymentRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingCapitalApi#mobilePostAccountingCapitalInjectionsByIdPayments")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingCapitalApi#mobilePostAccountingCapitalInjectionsByIdPayments")
    e.printStackTrace()
}
```

### Parameters
| **id** | **kotlin.String**| Identificador único del recurso. | |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **capitalPaymentRequest** | [**CapitalPaymentRequest**](CapitalPaymentRequest.md)|  | |

### Return type

[**PostAccountingCapitalInjectionsIdPaymentsResponse**](PostAccountingCapitalInjectionsIdPaymentsResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

