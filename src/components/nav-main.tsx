"use client"

import { useState } from "react"
import Link from "next/link"
import { type LucideIcon, ChevronDown } from "lucide-react"

import {
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "./ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible"

/**
 * @description Navegación de una sección del sidebar con submenús accesibles.
 * @param {Object} props - Propiedades del grupo de navegación.
 * @param {string} props.label - Nombre único del landmark de navegación.
 * @returns {JSX.Element} Navegación etiquetada con enlaces y submenús.
 */
export function NavMain({
  items,
  label,
}: {
  items: {
    title: string
    url: string
    icon?: LucideIcon
    subItems?: {
      title: string
      url: string
      icon?: LucideIcon
    }[]
  }[]
  label: string
}) {
  const [openItems, setOpenItems] = useState<Set<string>>(() => new Set())

  /**
   * @description Actualiza el estado expandido de un grupo sin mutar el conjunto anterior.
   * @param {string} title - Título del grupo de navegación.
   * @param {boolean} open - Indica si el submenú debe quedar visible.
   * @returns {void}
   */
  const handleOpenChange = (title: string, open: boolean): void => {
    setOpenItems((current) => {
      const next = new Set(current)
      if (open) next.add(title)
      else next.delete(title)
      return next
    })
  }

  return (
    <nav aria-label={label}>
      <SidebarGroupContent className="flex flex-col gap-2 group-data-[collapsible=icon]:gap-1">
        <SidebarMenu className="group-data-[collapsible=icon]:items-center">
          {items.map((item) => (
            item.subItems ? (
              <Collapsible
                key={item.title}
                asChild
                open={openItems.has(item.title)}
                onOpenChange={(open) => handleOpenChange(item.title, open)}
              >
                <SidebarMenuItem className="flex flex-col">
                  <div className="flex w-full items-center">
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      className="min-h-11 min-w-0 flex-1 cursor-pointer justify-start font-sans font-semibold text-md group-data-[collapsible=icon]:justify-center"
                    >
                      <Link href={item.url}>
                        {item.icon && <item.icon aria-hidden="true" />}
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        aria-label={`${openItems.has(item.title) ? 'Ocultar' : 'Mostrar'} submenú de ${item.title}`}
                        className="group flex min-h-11 min-w-11 items-center justify-center rounded-md hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-data-[collapsible=icon]:hidden"
                      >
                        <ChevronDown
                          aria-hidden="true"
                          className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180"
                        />
                      </button>
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent className="w-full group-data-[collapsible=icon]:hidden">
                    <SidebarMenu className="group-data-[collapsible=icon]:items-center">
                      {item.subItems.map((subItem) => (
                        <SidebarMenuItem key={subItem.title}>
                          <SidebarMenuButton
                            asChild
                            tooltip={subItem.title}
                            className="min-h-11 cursor-pointer pl-6 font-sans font-semibold text-md"
                          >
                            <Link href={subItem.url}>
                              {subItem.icon && <subItem.icon aria-hidden="true" />}
                              <span>{subItem.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            ) : (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  className="min-h-11 cursor-pointer justify-start font-sans font-semibold text-md group-data-[collapsible=icon]:justify-center"
                >
                  <Link href={item.url}>
                    {item.icon && <item.icon aria-hidden="true" />}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </nav>
  )
}
