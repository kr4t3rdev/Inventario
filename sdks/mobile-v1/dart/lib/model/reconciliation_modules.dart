//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class ReconciliationModules {
  /// Returns a new [ReconciliationModules] instance.
  ReconciliationModules({
    required this.ventas,
    required this.servicios,
    required this.gastos,
  });

  ReconciliationModuleStats ventas;

  ReconciliationModuleStats servicios;

  ReconciliationModuleStats gastos;

  @override
  bool operator ==(Object other) => identical(this, other) || other is ReconciliationModules &&
    other.ventas == ventas &&
    other.servicios == servicios &&
    other.gastos == gastos;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (ventas.hashCode) +
    (servicios.hashCode) +
    (gastos.hashCode);

  @override
  String toString() => 'ReconciliationModules[ventas=$ventas, servicios=$servicios, gastos=$gastos]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'ventas'] = this.ventas;
      json[r'servicios'] = this.servicios;
      json[r'gastos'] = this.gastos;
    return json;
  }

  /// Returns a new [ReconciliationModules] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static ReconciliationModules? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "ReconciliationModules[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "ReconciliationModules[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return ReconciliationModules(
        ventas: ReconciliationModuleStats.fromJson(json[r'ventas'])!,
        servicios: ReconciliationModuleStats.fromJson(json[r'servicios'])!,
        gastos: ReconciliationModuleStats.fromJson(json[r'gastos'])!,
      );
    }
    return null;
  }

  static List<ReconciliationModules> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <ReconciliationModules>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = ReconciliationModules.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, ReconciliationModules> mapFromJson(dynamic json) {
    final map = <String, ReconciliationModules>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = ReconciliationModules.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of ReconciliationModules-objects as value to a dart map
  static Map<String, List<ReconciliationModules>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<ReconciliationModules>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = ReconciliationModules.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'ventas',
    'servicios',
    'gastos',
  };
}

