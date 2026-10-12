# GastosApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**mobileGetGastosById**](GastosApi.md#mobileGetGastosById) | **GET** /gastos/{id} | Detalle de gasto |
| [**mobileListGastos**](GastosApi.md#mobileListGastos) | **GET** /gastos | Listar gastos |


<a id="mobileGetGastosById"></a>
# **mobileGetGastosById**
> GetGastosDetailResponse mobileGetGastosById(id)

Detalle de gasto

Devuelve el detalle de una gasto.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = GastosApi()
val id : kotlin.String = id_example // kotlin.String | 
try {
    val result : GetGastosDetailResponse = apiInstance.mobileGetGastosById(id)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling GastosApi#mobileGetGastosById")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling GastosApi#mobileGetGastosById")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **id** | **kotlin.String**|  | |

### Return type

[**GetGastosDetailResponse**](GetGastosDetailResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileListGastos"></a>
# **mobileListGastos**
> GetGastosListResponse mobileListGastos()

Listar gastos

Devuelve el listado de gastos del tenant.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = GastosApi()
try {
    val result : GetGastosListResponse = apiInstance.mobileListGastos()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling GastosApi#mobileListGastos")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling GastosApi#mobileListGastos")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetGastosListResponse**](GetGastosListResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

