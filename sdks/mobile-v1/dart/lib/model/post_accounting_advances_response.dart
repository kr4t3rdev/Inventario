//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class PostAccountingAdvancesResponse {
  /// Returns a new [PostAccountingAdvancesResponse] instance.
  PostAccountingAdvancesResponse({
    required this.anticipo,
  });

  Advance anticipo;

  @override
  bool operator ==(Object other) => identical(this, other) || other is PostAccountingAdvancesResponse &&
    other.anticipo == anticipo;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (anticipo.hashCode);

  @override
  String toString() => 'PostAccountingAdvancesResponse[anticipo=$anticipo]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'anticipo'] = this.anticipo;
    return json;
  }

  /// Returns a new [PostAccountingAdvancesResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static PostAccountingAdvancesResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "PostAccountingAdvancesResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "PostAccountingAdvancesResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return PostAccountingAdvancesResponse(
        anticipo: Advance.fromJson(json[r'anticipo'])!,
      );
    }
    return null;
  }

  static List<PostAccountingAdvancesResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <PostAccountingAdvancesResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = PostAccountingAdvancesResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, PostAccountingAdvancesResponse> mapFromJson(dynamic json) {
    final map = <String, PostAccountingAdvancesResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = PostAccountingAdvancesResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of PostAccountingAdvancesResponse-objects as value to a dart map
  static Map<String, List<PostAccountingAdvancesResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<PostAccountingAdvancesResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = PostAccountingAdvancesResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'anticipo',
  };
}

