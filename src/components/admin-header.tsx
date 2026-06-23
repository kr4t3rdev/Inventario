"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationsDropdown } from "@/features/admin/components/notifications-dropdown";

export function AdminHeader() {
  return (
    <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-medium">Panel de Administración</h1>
        </div>
      </div>
      
      <div className="flex items-center gap-2 px-4 lg:px-6">
        <NotificationsDropdown />
        <ThemeToggle />
      </div>
    </header>
  );
}
