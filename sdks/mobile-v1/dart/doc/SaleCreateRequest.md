# tcp_mobile_v1_sdk.model.SaleCreateRequest

## Load the model package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**puntoDeVentaId** | **String** |  | 
**clienteId** | **String** |  | [optional] 
**empleadoId** | **String** |  | [optional] 
**descuento** | **int** |  | [optional] [default to 0]
**observaciones** | **String** |  | [optional] 
**items** | [**List<SaleItemRequest>**](SaleItemRequest.md) |  | [default to const []]
**turnoId** | **String** |  | [optional] 
**metodoPago** | **String** |  | [optional] 
**montoEfectivo** | **num** |  | [optional] 
**montoTarjeta** | **num** |  | [optional] 
**montoTransferencia** | **num** |  | [optional] 
**montoCredito** | **num** |  | [optional] 
**tipoVencimiento** | **String** |  | [optional] 
**fechaVencimiento** | **String** |  | [optional] 
**cuentaBancariaId** | **String** |  | [optional] 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


