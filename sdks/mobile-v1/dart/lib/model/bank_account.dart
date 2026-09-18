//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class BankAccount {
  /// Returns a new [BankAccount] instance.
  BankAccount({
    this.cuentaId,
    this.nombreBanco,
    this.numeroCuenta,
    this.tipoCuenta,
    this.moneda,
    this.saldo,
    this.isActive,
  });

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? cuentaId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? nombreBanco;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? numeroCuenta;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? tipoCuenta;

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
  num? saldo;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  bool? isActive;

  @override
  bool operator ==(Object other) => identical(this, other) || other is BankAccount &&
    other.cuentaId == cuentaId &&
    other.nombreBanco == nombreBanco &&
    other.numeroCuenta == numeroCuenta &&
    other.tipoCuenta == tipoCuenta &&
    other.moneda == moneda &&
    other.saldo == saldo &&
    other.isActive == isActive;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (cuentaId == null ? 0 : cuentaId!.hashCode) +
    (nombreBanco == null ? 0 : nombreBanco!.hashCode) +
    (numeroCuenta == null ? 0 : numeroCuenta!.hashCode) +
    (tipoCuenta == null ? 0 : tipoCuenta!.hashCode) +
    (moneda == null ? 0 : moneda!.hashCode) +
    (saldo == null ? 0 : saldo!.hashCode) +
    (isActive == null ? 0 : isActive!.hashCode);

  @override
  String toString() => 'BankAccount[cuentaId=$cuentaId, nombreBanco=$nombreBanco, numeroCuenta=$numeroCuenta, tipoCuenta=$tipoCuenta, moneda=$moneda, saldo=$saldo, isActive=$isActive]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    if (this.cuentaId != null) {
      json[r'cuentaId'] = this.cuentaId;
    } else {
      json[r'cuentaId'] = null;
    }
    if (this.nombreBanco != null) {
      json[r'nombreBanco'] = this.nombreBanco;
    } else {
      json[r'nombreBanco'] = null;
    }
    if (this.numeroCuenta != null) {
      json[r'numeroCuenta'] = this.numeroCuenta;
    } else {
      json[r'numeroCuenta'] = null;
    }
    if (this.tipoCuenta != null) {
      json[r'tipoCuenta'] = this.tipoCuenta;
    } else {
      json[r'tipoCuenta'] = null;
    }
    if (this.moneda != null) {
      json[r'moneda'] = this.moneda;
    } else {
      json[r'moneda'] = null;
    }
    if (this.saldo != null) {
      json[r'saldo'] = this.saldo;
    } else {
      json[r'saldo'] = null;
    }
    if (this.isActive != null) {
      json[r'isActive'] = this.isActive;
    } else {
      json[r'isActive'] = null;
    }
    return json;
  }

  /// Returns a new [BankAccount] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static BankAccount? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "BankAccount[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "BankAccount[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return BankAccount(
        cuentaId: mapValueOfType<String>(json, r'cuentaId'),
        nombreBanco: mapValueOfType<String>(json, r'nombreBanco'),
        numeroCuenta: mapValueOfType<String>(json, r'numeroCuenta'),
        tipoCuenta: mapValueOfType<String>(json, r'tipoCuenta'),
        moneda: mapValueOfType<String>(json, r'moneda'),
        saldo: num.parse('${json[r'saldo']}'),
        isActive: mapValueOfType<bool>(json, r'isActive'),
      );
    }
    return null;
  }

  static List<BankAccount> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <BankAccount>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = BankAccount.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, BankAccount> mapFromJson(dynamic json) {
    final map = <String, BankAccount>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = BankAccount.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of BankAccount-objects as value to a dart map
  static Map<String, List<BankAccount>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<BankAccount>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = BankAccount.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
  };
}

