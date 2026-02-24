'use client'
import { SiteHeader } from "@/components/site-header"
import {  SidebarInset,SidebarProvider} from "@/components/ui/sidebar"
//import { ThemeProvider } from "next-themes"
//import "../globals.css"    
import { AppSidebar2 } from "@/components/app-sidebar2"
import { AuthProvider } from "@/contexts/auth-context"

const Layout = ({ children }: { children: React.ReactNode }) => {
    return (                                      
        <main >
          
            <SidebarProvider>
             <AppSidebar2 variant="floating" />
              <SidebarInset>
                <SiteHeader />                
                <AuthProvider>
                  {children} 
                </AuthProvider>
              </SidebarInset>
            </SidebarProvider>
                  
        </main>
       
    )
}   

export default Layout

