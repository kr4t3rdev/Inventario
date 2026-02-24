'use client'

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CalendarIcon } from "lucide-react";
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Formulario para crear un nuevo cierre contable
 * @param onSubmit - Función a ejecutar al enviar el formulario
 * @param isLoading - Estado de carga
 */
export function CierreForm({ onSubmit, isLoading }: {
  onSubmit: (data: any) => void;
  isLoading: boolean;
}) {
  const [tipo, setTipo] = useState("");
  const [fechaInicio, setFechaInicio] = useState<Date>();
  const [fechaFin, setFechaFin] = useState<Date>();
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedMonth, setSelectedMonth] = useState<number>();
  const [selectedYear, setSelectedYear] = useState<number>();
  const [observaciones, setObservaciones] = useState("");

  // Resetear selecciones cuando cambia el tipo
  useEffect(() => {
    setSelectedDate(undefined);
    setSelectedMonth(undefined);
    setSelectedYear(undefined);
    setFechaInicio(undefined);
    setFechaFin(undefined);
  }, [tipo]);

  // Auto-ajustar fechas basado en tipo y selecciones
  useEffect(() => {
    if (!tipo) return;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    if (tipo === "diario") {
      if (selectedDate) {
        setFechaInicio(startOfDay(selectedDate));
        setFechaFin(endOfDay(selectedDate));
      }
    } else if (tipo === "mensual") {
      const year = selectedYear || currentYear;
      const month = selectedMonth !== undefined ? selectedMonth : currentMonth;
      setFechaInicio(startOfMonth(new Date(year, month, 1)));
      setFechaFin(endOfMonth(new Date(year, month, 1)));
    } else if (tipo === "anual") {
      const year = selectedYear || currentYear;
      setFechaInicio(startOfYear(new Date(year, 0, 1)));
      setFechaFin(endOfYear(new Date(year, 0, 1)));
    }
  }, [tipo, selectedDate, selectedMonth, selectedYear]);

  // Generar opciones de años (últimos 10 años)
  const yearOptions = Array.from({ length: 10 }, (_, i) => {
    const year = new Date().getFullYear() - i;
    return { value: year.toString(), label: year.toString() };
  });

  // Opciones de meses
  const monthOptions = [
    { value: "0", label: "Enero" },
    { value: "1", label: "Febrero" },
    { value: "2", label: "Marzo" },
    { value: "3", label: "Abril" },
    { value: "4", label: "Mayo" },
    { value: "5", label: "Junio" },
    { value: "6", label: "Julio" },
    { value: "7", label: "Agosto" },
    { value: "8", label: "Septiembre" },
    { value: "9", label: "Octubre" },
    { value: "10", label: "Noviembre" },
    { value: "11", label: "Diciembre" },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!tipo) {
      alert("Por favor seleccione el tipo de cierre");
      return;
    }

    if (!fechaInicio || !fechaFin) {
      alert("Por favor complete la selección del período");
      return;
    }

    onSubmit({
      tipo,
      fechaInicio: fechaInicio.toISOString(),
      fechaFin: fechaFin.toISOString(),
      creadoPor: "admin", // TODO: obtener del contexto de usuario
      observaciones,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Crear Nuevo Cierre Contable</CardTitle>
        <CardDescription>
          Genere un cierre diario, mensual o anual con estadísticas automáticas
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo de Cierre</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccione el tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="diario">Diario</SelectItem>
                <SelectItem value="mensual">Mensual</SelectItem>
                <SelectItem value="anual">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {tipo && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Selector de período basado en tipo */}
            {tipo === "diario" && (
              <div className="space-y-2 md:col-span-2">
                <Label>Fecha del Cierre Diario</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !selectedDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "PPP") : "Seleccione fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {tipo === "mensual" && (
              <>
                <div className="space-y-2">
                  <Label>Mes</Label>
                  <Select value={selectedMonth?.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione mes" />
                    </SelectTrigger>
                    <SelectContent>
                      {monthOptions.map((month) => (
                        <SelectItem key={month.value} value={month.value}>
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Año</Label>
                  <Select value={selectedYear?.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione año" />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map((year) => (
                        <SelectItem key={year.value} value={year.value}>
                          {year.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {tipo === "anual" && (
              <div className="space-y-2 md:col-span-2">
                <Label>Año del Cierre Anual</Label>
                <Select value={selectedYear?.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione año" />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((year) => (
                      <SelectItem key={year.value} value={year.value}>
                        {year.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Mostrar período calculado */}
            {fechaInicio && fechaFin && (
              <div className="space-y-2 md:col-span-2">
                <Label>Período Calculado</Label>
                <div className="p-3 bg-muted rounded-md text-sm">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    <span>
                      {format(fechaInicio, "dd/MM/yyyy")} - {format(fechaFin, "dd/MM/yyyy")}
                    </span>
                  </div>
                </div>
              </div>
            )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="observaciones">Observaciones (opcional)</Label>
            <Textarea
              id="observaciones"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Notas adicionales sobre el cierre..."
              rows={3}
            />
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? "Creando cierre..." : "Crear Cierre Contable"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}