"use client"

import { MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { useDispatch } from "react-redux"
import { setThemeMode } from "@/lib/redux/slices/themeSlice"

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  const dispatch = useDispatch()

  const toggleTheme = () => {
    const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    dispatch(setThemeMode(newTheme))
  }

  return (
    <Button 
      variant="secondary" 
      size="icon" 
      className="h-8 w-8" 
      onClick={toggleTheme}
    >
      <SunIcon className="h-[3.0rem] w-[3.0rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <MoonIcon className="absolute h-[3.0rem] w-[3.0rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
