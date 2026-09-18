//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class PostAccountingCashDebtsResponse {
  /// Returns a new [PostAccountingCashDebtsResponse] instance.
  PostAccountingCashDebtsResponse({
    this.id,
    this.proveedorId,
    this.montoCapital,
    this.moneda,
    this.tasaInteres,
    this.fechaVencimiento,
    this.estado,
    this.cuentaBancariaId,
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
  String? proveedorId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? montoCapital;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? moneda;

  num? tasaInteres;

  String? fechaVencimiento;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? estado;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? cuentaBancariaId;

  @override
  bool operator ==(Object other) => identical(this, other) || other is PostAccountingCashDebtsResponse &&
    other.id == id &&
    other.proveedorId == proveedorId &&
    other.montoCapital == montoCapital &&
    other.moneda == moneda &&
    other.tasaInteres == tasaInteres &&
    other.fechaVencimiento == fechaVencimiento &&
    other.estado == estado &&
    other.cuentaBancariaId == cuentaBancariaId;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (id == null ? 0 : id!.hashCode) +
    (proveedorId == null ? 0 : proveedorId!.hashCode) +
    (montoCapital == null ? 0 : montoCapital!.hashCode) +
    (moneda == null ? 0 : moneda!.hashCode) +
    (tasaInteres == null ? 0 : tasaInteres!.hashCode) +
    (fechaVencimiento == null ? 0 : fechaVencimiento!.hashCode) +
    (estado == null ? 0 : estado!.hashCode) +
    (cuentaBancariaId == null ? 0 : cuentaBancariaId!.hashCode);

  @override
  String toString() => 'PostAccountingCashDebtsResponse[id=$id, proveedorId=$proveedorId, montoCapital=$montoCapital, moneda=$moneda, tasaInteres=$tasaInteres, fechaVencimiento=$fechaVencimiento, estado=$estado, cuentaBancariaId=$cuentaBancariaId]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    if (this.id != null) {
      json[r'id'] = this.id;
    } else {
      json[r'id'] = null;
    }
    if (this.proveedorId != null) {
      json[r'proveedorId'] = this.proveedorId;
    } else {
      json[r'proveedorId'] = null;
    }
    if (this.montoCapital != null) {
      json[r'montoCapital'] = this.montoCapital;
    } else {
      json[r'montoCapital'] = null;
    }
    if (this.moneda != null) {
      json[r'moneda'] = this.moneda;
    } else {
      json[r'moneda'] = null;
    }
    if (this.tasaInteres != null) {
      json[r'tasaInteres'] = this.tasaInteres;
    } else {
      json[r'tasaInteres'] = null;
    }
    if (this.fechaVencimiento != null) {
      json[r'fechaVencimiento'] = this.fechaVencimiento;
    } else {
      json[r'fechaVencimiento'] = null;
    }
    if (this.estado != null) {
      json[r'estado'] = this.estado;
    } else {
      json[r'estado'] = null;
    }
    if (this.cuentaBancariaId != null) {
      json[r'cuentaBancariaId'] = this.cuentaBancariaId;
    } else {
      json[r'cuentaBancariaId'] = null;
    }
    return json;
  }

  /// Returns a new [PostAccountingCashDebtsResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static PostAccountingCashDebtsResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "PostAccountingCashDebtsResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "PostAccountingCashDebtsResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return PostAccountingCashDebtsResponse(
        id: mapValueOfType<String>(json, r'id'),
        proveedorId: mapValueOfType<String>(json, r'proveedorId'),
        montoCapital: num.parse('${json[r'montoCapital']}'),
        moneda: mapValueOfType<String>(json, r'moneda'),
        tasaInteres: json[r'tasaInteres'] == null
            ? null
            : num.parse('${json[r'tasaInteres']}'),
        fechaVencimiento: mapValueOfType<String>(json, r'fechaVencimiento'),
        estado: mapValueOfType<String>(json, r'estado'),
        cuentaBancariaId: mapValueOfType<String>(json, r'cuentaBancariaId'),
      );
    }
    return null;
  }

  static List<PostAccountingCashDebtsResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <PostAccountingCashDebtsResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = PostAccountingCashDebtsResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, PostAccountingCashDebtsResponse> mapFromJson(dynamic json) {
    final map = <String, PostAccountingCashDebtsResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = PostAccountingCashDebtsResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of PostAccountingCashDebtsResponse-objects as value to a dart map
  static Map<String, List<PostAccountingCashDebtsResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<PostAccountingCashDebtsResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = PostAccountingCashDebtsResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
  };
}

