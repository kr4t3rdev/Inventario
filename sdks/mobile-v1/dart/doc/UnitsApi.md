# tcp_mobile_v1_sdk.api.UnitsApi

## Load the API package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileCreateUnit**](UnitsApi.md#mobilecreateunit) | **POST** /units/create | Crear unidad
[**mobileDeleteUnit**](UnitsApi.md#mobiledeleteunit) | **DELETE** /units/{id} | Eliminar unidad
[**mobileListUnits**](UnitsApi.md#mobilelistunits) | **GET** /units | Listar unidades
[**mobileUpdateUnit**](UnitsApi.md#mobileupdateunit) | **PUT** /units/{id} | Actualizar unidad


# **mobileCreateUnit**
> GetUnitsDetailResponse mobileCreateUnit(mobileCreateUnitRequest)

Crear unidad

Crea una nueva unidad de medida.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = UnitsApi();
final mobileCreateUnitRequest = MobileCreateUnitRequest(); // MobileCreateUnitRequest | 

try {
    final result = api_instance.mobileCreateUnit(mobileCreateUnitRequest);
    print(result);
} catch (e) {
    print('Exception when calling UnitsApi->mobileCreateUnit: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **mobileCreateUnitRequest** | [**MobileCreateUnitRequest**](MobileCreateUnitRequest.md)|  | 

### Return type

[**GetUnitsDetailResponse**](GetUnitsDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileDeleteUnit**
> DeleteUnitResponse mobileDeleteUnit(id)

Eliminar unidad

Elimina una unidad de medida.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = UnitsApi();
final id = id_example; // String | 

try {
    final result = api_instance.mobileDeleteUnit(id);
    print(result);
} catch (e) {
    print('Exception when calling UnitsApi->mobileDeleteUnit: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**DeleteUnitResponse**](DeleteUnitResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileListUnits**
> GetUnitsListResponse mobileListUnits()

Listar unidades

Devuelve las unidades de medida del tenant.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = UnitsApi();

try {
    final result = api_instance.mobileListUnits();
    print(result);
} catch (e) {
    print('Exception when calling UnitsApi->mobileListUnits: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetUnitsListResponse**](GetUnitsListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileUpdateUnit**
> GetUnitsDetailResponse mobileUpdateUnit(id, mobileUpdateUnitRequest)

Actualizar unidad

Actualiza una unidad de medida.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = UnitsApi();
final id = id_example; // String | 
final mobileUpdateUnitRequest = MobileUpdateUnitRequest(); // MobileUpdateUnitRequest | 

try {
    final result = api_instance.mobileUpdateUnit(id, mobileUpdateUnitRequest);
    print(result);
} catch (e) {
    print('Exception when calling UnitsApi->mobileUpdateUnit: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 
 **mobileUpdateUnitRequest** | [**MobileUpdateUnitRequest**](MobileUpdateUnitRequest.md)|  | 

### Return type

[**GetUnitsDetailResponse**](GetUnitsDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

