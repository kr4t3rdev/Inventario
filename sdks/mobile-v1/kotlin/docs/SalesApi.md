# SalesApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**mobileGetSales**](SalesApi.md#mobileGetSales) | **GET** /sales | Consultar ventas |
| [**mobileGetSalesById**](SalesApi.md#mobileGetSalesById) | **GET** /sales/{id} | Consultar venta |
| [**mobilePatchSalesByIdUpdate**](SalesApi.md#mobilePatchSalesByIdUpdate) | **PATCH** /sales/{id}/update | Actualizar datos de venta |
| [**mobilePostSalesByIdCancel**](SalesApi.md#mobilePostSalesByIdCancel) | **POST** /sales/{id}/cancel | Anular venta |
| [**mobilePostSalesCreate**](SalesApi.md#mobilePostSalesCreate) | **POST** /sales/create | Registrar venta |


<a id="mobileGetSales"></a>
# **mobileGetSales**
> GetSalesResponse mobileGetSales()

Consultar ventas

Devuelve las ventas activas con sus líneas, totales y relaciones de facturación.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = SalesApi()
try {
    val result : GetSalesResponse = apiInstance.mobileGetSales()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling SalesApi#mobileGetSales")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling SalesApi#mobileGetSales")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetSalesResponse**](GetSalesResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetSalesById"></a>
# **mobileGetSalesById**
> GetSalesIdResponse mobileGetSalesById(id)

Consultar venta

Devuelve la venta identificada con líneas, cliente, turno, factura y conciliaciones.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = SalesApi()
val id : kotlin.String = id_example // kotlin.String | Identificador único del recurso.
try {
    val result : GetSalesIdResponse = apiInstance.mobileGetSalesById(id)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling SalesApi#mobileGetSalesById")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling SalesApi#mobileGetSalesById")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **id** | **kotlin.String**| Identificador único del recurso. | |

### Return type

[**GetSalesIdResponse**](GetSalesIdResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobilePatchSalesByIdUpdate"></a>
# **mobilePatchSalesByIdUpdate**
> PatchSalesIdUpdateResponse mobilePatchSalesByIdUpdate(id, saleUpdateRequest)

Actualizar datos de venta

Modifica únicamente el descuento y las observaciones editables de la venta seleccionada.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = SalesApi()
val id : kotlin.String = id_example // kotlin.String | Identificador único del recurso.
val saleUpdateRequest : SaleUpdateRequest =  // SaleUpdateRequest | 
try {
    val result : PatchSalesIdUpdateResponse = apiInstance.mobilePatchSalesByIdUpdate(id, saleUpdateRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling SalesApi#mobilePatchSalesByIdUpdate")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling SalesApi#mobilePatchSalesByIdUpdate")
    e.printStackTrace()
}
```

### Parameters
| **id** | **kotlin.String**| Identificador único del recurso. | |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **saleUpdateRequest** | [**SaleUpdateRequest**](SaleUpdateRequest.md)|  | |

### Return type

[**PatchSalesIdUpdateResponse**](PatchSalesIdUpdateResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobilePostSalesByIdCancel"></a>
# **mobilePostSalesByIdCancel**
> PostSalesIdCancelResponse mobilePostSalesByIdCancel(id, saleCancelRequest)

Anular venta

Anula la venta seleccionada y revierte los efectos permitidos sobre inventario y conciliaciones.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = SalesApi()
val id : kotlin.String = id_example // kotlin.String | Identificador único del recurso.
val saleCancelRequest : SaleCancelRequest =  // SaleCancelRequest | 
try {
    val result : PostSalesIdCancelResponse = apiInstance.mobilePostSalesByIdCancel(id, saleCancelRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling SalesApi#mobilePostSalesByIdCancel")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling SalesApi#mobilePostSalesByIdCancel")
    e.printStackTrace()
}
```

### Parameters
| **id** | **kotlin.String**| Identificador único del recurso. | |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **saleCancelRequest** | [**SaleCancelRequest**](SaleCancelRequest.md)|  | |

### Return type

[**PostSalesIdCancelResponse**](PostSalesIdCancelResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobilePostSalesCreate"></a>
# **mobilePostSalesCreate**
> PostSalesCreateResponse mobilePostSalesCreate(saleCreateRequest)

Registrar venta

Crea la venta, sus líneas y los efectos de inventario, turno y facturación que correspondan.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = SalesApi()
val saleCreateRequest : SaleCreateRequest =  // SaleCreateRequest | 
try {
    val result : PostSalesCreateResponse = apiInstance.mobilePostSalesCreate(saleCreateRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling SalesApi#mobilePostSalesCreate")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling SalesApi#mobilePostSalesCreate")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **saleCreateRequest** | [**SaleCreateRequest**](SaleCreateRequest.md)|  | |

### Return type

[**PostSalesCreateResponse**](PostSalesCreateResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

