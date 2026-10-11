//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class DashboardIncomeExpensePoint {
  /// Returns a new [DashboardIncomeExpensePoint] instance.
  DashboardIncomeExpensePoint({
    this.label,
    this.ingresos,
    this.gastos,
  });

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? label;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? ingresos;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? gastos;

  @override
  bool operator ==(Object other) => identical(this, other) || other is DashboardIncomeExpensePoint &&
    other.label == label &&
    other.ingresos == ingresos &&
    other.gastos == gastos;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (label == null ? 0 : label!.hashCode) +
    (ingresos == null ? 0 : ingresos!.hashCode) +
    (gastos == null ? 0 : gastos!.hashCode);

  @override
  String toString() => 'DashboardIncomeExpensePoint[label=$label, ingresos=$ingresos, gastos=$gastos]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    if (this.label != null) {
      json[r'label'] = this.label;
    } else {
      json[r'label'] = null;
    }
    if (this.ingresos != null) {
      json[r'ingresos'] = this.ingresos;
    } else {
      json[r'ingresos'] = null;
    }
    if (this.gastos != null) {
      json[r'gastos'] = this.gastos;
    } else {
      json[r'gastos'] = null;
    }
    return json;
  }

  /// Returns a new [DashboardIncomeExpensePoint] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static DashboardIncomeExpensePoint? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "DashboardIncomeExpensePoint[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "DashboardIncomeExpensePoint[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return DashboardIncomeExpensePoint(
        label: mapValueOfType<String>(json, r'label'),
        ingresos: num.parse('${json[r'ingresos']}'),
        gastos: num.parse('${json[r'gastos']}'),
      );
    }
    return null;
  }

  static List<DashboardIncomeExpensePoint> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <DashboardIncomeExpensePoint>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = DashboardIncomeExpensePoint.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, DashboardIncomeExpensePoint> mapFromJson(dynamic json) {
    final map = <String, DashboardIncomeExpensePoint>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = DashboardIncomeExpensePoint.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of DashboardIncomeExpensePoint-objects as value to a dart map
  static Map<String, List<DashboardIncomeExpensePoint>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<DashboardIncomeExpensePoint>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = DashboardIncomeExpensePoint.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
  };
}

