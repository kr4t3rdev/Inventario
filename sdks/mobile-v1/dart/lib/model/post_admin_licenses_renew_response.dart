//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class PostAdminLicensesRenewResponse {
  /// Returns a new [PostAdminLicensesRenewResponse] instance.
  PostAdminLicensesRenewResponse({
    required this.tenantLicenseId,
    required this.newExpiracion,
    required this.newPlanId,
    this.previousExpiracion,
    this.previousPlanId,
    required this.message,
  });

  String tenantLicenseId;

  DateTime newExpiracion;

  String newPlanId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  DateTime? previousExpiracion;

  String? previousPlanId;

  String message;

  @override
  bool operator ==(Object other) => identical(this, other) || other is PostAdminLicensesRenewResponse &&
    other.tenantLicenseId == tenantLicenseId &&
    other.newExpiracion == newExpiracion &&
    other.newPlanId == newPlanId &&
    other.previousExpiracion == previousExpiracion &&
    other.previousPlanId == previousPlanId &&
    other.message == message;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (tenantLicenseId.hashCode) +
    (newExpiracion.hashCode) +
    (newPlanId.hashCode) +
    (previousExpiracion == null ? 0 : previousExpiracion!.hashCode) +
    (previousPlanId == null ? 0 : previousPlanId!.hashCode) +
    (message.hashCode);

  @override
  String toString() => 'PostAdminLicensesRenewResponse[tenantLicenseId=$tenantLicenseId, newExpiracion=$newExpiracion, newPlanId=$newPlanId, previousExpiracion=$previousExpiracion, previousPlanId=$previousPlanId, message=$message]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'tenantLicenseId'] = this.tenantLicenseId;
      json[r'newExpiracion'] = this.newExpiracion.toUtc().toIso8601String();
      json[r'newPlanId'] = this.newPlanId;
    if (this.previousExpiracion != null) {
      json[r'previousExpiracion'] = this.previousExpiracion!.toUtc().toIso8601String();
    } else {
      json[r'previousExpiracion'] = null;
    }
    if (this.previousPlanId != null) {
      json[r'previousPlanId'] = this.previousPlanId;
    } else {
      json[r'previousPlanId'] = null;
    }
      json[r'message'] = this.message;
    return json;
  }

  /// Returns a new [PostAdminLicensesRenewResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static PostAdminLicensesRenewResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "PostAdminLicensesRenewResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "PostAdminLicensesRenewResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return PostAdminLicensesRenewResponse(
        tenantLicenseId: mapValueOfType<String>(json, r'tenantLicenseId')!,
        newExpiracion: mapDateTime(json, r'newExpiracion', r'')!,
        newPlanId: mapValueOfType<String>(json, r'newPlanId')!,
        previousExpiracion: mapDateTime(json, r'previousExpiracion', r''),
        previousPlanId: mapValueOfType<String>(json, r'previousPlanId'),
        message: mapValueOfType<String>(json, r'message')!,
      );
    }
    return null;
  }

  static List<PostAdminLicensesRenewResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <PostAdminLicensesRenewResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = PostAdminLicensesRenewResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, PostAdminLicensesRenewResponse> mapFromJson(dynamic json) {
    final map = <String, PostAdminLicensesRenewResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = PostAdminLicensesRenewResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of PostAdminLicensesRenewResponse-objects as value to a dart map
  static Map<String, List<PostAdminLicensesRenewResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<PostAdminLicensesRenewResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = PostAdminLicensesRenewResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'tenantLicenseId',
    'newExpiracion',
    'newPlanId',
    'message',
  };
}

