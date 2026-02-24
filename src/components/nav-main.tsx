"use client"

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
import Link from "next/link"

export function NavMain({
  items,
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
}) {
  return (
    <SidebarGroupContent className="flex flex-col gap-2 group-data-[collapsible=icon]:gap-1">
      <SidebarMenu>
        {items.map((item) => (
          item.subItems ? (
            <Collapsible key={item.title}>
              <SidebarMenuItem className="flex items-center">
                <Link href={item.url} className="min-w-0 flex-1">
                  <SidebarMenuButton
                    tooltip={item.title}
                    className="cursor-pointer justify-start font-sans font-semibold text-md group-data-[collapsible=icon]:justify-center"
                  >
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </Link>
                <CollapsibleTrigger asChild>
                  <button className="rounded-md p-2 hover:bg-muted group-data-[collapsible=icon]:hidden">
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </CollapsibleTrigger>
              </SidebarMenuItem>
              <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
                <SidebarMenu>
                  {item.subItems.map((subItem) => (
                    <SidebarMenuItem key={subItem.title}>
                      <Link href={subItem.url} className="min-w-0">
                        <SidebarMenuButton
                          tooltip={subItem.title}
                          className="cursor-pointer pl-6 font-sans font-semibold text-md"
                        >
                          {subItem.icon && <subItem.icon />}
                          <span>{subItem.title}</span>
                        </SidebarMenuButton>
                      </Link>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <SidebarMenuItem key={item.title}>
              <Link href={item.url} className="min-w-0">
                <SidebarMenuButton
                  tooltip={item.title}
                  className="cursor-pointer justify-start font-sans font-semibold text-md group-data-[collapsible=icon]:justify-center"
                >
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          )
        ))}
      </SidebarMenu>
    </SidebarGroupContent>
  )
}
