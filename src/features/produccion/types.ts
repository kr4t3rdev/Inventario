import type {
  RecetaProduccion as ModelRecetaProduccion,
  RecetaProduccionIngrediente as ModelRecetaProduccionIngrediente,
  OrdenProduccion as ModelOrdenProduccion,
  OrdenProduccionHistorial as ModelOrdenProduccionHistorial,
  ValeSalida as ModelValeSalida,
  ValeSalidaItem as ModelValeSalidaItem,
  CreateValeSalidaPayload as ModelCreateValeSalidaPayload,
  CreateOrdenProduccionPayload as ModelCreateOrdenProduccionPayload,
  CreateRecetaProduccionPayload as ModelCreateRecetaProduccionPayload,
  SetIngredientesPayload as ModelSetIngredientesPayload,
  SetIngredientesResponse as ModelSetIngredientesResponse,
  PaginatedResponse as ModelPaginatedResponse,
  OrdenesPaginationMeta as ModelOrdenesPaginationMeta,
  PaginationMeta as ModelPaginationMeta,
  UnitNormalization as ModelUnitNormalization,
  UnitError as ModelUnitError,
  EstadoProduccion as ModelEstadoProduccion,
  EstadoValeSalida as ModelEstadoValeSalida,
} from '@/app/models/model';

export type RecetaProduccion = ModelRecetaProduccion;
export type RecetaProduccionIngrediente = ModelRecetaProduccionIngrediente;
export type OrdenProduccion = ModelOrdenProduccion;
export type OrdenProduccionHistorial = ModelOrdenProduccionHistorial;
export type ValeSalida = ModelValeSalida;
export type ValeSalidaItem = ModelValeSalidaItem;
export type CreateValeSalidaPayload = ModelCreateValeSalidaPayload;
export type CreateOrdenProduccionPayload = ModelCreateOrdenProduccionPayload;
export type CreateRecetaProduccionPayload = ModelCreateRecetaProduccionPayload;
export type SetIngredientesPayload = ModelSetIngredientesPayload;
export type SetIngredientesResponse = ModelSetIngredientesResponse;
export type PaginatedResponse<T, M = ModelPaginationMeta> = ModelPaginatedResponse<T, M>;
export type OrdenesPaginationMeta = ModelOrdenesPaginationMeta;
export type PaginationMeta = ModelPaginationMeta;
export type UnitNormalization = ModelUnitNormalization;
export type UnitError = ModelUnitError;
export type EstadoProduccion = ModelEstadoProduccion;
export type EstadoValeSalida = ModelEstadoValeSalida;
