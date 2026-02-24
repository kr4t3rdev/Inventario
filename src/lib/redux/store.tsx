import { configureStore } from "@reduxjs/toolkit"
import { setupListeners } from "@reduxjs/toolkit/query"
import { apiSlice } from "./services/apiSlice"
import themeReducer from "./slices/themeSlice"
import contabilidadReducer from "./slices/contabilidadSlice"
import pagoSalarioReducer from "./slices/pagoSalarioSlice"
import exchangeIntelligenceReducer from "./slices/exchangeIntelligenceSlice"

export const store = configureStore({
  reducer: {
    [apiSlice.reducerPath]: apiSlice.reducer,
    theme: themeReducer,
    contabilidad: contabilidadReducer,
    pagoSalario: pagoSalarioReducer,
    exchangeIntelligence: exchangeIntelligenceReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(apiSlice.middleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

setupListeners(store.dispatch)
