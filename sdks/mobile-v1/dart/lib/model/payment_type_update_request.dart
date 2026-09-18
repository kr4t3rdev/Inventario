//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class PaymentTypeUpdateRequest {
  /// Returns a new [PaymentTypeUpdateRequest] instance.
  PaymentTypeUpdateRequest({
    this.nombre,
    this.descripcion,
    this.requiereCuenta,
    this.cuentaDefecto,
    this.isActive,
  });

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
  String? descripcion;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  bool? requiereCuenta;

  String? cuentaDefecto;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  bool? isActive;

  @override
  bool operator ==(Object other) => identical(this, other) || other is PaymentTypeUpdateRequest &&
    other.nombre == nombre &&
    other.descripcion == descripcion &&
    other.requiereCuenta == requiereCuenta &&
    other.cuentaDefecto == cuentaDefecto &&
    other.isActive == isActive;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (nombre == null ? 0 : nombre!.hashCode) +
    (descripcion == null ? 0 : descripcion!.hashCode) +
    (requiereCuenta == null ? 0 : requiereCuenta!.hashCode) +
    (cuentaDefecto == null ? 0 : cuentaDefecto!.hashCode) +
    (isActive == null ? 0 : isActive!.hashCode);

  @override
  String toString() => 'PaymentTypeUpdateRequest[nombre=$nombre, descripcion=$descripcion, requiereCuenta=$requiereCuenta, cuentaDefecto=$cuentaDefecto, isActive=$isActive]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    if (this.nombre != null) {
      json[r'nombre'] = this.nombre;
    } else {
      json[r'nombre'] = null;
    }
    if (this.descripcion != null) {
      json[r'descripcion'] = this.descripcion;
    } else {
      json[r'descripcion'] = null;
    }
    if (this.requiereCuenta != null) {
      json[r'requiereCuenta'] = this.requiereCuenta;
    } else {
      json[r'requiereCuenta'] = null;
    }
    if (this.cuentaDefecto != null) {
      json[r'cuentaDefecto'] = this.cuentaDefecto;
    } else {
      json[r'cuentaDefecto'] = null;
    }
    if (this.isActive != null) {
      json[r'isActive'] = this.isActive;
    } else {
      json[r'isActive'] = null;
    }
    return json;
  }

  /// Returns a new [PaymentTypeUpdateRequest] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static PaymentTypeUpdateRequest? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "PaymentTypeUpdateRequest[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "PaymentTypeUpdateRequest[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return PaymentTypeUpdateRequest(
        nombre: mapValueOfType<String>(json, r'nombre'),
        descripcion: mapValueOfType<String>(json, r'descripcion'),
        requiereCuenta: mapValueOfType<bool>(json, r'requiereCuenta'),
        cuentaDefecto: mapValueOfType<String>(json, r'cuentaDefecto'),
        isActive: mapValueOfType<bool>(json, r'isActive'),
      );
    }
    return null;
  }

  static List<PaymentTypeUpdateRequest> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <PaymentTypeUpdateRequest>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = PaymentTypeUpdateRequest.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, PaymentTypeUpdateRequest> mapFromJson(dynamic json) {
    final map = <String, PaymentTypeUpdateRequest>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = PaymentTypeUpdateRequest.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of PaymentTypeUpdateRequest-objects as value to a dart map
  static Map<String, List<PaymentTypeUpdateRequest>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<PaymentTypeUpdateRequest>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = PaymentTypeUpdateRequest.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
  };
}

