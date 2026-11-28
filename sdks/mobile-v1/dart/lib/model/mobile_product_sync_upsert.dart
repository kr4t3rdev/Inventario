//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class MobileProductSyncUpsert {
  /// Returns a new [MobileProductSyncUpsert] instance.
  MobileProductSyncUpsert({
    required this.sequence,
    required this.productId,
    required this.operation,
    required this.product,
  });

  String sequence;

  String productId;

  Object? operation;

  MobileSyncProduct product;

  @override
  bool operator ==(Object other) => identical(this, other) || other is MobileProductSyncUpsert &&
    other.sequence == sequence &&
    other.productId == productId &&
    other.operation == operation &&
    other.product == product;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (sequence.hashCode) +
    (productId.hashCode) +
    (operation == null ? 0 : operation!.hashCode) +
    (product.hashCode);

  @override
  String toString() => 'MobileProductSyncUpsert[sequence=$sequence, productId=$productId, operation=$operation, product=$product]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'sequence'] = this.sequence;
      json[r'productId'] = this.productId;
    if (this.operation != null) {
      json[r'operation'] = this.operation;
    } else {
      json[r'operation'] = null;
    }
      json[r'product'] = this.product;
    return json;
  }

  /// Returns a new [MobileProductSyncUpsert] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static MobileProductSyncUpsert? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "MobileProductSyncUpsert[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "MobileProductSyncUpsert[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return MobileProductSyncUpsert(
        sequence: mapValueOfType<String>(json, r'sequence')!,
        productId: mapValueOfType<String>(json, r'productId')!,
        operation: mapValueOfType<Object>(json, r'operation'),
        product: MobileSyncProduct.fromJson(json[r'product'])!,
      );
    }
    return null;
  }

  static List<MobileProductSyncUpsert> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <MobileProductSyncUpsert>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = MobileProductSyncUpsert.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, MobileProductSyncUpsert> mapFromJson(dynamic json) {
    final map = <String, MobileProductSyncUpsert>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = MobileProductSyncUpsert.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of MobileProductSyncUpsert-objects as value to a dart map
  static Map<String, List<MobileProductSyncUpsert>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<MobileProductSyncUpsert>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = MobileProductSyncUpsert.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'sequence',
    'productId',
    'operation',
    'product',
  };
}

