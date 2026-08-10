//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class PostAccountingReconciliationSalesResponse {
  /// Returns a new [PostAccountingReconciliationSalesResponse] instance.
  PostAccountingReconciliationSalesResponse({
    this.reconciliacionId,
    this.cuentaId,
    this.tipoPagoId,
    this.monto,
    this.moneda,
    this.tasaCambio,
    this.montoConvertido,
    this.fechaReconciliacion,
    this.observaciones,
  });

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? reconciliacionId;

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
  String? tipoPagoId;

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

  num? tasaCambio;

  num? montoConvertido;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  DateTime? fechaReconciliacion;

  String? observaciones;

  @override
  bool operator ==(Object other) => identical(this, other) || other is PostAccountingReconciliationSalesResponse &&
    other.reconciliacionId == reconciliacionId &&
    other.cuentaId == cuentaId &&
    other.tipoPagoId == tipoPagoId &&
    other.monto == monto &&
    other.moneda == moneda &&
    other.tasaCambio == tasaCambio &&
    other.montoConvertido == montoConvertido &&
    other.fechaReconciliacion == fechaReconciliacion &&
    other.observaciones == observaciones;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (reconciliacionId == null ? 0 : reconciliacionId!.hashCode) +
    (cuentaId == null ? 0 : cuentaId!.hashCode) +
    (tipoPagoId == null ? 0 : tipoPagoId!.hashCode) +
    (monto == null ? 0 : monto!.hashCode) +
    (moneda == null ? 0 : moneda!.hashCode) +
    (tasaCambio == null ? 0 : tasaCambio!.hashCode) +
    (montoConvertido == null ? 0 : montoConvertido!.hashCode) +
    (fechaReconciliacion == null ? 0 : fechaReconciliacion!.hashCode) +
    (observaciones == null ? 0 : observaciones!.hashCode);

  @override
  String toString() => 'PostAccountingReconciliationSalesResponse[reconciliacionId=$reconciliacionId, cuentaId=$cuentaId, tipoPagoId=$tipoPagoId, monto=$monto, moneda=$moneda, tasaCambio=$tasaCambio, montoConvertido=$montoConvertido, fechaReconciliacion=$fechaReconciliacion, observaciones=$observaciones]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    if (this.reconciliacionId != null) {
      json[r'reconciliacionId'] = this.reconciliacionId;
    } else {
      json[r'reconciliacionId'] = null;
    }
    if (this.cuentaId != null) {
      json[r'cuentaId'] = this.cuentaId;
    } else {
      json[r'cuentaId'] = null;
    }
    if (this.tipoPagoId != null) {
      json[r'tipoPagoId'] = this.tipoPagoId;
    } else {
      json[r'tipoPagoId'] = null;
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
    if (this.tasaCambio != null) {
      json[r'tasaCambio'] = this.tasaCambio;
    } else {
      json[r'tasaCambio'] = null;
    }
    if (this.montoConvertido != null) {
      json[r'montoConvertido'] = this.montoConvertido;
    } else {
      json[r'montoConvertido'] = null;
    }
    if (this.fechaReconciliacion != null) {
      json[r'fechaReconciliacion'] = this.fechaReconciliacion!.toUtc().toIso8601String();
    } else {
      json[r'fechaReconciliacion'] = null;
    }
    if (this.observaciones != null) {
      json[r'observaciones'] = this.observaciones;
    } else {
      json[r'observaciones'] = null;
    }
    return json;
  }

  /// Returns a new [PostAccountingReconciliationSalesResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static PostAccountingReconciliationSalesResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "PostAccountingReconciliationSalesResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "PostAccountingReconciliationSalesResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return PostAccountingReconciliationSalesResponse(
        reconciliacionId: mapValueOfType<String>(json, r'reconciliacionId'),
        cuentaId: mapValueOfType<String>(json, r'cuentaId'),
        tipoPagoId: mapValueOfType<String>(json, r'tipoPagoId'),
        monto: num.parse('${json[r'monto']}'),
        moneda: mapValueOfType<String>(json, r'moneda'),
        tasaCambio: json[r'tasaCambio'] == null
            ? null
            : num.parse('${json[r'tasaCambio']}'),
        montoConvertido: json[r'montoConvertido'] == null
            ? null
            : num.parse('${json[r'montoConvertido']}'),
        fechaReconciliacion: mapDateTime(json, r'fechaReconciliacion', r''),
        observaciones: mapValueOfType<String>(json, r'observaciones'),
      );
    }
    return null;
  }

  static List<PostAccountingReconciliationSalesResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <PostAccountingReconciliationSalesResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = PostAccountingReconciliationSalesResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, PostAccountingReconciliationSalesResponse> mapFromJson(dynamic json) {
    final map = <String, PostAccountingReconciliationSalesResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = PostAccountingReconciliationSalesResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of PostAccountingReconciliationSalesResponse-objects as value to a dart map
  static Map<String, List<PostAccountingReconciliationSalesResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<PostAccountingReconciliationSalesResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = PostAccountingReconciliationSalesResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
  };
}

