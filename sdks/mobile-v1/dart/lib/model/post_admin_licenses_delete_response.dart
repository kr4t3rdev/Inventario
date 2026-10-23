//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class PostAdminLicensesDeleteResponse {
  /// Returns a new [PostAdminLicensesDeleteResponse] instance.
  PostAdminLicensesDeleteResponse({
    required this.success,
    required this.tenantLicenseId,
  });

  bool success;

  String tenantLicenseId;

  @override
  bool operator ==(Object other) => identical(this, other) || other is PostAdminLicensesDeleteResponse &&
    other.success == success &&
    other.tenantLicenseId == tenantLicenseId;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (success.hashCode) +
    (tenantLicenseId.hashCode);

  @override
  String toString() => 'PostAdminLicensesDeleteResponse[success=$success, tenantLicenseId=$tenantLicenseId]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'success'] = this.success;
      json[r'tenantLicenseId'] = this.tenantLicenseId;
    return json;
  }

  /// Returns a new [PostAdminLicensesDeleteResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static PostAdminLicensesDeleteResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "PostAdminLicensesDeleteResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "PostAdminLicensesDeleteResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return PostAdminLicensesDeleteResponse(
        success: mapValueOfType<bool>(json, r'success')!,
        tenantLicenseId: mapValueOfType<String>(json, r'tenantLicenseId')!,
      );
    }
    return null;
  }

  static List<PostAdminLicensesDeleteResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <PostAdminLicensesDeleteResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = PostAdminLicensesDeleteResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, PostAdminLicensesDeleteResponse> mapFromJson(dynamic json) {
    final map = <String, PostAdminLicensesDeleteResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = PostAdminLicensesDeleteResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of PostAdminLicensesDeleteResponse-objects as value to a dart map
  static Map<String, List<PostAdminLicensesDeleteResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<PostAdminLicensesDeleteResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = PostAdminLicensesDeleteResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'success',
    'tenantLicenseId',
  };
}
