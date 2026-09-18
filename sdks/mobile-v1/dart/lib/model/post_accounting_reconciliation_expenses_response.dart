//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class PostAccountingReconciliationExpensesResponse {
  /// Returns a new [PostAccountingReconciliationExpensesResponse] instance.
  PostAccountingReconciliationExpensesResponse({
    this.reconciliaciones = const [],
    required this.cuentaPorPagar,
    required this.pagoCuentaPorPagar,
    required this.distribucionMultiCuenta,
  });

  List<Reconciliation> reconciliaciones;

  PayableAccountSummary? cuentaPorPagar;

  PayablePaymentSummary? pagoCuentaPorPagar;

  bool distribucionMultiCuenta;

  @override
  bool operator ==(Object other) => identical(this, other) || other is PostAccountingReconciliationExpensesResponse &&
    _deepEquality.equals(other.reconciliaciones, reconciliaciones) &&
    other.cuentaPorPagar == cuentaPorPagar &&
    other.pagoCuentaPorPagar == pagoCuentaPorPagar &&
    other.distribucionMultiCuenta == distribucionMultiCuenta;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (reconciliaciones.hashCode) +
    (cuentaPorPagar == null ? 0 : cuentaPorPagar!.hashCode) +
    (pagoCuentaPorPagar == null ? 0 : pagoCuentaPorPagar!.hashCode) +
    (distribucionMultiCuenta.hashCode);

  @override
  String toString() => 'PostAccountingReconciliationExpensesResponse[reconciliaciones=$reconciliaciones, cuentaPorPagar=$cuentaPorPagar, pagoCuentaPorPagar=$pagoCuentaPorPagar, distribucionMultiCuenta=$distribucionMultiCuenta]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'reconciliaciones'] = this.reconciliaciones;
    if (this.cuentaPorPagar != null) {
      json[r'cuentaPorPagar'] = this.cuentaPorPagar;
    } else {
      json[r'cuentaPorPagar'] = null;
    }
    if (this.pagoCuentaPorPagar != null) {
      json[r'pagoCuentaPorPagar'] = this.pagoCuentaPorPagar;
    } else {
      json[r'pagoCuentaPorPagar'] = null;
    }
      json[r'distribucionMultiCuenta'] = this.distribucionMultiCuenta;
    return json;
  }

  /// Returns a new [PostAccountingReconciliationExpensesResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static PostAccountingReconciliationExpensesResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "PostAccountingReconciliationExpensesResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "PostAccountingReconciliationExpensesResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return PostAccountingReconciliationExpensesResponse(
        reconciliaciones: Reconciliation.listFromJson(json[r'reconciliaciones']),
        cuentaPorPagar: PayableAccountSummary.fromJson(json[r'cuentaPorPagar']),
        pagoCuentaPorPagar: PayablePaymentSummary.fromJson(json[r'pagoCuentaPorPagar']),
        distribucionMultiCuenta: mapValueOfType<bool>(json, r'distribucionMultiCuenta')!,
      );
    }
    return null;
  }

  static List<PostAccountingReconciliationExpensesResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <PostAccountingReconciliationExpensesResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = PostAccountingReconciliationExpensesResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, PostAccountingReconciliationExpensesResponse> mapFromJson(dynamic json) {
    final map = <String, PostAccountingReconciliationExpensesResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = PostAccountingReconciliationExpensesResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of PostAccountingReconciliationExpensesResponse-objects as value to a dart map
  static Map<String, List<PostAccountingReconciliationExpensesResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<PostAccountingReconciliationExpensesResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = PostAccountingReconciliationExpensesResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'reconciliaciones',
    'cuentaPorPagar',
    'pagoCuentaPorPagar',
    'distribucionMultiCuenta',
  };
}

