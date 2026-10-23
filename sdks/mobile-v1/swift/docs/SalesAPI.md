# SalesAPI

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetSales**](SalesAPI.md#mobilegetsales) | **GET** /sales | Consultar ventas
[**mobileGetSalesById**](SalesAPI.md#mobilegetsalesbyid) | **GET** /sales/{id} | Consultar venta
[**mobilePatchSalesByIdUpdate**](SalesAPI.md#mobilepatchsalesbyidupdate) | **PATCH** /sales/{id}/update | Actualizar datos de venta
[**mobilePostSalesByIdCancel**](SalesAPI.md#mobilepostsalesbyidcancel) | **POST** /sales/{id}/cancel | Anular venta
[**mobilePostSalesCreate**](SalesAPI.md#mobilepostsalescreate) | **POST** /sales/create | Registrar venta


# **mobileGetSales**
```swift
    open class func mobileGetSales(completion: @escaping (_ data: GetSalesResponse?, _ error: Error?) -> Void)
```

Consultar ventas

Devuelve las ventas activas con sus líneas, totales y relaciones de facturación.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK


// Consultar ventas
SalesAPI.mobileGetSales() { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetSalesResponse**](GetSalesResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetSalesById**
```swift
    open class func mobileGetSalesById(id: String, completion: @escaping (_ data: GetSalesIdResponse?, _ error: Error?) -> Void)
```

Consultar venta

Devuelve la venta identificada con líneas, cliente, turno, factura y conciliaciones.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | Identificador único del recurso.

// Consultar venta
SalesAPI.mobileGetSalesById(id: id) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String** | Identificador único del recurso. |

### Return type

[**GetSalesIdResponse**](GetSalesIdResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePatchSalesByIdUpdate**
```swift
    open class func mobilePatchSalesByIdUpdate(id: String, saleUpdateRequest: SaleUpdateRequest, completion: @escaping (_ data: PatchSalesIdUpdateResponse?, _ error: Error?) -> Void)
```

Actualizar datos de venta

Modifica únicamente el descuento y las observaciones editables de la venta seleccionada.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | Identificador único del recurso.
let saleUpdateRequest = SaleUpdateRequest(observaciones: "observaciones_example", descuento: 123) // SaleUpdateRequest |

// Actualizar datos de venta
SalesAPI.mobilePatchSalesByIdUpdate(id: id, saleUpdateRequest: saleUpdateRequest) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String** | Identificador único del recurso. |
 **saleUpdateRequest** | [**SaleUpdateRequest**](SaleUpdateRequest.md) |  |

### Return type

[**PatchSalesIdUpdateResponse**](PatchSalesIdUpdateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostSalesByIdCancel**
```swift
    open class func mobilePostSalesByIdCancel(id: String, saleCancelRequest: SaleCancelRequest, completion: @escaping (_ data: PostSalesIdCancelResponse?, _ error: Error?) -> Void)
```

Anular venta

Anula la venta seleccionada y revierte los efectos permitidos sobre inventario y conciliaciones.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | Identificador único del recurso.
let saleCancelRequest = SaleCancelRequest(motivo: "motivo_example") // SaleCancelRequest |

// Anular venta
SalesAPI.mobilePostSalesByIdCancel(id: id, saleCancelRequest: saleCancelRequest) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String** | Identificador único del recurso. |
 **saleCancelRequest** | [**SaleCancelRequest**](SaleCancelRequest.md) |  |

### Return type

[**PostSalesIdCancelResponse**](PostSalesIdCancelResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostSalesCreate**
```swift
    open class func mobilePostSalesCreate(saleCreateRequest: SaleCreateRequest, idempotencyKey: String? = nil, completion: @escaping (_ data: PostSalesCreateResponse?, _ error: Error?) -> Void)
```

Registrar venta

Crea la venta, sus líneas y los efectos de inventario, turno y facturación que correspondan. Acepta idempotencyKey en el cuerpo o Idempotency-Key en el encabezado; si ambos están presentes, prevalece el cuerpo. La clave se recorta y debe contener de 1 a 64 caracteres; una clave inválida en el cuerpo devuelve 400. La idempotencia se limita al tenant y a la clave. Si se repite la misma clave con el mismo payload normalizado, devuelve la respuesta original; si el payload normalizado difiere, responde 409. Se valida la autenticación y autorización antes de consultar una repetición. El cliente debe conservar una clave estable por venta lógica pendiente y reutilizarla en todos sus reintentos; no debe generar una clave nueva por intento.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let saleCreateRequest = SaleCreateRequest(puntoDeVentaId: "puntoDeVentaId_example", clienteId: "clienteId_example", empleadoId: "empleadoId_example", descuento: 123, observaciones: "observaciones_example", items: [SaleItemRequest(productoId: "productoId_example", cantidad: 123, precioUnitario: 123)], turnoId: "turnoId_example", metodoPago: "metodoPago_example", montoEfectivo: 123, montoTarjeta: 123, montoTransferencia: 123, montoCredito: 123, tipoVencimiento: "tipoVencimiento_example", fechaVencimiento: "fechaVencimiento_example", cuentaBancariaId: "cuentaBancariaId_example", idempotencyKey: "idempotencyKey_example") // SaleCreateRequest |
let idempotencyKey = "idempotencyKey_example" // String | Clave opcional de idempotencia; se usa solo si idempotencyKey no está presente en el cuerpo. El valor del cuerpo tiene precedencia. (optional)

// Registrar venta
SalesAPI.mobilePostSalesCreate(saleCreateRequest: saleCreateRequest, idempotencyKey: idempotencyKey) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **saleCreateRequest** | [**SaleCreateRequest**](SaleCreateRequest.md) |  |
 **idempotencyKey** | **String** | Clave opcional de idempotencia; se usa solo si idempotencyKey no está presente en el cuerpo. El valor del cuerpo tiene precedencia. | [optional]

### Return type

[**PostSalesCreateResponse**](PostSalesCreateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

