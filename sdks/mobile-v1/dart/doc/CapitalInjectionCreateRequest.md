# tcp_mobile_v1_sdk.model.CapitalInjectionCreateRequest

## Load the model package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**montoRecibido** | **num** |  |
**moneda** | **String** |  | [optional] [default to 'CUP']
**tipo** | **String** |  |
**descripcion** | **String** |  | [optional]
**cuentaId** | **String** |  |
**socio** | **String** |  | [optional]
**entidadPrestamista** | **String** |  | [optional]
**tasaInteres** | **num** |  | [optional]
**tasaCambio** | **num** |  | [optional]
**plazoMeses** | **int** |  | [optional]
**fechaInicioPago** | [**DateTime**](DateTime.md) |  | [optional]
**fechaOperacion** | [**DateTime**](DateTime.md) |  | [optional]
**idempotencyKey** | **String** | Clave opcional de idempotencia (1 a 64 caracteres). Si se proporciona también Idempotency-Key, prevalece esta propiedad. | [optional]

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


