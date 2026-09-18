"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Wallet, CreditCard, Calculator, RefreshCw } from "lucide-react";

interface DisclosureSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

interface AccountingDetailsDisclosureProps {
  sections: DisclosureSection[];
}

export function AccountingDetailsDisclosure({ sections }: AccountingDetailsDisclosureProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
        <Calculator className="h-4 w-4" />
        <span>Desglose Detallado</span>
      </div>
      <Accordion type="multiple" className="space-y-3">
        {sections.map((section) => (
          <AccordionItem
            key={section.id}
            value={section.id}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden"
          >
            <AccordionTrigger className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors flex items-center gap-3">
              <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {section.icon}
              </div>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{section.title}</span>
            </AccordionTrigger>
            <AccordionContent className="p-4 border-t border-slate-100 dark:border-slate-800">
              {section.content}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
