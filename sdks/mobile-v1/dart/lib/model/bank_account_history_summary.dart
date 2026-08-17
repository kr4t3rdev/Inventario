//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class BankAccountHistorySummary {
  /// Returns a new [BankAccountHistorySummary] instance.
  BankAccountHistorySummary({
    required this.saldoActual,
    required this.totalIngresos,
    required this.totalEgresos,
    required this.totalMovimientos,
  });

  num saldoActual;

  num totalIngresos;

  num totalEgresos;

  int totalMovimientos;

  @override
  bool operator ==(Object other) => identical(this, other) || other is BankAccountHistorySummary &&
    other.saldoActual == saldoActual &&
    other.totalIngresos == totalIngresos &&
    other.totalEgresos == totalEgresos &&
    other.totalMovimientos == totalMovimientos;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (saldoActual.hashCode) +
    (totalIngresos.hashCode) +
    (totalEgresos.hashCode) +
    (totalMovimientos.hashCode);

  @override
  String toString() => 'BankAccountHistorySummary[saldoActual=$saldoActual, totalIngresos=$totalIngresos, totalEgresos=$totalEgresos, totalMovimientos=$totalMovimientos]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'saldoActual'] = this.saldoActual;
      json[r'totalIngresos'] = this.totalIngresos;
      json[r'totalEgresos'] = this.totalEgresos;
      json[r'totalMovimientos'] = this.totalMovimientos;
    return json;
  }

  /// Returns a new [BankAccountHistorySummary] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static BankAccountHistorySummary? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "BankAccountHistorySummary[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "BankAccountHistorySummary[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return BankAccountHistorySummary(
        saldoActual: num.parse('${json[r'saldoActual']}'),
        totalIngresos: num.parse('${json[r'totalIngresos']}'),
        totalEgresos: num.parse('${json[r'totalEgresos']}'),
        totalMovimientos: mapValueOfType<int>(json, r'totalMovimientos')!,
      );
    }
    return null;
  }

  static List<BankAccountHistorySummary> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <BankAccountHistorySummary>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = BankAccountHistorySummary.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, BankAccountHistorySummary> mapFromJson(dynamic json) {
    final map = <String, BankAccountHistorySummary>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = BankAccountHistorySummary.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of BankAccountHistorySummary-objects as value to a dart map
  static Map<String, List<BankAccountHistorySummary>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<BankAccountHistorySummary>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = BankAccountHistorySummary.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'saldoActual',
    'totalIngresos',
    'totalEgresos',
    'totalMovimientos',
  };
}

