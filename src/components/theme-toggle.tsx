"use client";

import { MoonIcon, SunIcon, MonitorIcon, Check } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";

/**
 * @description Permite seleccionar el tema visual con un control accesible.
 * @returns {React.JSX.Element} Selector de tema claro, oscuro o del sistema.
 */
export function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        aria-label="Cambiar tema"
        variant="secondary"
        size="icon"
        className="size-11"
      >
        <SunIcon className="h-4 w-4" />
      </Button>
    );
  }

  const themes = [
    { value: "light", label: "Claro", icon: SunIcon },
    { value: "dark", label: "Oscuro", icon: MoonIcon },
    { value: "system", label: "Sistema", icon: MonitorIcon },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          aria-label="Cambiar tema"
          variant="secondary" 
          size="icon" 
          className="relative size-11"
        >
          <SunIcon className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <MoonIcon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Cambiar tema</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {themes.map((t) => {
          const Icon = t.icon;
          const isActive = theme === t.value;
          return (
            <DropdownMenuItem
              key={t.value}
              onClick={() => setTheme(t.value)}
              className="cursor-pointer"
            >
              <Icon className="mr-2 h-4 w-4" />
              <span className="flex-1">{t.label}</span>
              {isActive && <Check className="h-4 w-4 text-purple" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
