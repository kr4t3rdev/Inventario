//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class GetAdminTenantUsersResponse {
  /// Returns a new [GetAdminTenantUsersResponse] instance.
  GetAdminTenantUsersResponse({
    this.users = const [],
    required this.total,
    required this.tenantId,
  });

  List<AdminTenantUserItem> users;

  /// Minimum value: 0
  int total;

  String tenantId;

  @override
  bool operator ==(Object other) => identical(this, other) || other is GetAdminTenantUsersResponse &&
    _deepEquality.equals(other.users, users) &&
    other.total == total &&
    other.tenantId == tenantId;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (users.hashCode) +
    (total.hashCode) +
    (tenantId.hashCode);

  @override
  String toString() => 'GetAdminTenantUsersResponse[users=$users, total=$total, tenantId=$tenantId]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'users'] = this.users;
      json[r'total'] = this.total;
      json[r'tenantId'] = this.tenantId;
    return json;
  }

  /// Returns a new [GetAdminTenantUsersResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static GetAdminTenantUsersResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "GetAdminTenantUsersResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "GetAdminTenantUsersResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return GetAdminTenantUsersResponse(
        users: AdminTenantUserItem.listFromJson(json[r'users']),
        total: mapValueOfType<int>(json, r'total')!,
        tenantId: mapValueOfType<String>(json, r'tenantId')!,
      );
    }
    return null;
  }

  static List<GetAdminTenantUsersResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <GetAdminTenantUsersResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = GetAdminTenantUsersResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, GetAdminTenantUsersResponse> mapFromJson(dynamic json) {
    final map = <String, GetAdminTenantUsersResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = GetAdminTenantUsersResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of GetAdminTenantUsersResponse-objects as value to a dart map
  static Map<String, List<GetAdminTenantUsersResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<GetAdminTenantUsersResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = GetAdminTenantUsersResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'users',
    'total',
    'tenantId',
  };
}

