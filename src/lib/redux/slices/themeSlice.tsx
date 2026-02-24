import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../store';

interface ThemeState {
    mode : 'light' | 'dark'
}
const initialState: ThemeState = {
    mode: 'light'
}

export const themeSlice = createSlice({
    name: 'theme',
    initialState,
    reducers: {
        setThemeMode: ( state, action: PayloadAction< 'light' | 'dark'>) => {
            state.mode = action.payload
        },
    },
})

export const { setThemeMode } = themeSlice.actions
export const selectThemeMode = (state : RootState) => state.theme.mode
export default themeSlice.reducer