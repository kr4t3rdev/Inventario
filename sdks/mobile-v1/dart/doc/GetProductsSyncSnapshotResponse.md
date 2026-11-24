# tcp_mobile_v1_sdk.model.GetProductsSyncSnapshotResponse

## Load the model package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**items** | [**List<MobileSyncProduct>**](MobileSyncProduct.md) |  | [default to const []]
**nextPageToken** | **String** | Token opaco para continuar el snapshot; nulo al llegar a la última página. | 
**changesCursor** | **String** | Cursor de cambios con el watermark capturado al iniciar el snapshot. | 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


