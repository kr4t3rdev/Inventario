//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class GetAdminSessionsResponse {
  /// Returns a new [GetAdminSessionsResponse] instance.
  GetAdminSessionsResponse({
    this.sessions = const [],
    required this.total,
  });

  List<AdminSessionItem> sessions;

  /// Minimum value: 0
  int total;

  @override
  bool operator ==(Object other) => identical(this, other) || other is GetAdminSessionsResponse &&
    _deepEquality.equals(other.sessions, sessions) &&
    other.total == total;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (sessions.hashCode) +
    (total.hashCode);

  @override
  String toString() => 'GetAdminSessionsResponse[sessions=$sessions, total=$total]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'sessions'] = this.sessions;
      json[r'total'] = this.total;
    return json;
  }

  /// Returns a new [GetAdminSessionsResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static GetAdminSessionsResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "GetAdminSessionsResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "GetAdminSessionsResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return GetAdminSessionsResponse(
        sessions: AdminSessionItem.listFromJson(json[r'sessions']),
        total: mapValueOfType<int>(json, r'total')!,
      );
    }
    return null;
  }

  static List<GetAdminSessionsResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <GetAdminSessionsResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = GetAdminSessionsResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, GetAdminSessionsResponse> mapFromJson(dynamic json) {
    final map = <String, GetAdminSessionsResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = GetAdminSessionsResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of GetAdminSessionsResponse-objects as value to a dart map
  static Map<String, List<GetAdminSessionsResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<GetAdminSessionsResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = GetAdminSessionsResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'sessions',
    'total',
  };
}

