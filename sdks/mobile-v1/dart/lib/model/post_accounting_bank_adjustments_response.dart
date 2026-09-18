//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class PostAccountingBankAdjustmentsResponse {
  /// Returns a new [PostAccountingBankAdjustmentsResponse] instance.
  PostAccountingBankAdjustmentsResponse({
    this.ajusteId,
    this.cuentaId,
    this.tipo,
    this.monto,
    this.moneda,
    this.descripcion,
    this.motivo,
  });

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? ajusteId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? cuentaId;

  PostAccountingBankAdjustmentsResponseTipoEnum? tipo;

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
  String? descripcion;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? motivo;

  @override
  bool operator ==(Object other) => identical(this, other) || other is PostAccountingBankAdjustmentsResponse &&
    other.ajusteId == ajusteId &&
    other.cuentaId == cuentaId &&
    other.tipo == tipo &&
    other.monto == monto &&
    other.moneda == moneda &&
    other.descripcion == descripcion &&
    other.motivo == motivo;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (ajusteId == null ? 0 : ajusteId!.hashCode) +
    (cuentaId == null ? 0 : cuentaId!.hashCode) +
    (tipo == null ? 0 : tipo!.hashCode) +
    (monto == null ? 0 : monto!.hashCode) +
    (moneda == null ? 0 : moneda!.hashCode) +
    (descripcion == null ? 0 : descripcion!.hashCode) +
    (motivo == null ? 0 : motivo!.hashCode);

  @override
  String toString() => 'PostAccountingBankAdjustmentsResponse[ajusteId=$ajusteId, cuentaId=$cuentaId, tipo=$tipo, monto=$monto, moneda=$moneda, descripcion=$descripcion, motivo=$motivo]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    if (this.ajusteId != null) {
      json[r'ajusteId'] = this.ajusteId;
    } else {
      json[r'ajusteId'] = null;
    }
    if (this.cuentaId != null) {
      json[r'cuentaId'] = this.cuentaId;
    } else {
      json[r'cuentaId'] = null;
    }
    if (this.tipo != null) {
      json[r'tipo'] = this.tipo;
    } else {
      json[r'tipo'] = null;
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
    if (this.descripcion != null) {
      json[r'descripcion'] = this.descripcion;
    } else {
      json[r'descripcion'] = null;
    }
    if (this.motivo != null) {
      json[r'motivo'] = this.motivo;
    } else {
      json[r'motivo'] = null;
    }
    return json;
  }

  /// Returns a new [PostAccountingBankAdjustmentsResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static PostAccountingBankAdjustmentsResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "PostAccountingBankAdjustmentsResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "PostAccountingBankAdjustmentsResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return PostAccountingBankAdjustmentsResponse(
        ajusteId: mapValueOfType<String>(json, r'ajusteId'),
        cuentaId: mapValueOfType<String>(json, r'cuentaId'),
        tipo: PostAccountingBankAdjustmentsResponseTipoEnum.fromJson(json[r'tipo']),
        monto: num.parse('${json[r'monto']}'),
        moneda: mapValueOfType<String>(json, r'moneda'),
        descripcion: mapValueOfType<String>(json, r'descripcion'),
        motivo: mapValueOfType<String>(json, r'motivo'),
      );
    }
    return null;
  }

  static List<PostAccountingBankAdjustmentsResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <PostAccountingBankAdjustmentsResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = PostAccountingBankAdjustmentsResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, PostAccountingBankAdjustmentsResponse> mapFromJson(dynamic json) {
    final map = <String, PostAccountingBankAdjustmentsResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = PostAccountingBankAdjustmentsResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of PostAccountingBankAdjustmentsResponse-objects as value to a dart map
  static Map<String, List<PostAccountingBankAdjustmentsResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<PostAccountingBankAdjustmentsResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = PostAccountingBankAdjustmentsResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
  };
}


class PostAccountingBankAdjustmentsResponseTipoEnum {
  /// Instantiate a new enum with the provided [value].
  const PostAccountingBankAdjustmentsResponseTipoEnum._(this.value);

  /// The underlying value of this enum member.
  final String value;

  @override
  String toString() => value;

  String toJson() => value;

  static const ingreso = PostAccountingBankAdjustmentsResponseTipoEnum._(r'ingreso');
  static const egreso = PostAccountingBankAdjustmentsResponseTipoEnum._(r'egreso');

  /// List of all possible values in this [enum][PostAccountingBankAdjustmentsResponseTipoEnum].
  static const values = <PostAccountingBankAdjustmentsResponseTipoEnum>[
    ingreso,
    egreso,
  ];

  static PostAccountingBankAdjustmentsResponseTipoEnum? fromJson(dynamic value) => PostAccountingBankAdjustmentsResponseTipoEnumTypeTransformer().decode(value);

  static List<PostAccountingBankAdjustmentsResponseTipoEnum> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <PostAccountingBankAdjustmentsResponseTipoEnum>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = PostAccountingBankAdjustmentsResponseTipoEnum.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }
}

/// Transformation class that can [encode] an instance of [PostAccountingBankAdjustmentsResponseTipoEnum] to String,
/// and [decode] dynamic data back to [PostAccountingBankAdjustmentsResponseTipoEnum].
class PostAccountingBankAdjustmentsResponseTipoEnumTypeTransformer {
  factory PostAccountingBankAdjustmentsResponseTipoEnumTypeTransformer() => _instance ??= const PostAccountingBankAdjustmentsResponseTipoEnumTypeTransformer._();

  const PostAccountingBankAdjustmentsResponseTipoEnumTypeTransformer._();

  String encode(PostAccountingBankAdjustmentsResponseTipoEnum data) => data.value;

  /// Decodes a [dynamic value][data] to a PostAccountingBankAdjustmentsResponseTipoEnum.
  ///
  /// If [allowNull] is true and the [dynamic value][data] cannot be decoded successfully,
  /// then null is returned. However, if [allowNull] is false and the [dynamic value][data]
  /// cannot be decoded successfully, then an [UnimplementedError] is thrown.
  ///
  /// The [allowNull] is very handy when an API changes and a new enum value is added or removed,
  /// and users are still using an old app with the old code.
  PostAccountingBankAdjustmentsResponseTipoEnum? decode(dynamic data, {bool allowNull = true}) {
    if (data != null) {
      switch (data) {
        case r'ingreso': return PostAccountingBankAdjustmentsResponseTipoEnum.ingreso;
        case r'egreso': return PostAccountingBankAdjustmentsResponseTipoEnum.egreso;
        default:
          if (!allowNull) {
            throw ArgumentError('Unknown enum value to decode: $data');
          }
      }
    }
    return null;
  }

  /// Singleton [PostAccountingBankAdjustmentsResponseTipoEnumTypeTransformer] instance.
  static PostAccountingBankAdjustmentsResponseTipoEnumTypeTransformer? _instance;
}


