//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class AccountPayable {
  /// Returns a new [AccountPayable] instance.
  AccountPayable({
    this.cuentaPorPagarId,
    this.numeroFactura,
    this.montoDeuda,
    this.montoPagado,
    this.saldoPendiente,
    this.moneda,
    this.estado,
    this.fechaVencimiento,
  });

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? cuentaPorPagarId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? numeroFactura;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? montoDeuda;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? montoPagado;

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
  String? moneda;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? estado;

  String? fechaVencimiento;

  @override
  bool operator ==(Object other) => identical(this, other) || other is AccountPayable &&
    other.cuentaPorPagarId == cuentaPorPagarId &&
    other.numeroFactura == numeroFactura &&
    other.montoDeuda == montoDeuda &&
    other.montoPagado == montoPagado &&
    other.saldoPendiente == saldoPendiente &&
    other.moneda == moneda &&
    other.estado == estado &&
    other.fechaVencimiento == fechaVencimiento;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (cuentaPorPagarId == null ? 0 : cuentaPorPagarId!.hashCode) +
    (numeroFactura == null ? 0 : numeroFactura!.hashCode) +
    (montoDeuda == null ? 0 : montoDeuda!.hashCode) +
    (montoPagado == null ? 0 : montoPagado!.hashCode) +
    (saldoPendiente == null ? 0 : saldoPendiente!.hashCode) +
    (moneda == null ? 0 : moneda!.hashCode) +
    (estado == null ? 0 : estado!.hashCode) +
    (fechaVencimiento == null ? 0 : fechaVencimiento!.hashCode);

  @override
  String toString() => 'AccountPayable[cuentaPorPagarId=$cuentaPorPagarId, numeroFactura=$numeroFactura, montoDeuda=$montoDeuda, montoPagado=$montoPagado, saldoPendiente=$saldoPendiente, moneda=$moneda, estado=$estado, fechaVencimiento=$fechaVencimiento]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    if (this.cuentaPorPagarId != null) {
      json[r'cuentaPorPagarId'] = this.cuentaPorPagarId;
    } else {
      json[r'cuentaPorPagarId'] = null;
    }
    if (this.numeroFactura != null) {
      json[r'numeroFactura'] = this.numeroFactura;
    } else {
      json[r'numeroFactura'] = null;
    }
    if (this.montoDeuda != null) {
      json[r'montoDeuda'] = this.montoDeuda;
    } else {
      json[r'montoDeuda'] = null;
    }
    if (this.montoPagado != null) {
      json[r'montoPagado'] = this.montoPagado;
    } else {
      json[r'montoPagado'] = null;
    }
    if (this.saldoPendiente != null) {
      json[r'saldoPendiente'] = this.saldoPendiente;
    } else {
      json[r'saldoPendiente'] = null;
    }
    if (this.moneda != null) {
      json[r'moneda'] = this.moneda;
    } else {
      json[r'moneda'] = null;
    }
    if (this.estado != null) {
      json[r'estado'] = this.estado;
    } else {
      json[r'estado'] = null;
    }
    if (this.fechaVencimiento != null) {
      json[r'fechaVencimiento'] = this.fechaVencimiento;
    } else {
      json[r'fechaVencimiento'] = null;
    }
    return json;
  }

  /// Returns a new [AccountPayable] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static AccountPayable? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "AccountPayable[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "AccountPayable[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return AccountPayable(
        cuentaPorPagarId: mapValueOfType<String>(json, r'cuentaPorPagarId'),
        numeroFactura: mapValueOfType<String>(json, r'numeroFactura'),
        montoDeuda: num.parse('${json[r'montoDeuda']}'),
        montoPagado: num.parse('${json[r'montoPagado']}'),
        saldoPendiente: num.parse('${json[r'saldoPendiente']}'),
        moneda: mapValueOfType<String>(json, r'moneda'),
        estado: mapValueOfType<String>(json, r'estado'),
        fechaVencimiento: mapValueOfType<String>(json, r'fechaVencimiento'),
      );
    }
    return null;
  }

  static List<AccountPayable> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <AccountPayable>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = AccountPayable.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, AccountPayable> mapFromJson(dynamic json) {
    final map = <String, AccountPayable>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = AccountPayable.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of AccountPayable-objects as value to a dart map
  static Map<String, List<AccountPayable>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<AccountPayable>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = AccountPayable.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
  };
}

