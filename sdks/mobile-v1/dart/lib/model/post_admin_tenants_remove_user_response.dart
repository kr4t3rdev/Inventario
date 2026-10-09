//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class PostAdminTenantsRemoveUserResponse {
  /// Returns a new [PostAdminTenantsRemoveUserResponse] instance.
  PostAdminTenantsRemoveUserResponse({
    required this.success,
    required this.membershipId,
    required this.message,
  });

  bool success;

  String membershipId;

  String message;

  @override
  bool operator ==(Object other) => identical(this, other) || other is PostAdminTenantsRemoveUserResponse &&
    other.success == success &&
    other.membershipId == membershipId &&
    other.message == message;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (success.hashCode) +
    (membershipId.hashCode) +
    (message.hashCode);

  @override
  String toString() => 'PostAdminTenantsRemoveUserResponse[success=$success, membershipId=$membershipId, message=$message]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'success'] = this.success;
      json[r'membershipId'] = this.membershipId;
      json[r'message'] = this.message;
    return json;
  }

  /// Returns a new [PostAdminTenantsRemoveUserResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static PostAdminTenantsRemoveUserResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "PostAdminTenantsRemoveUserResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "PostAdminTenantsRemoveUserResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return PostAdminTenantsRemoveUserResponse(
        success: mapValueOfType<bool>(json, r'success')!,
        membershipId: mapValueOfType<String>(json, r'membershipId')!,
        message: mapValueOfType<String>(json, r'message')!,
      );
    }
    return null;
  }

  static List<PostAdminTenantsRemoveUserResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <PostAdminTenantsRemoveUserResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = PostAdminTenantsRemoveUserResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, PostAdminTenantsRemoveUserResponse> mapFromJson(dynamic json) {
    final map = <String, PostAdminTenantsRemoveUserResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = PostAdminTenantsRemoveUserResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of PostAdminTenantsRemoveUserResponse-objects as value to a dart map
  static Map<String, List<PostAdminTenantsRemoveUserResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<PostAdminTenantsRemoveUserResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = PostAdminTenantsRemoveUserResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'success',
    'membershipId',
    'message',
  };
}

