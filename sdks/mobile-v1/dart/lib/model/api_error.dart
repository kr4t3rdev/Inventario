//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class ApiError {
  /// Returns a new [ApiError] instance.
  ApiError({
    required this.error,
    this.code,
    this.details,
  });

  String error;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? code;

  JsonValue? details;

  @override
  bool operator ==(Object other) => identical(this, other) || other is ApiError &&
    other.error == error &&
    other.code == code &&
    other.details == details;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (error.hashCode) +
    (code == null ? 0 : code!.hashCode) +
    (details == null ? 0 : details!.hashCode);

  @override
  String toString() => 'ApiError[error=$error, code=$code, details=$details]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'error'] = this.error;
    if (this.code != null) {
      json[r'code'] = this.code;
    } else {
      json[r'code'] = null;
    }
    if (this.details != null) {
      json[r'details'] = this.details;
    } else {
      json[r'details'] = null;
    }
    return json;
  }

  /// Returns a new [ApiError] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static ApiError? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "ApiError[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "ApiError[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return ApiError(
        error: mapValueOfType<String>(json, r'error')!,
        code: mapValueOfType<String>(json, r'code'),
        details: JsonValue.fromJson(json[r'details']),
      );
    }
    return null;
  }

  static List<ApiError> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <ApiError>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = ApiError.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, ApiError> mapFromJson(dynamic json) {
    final map = <String, ApiError>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = ApiError.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of ApiError-objects as value to a dart map
  static Map<String, List<ApiError>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<ApiError>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = ApiError.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'error',
  };
}

