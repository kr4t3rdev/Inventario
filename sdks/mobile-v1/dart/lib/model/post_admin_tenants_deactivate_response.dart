//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class PostAdminTenantsDeactivateResponse {
  /// Returns a new [PostAdminTenantsDeactivateResponse] instance.
  PostAdminTenantsDeactivateResponse({
    required this.tenantId,
    required this.membershipsDeactivated,
    required this.message,
  });

  String tenantId;

  /// Minimum value: 0
  int membershipsDeactivated;

  String message;

  @override
  bool operator ==(Object other) => identical(this, other) || other is PostAdminTenantsDeactivateResponse &&
    other.tenantId == tenantId &&
    other.membershipsDeactivated == membershipsDeactivated &&
    other.message == message;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (tenantId.hashCode) +
    (membershipsDeactivated.hashCode) +
    (message.hashCode);

  @override
  String toString() => 'PostAdminTenantsDeactivateResponse[tenantId=$tenantId, membershipsDeactivated=$membershipsDeactivated, message=$message]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'tenantId'] = this.tenantId;
      json[r'membershipsDeactivated'] = this.membershipsDeactivated;
      json[r'message'] = this.message;
    return json;
  }

  /// Returns a new [PostAdminTenantsDeactivateResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static PostAdminTenantsDeactivateResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "PostAdminTenantsDeactivateResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "PostAdminTenantsDeactivateResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return PostAdminTenantsDeactivateResponse(
        tenantId: mapValueOfType<String>(json, r'tenantId')!,
        membershipsDeactivated: mapValueOfType<int>(json, r'membershipsDeactivated')!,
        message: mapValueOfType<String>(json, r'message')!,
      );
    }
    return null;
  }

  static List<PostAdminTenantsDeactivateResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <PostAdminTenantsDeactivateResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = PostAdminTenantsDeactivateResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, PostAdminTenantsDeactivateResponse> mapFromJson(dynamic json) {
    final map = <String, PostAdminTenantsDeactivateResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = PostAdminTenantsDeactivateResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of PostAdminTenantsDeactivateResponse-objects as value to a dart map
  static Map<String, List<PostAdminTenantsDeactivateResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<PostAdminTenantsDeactivateResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = PostAdminTenantsDeactivateResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'tenantId',
    'membershipsDeactivated',
    'message',
  };
}

