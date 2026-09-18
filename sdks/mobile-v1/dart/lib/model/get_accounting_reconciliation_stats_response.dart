//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class GetAccountingReconciliationStatsResponse {
  /// Returns a new [GetAccountingReconciliationStatsResponse] instance.
  GetAccountingReconciliationStatsResponse({
    required this.modules,
    required this.stats,
    this.recentActivity = const [],
  });

  ReconciliationModules modules;

  ReconciliationOverviewStats stats;

  List<ReconciliationActivity> recentActivity;

  @override
  bool operator ==(Object other) => identical(this, other) || other is GetAccountingReconciliationStatsResponse &&
    other.modules == modules &&
    other.stats == stats &&
    _deepEquality.equals(other.recentActivity, recentActivity);

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (modules.hashCode) +
    (stats.hashCode) +
    (recentActivity.hashCode);

  @override
  String toString() => 'GetAccountingReconciliationStatsResponse[modules=$modules, stats=$stats, recentActivity=$recentActivity]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'modules'] = this.modules;
      json[r'stats'] = this.stats;
      json[r'recentActivity'] = this.recentActivity;
    return json;
  }

  /// Returns a new [GetAccountingReconciliationStatsResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static GetAccountingReconciliationStatsResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "GetAccountingReconciliationStatsResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "GetAccountingReconciliationStatsResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return GetAccountingReconciliationStatsResponse(
        modules: ReconciliationModules.fromJson(json[r'modules'])!,
        stats: ReconciliationOverviewStats.fromJson(json[r'stats'])!,
        recentActivity: ReconciliationActivity.listFromJson(json[r'recentActivity']),
      );
    }
    return null;
  }

  static List<GetAccountingReconciliationStatsResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <GetAccountingReconciliationStatsResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = GetAccountingReconciliationStatsResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, GetAccountingReconciliationStatsResponse> mapFromJson(dynamic json) {
    final map = <String, GetAccountingReconciliationStatsResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = GetAccountingReconciliationStatsResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of GetAccountingReconciliationStatsResponse-objects as value to a dart map
  static Map<String, List<GetAccountingReconciliationStatsResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<GetAccountingReconciliationStatsResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = GetAccountingReconciliationStatsResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'modules',
    'stats',
    'recentActivity',
  };
}

