//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class ReportStatistics {
  /// Returns a new [ReportStatistics] instance.
  ReportStatistics({
    this.totalRegistros,
    this.totalTransacciones,
    this.totalTransferencias,
    this.transferenciasConConversion,
    this.montoTotal,
    this.montoPromedio,
    this.montoTotalPorMoneda = const {},
    this.porMoneda = const {},
    this.porTipoDePago = const {},
  });

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  int? totalRegistros;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  int? totalTransacciones;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  int? totalTransferencias;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  int? transferenciasConConversion;

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
  num? montoPromedio;

  /// Objeto JSON con claves dinámicas y valores serializables.
  Map<String, JsonValue> montoTotalPorMoneda;

  /// Objeto JSON con claves dinámicas y valores serializables.
  Map<String, JsonValue> porMoneda;

  /// Objeto JSON con claves dinámicas y valores serializables.
  Map<String, JsonValue> porTipoDePago;

  @override
  bool operator ==(Object other) => identical(this, other) || other is ReportStatistics &&
    other.totalRegistros == totalRegistros &&
    other.totalTransacciones == totalTransacciones &&
    other.totalTransferencias == totalTransferencias &&
    other.transferenciasConConversion == transferenciasConConversion &&
    other.montoTotal == montoTotal &&
    other.montoPromedio == montoPromedio &&
    _deepEquality.equals(other.montoTotalPorMoneda, montoTotalPorMoneda) &&
    _deepEquality.equals(other.porMoneda, porMoneda) &&
    _deepEquality.equals(other.porTipoDePago, porTipoDePago);

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (totalRegistros == null ? 0 : totalRegistros!.hashCode) +
    (totalTransacciones == null ? 0 : totalTransacciones!.hashCode) +
    (totalTransferencias == null ? 0 : totalTransferencias!.hashCode) +
    (transferenciasConConversion == null ? 0 : transferenciasConConversion!.hashCode) +
    (montoTotal == null ? 0 : montoTotal!.hashCode) +
    (montoPromedio == null ? 0 : montoPromedio!.hashCode) +
    (montoTotalPorMoneda.hashCode) +
    (porMoneda.hashCode) +
    (porTipoDePago.hashCode);

  @override
  String toString() => 'ReportStatistics[totalRegistros=$totalRegistros, totalTransacciones=$totalTransacciones, totalTransferencias=$totalTransferencias, transferenciasConConversion=$transferenciasConConversion, montoTotal=$montoTotal, montoPromedio=$montoPromedio, montoTotalPorMoneda=$montoTotalPorMoneda, porMoneda=$porMoneda, porTipoDePago=$porTipoDePago]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    if (this.totalRegistros != null) {
      json[r'totalRegistros'] = this.totalRegistros;
    } else {
      json[r'totalRegistros'] = null;
    }
    if (this.totalTransacciones != null) {
      json[r'totalTransacciones'] = this.totalTransacciones;
    } else {
      json[r'totalTransacciones'] = null;
    }
    if (this.totalTransferencias != null) {
      json[r'totalTransferencias'] = this.totalTransferencias;
    } else {
      json[r'totalTransferencias'] = null;
    }
    if (this.transferenciasConConversion != null) {
      json[r'transferenciasConConversion'] = this.transferenciasConConversion;
    } else {
      json[r'transferenciasConConversion'] = null;
    }
    if (this.montoTotal != null) {
      json[r'montoTotal'] = this.montoTotal;
    } else {
      json[r'montoTotal'] = null;
    }
    if (this.montoPromedio != null) {
      json[r'montoPromedio'] = this.montoPromedio;
    } else {
      json[r'montoPromedio'] = null;
    }
      json[r'montoTotalPorMoneda'] = this.montoTotalPorMoneda;
      json[r'porMoneda'] = this.porMoneda;
      json[r'porTipoDePago'] = this.porTipoDePago;
    return json;
  }

  /// Returns a new [ReportStatistics] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static ReportStatistics? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "ReportStatistics[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "ReportStatistics[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return ReportStatistics(
        totalRegistros: mapValueOfType<int>(json, r'totalRegistros'),
        totalTransacciones: mapValueOfType<int>(json, r'totalTransacciones'),
        totalTransferencias: mapValueOfType<int>(json, r'totalTransferencias'),
        transferenciasConConversion: mapValueOfType<int>(json, r'transferenciasConConversion'),
        montoTotal: num.parse('${json[r'montoTotal']}'),
        montoPromedio: num.parse('${json[r'montoPromedio']}'),
        montoTotalPorMoneda: JsonValue.mapFromJson(json[r'montoTotalPorMoneda']),
        porMoneda: JsonValue.mapFromJson(json[r'porMoneda']),
        porTipoDePago: JsonValue.mapFromJson(json[r'porTipoDePago']),
      );
    }
    return null;
  }

  static List<ReportStatistics> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <ReportStatistics>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = ReportStatistics.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, ReportStatistics> mapFromJson(dynamic json) {
    final map = <String, ReportStatistics>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = ReportStatistics.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of ReportStatistics-objects as value to a dart map
  static Map<String, List<ReportStatistics>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<ReportStatistics>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = ReportStatistics.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
  };
}

