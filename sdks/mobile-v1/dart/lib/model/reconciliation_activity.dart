//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class ReconciliationActivity {
  /// Returns a new [ReconciliationActivity] instance.
  ReconciliationActivity({
    required this.id,
    required this.type,
    required this.description,
    required this.accountName,
    required this.amount,
    required this.date,
    required this.reference,
  });

  String id;

  ReconciliationActivityTypeEnum type;

  String description;

  String accountName;

  num amount;

  DateTime date;

  String reference;

  @override
  bool operator ==(Object other) => identical(this, other) || other is ReconciliationActivity &&
    other.id == id &&
    other.type == type &&
    other.description == description &&
    other.accountName == accountName &&
    other.amount == amount &&
    other.date == date &&
    other.reference == reference;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (id.hashCode) +
    (type.hashCode) +
    (description.hashCode) +
    (accountName.hashCode) +
    (amount.hashCode) +
    (date.hashCode) +
    (reference.hashCode);

  @override
  String toString() => 'ReconciliationActivity[id=$id, type=$type, description=$description, accountName=$accountName, amount=$amount, date=$date, reference=$reference]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'id'] = this.id;
      json[r'type'] = this.type;
      json[r'description'] = this.description;
      json[r'accountName'] = this.accountName;
      json[r'amount'] = this.amount;
      json[r'date'] = this.date.toUtc().toIso8601String();
      json[r'reference'] = this.reference;
    return json;
  }

  /// Returns a new [ReconciliationActivity] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static ReconciliationActivity? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "ReconciliationActivity[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "ReconciliationActivity[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return ReconciliationActivity(
        id: mapValueOfType<String>(json, r'id')!,
        type: ReconciliationActivityTypeEnum.fromJson(json[r'type'])!,
        description: mapValueOfType<String>(json, r'description')!,
        accountName: mapValueOfType<String>(json, r'accountName')!,
        amount: num.parse('${json[r'amount']}'),
        date: mapDateTime(json, r'date', r'')!,
        reference: mapValueOfType<String>(json, r'reference')!,
      );
    }
    return null;
  }

  static List<ReconciliationActivity> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <ReconciliationActivity>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = ReconciliationActivity.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, ReconciliationActivity> mapFromJson(dynamic json) {
    final map = <String, ReconciliationActivity>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = ReconciliationActivity.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of ReconciliationActivity-objects as value to a dart map
  static Map<String, List<ReconciliationActivity>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<ReconciliationActivity>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = ReconciliationActivity.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'id',
    'type',
    'description',
    'accountName',
    'amount',
    'date',
    'reference',
  };
}


class ReconciliationActivityTypeEnum {
  /// Instantiate a new enum with the provided [value].
  const ReconciliationActivityTypeEnum._(this.value);

  /// The underlying value of this enum member.
  final String value;

  @override
  String toString() => value;

  String toJson() => value;

  static const venta = ReconciliationActivityTypeEnum._(r'venta');
  static const servicio = ReconciliationActivityTypeEnum._(r'servicio');
  static const gasto = ReconciliationActivityTypeEnum._(r'gasto');

  /// List of all possible values in this [enum][ReconciliationActivityTypeEnum].
  static const values = <ReconciliationActivityTypeEnum>[
    venta,
    servicio,
    gasto,
  ];

  static ReconciliationActivityTypeEnum? fromJson(dynamic value) => ReconciliationActivityTypeEnumTypeTransformer().decode(value);

  static List<ReconciliationActivityTypeEnum> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <ReconciliationActivityTypeEnum>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = ReconciliationActivityTypeEnum.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }
}

/// Transformation class that can [encode] an instance of [ReconciliationActivityTypeEnum] to String,
/// and [decode] dynamic data back to [ReconciliationActivityTypeEnum].
class ReconciliationActivityTypeEnumTypeTransformer {
  factory ReconciliationActivityTypeEnumTypeTransformer() => _instance ??= const ReconciliationActivityTypeEnumTypeTransformer._();

  const ReconciliationActivityTypeEnumTypeTransformer._();

  String encode(ReconciliationActivityTypeEnum data) => data.value;

  /// Decodes a [dynamic value][data] to a ReconciliationActivityTypeEnum.
  ///
  /// If [allowNull] is true and the [dynamic value][data] cannot be decoded successfully,
  /// then null is returned. However, if [allowNull] is false and the [dynamic value][data]
  /// cannot be decoded successfully, then an [UnimplementedError] is thrown.
  ///
  /// The [allowNull] is very handy when an API changes and a new enum value is added or removed,
  /// and users are still using an old app with the old code.
  ReconciliationActivityTypeEnum? decode(dynamic data, {bool allowNull = true}) {
    if (data != null) {
      switch (data) {
        case r'venta': return ReconciliationActivityTypeEnum.venta;
        case r'servicio': return ReconciliationActivityTypeEnum.servicio;
        case r'gasto': return ReconciliationActivityTypeEnum.gasto;
        default:
          if (!allowNull) {
            throw ArgumentError('Unknown enum value to decode: $data');
          }
      }
    }
    return null;
  }

  /// Singleton [ReconciliationActivityTypeEnumTypeTransformer] instance.
  static ReconciliationActivityTypeEnumTypeTransformer? _instance;
}


