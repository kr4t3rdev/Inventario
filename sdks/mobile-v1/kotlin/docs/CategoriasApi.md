# CategoriasApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**mobileGetCategoriaById**](CategoriasApi.md#mobileGetCategoriaById) | **GET** /categorias/{id} | Detalle de categoría |
| [**mobileListCategorias**](CategoriasApi.md#mobileListCategorias) | **GET** /categorias | Listar categorías |


<a id="mobileGetCategoriaById"></a>
# **mobileGetCategoriaById**
> GetCategoriasDetailResponse mobileGetCategoriaById(id)

Detalle de categoría

Detalle de una categoría.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = CategoriasApi()
val id : kotlin.String = id_example // kotlin.String | 
try {
    val result : GetCategoriasDetailResponse = apiInstance.mobileGetCategoriaById(id)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling CategoriasApi#mobileGetCategoriaById")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling CategoriasApi#mobileGetCategoriaById")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **id** | **kotlin.String**|  | |

### Return type

[**GetCategoriasDetailResponse**](GetCategoriasDetailResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileListCategorias"></a>
# **mobileListCategorias**
> GetCategoriasListResponse mobileListCategorias()

Listar categorías

Devuelve las categorías del tenant autenticado.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = CategoriasApi()
try {
    val result : GetCategoriasListResponse = apiInstance.mobileListCategorias()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling CategoriasApi#mobileListCategorias")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling CategoriasApi#mobileListCategorias")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetCategoriasListResponse**](GetCategoriasListResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

