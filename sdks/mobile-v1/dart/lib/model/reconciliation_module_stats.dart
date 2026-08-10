//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class ReconciliationModuleStats {
  /// Returns a new [ReconciliationModuleStats] instance.
  ReconciliationModuleStats({
    required this.pending,
    required this.completedToday,
    required this.totalToday,
  });

  int pending;

  int completedToday;

  int totalToday;

  @override
  bool operator ==(Object other) => identical(this, other) || other is ReconciliationModuleStats &&
    other.pending == pending &&
    other.completedToday == completedToday &&
    other.totalToday == totalToday;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (pending.hashCode) +
    (completedToday.hashCode) +
    (totalToday.hashCode);

  @override
  String toString() => 'ReconciliationModuleStats[pending=$pending, completedToday=$completedToday, totalToday=$totalToday]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'pending'] = this.pending;
      json[r'completedToday'] = this.completedToday;
      json[r'totalToday'] = this.totalToday;
    return json;
  }

  /// Returns a new [ReconciliationModuleStats] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static ReconciliationModuleStats? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "ReconciliationModuleStats[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "ReconciliationModuleStats[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return ReconciliationModuleStats(
        pending: mapValueOfType<int>(json, r'pending')!,
        completedToday: mapValueOfType<int>(json, r'completedToday')!,
        totalToday: mapValueOfType<int>(json, r'totalToday')!,
      );
    }
    return null;
  }

  static List<ReconciliationModuleStats> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <ReconciliationModuleStats>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = ReconciliationModuleStats.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, ReconciliationModuleStats> mapFromJson(dynamic json) {
    final map = <String, ReconciliationModuleStats>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = ReconciliationModuleStats.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of ReconciliationModuleStats-objects as value to a dart map
  static Map<String, List<ReconciliationModuleStats>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<ReconciliationModuleStats>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = ReconciliationModuleStats.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'pending',
    'completedToday',
    'totalToday',
  };
}

