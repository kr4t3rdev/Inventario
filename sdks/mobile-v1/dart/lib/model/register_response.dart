//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class RegisterResponse {
  /// Returns a new [RegisterResponse] instance.
  RegisterResponse({
    required this.message,
    required this.success,
  });

  String message;

  bool success;

  @override
  bool operator ==(Object other) => identical(this, other) || other is RegisterResponse &&
    other.message == message &&
    other.success == success;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (message.hashCode) +
    (success.hashCode);

  @override
  String toString() => 'RegisterResponse[message=$message, success=$success]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'message'] = this.message;
      json[r'success'] = this.success;
    return json;
  }

  /// Returns a new [RegisterResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static RegisterResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "RegisterResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "RegisterResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return RegisterResponse(
        message: mapValueOfType<String>(json, r'message')!,
        success: mapValueOfType<bool>(json, r'success')!,
      );
    }
    return null;
  }

  static List<RegisterResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <RegisterResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = RegisterResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, RegisterResponse> mapFromJson(dynamic json) {
    final map = <String, RegisterResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = RegisterResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of RegisterResponse-objects as value to a dart map
  static Map<String, List<RegisterResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<RegisterResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = RegisterResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'message',
    'success',
  };
}

