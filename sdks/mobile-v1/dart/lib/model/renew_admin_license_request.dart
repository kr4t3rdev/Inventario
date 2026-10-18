//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class RenewAdminLicenseRequest {
  /// Returns a new [RenewAdminLicenseRequest] instance.
  RenewAdminLicenseRequest({
    required this.tenantLicenseId,
    this.planId,
    this.durationDays,
  });

  String tenantLicenseId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? planId;

  /// Minimum value: 1
  /// Maximum value: 3650
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  int? durationDays;

  @override
  bool operator ==(Object other) => identical(this, other) || other is RenewAdminLicenseRequest &&
    other.tenantLicenseId == tenantLicenseId &&
    other.planId == planId &&
    other.durationDays == durationDays;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (tenantLicenseId.hashCode) +
    (planId == null ? 0 : planId!.hashCode) +
    (durationDays == null ? 0 : durationDays!.hashCode);

  @override
  String toString() => 'RenewAdminLicenseRequest[tenantLicenseId=$tenantLicenseId, planId=$planId, durationDays=$durationDays]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'tenantLicenseId'] = this.tenantLicenseId;
    if (this.planId != null) {
      json[r'planId'] = this.planId;
    } else {
      json[r'planId'] = null;
    }
    if (this.durationDays != null) {
      json[r'durationDays'] = this.durationDays;
    } else {
      json[r'durationDays'] = null;
    }
    return json;
  }

  /// Returns a new [RenewAdminLicenseRequest] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static RenewAdminLicenseRequest? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "RenewAdminLicenseRequest[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "RenewAdminLicenseRequest[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return RenewAdminLicenseRequest(
        tenantLicenseId: mapValueOfType<String>(json, r'tenantLicenseId')!,
        planId: mapValueOfType<String>(json, r'planId'),
        durationDays: mapValueOfType<int>(json, r'durationDays'),
      );
    }
    return null;
  }

  static List<RenewAdminLicenseRequest> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <RenewAdminLicenseRequest>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = RenewAdminLicenseRequest.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, RenewAdminLicenseRequest> mapFromJson(dynamic json) {
    final map = <String, RenewAdminLicenseRequest>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = RenewAdminLicenseRequest.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of RenewAdminLicenseRequest-objects as value to a dart map
  static Map<String, List<RenewAdminLicenseRequest>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<RenewAdminLicenseRequest>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = RenewAdminLicenseRequest.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'tenantLicenseId',
  };
}

