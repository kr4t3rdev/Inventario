//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class BankAccountTransaction {
  /// Returns a new [BankAccountTransaction] instance.
  BankAccountTransaction({
    required this.transaccionId,
    required this.fecha,
    required this.tipoMovimiento,
    required this.descripcion,
    required this.montoOriginal,
    required this.monedaOriginal,
    required this.tasaCambio,
    required this.montoConvertido,
    this.observaciones,
  });

  String transaccionId;

  DateTime fecha;

  String tipoMovimiento;

  String descripcion;

  num montoOriginal;

  String monedaOriginal;

  num? tasaCambio;

  num montoConvertido;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? observaciones;

  @override
  bool operator ==(Object other) => identical(this, other) || other is BankAccountTransaction &&
    other.transaccionId == transaccionId &&
    other.fecha == fecha &&
    other.tipoMovimiento == tipoMovimiento &&
    other.descripcion == descripcion &&
    other.montoOriginal == montoOriginal &&
    other.monedaOriginal == monedaOriginal &&
    other.tasaCambio == tasaCambio &&
    other.montoConvertido == montoConvertido &&
    other.observaciones == observaciones;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (transaccionId.hashCode) +
    (fecha.hashCode) +
    (tipoMovimiento.hashCode) +
    (descripcion.hashCode) +
    (montoOriginal.hashCode) +
    (monedaOriginal.hashCode) +
    (tasaCambio == null ? 0 : tasaCambio!.hashCode) +
    (montoConvertido.hashCode) +
    (observaciones == null ? 0 : observaciones!.hashCode);

  @override
  String toString() => 'BankAccountTransaction[transaccionId=$transaccionId, fecha=$fecha, tipoMovimiento=$tipoMovimiento, descripcion=$descripcion, montoOriginal=$montoOriginal, monedaOriginal=$monedaOriginal, tasaCambio=$tasaCambio, montoConvertido=$montoConvertido, observaciones=$observaciones]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'transaccionId'] = this.transaccionId;
      json[r'fecha'] = this.fecha.toUtc().toIso8601String();
      json[r'tipoMovimiento'] = this.tipoMovimiento;
      json[r'descripcion'] = this.descripcion;
      json[r'montoOriginal'] = this.montoOriginal;
      json[r'monedaOriginal'] = this.monedaOriginal;
    if (this.tasaCambio != null) {
      json[r'tasaCambio'] = this.tasaCambio;
    } else {
      json[r'tasaCambio'] = null;
    }
      json[r'montoConvertido'] = this.montoConvertido;
    if (this.observaciones != null) {
      json[r'observaciones'] = this.observaciones;
    } else {
      json[r'observaciones'] = null;
    }
    return json;
  }

  /// Returns a new [BankAccountTransaction] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static BankAccountTransaction? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "BankAccountTransaction[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "BankAccountTransaction[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return BankAccountTransaction(
        transaccionId: mapValueOfType<String>(json, r'transaccionId')!,
        fecha: mapDateTime(json, r'fecha', r'')!,
        tipoMovimiento: mapValueOfType<String>(json, r'tipoMovimiento')!,
        descripcion: mapValueOfType<String>(json, r'descripcion')!,
        montoOriginal: num.parse('${json[r'montoOriginal']}'),
        monedaOriginal: mapValueOfType<String>(json, r'monedaOriginal')!,
        tasaCambio: json[r'tasaCambio'] == null
            ? null
            : num.parse('${json[r'tasaCambio']}'),
        montoConvertido: num.parse('${json[r'montoConvertido']}'),
        observaciones: mapValueOfType<String>(json, r'observaciones'),
      );
    }
    return null;
  }

  static List<BankAccountTransaction> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <BankAccountTransaction>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = BankAccountTransaction.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, BankAccountTransaction> mapFromJson(dynamic json) {
    final map = <String, BankAccountTransaction>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = BankAccountTransaction.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of BankAccountTransaction-objects as value to a dart map
  static Map<String, List<BankAccountTransaction>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<BankAccountTransaction>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = BankAccountTransaction.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'transaccionId',
    'fecha',
    'tipoMovimiento',
    'descripcion',
    'montoOriginal',
    'monedaOriginal',
    'tasaCambio',
    'montoConvertido',
  };
}

