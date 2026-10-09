//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class GetAdminActivityLogsResponse {
  /// Returns a new [GetAdminActivityLogsResponse] instance.
  GetAdminActivityLogsResponse({
    this.logs = const [],
    required this.total,
  });

  List<AdminActivityLogItem> logs;

  /// Minimum value: 0
  int total;

  @override
  bool operator ==(Object other) => identical(this, other) || other is GetAdminActivityLogsResponse &&
    _deepEquality.equals(other.logs, logs) &&
    other.total == total;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (logs.hashCode) +
    (total.hashCode);

  @override
  String toString() => 'GetAdminActivityLogsResponse[logs=$logs, total=$total]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'logs'] = this.logs;
      json[r'total'] = this.total;
    return json;
  }

  /// Returns a new [GetAdminActivityLogsResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static GetAdminActivityLogsResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "GetAdminActivityLogsResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "GetAdminActivityLogsResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return GetAdminActivityLogsResponse(
        logs: AdminActivityLogItem.listFromJson(json[r'logs']),
        total: mapValueOfType<int>(json, r'total')!,
      );
    }
    return null;
  }

  static List<GetAdminActivityLogsResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <GetAdminActivityLogsResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = GetAdminActivityLogsResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, GetAdminActivityLogsResponse> mapFromJson(dynamic json) {
    final map = <String, GetAdminActivityLogsResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = GetAdminActivityLogsResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of GetAdminActivityLogsResponse-objects as value to a dart map
  static Map<String, List<GetAdminActivityLogsResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<GetAdminActivityLogsResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = GetAdminActivityLogsResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'logs',
    'total',
  };
}

