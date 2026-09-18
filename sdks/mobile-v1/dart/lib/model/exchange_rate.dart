//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class ExchangeRate {
  /// Returns a new [ExchangeRate] instance.
  ExchangeRate({
    this.tasaId,
    this.monedaOrigen,
    this.monedaDestino,
    this.tasa,
    this.fecha,
  });

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? tasaId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? monedaOrigen;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? monedaDestino;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? tasa;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  DateTime? fecha;

  @override
  bool operator ==(Object other) => identical(this, other) || other is ExchangeRate &&
    other.tasaId == tasaId &&
    other.monedaOrigen == monedaOrigen &&
    other.monedaDestino == monedaDestino &&
    other.tasa == tasa &&
    other.fecha == fecha;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (tasaId == null ? 0 : tasaId!.hashCode) +
    (monedaOrigen == null ? 0 : monedaOrigen!.hashCode) +
    (monedaDestino == null ? 0 : monedaDestino!.hashCode) +
    (tasa == null ? 0 : tasa!.hashCode) +
    (fecha == null ? 0 : fecha!.hashCode);

  @override
  String toString() => 'ExchangeRate[tasaId=$tasaId, monedaOrigen=$monedaOrigen, monedaDestino=$monedaDestino, tasa=$tasa, fecha=$fecha]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    if (this.tasaId != null) {
      json[r'tasaId'] = this.tasaId;
    } else {
      json[r'tasaId'] = null;
    }
    if (this.monedaOrigen != null) {
      json[r'monedaOrigen'] = this.monedaOrigen;
    } else {
      json[r'monedaOrigen'] = null;
    }
    if (this.monedaDestino != null) {
      json[r'monedaDestino'] = this.monedaDestino;
    } else {
      json[r'monedaDestino'] = null;
    }
    if (this.tasa != null) {
      json[r'tasa'] = this.tasa;
    } else {
      json[r'tasa'] = null;
    }
    if (this.fecha != null) {
      json[r'fecha'] = this.fecha!.toUtc().toIso8601String();
    } else {
      json[r'fecha'] = null;
    }
    return json;
  }

  /// Returns a new [ExchangeRate] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static ExchangeRate? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "ExchangeRate[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "ExchangeRate[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return ExchangeRate(
        tasaId: mapValueOfType<String>(json, r'tasaId'),
        monedaOrigen: mapValueOfType<String>(json, r'monedaOrigen'),
        monedaDestino: mapValueOfType<String>(json, r'monedaDestino'),
        tasa: num.parse('${json[r'tasa']}'),
        fecha: mapDateTime(json, r'fecha', r''),
      );
    }
    return null;
  }

  static List<ExchangeRate> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <ExchangeRate>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = ExchangeRate.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, ExchangeRate> mapFromJson(dynamic json) {
    final map = <String, ExchangeRate>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = ExchangeRate.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of ExchangeRate-objects as value to a dart map
  static Map<String, List<ExchangeRate>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<ExchangeRate>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = ExchangeRate.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
  };
}

