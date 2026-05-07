import { apiSlice } from "@/lib/redux/services/apiSlice";
import { ResumenData } from "@/app/models/model";

export const ReportesFinancierosApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getRF: builder.query<ResumenData[], void>({
            query: () => '/reportes-financieros',
            providesTags: ['ReportesFinancieros']
        }),
    })
})
export const { useGetRFQuery } = ReportesFinancierosApi
