# tcp_mobile_v1_sdk.api.AccountingAdvancesApi

## Load the API package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileDeleteAccountingAdvancesById**](AccountingAdvancesApi.md#mobiledeleteaccountingadvancesbyid) | **DELETE** /accounting/advances/{id} | Eliminar anticipo
[**mobileGetAccountingAdvances**](AccountingAdvancesApi.md#mobilegetaccountingadvances) | **GET** /accounting/advances | Consultar anticipos
[**mobileGetAccountingAdvancesAvailable**](AccountingAdvancesApi.md#mobilegetaccountingadvancesavailable) | **GET** /accounting/advances/available | Consultar anticipos disponibles
[**mobileGetAccountingAdvancesById**](AccountingAdvancesApi.md#mobilegetaccountingadvancesbyid) | **GET** /accounting/advances/{id} | Consultar anticipo
[**mobilePostAccountingAdvances**](AccountingAdvancesApi.md#mobilepostaccountingadvances) | **POST** /accounting/advances | Registrar anticipos
[**mobilePostAccountingAdvancesByIdEjecutar**](AccountingAdvancesApi.md#mobilepostaccountingadvancesbyidejecutar) | **POST** /accounting/advances/{id}/ejecutar | Ejecutar anticipo reservado
[**mobilePostAccountingAdvancesByIdRevertir**](AccountingAdvancesApi.md#mobilepostaccountingadvancesbyidrevertir) | **POST** /accounting/advances/{id}/revertir | Revertir ejecución de anticipo
[**mobilePutAccountingAdvancesById**](AccountingAdvancesApi.md#mobileputaccountingadvancesbyid) | **PUT** /accounting/advances/{id} | Actualizar anticipo


# **mobileDeleteAccountingAdvancesById**
> DeleteAccountingAdvancesIdResponse mobileDeleteAccountingAdvancesById(id)

Eliminar anticipo

Elimina el anticipo identificado después de comprobar que pertenece al tenant.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingAdvancesApi();
final id = id_example; // String | Identificador único del recurso.

try {
    final result = api_instance.mobileDeleteAccountingAdvancesById(id);
    print(result);
} catch (e) {
    print('Exception when calling AccountingAdvancesApi->mobileDeleteAccountingAdvancesById: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**| Identificador único del recurso. | 

### Return type

[**DeleteAccountingAdvancesIdResponse**](DeleteAccountingAdvancesIdResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingAdvances**
> GetAccountingAdvancesResponse mobileGetAccountingAdvances()

Consultar anticipos

Consulta anticipos de pago o cobro con su saldo disponible y vigencia.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingAdvancesApi();

try {
    final result = api_instance.mobileGetAccountingAdvances();
    print(result);
} catch (e) {
    print('Exception when calling AccountingAdvancesApi->mobileGetAccountingAdvances: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetAccountingAdvancesResponse**](GetAccountingAdvancesResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingAdvancesAvailable**
> GetAccountingAdvancesAvailableResponse mobileGetAccountingAdvancesAvailable(contexto, proveedorId, clienteId, moneda, estado)

Consultar anticipos disponibles

Busca anticipos reservados con saldo que todavía pueden aplicarse a una compra o factura. Permite precisar la consulta mediante contexto de uso, proveedor, cliente, moneda, estado.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingAdvancesApi();
final contexto = contexto_example; // String | Valor de contexto aceptado por el handler.
final proveedorId = proveedorId_example; // String | Identificador del proveedor.
final clienteId = clienteId_example; // String | Identificador del cliente.
final moneda = moneda_example; // String | Código de moneda.
final estado = true; // bool | Estado usado para filtrar resultados.

try {
    final result = api_instance.mobileGetAccountingAdvancesAvailable(contexto, proveedorId, clienteId, moneda, estado);
    print(result);
} catch (e) {
    print('Exception when calling AccountingAdvancesApi->mobileGetAccountingAdvancesAvailable: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **contexto** | **String**| Valor de contexto aceptado por el handler. | [optional] 
 **proveedorId** | **String**| Identificador del proveedor. | [optional] 
 **clienteId** | **String**| Identificador del cliente. | [optional] 
 **moneda** | **String**| Código de moneda. | [optional] 
 **estado** | **bool**| Estado usado para filtrar resultados. | [optional] 

### Return type

[**GetAccountingAdvancesAvailableResponse**](GetAccountingAdvancesAvailableResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingAdvancesById**
> GetAccountingAdvancesIdResponse mobileGetAccountingAdvancesById(id)

Consultar anticipo

Devuelve el anticipo solicitado con contrato, contraparte y movimientos relacionados.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingAdvancesApi();
final id = id_example; // String | Identificador único del recurso.

try {
    final result = api_instance.mobileGetAccountingAdvancesById(id);
    print(result);
} catch (e) {
    print('Exception when calling AccountingAdvancesApi->mobileGetAccountingAdvancesById: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**| Identificador único del recurso. | 

### Return type

[**GetAccountingAdvancesIdResponse**](GetAccountingAdvancesIdResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostAccountingAdvances**
> PostAccountingAdvancesResponse mobilePostAccountingAdvances(accountingAdvancesPostRequest)

Registrar anticipos

Crea una reserva de anticipo de pago o cobro, vinculada al contrato y contraparte indicados.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingAdvancesApi();
final accountingAdvancesPostRequest = AccountingAdvancesPostRequest(); // AccountingAdvancesPostRequest | 

try {
    final result = api_instance.mobilePostAccountingAdvances(accountingAdvancesPostRequest);
    print(result);
} catch (e) {
    print('Exception when calling AccountingAdvancesApi->mobilePostAccountingAdvances: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **accountingAdvancesPostRequest** | [**AccountingAdvancesPostRequest**](AccountingAdvancesPostRequest.md)|  | 

### Return type

[**PostAccountingAdvancesResponse**](PostAccountingAdvancesResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostAccountingAdvancesByIdEjecutar**
> PostAccountingAdvancesIdEjecutarResponse mobilePostAccountingAdvancesByIdEjecutar(id, accountingAdvancesIdEjecutarPostRequest)

Ejecutar anticipo reservado

Aplica el saldo completo del anticipo al documento destino con control de idempotencia y período contable.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingAdvancesApi();
final id = id_example; // String | Identificador único del recurso.
final accountingAdvancesIdEjecutarPostRequest = AccountingAdvancesIdEjecutarPostRequest(); // AccountingAdvancesIdEjecutarPostRequest | 

try {
    final result = api_instance.mobilePostAccountingAdvancesByIdEjecutar(id, accountingAdvancesIdEjecutarPostRequest);
    print(result);
} catch (e) {
    print('Exception when calling AccountingAdvancesApi->mobilePostAccountingAdvancesByIdEjecutar: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**| Identificador único del recurso. | 
 **accountingAdvancesIdEjecutarPostRequest** | [**AccountingAdvancesIdEjecutarPostRequest**](AccountingAdvancesIdEjecutarPostRequest.md)|  | 

### Return type

[**PostAccountingAdvancesIdEjecutarResponse**](PostAccountingAdvancesIdEjecutarResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostAccountingAdvancesByIdRevertir**
> PostAccountingAdvancesIdRevertirResponse mobilePostAccountingAdvancesByIdRevertir(id, accountingAdvancesIdRevertirPostRequest)

Revertir ejecución de anticipo

Revierte el importe aplicado al documento destino y restablece el estado contable correspondiente.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingAdvancesApi();
final id = id_example; // String | Identificador único del recurso.
final accountingAdvancesIdRevertirPostRequest = AccountingAdvancesIdRevertirPostRequest(); // AccountingAdvancesIdRevertirPostRequest | 

try {
    final result = api_instance.mobilePostAccountingAdvancesByIdRevertir(id, accountingAdvancesIdRevertirPostRequest);
    print(result);
} catch (e) {
    print('Exception when calling AccountingAdvancesApi->mobilePostAccountingAdvancesByIdRevertir: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**| Identificador único del recurso. | 
 **accountingAdvancesIdRevertirPostRequest** | [**AccountingAdvancesIdRevertirPostRequest**](AccountingAdvancesIdRevertirPostRequest.md)|  | 

### Return type

[**PostAccountingAdvancesIdRevertirResponse**](PostAccountingAdvancesIdRevertirResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePutAccountingAdvancesById**
> PutAccountingAdvancesIdResponse mobilePutAccountingAdvancesById(id, accountingAdvancesIdPutRequest)

Actualizar anticipo

Modifica estado, saldo disponible, vigencia o referencia externa del anticipo existente.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingAdvancesApi();
final id = id_example; // String | Identificador único del recurso.
final accountingAdvancesIdPutRequest = AccountingAdvancesIdPutRequest(); // AccountingAdvancesIdPutRequest | 

try {
    final result = api_instance.mobilePutAccountingAdvancesById(id, accountingAdvancesIdPutRequest);
    print(result);
} catch (e) {
    print('Exception when calling AccountingAdvancesApi->mobilePutAccountingAdvancesById: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**| Identificador único del recurso. | 
 **accountingAdvancesIdPutRequest** | [**AccountingAdvancesIdPutRequest**](AccountingAdvancesIdPutRequest.md)|  | 

### Return type

[**PutAccountingAdvancesIdResponse**](PutAccountingAdvancesIdResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

