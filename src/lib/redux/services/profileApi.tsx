import { apiSlice } from "./apiSlice";
import { Usuario } from "../../../app/models/model";

export const profileApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getProfile: builder.query<Usuario[], void>({
            query: () => '/profile',
            providesTags: ['Profile']
        }),
         
        updateProfile: builder.mutation<Usuario, Partial<Usuario> >({
            query: ({ ...patch }) => ({
                url: '/profile',
                method: 'PUT',
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
