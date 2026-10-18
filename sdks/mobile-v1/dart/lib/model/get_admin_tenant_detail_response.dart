//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class GetAdminTenantDetailResponse {
  /// Returns a new [GetAdminTenantDetailResponse] instance.
  GetAdminTenantDetailResponse({
    required this.tenant,
    required this.currentLicense,
  });

  AdminTenantDetail tenant;

  AdminLicenseSummary? currentLicense;

  @override
  bool operator ==(Object other) => identical(this, other) || other is GetAdminTenantDetailResponse &&
    other.tenant == tenant &&
    other.currentLicense == currentLicense;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (tenant.hashCode) +
    (currentLicense == null ? 0 : currentLicense!.hashCode);

  @override
  String toString() => 'GetAdminTenantDetailResponse[tenant=$tenant, currentLicense=$currentLicense]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'tenant'] = this.tenant;
    if (this.currentLicense != null) {
      json[r'currentLicense'] = this.currentLicense;
    } else {
      json[r'currentLicense'] = null;
    }
    return json;
  }

  /// Returns a new [GetAdminTenantDetailResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static GetAdminTenantDetailResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "GetAdminTenantDetailResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "GetAdminTenantDetailResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return GetAdminTenantDetailResponse(
        tenant: AdminTenantDetail.fromJson(json[r'tenant'])!,
        currentLicense: AdminLicenseSummary.fromJson(json[r'currentLicense']),
      );
    }
    return null;
  }

  static List<GetAdminTenantDetailResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <GetAdminTenantDetailResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = GetAdminTenantDetailResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, GetAdminTenantDetailResponse> mapFromJson(dynamic json) {
    final map = <String, GetAdminTenantDetailResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = GetAdminTenantDetailResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of GetAdminTenantDetailResponse-objects as value to a dart map
  static Map<String, List<GetAdminTenantDetailResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<GetAdminTenantDetailResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = GetAdminTenantDetailResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'tenant',
    'currentLicense',
  };
}

