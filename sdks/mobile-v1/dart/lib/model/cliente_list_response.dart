//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class ClienteListResponse {
  /// Returns a new [ClienteListResponse] instance.
  ClienteListResponse({
    this.items = const [],
  });

  List<Cliente> items;

  @override
  bool operator ==(Object other) => identical(this, other) || other is ClienteListResponse &&
    _deepEquality.equals(other.items, items);

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (items.hashCode);

  @override
  String toString() => 'ClienteListResponse[items=$items]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'items'] = this.items;
    return json;
  }

  /// Returns a new [ClienteListResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static ClienteListResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "ClienteListResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "ClienteListResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return ClienteListResponse(
        items: Cliente.listFromJson(json[r'items']),
      );
    }
    return null;
  }

  static List<ClienteListResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <ClienteListResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = ClienteListResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, ClienteListResponse> mapFromJson(dynamic json) {
    final map = <String, ClienteListResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = ClienteListResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of ClienteListResponse-objects as value to a dart map
  static Map<String, List<ClienteListResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<ClienteListResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = ClienteListResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'items',
  };
}

