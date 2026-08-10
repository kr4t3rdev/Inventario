//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class ReportTotals {
  /// Returns a new [ReportTotals] instance.
  ReportTotals({
    this.total,
    this.montoTotal,
    this.totalIngresos,
    this.totalEgresos,
    this.flujoNeto,
    this.montoConvertidoTotal,
    this.saldoPendiente,
    this.cantidad,
  });

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? total;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? montoTotal;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? totalIngresos;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? totalEgresos;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? flujoNeto;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? montoConvertidoTotal;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? saldoPendiente;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  int? cantidad;

  @override
  bool operator ==(Object other) => identical(this, other) || other is ReportTotals &&
    other.total == total &&
    other.montoTotal == montoTotal &&
    other.totalIngresos == totalIngresos &&
    other.totalEgresos == totalEgresos &&
    other.flujoNeto == flujoNeto &&
    other.montoConvertidoTotal == montoConvertidoTotal &&
    other.saldoPendiente == saldoPendiente &&
    other.cantidad == cantidad;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (total == null ? 0 : total!.hashCode) +
    (montoTotal == null ? 0 : montoTotal!.hashCode) +
    (totalIngresos == null ? 0 : totalIngresos!.hashCode) +
    (totalEgresos == null ? 0 : totalEgresos!.hashCode) +
    (flujoNeto == null ? 0 : flujoNeto!.hashCode) +
    (montoConvertidoTotal == null ? 0 : montoConvertidoTotal!.hashCode) +
    (saldoPendiente == null ? 0 : saldoPendiente!.hashCode) +
    (cantidad == null ? 0 : cantidad!.hashCode);

  @override
  String toString() => 'ReportTotals[total=$total, montoTotal=$montoTotal, totalIngresos=$totalIngresos, totalEgresos=$totalEgresos, flujoNeto=$flujoNeto, montoConvertidoTotal=$montoConvertidoTotal, saldoPendiente=$saldoPendiente, cantidad=$cantidad]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    if (this.total != null) {
      json[r'total'] = this.total;
    } else {
      json[r'total'] = null;
    }
    if (this.montoTotal != null) {
      json[r'montoTotal'] = this.montoTotal;
    } else {
      json[r'montoTotal'] = null;
    }
    if (this.totalIngresos != null) {
      json[r'totalIngresos'] = this.totalIngresos;
    } else {
      json[r'totalIngresos'] = null;
    }
    if (this.totalEgresos != null) {
      json[r'totalEgresos'] = this.totalEgresos;
    } else {
      json[r'totalEgresos'] = null;
    }
    if (this.flujoNeto != null) {
      json[r'flujoNeto'] = this.flujoNeto;
    } else {
      json[r'flujoNeto'] = null;
    }
    if (this.montoConvertidoTotal != null) {
      json[r'montoConvertidoTotal'] = this.montoConvertidoTotal;
    } else {
      json[r'montoConvertidoTotal'] = null;
    }
    if (this.saldoPendiente != null) {
      json[r'saldoPendiente'] = this.saldoPendiente;
    } else {
      json[r'saldoPendiente'] = null;
    }
    if (this.cantidad != null) {
      json[r'cantidad'] = this.cantidad;
    } else {
      json[r'cantidad'] = null;
    }
    return json;
  }

  /// Returns a new [ReportTotals] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static ReportTotals? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "ReportTotals[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "ReportTotals[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return ReportTotals(
        total: num.parse('${json[r'total']}'),
        montoTotal: num.parse('${json[r'montoTotal']}'),
        totalIngresos: num.parse('${json[r'totalIngresos']}'),
        totalEgresos: num.parse('${json[r'totalEgresos']}'),
        flujoNeto: num.parse('${json[r'flujoNeto']}'),
        montoConvertidoTotal: num.parse('${json[r'montoConvertidoTotal']}'),
        saldoPendiente: num.parse('${json[r'saldoPendiente']}'),
        cantidad: mapValueOfType<int>(json, r'cantidad'),
      );
    }
    return null;
  }

  static List<ReportTotals> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <ReportTotals>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = ReportTotals.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, ReportTotals> mapFromJson(dynamic json) {
    final map = <String, ReportTotals>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = ReportTotals.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of ReportTotals-objects as value to a dart map
  static Map<String, List<ReportTotals>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<ReportTotals>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = ReportTotals.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
  };
}

