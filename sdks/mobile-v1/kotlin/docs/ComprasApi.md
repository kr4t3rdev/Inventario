# ComprasApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**mobileGetComprasById**](ComprasApi.md#mobileGetComprasById) | **GET** /compras/{id} | Detalle de compra |
| [**mobileListCompras**](ComprasApi.md#mobileListCompras) | **GET** /compras | Listar compras |


<a id="mobileGetComprasById"></a>
# **mobileGetComprasById**
> GetComprasDetailResponse mobileGetComprasById(id)

Detalle de compra

Devuelve el detalle de una compra.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = ComprasApi()
val id : kotlin.String = id_example // kotlin.String | 
try {
    val result : GetComprasDetailResponse = apiInstance.mobileGetComprasById(id)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling ComprasApi#mobileGetComprasById")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling ComprasApi#mobileGetComprasById")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **id** | **kotlin.String**|  | |

### Return type

[**GetComprasDetailResponse**](GetComprasDetailResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileListCompras"></a>
# **mobileListCompras**
> GetComprasListResponse mobileListCompras()

Listar compras

Devuelve el listado de compras del tenant.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = ComprasApi()
try {
    val result : GetComprasListResponse = apiInstance.mobileListCompras()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling ComprasApi#mobileListCompras")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling ComprasApi#mobileListCompras")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetComprasListResponse**](GetComprasListResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

