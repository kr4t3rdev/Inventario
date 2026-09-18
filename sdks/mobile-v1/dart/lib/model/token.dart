//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class Token {
  /// Returns a new [Token] instance.
  Token({
    required this.token,
    required this.expiresInSeconds,
  });

  String token;

  /// Minimum value: 1
  int expiresInSeconds;

  @override
  bool operator ==(Object other) => identical(this, other) || other is Token &&
    other.token == token &&
    other.expiresInSeconds == expiresInSeconds;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (token.hashCode) +
    (expiresInSeconds.hashCode);

  @override
  String toString() => 'Token[token=<redacted>, expiresInSeconds=$expiresInSeconds]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'token'] = this.token;
      json[r'expiresInSeconds'] = this.expiresInSeconds;
    return json;
  }

  /// Returns a new [Token] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static Token? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "Token[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "Token[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return Token(
        token: mapValueOfType<String>(json, r'token')!,
        expiresInSeconds: mapValueOfType<int>(json, r'expiresInSeconds')!,
      );
    }
    return null;
  }

  static List<Token> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <Token>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = Token.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, Token> mapFromJson(dynamic json) {
    final map = <String, Token>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = Token.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of Token-objects as value to a dart map
  static Map<String, List<Token>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<Token>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = Token.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'token',
    'expiresInSeconds',
  };
}

