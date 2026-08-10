//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class PostAccountingCashLoansIdPaymentsResponse {
  /// Returns a new [PostAccountingCashLoansIdPaymentsResponse] instance.
  PostAccountingCashLoansIdPaymentsResponse({
    this.id,
    this.clienteId,
    this.montoCapital,
    this.moneda,
    this.tasaInteres,
    this.fechaVencimiento,
    this.estado,
    this.cuentaBancariaId,
    this.pagination,
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
  String? clienteId;

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

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  Pagination? pagination;

  @override
  bool operator ==(Object other) => identical(this, other) || other is PostAccountingCashLoansIdPaymentsResponse &&
    other.id == id &&
    other.clienteId == clienteId &&
    other.montoCapital == montoCapital &&
    other.moneda == moneda &&
    other.tasaInteres == tasaInteres &&
    other.fechaVencimiento == fechaVencimiento &&
    other.estado == estado &&
    other.cuentaBancariaId == cuentaBancariaId &&
    other.pagination == pagination;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (id == null ? 0 : id!.hashCode) +
    (clienteId == null ? 0 : clienteId!.hashCode) +
    (montoCapital == null ? 0 : montoCapital!.hashCode) +
    (moneda == null ? 0 : moneda!.hashCode) +
    (tasaInteres == null ? 0 : tasaInteres!.hashCode) +
    (fechaVencimiento == null ? 0 : fechaVencimiento!.hashCode) +
    (estado == null ? 0 : estado!.hashCode) +
    (cuentaBancariaId == null ? 0 : cuentaBancariaId!.hashCode) +
    (pagination == null ? 0 : pagination!.hashCode);

  @override
  String toString() => 'PostAccountingCashLoansIdPaymentsResponse[id=$id, clienteId=$clienteId, montoCapital=$montoCapital, moneda=$moneda, tasaInteres=$tasaInteres, fechaVencimiento=$fechaVencimiento, estado=$estado, cuentaBancariaId=$cuentaBancariaId, pagination=$pagination]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    if (this.id != null) {
      json[r'id'] = this.id;
    } else {
      json[r'id'] = null;
    }
    if (this.clienteId != null) {
      json[r'clienteId'] = this.clienteId;
    } else {
      json[r'clienteId'] = null;
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
    if (this.pagination != null) {
      json[r'pagination'] = this.pagination;
    } else {
      json[r'pagination'] = null;
    }
    return json;
  }

  /// Returns a new [PostAccountingCashLoansIdPaymentsResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static PostAccountingCashLoansIdPaymentsResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "PostAccountingCashLoansIdPaymentsResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "PostAccountingCashLoansIdPaymentsResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return PostAccountingCashLoansIdPaymentsResponse(
        id: mapValueOfType<String>(json, r'id'),
        clienteId: mapValueOfType<String>(json, r'clienteId'),
        montoCapital: num.parse('${json[r'montoCapital']}'),
        moneda: mapValueOfType<String>(json, r'moneda'),
        tasaInteres: json[r'tasaInteres'] == null
            ? null
            : num.parse('${json[r'tasaInteres']}'),
        fechaVencimiento: mapValueOfType<String>(json, r'fechaVencimiento'),
        estado: mapValueOfType<String>(json, r'estado'),
        cuentaBancariaId: mapValueOfType<String>(json, r'cuentaBancariaId'),
        pagination: Pagination.fromJson(json[r'pagination']),
      );
    }
    return null;
  }

  static List<PostAccountingCashLoansIdPaymentsResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <PostAccountingCashLoansIdPaymentsResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = PostAccountingCashLoansIdPaymentsResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, PostAccountingCashLoansIdPaymentsResponse> mapFromJson(dynamic json) {
    final map = <String, PostAccountingCashLoansIdPaymentsResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = PostAccountingCashLoansIdPaymentsResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of PostAccountingCashLoansIdPaymentsResponse-objects as value to a dart map
  static Map<String, List<PostAccountingCashLoansIdPaymentsResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<PostAccountingCashLoansIdPaymentsResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = PostAccountingCashLoansIdPaymentsResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
  };
}

