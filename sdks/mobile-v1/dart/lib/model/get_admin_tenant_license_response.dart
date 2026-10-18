//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class GetAdminTenantLicenseResponse {
  /// Returns a new [GetAdminTenantLicenseResponse] instance.
  GetAdminTenantLicenseResponse({
    this.licenses = const [],
    required this.current,
    required this.tenantId,
  });

  List<AdminTenantLicenseItem> licenses;

  AdminTenantLicenseItem? current;

  String tenantId;

  @override
  bool operator ==(Object other) => identical(this, other) || other is GetAdminTenantLicenseResponse &&
    _deepEquality.equals(other.licenses, licenses) &&
    other.current == current &&
    other.tenantId == tenantId;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (licenses.hashCode) +
    (current == null ? 0 : current!.hashCode) +
    (tenantId.hashCode);

  @override
  String toString() => 'GetAdminTenantLicenseResponse[licenses=$licenses, current=$current, tenantId=$tenantId]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'licenses'] = this.licenses;
    if (this.current != null) {
      json[r'current'] = this.current;
    } else {
      json[r'current'] = null;
    }
      json[r'tenantId'] = this.tenantId;
    return json;
  }

  /// Returns a new [GetAdminTenantLicenseResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static GetAdminTenantLicenseResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "GetAdminTenantLicenseResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "GetAdminTenantLicenseResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return GetAdminTenantLicenseResponse(
        licenses: AdminTenantLicenseItem.listFromJson(json[r'licenses']),
        current: AdminTenantLicenseItem.fromJson(json[r'current']),
        tenantId: mapValueOfType<String>(json, r'tenantId')!,
      );
    }
    return null;
  }

  static List<GetAdminTenantLicenseResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <GetAdminTenantLicenseResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = GetAdminTenantLicenseResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, GetAdminTenantLicenseResponse> mapFromJson(dynamic json) {
    final map = <String, GetAdminTenantLicenseResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = GetAdminTenantLicenseResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of GetAdminTenantLicenseResponse-objects as value to a dart map
  static Map<String, List<GetAdminTenantLicenseResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<GetAdminTenantLicenseResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = GetAdminTenantLicenseResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'licenses',
    'current',
    'tenantId',
  };
}

