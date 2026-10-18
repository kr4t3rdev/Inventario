//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class PostAdminTenantsDeleteResponse {
  /// Returns a new [PostAdminTenantsDeleteResponse] instance.
  PostAdminTenantsDeleteResponse({
    required this.success,
    required this.tenantId,
    required this.message,
  });

  bool success;

  String tenantId;

  String message;

  @override
  bool operator ==(Object other) => identical(this, other) || other is PostAdminTenantsDeleteResponse &&
    other.success == success &&
    other.tenantId == tenantId &&
    other.message == message;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (success.hashCode) +
    (tenantId.hashCode) +
    (message.hashCode);

  @override
  String toString() => 'PostAdminTenantsDeleteResponse[success=$success, tenantId=$tenantId, message=$message]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'success'] = this.success;
      json[r'tenantId'] = this.tenantId;
      json[r'message'] = this.message;
    return json;
  }

  /// Returns a new [PostAdminTenantsDeleteResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static PostAdminTenantsDeleteResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "PostAdminTenantsDeleteResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "PostAdminTenantsDeleteResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return PostAdminTenantsDeleteResponse(
        success: mapValueOfType<bool>(json, r'success')!,
        tenantId: mapValueOfType<String>(json, r'tenantId')!,
        message: mapValueOfType<String>(json, r'message')!,
      );
    }
    return null;
  }

  static List<PostAdminTenantsDeleteResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <PostAdminTenantsDeleteResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = PostAdminTenantsDeleteResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, PostAdminTenantsDeleteResponse> mapFromJson(dynamic json) {
    final map = <String, PostAdminTenantsDeleteResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = PostAdminTenantsDeleteResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of PostAdminTenantsDeleteResponse-objects as value to a dart map
  static Map<String, List<PostAdminTenantsDeleteResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<PostAdminTenantsDeleteResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = PostAdminTenantsDeleteResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'success',
    'tenantId',
    'message',
  };
}

