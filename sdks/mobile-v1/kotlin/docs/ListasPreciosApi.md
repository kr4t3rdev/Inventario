# ListasPreciosApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**mobileGetListaPrecioById**](ListasPreciosApi.md#mobileGetListaPrecioById) | **GET** /listas-precios/{id} | Detalle de lista de precios |
| [**mobileListListasPrecios**](ListasPreciosApi.md#mobileListListasPrecios) | **GET** /listas-precios | Listar listas de precios |


<a id="mobileGetListaPrecioById"></a>
# **mobileGetListaPrecioById**
> GetListasPreciosDetailResponse mobileGetListaPrecioById(id)

Detalle de lista de precios

Lista con sus precios por producto.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = ListasPreciosApi()
val id : kotlin.String = id_example // kotlin.String | 
try {
    val result : GetListasPreciosDetailResponse = apiInstance.mobileGetListaPrecioById(id)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling ListasPreciosApi#mobileGetListaPrecioById")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling ListasPreciosApi#mobileGetListaPrecioById")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **id** | **kotlin.String**|  | |

### Return type

[**GetListasPreciosDetailResponse**](GetListasPreciosDetailResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileListListasPrecios"></a>
# **mobileListListasPrecios**
> GetListasPreciosListResponse mobileListListasPrecios()

Listar listas de precios

Listas de precios del tenant.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = ListasPreciosApi()
try {
    val result : GetListasPreciosListResponse = apiInstance.mobileListListasPrecios()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling ListasPreciosApi#mobileListListasPrecios")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling ListasPreciosApi#mobileListListasPrecios")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetListasPreciosListResponse**](GetListasPreciosListResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

