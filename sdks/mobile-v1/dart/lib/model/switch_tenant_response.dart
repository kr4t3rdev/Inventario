//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class SwitchTenantResponse {
  /// Returns a new [SwitchTenantResponse] instance.
  SwitchTenantResponse({
    required this.accessToken,
    required this.refreshToken,
    required this.tenantId,
    this.tenantRole,
  });

  Token accessToken;

  Token refreshToken;

  String tenantId;

  String? tenantRole;

  @override
  bool operator ==(Object other) => identical(this, other) || other is SwitchTenantResponse &&
    other.accessToken == accessToken &&
    other.refreshToken == refreshToken &&
    other.tenantId == tenantId &&
    other.tenantRole == tenantRole;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (accessToken.hashCode) +
    (refreshToken.hashCode) +
    (tenantId.hashCode) +
    (tenantRole == null ? 0 : tenantRole!.hashCode);

  @override
  String toString() => 'SwitchTenantResponse[accessToken=<redacted>, refreshToken=<redacted>, tenantId=$tenantId, tenantRole=$tenantRole]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'accessToken'] = this.accessToken;
      json[r'refreshToken'] = this.refreshToken;
      json[r'tenantId'] = this.tenantId;
    if (this.tenantRole != null) {
      json[r'tenantRole'] = this.tenantRole;
    } else {
      json[r'tenantRole'] = null;
    }
    return json;
  }

  /// Returns a new [SwitchTenantResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static SwitchTenantResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "SwitchTenantResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "SwitchTenantResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return SwitchTenantResponse(
        accessToken: Token.fromJson(json[r'accessToken'])!,
        refreshToken: Token.fromJson(json[r'refreshToken'])!,
        tenantId: mapValueOfType<String>(json, r'tenantId')!,
        tenantRole: mapValueOfType<String>(json, r'tenantRole'),
      );
    }
    return null;
  }

  static List<SwitchTenantResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <SwitchTenantResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = SwitchTenantResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, SwitchTenantResponse> mapFromJson(dynamic json) {
    final map = <String, SwitchTenantResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = SwitchTenantResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of SwitchTenantResponse-objects as value to a dart map
  static Map<String, List<SwitchTenantResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<SwitchTenantResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = SwitchTenantResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'accessToken',
    'refreshToken',
    'tenantId',
  };
}

