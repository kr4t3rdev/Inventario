//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class ReconciliationOverviewStats {
  /// Returns a new [ReconciliationOverviewStats] instance.
  ReconciliationOverviewStats({
    required this.totalPending,
    required this.completedToday,
    required this.reconciledAmount,
    required this.efficiency,
  });

  int totalPending;

  int completedToday;

  num reconciledAmount;

  /// Minimum value: 0
  /// Maximum value: 100
  int efficiency;

  @override
  bool operator ==(Object other) => identical(this, other) || other is ReconciliationOverviewStats &&
    other.totalPending == totalPending &&
    other.completedToday == completedToday &&
    other.reconciledAmount == reconciledAmount &&
    other.efficiency == efficiency;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (totalPending.hashCode) +
    (completedToday.hashCode) +
    (reconciledAmount.hashCode) +
    (efficiency.hashCode);

  @override
  String toString() => 'ReconciliationOverviewStats[totalPending=$totalPending, completedToday=$completedToday, reconciledAmount=$reconciledAmount, efficiency=$efficiency]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'totalPending'] = this.totalPending;
      json[r'completedToday'] = this.completedToday;
      json[r'reconciledAmount'] = this.reconciledAmount;
      json[r'efficiency'] = this.efficiency;
    return json;
  }

  /// Returns a new [ReconciliationOverviewStats] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static ReconciliationOverviewStats? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "ReconciliationOverviewStats[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "ReconciliationOverviewStats[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return ReconciliationOverviewStats(
        totalPending: mapValueOfType<int>(json, r'totalPending')!,
        completedToday: mapValueOfType<int>(json, r'completedToday')!,
        reconciledAmount: num.parse('${json[r'reconciledAmount']}'),
        efficiency: mapValueOfType<int>(json, r'efficiency')!,
      );
    }
    return null;
  }

  static List<ReconciliationOverviewStats> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <ReconciliationOverviewStats>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = ReconciliationOverviewStats.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, ReconciliationOverviewStats> mapFromJson(dynamic json) {
    final map = <String, ReconciliationOverviewStats>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = ReconciliationOverviewStats.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of ReconciliationOverviewStats-objects as value to a dart map
  static Map<String, List<ReconciliationOverviewStats>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<ReconciliationOverviewStats>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = ReconciliationOverviewStats.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'totalPending',
    'completedToday',
    'reconciledAmount',
    'efficiency',
  };
}

