//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

import 'package:tcp_mobile_v1_sdk/api.dart';
import 'package:test/test.dart';


/// tests for AuthApi
void main() {
  // final instance = AuthApi();

  group('tests for AuthApi', () {
    // Consultar perfil autenticado
    //
    // Devuelve la identidad, rol y contexto de tenant contenidos en la sesión Bearer vigente.
    //
    //Future<AuthenticatedUser> mobileGetAuthMe() async
    test('test mobileGetAuthMe', () async {
      // TODO
    });

    // Listar tenants accesibles
    //
    // Devuelve los tenants activos a los que pertenece el usuario autenticado.
    //
    //Future<TenantListResponse> mobileGetAuthTenants() async
    test('test mobileGetAuthTenants', () async {
      // TODO
    });

    // Iniciar sesión móvil
    //
    // Valida las credenciales y entrega el usuario autenticado junto con los tokens de acceso y renovación.
    //
    //Future<AuthSession> mobilePostAuthLogin(LoginRequest loginRequest, { String xTenantId }) async
    test('test mobilePostAuthLogin', () async {
      // TODO
    });

    // Cerrar sesión actual
    //
    // Invalida la sesión autenticada para impedir el uso posterior de sus credenciales de renovación.
    //
    //Future<SuccessResponse> mobilePostAuthLogout() async
    test('test mobilePostAuthLogout', () async {
      // TODO
    });

    // Renovar tokens de sesión
    //
    // Valida el token de renovación y emite un nuevo par de tokens para continuar la sesión.
    //
    //Future<TokenPair> mobilePostAuthRefresh(RefreshRequest refreshRequest) async
    test('test mobilePostAuthRefresh', () async {
      // TODO
    });

    // Registrar cuenta móvil
    //
    // Crea un usuario inactivo pendiente de verificación de correo y envía el enlace de verificación. Espejo del registro web: no devuelve sesión; la cuenta debe completar onboarding y aprobación antes de iniciar sesión en el móvil.
    //
    //Future<RegisterResponse> mobilePostAuthRegister(RegisterRequest registerRequest) async
    test('test mobilePostAuthRegister', () async {
      // TODO
    });

    // Cambiar tenant activo
    //
    // Cambia el contexto de tenant y entrega tokens nuevos asociados a la membresía seleccionada.
    //
    //Future<SwitchTenantResponse> mobilePostAuthTenants(SwitchTenantRequest switchTenantRequest) async
    test('test mobilePostAuthTenants', () async {
      // TODO
    });

  });
}
