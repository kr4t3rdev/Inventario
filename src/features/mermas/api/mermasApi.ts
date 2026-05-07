import { apiSlice } from "@/lib/redux/services/apiSlice"
import { Merma, MermaStats } from "@/app/models/model"

export const mermasApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getMermas: builder.query<Merma[], void>({
      query: () => "/mermas",
      providesTags: ["Mermas"],
    }),
    getMerma: builder.query<Merma, string>({
      query: (id) => `/mermas/${id}`,
      providesTags: (result, error, id) => [{ type: "Mermas", id }],
    }),
    getMermaStats: builder.query<MermaStats, void>({
      query: () => "/mermas/stats",
      providesTags: ["Mermas", "Dashboard"],
    }),
    addMerma: builder.mutation<Merma, Omit<Merma, "mermaId" | "createdAt" | "updatedAt">>({
      query: (merma) => ({
        url: "/mermas",
        method: "POST",
        body: merma,
      }),
      invalidatesTags: ["Mermas", "Dashboard"],
    }),
    updateMerma: builder.mutation<Merma, Partial<Merma> & { mermaId: string }>({
      query: ({ mermaId, ...patch }) => ({
        url: `/mermas/${mermaId}`,
        method: "PATCH",
        body: patch,
      }),
      invalidatesTags: (result, error, { mermaId }) => [{ type: "Mermas", mermaId }, "Dashboard"],
    }),
    deleteMerma: builder.mutation<{ success: boolean; id: string }, string>({
      query: (id) => ({
        url: `/mermas/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Mermas", "Dashboard"],
    }),
  }),
})

export const {
  useGetMermasQuery,
  useGetMermaQuery,
  useGetMermaStatsQuery,
  useAddMermaMutation,
  useUpdateMermaMutation,
  useDeleteMermaMutation,
} = mermasApi
