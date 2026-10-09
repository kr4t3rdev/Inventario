//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class PostAdminSessionsRevokeResponse {
  /// Returns a new [PostAdminSessionsRevokeResponse] instance.
  PostAdminSessionsRevokeResponse({
    required this.success,
    required this.sessionId,
    required this.message,
  });

  bool success;

  String sessionId;

  String message;

  @override
  bool operator ==(Object other) => identical(this, other) || other is PostAdminSessionsRevokeResponse &&
    other.success == success &&
    other.sessionId == sessionId &&
    other.message == message;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (success.hashCode) +
    (sessionId.hashCode) +
    (message.hashCode);

  @override
  String toString() => 'PostAdminSessionsRevokeResponse[success=$success, sessionId=$sessionId, message=$message]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'success'] = this.success;
      json[r'sessionId'] = this.sessionId;
      json[r'message'] = this.message;
    return json;
  }

  /// Returns a new [PostAdminSessionsRevokeResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static PostAdminSessionsRevokeResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "PostAdminSessionsRevokeResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "PostAdminSessionsRevokeResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return PostAdminSessionsRevokeResponse(
        success: mapValueOfType<bool>(json, r'success')!,
        sessionId: mapValueOfType<String>(json, r'sessionId')!,
        message: mapValueOfType<String>(json, r'message')!,
      );
    }
    return null;
  }

  static List<PostAdminSessionsRevokeResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <PostAdminSessionsRevokeResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = PostAdminSessionsRevokeResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, PostAdminSessionsRevokeResponse> mapFromJson(dynamic json) {
    final map = <String, PostAdminSessionsRevokeResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = PostAdminSessionsRevokeResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of PostAdminSessionsRevokeResponse-objects as value to a dart map
  static Map<String, List<PostAdminSessionsRevokeResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<PostAdminSessionsRevokeResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = PostAdminSessionsRevokeResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'success',
    'sessionId',
    'message',
  };
}

