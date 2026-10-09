# tcp_mobile_v1_sdk.model.AdminUserDetail

## Load the model package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**userId** | **String** |  | 
**name** | **String** |  | 
**email** | **String** |  | 
**role** | **String** |  | 
**isActive** | **bool** |  | 
**onboardingType** | **String** |  | [optional] 
**onboardingStatus** | **String** |  | [optional] 
**emailVerifiedAt** | [**DateTime**](DateTime.md) |  | [optional] 
**createdAt** | [**DateTime**](DateTime.md) |  | [optional] 
**updatedAt** | [**DateTime**](DateTime.md) |  | [optional] 
**activatedAt** | [**DateTime**](DateTime.md) |  | [optional] 
**expiresAt** | [**DateTime**](DateTime.md) |  | [optional] 
**avatar** | **String** |  | [optional] 
**lockedUntil** | [**DateTime**](DateTime.md) |  | [optional] 
**loginAttempts** | **int** |  | 
**lastFailedLogin** | [**DateTime**](DateTime.md) |  | [optional] 
**memberships** | [**List<AdminUserMembership>**](AdminUserMembership.md) |  | [optional] [default to const []]
**activeSessions** | **int** |  | 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


