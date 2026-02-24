import { apiSlice } from "./apiSlice";
import { Usuario } from "../../../app/models/model";
import { getAuthToken } from "@/lib/token";

export const profileApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getProfile: builder.query<Usuario[], void>({
            query: () => ({
                url: '/profile',
                headers: {
                    Authorization: getAuthToken()
                }
            }),
            providesTags: ['Profile']
        }),
         
        updateProfile: builder.mutation<Usuario, Partial<Usuario> >({
            query: ({ ...patch }) => ({
                url: '/profile',
                method: 'PUT',
                headers: {
                    Authorization: getAuthToken(),
                },
                body: patch,
            }),
            invalidatesTags: ['Profile'],
        }),
        
    })
})

export const {
    useGetProfileQuery,
    useUpdateProfileMutation
} = profileApi
