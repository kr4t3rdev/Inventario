# ProductsApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**mobileGetProducts**](ProductsApi.md#mobileGetProducts) | **GET** /products | Consultar productos |
| [**mobileGetProductsById**](ProductsApi.md#mobileGetProductsById) | **GET** /products/{id} | Consultar producto |
| [**mobileGetProductsStock**](ProductsApi.md#mobileGetProductsStock) | **GET** /products/stock | Consultar existencias por ubicación |


<a id="mobileGetProducts"></a>
# **mobileGetProducts**
> GetProductsResponse mobileGetProducts()

Consultar productos

Devuelve el catálogo de productos disponible para el tenant autenticado.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = ProductsApi()
try {
    val result : GetProductsResponse = apiInstance.mobileGetProducts()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling ProductsApi#mobileGetProducts")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling ProductsApi#mobileGetProducts")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetProductsResponse**](GetProductsResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetProductsById"></a>
# **mobileGetProductsById**
> GetProductsIdResponse mobileGetProductsById(id)

Consultar producto

Devuelve precio, costo, estado y datos de inventario del producto identificado.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = ProductsApi()
val id : kotlin.String = id_example // kotlin.String | Identificador único del recurso.
try {
    val result : GetProductsIdResponse = apiInstance.mobileGetProductsById(id)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling ProductsApi#mobileGetProductsById")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling ProductsApi#mobileGetProductsById")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **id** | **kotlin.String**| Identificador único del recurso. | |

### Return type

[**GetProductsIdResponse**](GetProductsIdResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetProductsStock"></a>
# **mobileGetProductsStock**
> GetProductsStockResponse mobileGetProductsStock(ubicacionId, tipoUbicacion, includeZero)

Consultar existencias por ubicación

Devuelve el inventario disponible en un almacén o punto de venta específico.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = ProductsApi()
val ubicacionId : kotlin.String = ubicacionId_example // kotlin.String | Valor de ubicacionId aceptado por el handler.
val tipoUbicacion : kotlin.String = tipoUbicacion_example // kotlin.String | Valor de tipoUbicacion aceptado por el handler.
val includeZero : kotlin.String = includeZero_example // kotlin.String | Valor de includeZero aceptado por el handler.
try {
    val result : GetProductsStockResponse = apiInstance.mobileGetProductsStock(ubicacionId, tipoUbicacion, includeZero)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling ProductsApi#mobileGetProductsStock")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling ProductsApi#mobileGetProductsStock")
    e.printStackTrace()
}
```

### Parameters
| **ubicacionId** | **kotlin.String**| Valor de ubicacionId aceptado por el handler. | [optional] |
| **tipoUbicacion** | **kotlin.String**| Valor de tipoUbicacion aceptado por el handler. | [optional] [enum: almacen, punto_venta] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **includeZero** | **kotlin.String**| Valor de includeZero aceptado por el handler. | [optional] [enum: true, false] |

### Return type

[**GetProductsStockResponse**](GetProductsStockResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

