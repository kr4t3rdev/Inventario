//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class PostAdminTenantsActivateResponse {
  /// Returns a new [PostAdminTenantsActivateResponse] instance.
  PostAdminTenantsActivateResponse({
    required this.tenantId,
    required this.membershipsActivated,
    required this.message,
  });

  String tenantId;

  /// Minimum value: 0
  int membershipsActivated;

  String message;

  @override
  bool operator ==(Object other) => identical(this, other) || other is PostAdminTenantsActivateResponse &&
    other.tenantId == tenantId &&
    other.membershipsActivated == membershipsActivated &&
    other.message == message;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (tenantId.hashCode) +
    (membershipsActivated.hashCode) +
    (message.hashCode);

  @override
  String toString() => 'PostAdminTenantsActivateResponse[tenantId=$tenantId, membershipsActivated=$membershipsActivated, message=$message]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'tenantId'] = this.tenantId;
      json[r'membershipsActivated'] = this.membershipsActivated;
      json[r'message'] = this.message;
    return json;
  }

  /// Returns a new [PostAdminTenantsActivateResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static PostAdminTenantsActivateResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "PostAdminTenantsActivateResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "PostAdminTenantsActivateResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return PostAdminTenantsActivateResponse(
        tenantId: mapValueOfType<String>(json, r'tenantId')!,
        membershipsActivated: mapValueOfType<int>(json, r'membershipsActivated')!,
        message: mapValueOfType<String>(json, r'message')!,
      );
    }
    return null;
  }

  static List<PostAdminTenantsActivateResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <PostAdminTenantsActivateResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = PostAdminTenantsActivateResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, PostAdminTenantsActivateResponse> mapFromJson(dynamic json) {
    final map = <String, PostAdminTenantsActivateResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = PostAdminTenantsActivateResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of PostAdminTenantsActivateResponse-objects as value to a dart map
  static Map<String, List<PostAdminTenantsActivateResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<PostAdminTenantsActivateResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = PostAdminTenantsActivateResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'tenantId',
    'membershipsActivated',
    'message',
  };
}

