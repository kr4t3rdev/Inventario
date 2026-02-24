import { apiSlice } from "./apiSlice";
import { GastosCompra } from "../../../app/models/model";

interface GastosCompraQueryParams {
    periodo?: string
    tipoOperacion?: 'restock' | 'regular'
    includeRestock?: boolean
}

export const gastosCompraApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getGastosCompra: builder.query<GastosCompra[], GastosCompraQueryParams | void>({
            query: (params) => {
                const searchParams = new URLSearchParams()

                if (params?.periodo) {
                    searchParams.append('periodo', params.periodo)
                }

                if (params?.tipoOperacion) {
                    searchParams.append('tipoOperacion', params.tipoOperacion)
                }

                if (params?.includeRestock !== undefined) {
                    searchParams.append('includeRestock', params.includeRestock.toString())
                }

                const queryString = searchParams.toString()
                return `/gastos-compra${queryString ? `?${queryString}` : ''}`
            },
            providesTags: ['GastosCompra']
        }),
        getGastosCompraRestock: builder.query<GastosCompra[], void>({
            query: () => '/gastos-compra?tipoOperacion=restock',
            providesTags: ['GastosCompra']
        }),
        getGastosCompraRegular: builder.query<GastosCompra[], void>({
            query: () => '/gastos-compra?tipoOperacion=regular',
            providesTags: ['GastosCompra']
        }),
    })
})

export const {
    useGetGastosCompraQuery,
    useGetGastosCompraRestockQuery,
    useGetGastosCompraRegularQuery
} = gastosCompraApi