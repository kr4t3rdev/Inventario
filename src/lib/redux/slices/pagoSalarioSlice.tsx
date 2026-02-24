import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { RootState } from "../store"
import { Empleado } from "../../../app/models/model"

// Interface for cart item
export interface PagoSalarioCartItem {
  empleadoId: string
  empleado: Empleado
  salario: number
  bonificaciones?: number
  deducciones?: number
  horasExtras?: number
  clienteId?: string // Optional client for the payment
}

// State interface
export interface PagoSalarioState {
  cart: PagoSalarioCartItem[]
  isDialogOpen: boolean
  selectedEmpleado: Empleado | null
}

// Initial state
const initialState: PagoSalarioState = {
  cart: [],
  isDialogOpen: false,
  selectedEmpleado: null,
}

// Slice
const pagoSalarioSlice = createSlice({
  name: "pagoSalario",
  initialState,
  reducers: {
    addToCart: (state, action: PayloadAction<PagoSalarioCartItem>) => {
      const existingItem = state.cart.find(item => item.empleadoId === action.payload.empleadoId)
      if (!existingItem) {
        state.cart.push(action.payload)
      }
    },
    removeFromCart: (state, action: PayloadAction<string>) => {
      state.cart = state.cart.filter(item => item.empleadoId !== action.payload)
    },
    clearCart: (state) => {
      state.cart = []
    },
    openDialog: (state, action: PayloadAction<Empleado>) => {
      state.isDialogOpen = true
      state.selectedEmpleado = action.payload
    },
    closeDialog: (state) => {
      state.isDialogOpen = false
      state.selectedEmpleado = null
    },
    updateCartItem: (state, action: PayloadAction<{ empleadoId: string; updates: Partial<PagoSalarioCartItem> }>) => {
      const item = state.cart.find(item => item.empleadoId === action.payload.empleadoId)
      if (item) {
        Object.assign(item, action.payload.updates)
      }
    },
  },
})

// Actions
export const {
  addToCart,
  removeFromCart,
  clearCart,
  openDialog,
  closeDialog,
  updateCartItem,
} = pagoSalarioSlice.actions

// Selectors
export const selectPagoSalarioState = (state: RootState) => state.pagoSalario || initialState
export const selectCart = (state: RootState) => (state.pagoSalario || initialState).cart
export const selectCartTotal = (state: RootState) =>
  (state.pagoSalario || initialState).cart.reduce((total, item) => total + item.salario + (item.bonificaciones || 0) - (item.deducciones || 0) + (item.horasExtras || 0), 0)
export const selectIsDialogOpen = (state: RootState) => (state.pagoSalario || initialState).isDialogOpen
export const selectSelectedEmpleado = (state: RootState) => (state.pagoSalario || initialState).selectedEmpleado

export default pagoSalarioSlice.reducer