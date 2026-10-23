# tcp_mobile_v1_sdk.model.CashPaymentRequest

## Load the model package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**monto** | **num** |  |
**cuentaId** | **String** |  |
**tipoPagoId** | **String** |  |
**moneda** | **String** |  | [optional]
**tasaCambio** | **num** |  | [optional]
**observaciones** | **String** |  | [optional]
**idempotencyKey** | **String** | Clave opcional de idempotencia (1 a 64 caracteres). Si también se envía Idempotency-Key en el encabezado, prevalece esta propiedad. | [optional]
**fechaOperacion** | **String** | Fecha explícita de operación: fecha ISO 8601 (YYYY-MM-DD) o timestamp ISO 8601 con zona horaria. Si se omite, se conserva la fecha actual. | [optional]

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


