//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class DashboardTransferItem {
  /// Returns a new [DashboardTransferItem] instance.
  DashboardTransferItem({
    this.id,
    this.descripcion,
    this.monto,
    this.estado,
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
  String? descripcion;

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
  String? estado;

  @override
  bool operator ==(Object other) => identical(this, other) || other is DashboardTransferItem &&
    other.id == id &&
    other.descripcion == descripcion &&
    other.monto == monto &&
    other.estado == estado;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (id == null ? 0 : id!.hashCode) +
    (descripcion == null ? 0 : descripcion!.hashCode) +
    (monto == null ? 0 : monto!.hashCode) +
    (estado == null ? 0 : estado!.hashCode);

  @override
  String toString() => 'DashboardTransferItem[id=$id, descripcion=$descripcion, monto=$monto, estado=$estado]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    if (this.id != null) {
      json[r'id'] = this.id;
    } else {
      json[r'id'] = null;
    }
    if (this.descripcion != null) {
      json[r'descripcion'] = this.descripcion;
    } else {
      json[r'descripcion'] = null;
    }
    if (this.monto != null) {
      json[r'monto'] = this.monto;
    } else {
      json[r'monto'] = null;
    }
    if (this.estado != null) {
      json[r'estado'] = this.estado;
    } else {
      json[r'estado'] = null;
    }
    return json;
  }

  /// Returns a new [DashboardTransferItem] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static DashboardTransferItem? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "DashboardTransferItem[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "DashboardTransferItem[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return DashboardTransferItem(
        id: mapValueOfType<String>(json, r'id'),
        descripcion: mapValueOfType<String>(json, r'descripcion'),
        monto: num.parse('${json[r'monto']}'),
        estado: mapValueOfType<String>(json, r'estado'),
      );
    }
    return null;
  }

  static List<DashboardTransferItem> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <DashboardTransferItem>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = DashboardTransferItem.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, DashboardTransferItem> mapFromJson(dynamic json) {
    final map = <String, DashboardTransferItem>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = DashboardTransferItem.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of DashboardTransferItem-objects as value to a dart map
  static Map<String, List<DashboardTransferItem>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<DashboardTransferItem>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = DashboardTransferItem.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
  };
}

