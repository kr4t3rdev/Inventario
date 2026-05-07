import { apiSlice } from "@/lib/redux/services/apiSlice"

interface Vendor {
  vendorId: string
  nombre: string
  direccion?: string | null
  telefono?: string | null
  contacto?: string | null
  cuentaCUP?: string | null
  cuentaUSD?: string | null
  logo?: string | null
  contrato?: string | null
  vendorCode?: string | null
  ean13Code?: string | null
  createdAt: string
  updatedAt: string
}

export const vendorsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getVendors: builder.query<Vendor[], void>({
      query: () => "/vendors",
      providesTags: ["Vendors"],
    }),
    getVendor: builder.query<Vendor, string>({
      query: (id) => `/vendors/${id}`,
      providesTags: (result, error, id) => [{ type: "Vendors", id }],
    }),
    addVendor: builder.mutation<Vendor, Partial<Vendor>>({
      query: (vendor) => ({ url: "/vendors", method: "POST", body: vendor }),
      invalidatesTags: ["Vendors"],
    }),
    updateVendor: builder.mutation<Vendor, Partial<Vendor> & { vendorId: string }>({
      query: ({ vendorId, ...patch }) => ({ url: `/vendors/${vendorId}`, method: "PATCH", body: patch }),
      invalidatesTags: (result, error, { vendorId }) => [{ type: "Vendors", vendorId }],
    }),
    deleteVendor: builder.mutation<{ success: boolean; id: string }, string>({
      query: (id) => ({ url: `/vendors/${id}`, method: "DELETE" }),
      invalidatesTags: ["Vendors"],
    }),
  }),
})

export const { useGetVendorsQuery, useGetVendorQuery, useAddVendorMutation, useUpdateVendorMutation, useDeleteVendorMutation } = vendorsApi
