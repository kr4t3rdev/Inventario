//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class AdminTenantIdRequest {
  /// Returns a new [AdminTenantIdRequest] instance.
  AdminTenantIdRequest({
    required this.tenantId,
  });

  String tenantId;

  @override
  bool operator ==(Object other) => identical(this, other) || other is AdminTenantIdRequest &&
    other.tenantId == tenantId;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (tenantId.hashCode);

  @override
  String toString() => 'AdminTenantIdRequest[tenantId=$tenantId]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'tenantId'] = this.tenantId;
    return json;
  }

  /// Returns a new [AdminTenantIdRequest] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static AdminTenantIdRequest? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "AdminTenantIdRequest[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "AdminTenantIdRequest[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return AdminTenantIdRequest(
        tenantId: mapValueOfType<String>(json, r'tenantId')!,
      );
    }
    return null;
  }

  static List<AdminTenantIdRequest> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <AdminTenantIdRequest>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = AdminTenantIdRequest.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, AdminTenantIdRequest> mapFromJson(dynamic json) {
    final map = <String, AdminTenantIdRequest>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = AdminTenantIdRequest.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of AdminTenantIdRequest-objects as value to a dart map
  static Map<String, List<AdminTenantIdRequest>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<AdminTenantIdRequest>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = AdminTenantIdRequest.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'tenantId',
  };
}

