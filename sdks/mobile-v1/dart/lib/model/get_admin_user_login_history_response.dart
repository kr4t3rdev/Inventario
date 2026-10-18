//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class GetAdminUserLoginHistoryResponse {
  /// Returns a new [GetAdminUserLoginHistoryResponse] instance.
  GetAdminUserLoginHistoryResponse({
    this.sessions = const [],
    required this.total,
    required this.userId,
  });

  List<AdminSessionItem> sessions;

  /// Minimum value: 0
  int total;

  String userId;

  @override
  bool operator ==(Object other) => identical(this, other) || other is GetAdminUserLoginHistoryResponse &&
    _deepEquality.equals(other.sessions, sessions) &&
    other.total == total &&
    other.userId == userId;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (sessions.hashCode) +
    (total.hashCode) +
    (userId.hashCode);

  @override
  String toString() => 'GetAdminUserLoginHistoryResponse[sessions=$sessions, total=$total, userId=$userId]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'sessions'] = this.sessions;
      json[r'total'] = this.total;
      json[r'userId'] = this.userId;
    return json;
  }

  /// Returns a new [GetAdminUserLoginHistoryResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static GetAdminUserLoginHistoryResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "GetAdminUserLoginHistoryResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "GetAdminUserLoginHistoryResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return GetAdminUserLoginHistoryResponse(
        sessions: AdminSessionItem.listFromJson(json[r'sessions']),
        total: mapValueOfType<int>(json, r'total')!,
        userId: mapValueOfType<String>(json, r'userId')!,
      );
    }
    return null;
  }

  static List<GetAdminUserLoginHistoryResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <GetAdminUserLoginHistoryResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = GetAdminUserLoginHistoryResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, GetAdminUserLoginHistoryResponse> mapFromJson(dynamic json) {
    final map = <String, GetAdminUserLoginHistoryResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = GetAdminUserLoginHistoryResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of GetAdminUserLoginHistoryResponse-objects as value to a dart map
  static Map<String, List<GetAdminUserLoginHistoryResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<GetAdminUserLoginHistoryResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = GetAdminUserLoginHistoryResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'sessions',
    'total',
    'userId',
  };
}

