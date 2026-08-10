# tcp_mobile_v1_sdk.model.ExpenseReconciliationRequest

## Load the model package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**tipoGasto** | **String** |  | 
**pgId** | **String** |  | [optional] 
**gastosDEId** | **String** |  | [optional] 
**gastoCompraId** | **String** |  | [optional] 
**referenciaId** | **String** |  | [optional] 
**cuentaId** | **String** |  | [optional] 
**tipoPagoId** | **String** |  | [optional] 
**monto** | **num** |  | 
**moneda** | **String** |  | [optional] [default to 'CUP']
**tasaCambio** | **num** |  | [optional] 
**descripcion** | **String** |  | 
**periodo** | **String** |  | [optional] 
**observaciones** | **String** |  | [optional] 
**estado** | **String** |  | [optional] [default to 'PAGADA']
**cuentaPorPagarId** | **String** |  | [optional] 
**numeroTransaccion** | **String** |  | [optional] 
**distribucion** | [**List<ExpenseDistributionRequest>**](ExpenseDistributionRequest.md) |  | [optional] [default to const []]

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


