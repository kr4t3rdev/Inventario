//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class Currency {
  /// Returns a new [Currency] instance.
  Currency({
    this.monedaId,
    this.codigo,
    this.nombre,
    this.simbolo,
    this.isActive,
  });

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? monedaId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? codigo;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? nombre;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? simbolo;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  bool? isActive;

  @override
  bool operator ==(Object other) => identical(this, other) || other is Currency &&
    other.monedaId == monedaId &&
    other.codigo == codigo &&
    other.nombre == nombre &&
    other.simbolo == simbolo &&
    other.isActive == isActive;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (monedaId == null ? 0 : monedaId!.hashCode) +
    (codigo == null ? 0 : codigo!.hashCode) +
    (nombre == null ? 0 : nombre!.hashCode) +
    (simbolo == null ? 0 : simbolo!.hashCode) +
    (isActive == null ? 0 : isActive!.hashCode);

  @override
  String toString() => 'Currency[monedaId=$monedaId, codigo=$codigo, nombre=$nombre, simbolo=$simbolo, isActive=$isActive]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    if (this.monedaId != null) {
      json[r'monedaId'] = this.monedaId;
    } else {
      json[r'monedaId'] = null;
    }
    if (this.codigo != null) {
      json[r'codigo'] = this.codigo;
    } else {
      json[r'codigo'] = null;
    }
    if (this.nombre != null) {
      json[r'nombre'] = this.nombre;
    } else {
      json[r'nombre'] = null;
    }
    if (this.simbolo != null) {
      json[r'simbolo'] = this.simbolo;
    } else {
      json[r'simbolo'] = null;
    }
    if (this.isActive != null) {
      json[r'isActive'] = this.isActive;
    } else {
      json[r'isActive'] = null;
    }
    return json;
  }

  /// Returns a new [Currency] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static Currency? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "Currency[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "Currency[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return Currency(
        monedaId: mapValueOfType<String>(json, r'monedaId'),
        codigo: mapValueOfType<String>(json, r'codigo'),
        nombre: mapValueOfType<String>(json, r'nombre'),
        simbolo: mapValueOfType<String>(json, r'simbolo'),
        isActive: mapValueOfType<bool>(json, r'isActive'),
      );
    }
    return null;
  }

  static List<Currency> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <Currency>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = Currency.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, Currency> mapFromJson(dynamic json) {
    final map = <String, Currency>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = Currency.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of Currency-objects as value to a dart map
  static Map<String, List<Currency>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<Currency>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = Currency.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
  };
}

