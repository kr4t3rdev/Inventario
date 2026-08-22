import { BarChart3, Scale } from 'lucide-react';
import type { JSX } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { BalanceOverview } from './balance-overview';
import { IncomeStatement } from './income-statement';
import { MethodologyPanel, ReportStatusBand } from './report-states';
import type { FinancialData } from './types';

interface BalanceResultsViewProps {
  data: FinancialData;
  activeTab: 'balance' | 'resultados';
  onTabChange: (value: 'balance' | 'resultados') => void;
}

/**
 * @description Composición principal de balance y resultados con navegación por pestañas.
 * @param {BalanceResultsViewProps} props - Reporte financiero cargado.
 * @returns {JSX.Element} Vista operativa completa.
 */
export function BalanceResultsView({ data, activeTab, onTabChange }: BalanceResultsViewProps): JSX.Element {
  return (
    <div className="space-y-6">
      <ReportStatusBand data={data} />

      <MethodologyPanel data={data} />

      <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as 'balance' | 'resultados')} className="w-full">
        <div className="flex flex-col gap-3 border-b border-border/70 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Lectura del período</p>
            <p className="mt-1 text-sm text-muted-foreground">Cambia entre posición financiera y rendimiento.</p>
          </div>
          <TabsList className="grid h-11 w-full grid-cols-2 rounded-xl bg-muted/70 p-1 sm:w-[360px]">
            <TabsTrigger value="balance" className="h-11 gap-2 rounded-lg">
              <Scale className="h-4 w-4" aria-hidden="true" />
              Balance general
            </TabsTrigger>
            <TabsTrigger value="resultados" className="h-11 gap-2 rounded-lg">
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              Resultados
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="balance" className="mt-6 focus-visible:outline-none">
          <BalanceOverview balance={data.balance} />
        </TabsContent>
        <TabsContent value="resultados" className="mt-6 focus-visible:outline-none">
          <IncomeStatement statement={data.estadoResultados} currency={data.balance.monedaFuncional} isVisible={activeTab === 'resultados'} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
