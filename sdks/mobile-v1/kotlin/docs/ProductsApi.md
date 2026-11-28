# ProductsApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**mobileGetProducts**](ProductsApi.md#mobileGetProducts) | **GET** /products | Consultar productos |
| [**mobileGetProductsById**](ProductsApi.md#mobileGetProductsById) | **GET** /products/{id} | Consultar producto |
| [**mobileGetProductsStock**](ProductsApi.md#mobileGetProductsStock) | **GET** /products/stock | Consultar existencias por ubicación |
| [**mobileGetProductsSyncChanges**](ProductsApi.md#mobileGetProductsSyncChanges) | **GET** /products/sync/changes | Consultar cambios incrementales de productos |
| [**mobileGetProductsSyncSnapshot**](ProductsApi.md#mobileGetProductsSyncSnapshot) | **GET** /products/sync/snapshot | Obtener una página inicial del catálogo sincronizable |


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

<a id="mobileGetProductsSyncChanges"></a>
# **mobileGetProductsSyncChanges**
> GetProductsSyncChangesResponse mobileGetProductsSyncChanges(cursor, limit)

Consultar cambios incrementales de productos

Entrega cambios de producto y stock en orden ascendente de secuencia. La ventana queda acotada durante la paginación; no se aplica expiración automática ni purga de eventos en esta fase.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = ProductsApi()
val cursor : kotlin.String = cursor_example // kotlin.String | Cursor opaco tenant-scoped recibido del snapshot o del pull anterior.
val limit : kotlin.Int = 56 // kotlin.Int | 
try {
    val result : GetProductsSyncChangesResponse = apiInstance.mobileGetProductsSyncChanges(cursor, limit)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling ProductsApi#mobileGetProductsSyncChanges")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling ProductsApi#mobileGetProductsSyncChanges")
    e.printStackTrace()
}
```

### Parameters
| **cursor** | **kotlin.String**| Cursor opaco tenant-scoped recibido del snapshot o del pull anterior. | |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **limit** | **kotlin.Int**|  | [optional] [default to 200] |

### Return type

[**GetProductsSyncChangesResponse**](GetProductsSyncChangesResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetProductsSyncSnapshot"></a>
# **mobileGetProductsSyncSnapshot**
> GetProductsSyncSnapshotResponse mobileGetProductsSyncSnapshot(limit, pageToken)

Obtener una página inicial del catálogo sincronizable

Devuelve páginas ordenadas por identificador y una marca de agua fija. Los cambios posteriores a esa marca se reproducen desde el feed; el cliente debe aplicar upserts de forma idempotente. La respuesta no incluye costo.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = ProductsApi()
val limit : kotlin.Int = 56 // kotlin.Int | 
val pageToken : kotlin.String = pageToken_example // kotlin.String | Token opaco de continuación, ligado al tenant autenticado.
try {
    val result : GetProductsSyncSnapshotResponse = apiInstance.mobileGetProductsSyncSnapshot(limit, pageToken)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling ProductsApi#mobileGetProductsSyncSnapshot")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling ProductsApi#mobileGetProductsSyncSnapshot")
    e.printStackTrace()
}
```

### Parameters
| **limit** | **kotlin.Int**|  | [optional] [default to 200] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **pageToken** | **kotlin.String**| Token opaco de continuación, ligado al tenant autenticado. | [optional] |

### Return type

[**GetProductsSyncSnapshotResponse**](GetProductsSyncSnapshotResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

