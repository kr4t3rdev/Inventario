//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class PostAccountingCapitalInjectionsIdPaymentsResponse {
  /// Returns a new [PostAccountingCapitalInjectionsIdPaymentsResponse] instance.
  PostAccountingCapitalInjectionsIdPaymentsResponse({
    this.inyeccionId,
    this.monto,
    this.moneda,
    this.tipo,
    this.descripcion,
    this.cuentaBancariaId,
  });

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? inyeccionId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? monto;

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
  String? tipo;

  String? descripcion;

  String? cuentaBancariaId;

  @override
  bool operator ==(Object other) => identical(this, other) || other is PostAccountingCapitalInjectionsIdPaymentsResponse &&
    other.inyeccionId == inyeccionId &&
    other.monto == monto &&
    other.moneda == moneda &&
    other.tipo == tipo &&
    other.descripcion == descripcion &&
    other.cuentaBancariaId == cuentaBancariaId;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (inyeccionId == null ? 0 : inyeccionId!.hashCode) +
    (monto == null ? 0 : monto!.hashCode) +
    (moneda == null ? 0 : moneda!.hashCode) +
    (tipo == null ? 0 : tipo!.hashCode) +
    (descripcion == null ? 0 : descripcion!.hashCode) +
    (cuentaBancariaId == null ? 0 : cuentaBancariaId!.hashCode);

  @override
  String toString() => 'PostAccountingCapitalInjectionsIdPaymentsResponse[inyeccionId=$inyeccionId, monto=$monto, moneda=$moneda, tipo=$tipo, descripcion=$descripcion, cuentaBancariaId=$cuentaBancariaId]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    if (this.inyeccionId != null) {
      json[r'inyeccionId'] = this.inyeccionId;
    } else {
      json[r'inyeccionId'] = null;
    }
    if (this.monto != null) {
      json[r'monto'] = this.monto;
    } else {
      json[r'monto'] = null;
    }
    if (this.moneda != null) {
      json[r'moneda'] = this.moneda;
    } else {
      json[r'moneda'] = null;
    }
    if (this.tipo != null) {
      json[r'tipo'] = this.tipo;
    } else {
      json[r'tipo'] = null;
    }
    if (this.descripcion != null) {
      json[r'descripcion'] = this.descripcion;
    } else {
      json[r'descripcion'] = null;
    }
    if (this.cuentaBancariaId != null) {
      json[r'cuentaBancariaId'] = this.cuentaBancariaId;
    } else {
      json[r'cuentaBancariaId'] = null;
    }
    return json;
  }

  /// Returns a new [PostAccountingCapitalInjectionsIdPaymentsResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static PostAccountingCapitalInjectionsIdPaymentsResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "PostAccountingCapitalInjectionsIdPaymentsResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "PostAccountingCapitalInjectionsIdPaymentsResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return PostAccountingCapitalInjectionsIdPaymentsResponse(
        inyeccionId: mapValueOfType<String>(json, r'inyeccionId'),
        monto: num.parse('${json[r'monto']}'),
        moneda: mapValueOfType<String>(json, r'moneda'),
        tipo: mapValueOfType<String>(json, r'tipo'),
        descripcion: mapValueOfType<String>(json, r'descripcion'),
        cuentaBancariaId: mapValueOfType<String>(json, r'cuentaBancariaId'),
      );
    }
    return null;
  }

  static List<PostAccountingCapitalInjectionsIdPaymentsResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <PostAccountingCapitalInjectionsIdPaymentsResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = PostAccountingCapitalInjectionsIdPaymentsResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, PostAccountingCapitalInjectionsIdPaymentsResponse> mapFromJson(dynamic json) {
    final map = <String, PostAccountingCapitalInjectionsIdPaymentsResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = PostAccountingCapitalInjectionsIdPaymentsResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of PostAccountingCapitalInjectionsIdPaymentsResponse-objects as value to a dart map
  static Map<String, List<PostAccountingCapitalInjectionsIdPaymentsResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<PostAccountingCapitalInjectionsIdPaymentsResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = PostAccountingCapitalInjectionsIdPaymentsResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
  };
}

