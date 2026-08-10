//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class AccountReceivable {
  /// Returns a new [AccountReceivable] instance.
  AccountReceivable({
    this.id,
    this.montoDeuda,
    this.montoPagado,
    this.estado,
    this.fechaVencimiento,
  });

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? id;

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
  String? estado;

  String? fechaVencimiento;

  @override
  bool operator ==(Object other) => identical(this, other) || other is AccountReceivable &&
    other.id == id &&
    other.montoDeuda == montoDeuda &&
    other.montoPagado == montoPagado &&
    other.estado == estado &&
    other.fechaVencimiento == fechaVencimiento;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (id == null ? 0 : id!.hashCode) +
    (montoDeuda == null ? 0 : montoDeuda!.hashCode) +
    (montoPagado == null ? 0 : montoPagado!.hashCode) +
    (estado == null ? 0 : estado!.hashCode) +
    (fechaVencimiento == null ? 0 : fechaVencimiento!.hashCode);

  @override
  String toString() => 'AccountReceivable[id=$id, montoDeuda=$montoDeuda, montoPagado=$montoPagado, estado=$estado, fechaVencimiento=$fechaVencimiento]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    if (this.id != null) {
      json[r'id'] = this.id;
    } else {
      json[r'id'] = null;
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

  /// Returns a new [AccountReceivable] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static AccountReceivable? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "AccountReceivable[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "AccountReceivable[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return AccountReceivable(
        id: mapValueOfType<String>(json, r'id'),
        montoDeuda: num.parse('${json[r'montoDeuda']}'),
        montoPagado: num.parse('${json[r'montoPagado']}'),
        estado: mapValueOfType<String>(json, r'estado'),
        fechaVencimiento: mapValueOfType<String>(json, r'fechaVencimiento'),
      );
    }
    return null;
  }

  static List<AccountReceivable> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <AccountReceivable>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = AccountReceivable.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, AccountReceivable> mapFromJson(dynamic json) {
    final map = <String, AccountReceivable>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = AccountReceivable.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of AccountReceivable-objects as value to a dart map
  static Map<String, List<AccountReceivable>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<AccountReceivable>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = AccountReceivable.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
  };
}

