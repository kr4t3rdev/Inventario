"use client";

/**
 * @description Componente que muestra el historial de pagos en 2 tabs:
 *              - Historial Detallado: tabla con cada pago individual
 *              - Resumen por Período: agrupado por empleado + período
 *
 * @param {HistorialPagosProps} props
 * @returns {JSX.Element}
 */
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Pagosalario } from "@/app/models/model";

interface HistorialPagosProps {
  pagos: Pagosalario[];
}

export function HistorialPagos({ pagos }: HistorialPagosProps) {
  if (pagos.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6 text-center text-muted-foreground">
          No hay pagos registrados todavía.
        </CardContent>
      </Card>
    );
  }

  // Agrupar por empleadoId + período para el resumen
  const grouped = pagos.reduce(
    (acc, pago) => {
      const key = `${pago.empleadoId}-${pago.periodo}`;
      if (!acc[key]) {
        acc[key] = {
          empleado: pago.empleado!,
          periodo: pago.periodo,
          total: 0,
          count: 0,
        };
      }
      const totalPagado =
        pago.salario +
        (pago.bonificaciones || 0) -
        Math.abs(pago.deducciones || 0);
      acc[key].total += totalPagado;
      acc[key].count += 1;
      return acc;
    },
    {} as Record<
      string,
      { empleado: any; periodo: string; total: number; count: number }
    >,
  );

  return (
    <Tabs defaultValue="historial" className="w-full">
      <TabsList className="grid w-full max-w-md grid-cols-2">
        <TabsTrigger value="historial">Historial Detallado</TabsTrigger>
        <TabsTrigger value="resumen">Resumen por Período</TabsTrigger>
      </TabsList>

      <TabsContent value="historial" className="mt-4">
        <Card className="border-dashed">
          <div className="h-1 bg-linear-to-r from-orange-500 via-red-500 to-orange-500" />
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Salario Base</TableHead>
                  <TableHead>Bonificaciones</TableHead>
                  <TableHead>Deducciones</TableHead>
                  <TableHead>Horas Extras</TableHead>
                  <TableHead>Total Pagado</TableHead>
                  <TableHead>Observaciones</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagos.map((pago) => {
                  const totalPagado =
                    pago.salario +
                    (pago.bonificaciones || 0) -
                    Math.abs(pago.deducciones || 0);

                  return (
                    <TableRow key={pago.pgId}>
                      <TableCell className="font-medium">
                        {pago.empleado?.nombre} {pago.empleado?.apellido}
                      </TableCell>
                      <TableCell>${pago.salario.toLocaleString()}</TableCell>
                      <TableCell>
                        ${(pago.bonificaciones || 0).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        ${(pago.deducciones || 0).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {(pago.horasExtras || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-semibold">
                        ${totalPagado.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {pago.observaciones || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(pago.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="resumen" className="mt-4">
        <Card className="border-dashed">
          <div className="h-1 bg-linear-to-r from-orange-500 to-red-600" />
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Total Pagado</TableHead>
                  <TableHead>Número de Pagos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.values(grouped).map((group) => (
                  <TableRow key={`${group.empleado.empleadoId}-${group.periodo}`}>
                    <TableCell className="font-medium">
                      {group.empleado?.nombre} {group.empleado?.apellido}
                    </TableCell>
                    <TableCell>{group.periodo}</TableCell>
                    <TableCell className="font-semibold">
                      ${group.total.toLocaleString()}
                    </TableCell>
                    <TableCell>{group.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
