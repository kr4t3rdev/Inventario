# OfertasApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**mobileGetOfertasById**](OfertasApi.md#mobileGetOfertasById) | **GET** /ofertas/{id} | Detalle de oferta |
| [**mobileListOfertas**](OfertasApi.md#mobileListOfertas) | **GET** /ofertas | Listar ofertas |


<a id="mobileGetOfertasById"></a>
# **mobileGetOfertasById**
> GetOfertasDetailResponse mobileGetOfertasById(id)

Detalle de oferta

Devuelve el detalle de una oferta.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = OfertasApi()
val id : kotlin.String = id_example // kotlin.String | 
try {
    val result : GetOfertasDetailResponse = apiInstance.mobileGetOfertasById(id)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling OfertasApi#mobileGetOfertasById")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling OfertasApi#mobileGetOfertasById")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **id** | **kotlin.String**|  | |

### Return type

[**GetOfertasDetailResponse**](GetOfertasDetailResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileListOfertas"></a>
# **mobileListOfertas**
> GetOfertasListResponse mobileListOfertas()

Listar ofertas

Devuelve el listado de ofertas del tenant.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = OfertasApi()
try {
    val result : GetOfertasListResponse = apiInstance.mobileListOfertas()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling OfertasApi#mobileListOfertas")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling OfertasApi#mobileListOfertas")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetOfertasListResponse**](GetOfertasListResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

