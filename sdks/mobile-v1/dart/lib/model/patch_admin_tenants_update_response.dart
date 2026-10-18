//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class PatchAdminTenantsUpdateResponse {
  /// Returns a new [PatchAdminTenantsUpdateResponse] instance.
  PatchAdminTenantsUpdateResponse({
    required this.tenant,
    required this.message,
  });

  AdminTenantDetail tenant;

  String message;

  @override
  bool operator ==(Object other) => identical(this, other) || other is PatchAdminTenantsUpdateResponse &&
    other.tenant == tenant &&
    other.message == message;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (tenant.hashCode) +
    (message.hashCode);

  @override
  String toString() => 'PatchAdminTenantsUpdateResponse[tenant=$tenant, message=$message]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'tenant'] = this.tenant;
      json[r'message'] = this.message;
    return json;
  }

  /// Returns a new [PatchAdminTenantsUpdateResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static PatchAdminTenantsUpdateResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "PatchAdminTenantsUpdateResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "PatchAdminTenantsUpdateResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return PatchAdminTenantsUpdateResponse(
        tenant: AdminTenantDetail.fromJson(json[r'tenant'])!,
        message: mapValueOfType<String>(json, r'message')!,
      );
    }
    return null;
  }

  static List<PatchAdminTenantsUpdateResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <PatchAdminTenantsUpdateResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = PatchAdminTenantsUpdateResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, PatchAdminTenantsUpdateResponse> mapFromJson(dynamic json) {
    final map = <String, PatchAdminTenantsUpdateResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = PatchAdminTenantsUpdateResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of PatchAdminTenantsUpdateResponse-objects as value to a dart map
  static Map<String, List<PatchAdminTenantsUpdateResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<PatchAdminTenantsUpdateResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = PatchAdminTenantsUpdateResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'tenant',
    'message',
  };
}

