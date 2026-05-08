export { getClientesHandler, createClienteHandler, getClienteByIdHandler, updateClienteHandler, deleteClienteHandler } from './api/handlers';
export { clientesApi, useGetClientesQuery, useGetClienteQuery, useAddClienteMutation, useUpdateClienteMutation, useDeleteClienteMutation } from './api/ClienteApi';
export { ClienteForm } from './components/clientes-form';
export type { Cliente } from './types';
