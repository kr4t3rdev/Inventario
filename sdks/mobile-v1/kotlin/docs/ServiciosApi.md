# ServiciosApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**mobileGetServiciosById**](ServiciosApi.md#mobileGetServiciosById) | **GET** /servicios/{id} | Detalle de servicio |
| [**mobileListServicios**](ServiciosApi.md#mobileListServicios) | **GET** /servicios | Listar servicios |


<a id="mobileGetServiciosById"></a>
# **mobileGetServiciosById**
> GetServiciosDetailResponse mobileGetServiciosById(id)

Detalle de servicio

Devuelve el detalle de una servicio.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = ServiciosApi()
val id : kotlin.String = id_example // kotlin.String | 
try {
    val result : GetServiciosDetailResponse = apiInstance.mobileGetServiciosById(id)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling ServiciosApi#mobileGetServiciosById")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling ServiciosApi#mobileGetServiciosById")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **id** | **kotlin.String**|  | |

### Return type

[**GetServiciosDetailResponse**](GetServiciosDetailResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileListServicios"></a>
# **mobileListServicios**
> GetServiciosListResponse mobileListServicios()

Listar servicios

Devuelve el listado de servicios del tenant.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = ServiciosApi()
try {
    val result : GetServiciosListResponse = apiInstance.mobileListServicios()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling ServiciosApi#mobileListServicios")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling ServiciosApi#mobileListServicios")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetServiciosListResponse**](GetServiciosListResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

