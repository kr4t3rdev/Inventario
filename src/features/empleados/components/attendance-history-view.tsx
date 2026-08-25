"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar, Edit, Save, Filter, Download, User } from "lucide-react";
import { getEmpleadosAction, getAsistenciaAction, updateAsistenciaAction } from '@/features/empleados/actions';
import { toast } from "sonner";

interface Empleado {
  empleadoId: string;
  nombre: string;
  apellido: string;
  cargo: string;
}

interface Asistencia {
  attendanceId: string;
  date: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  totalHours: number | null;
  manualCheckIn?: string | null;
  manualCheckOut?: string | null;
  isManualEntry?: boolean;
  notes?: string;
  scheduledHours?: number | null;
  overtimeHours?: number | null;
  employee?: {
    nombre: string;
    apellido: string;
    cargo: string;
  };
}

/**
 * Componente para visualización y edición del historial de asistencia
 * @returns Componente de historial de asistencia
 */
export function AttendanceHistoryView() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [selectedEmpleado, setSelectedEmpleado] = useState("");
  const [historialAsistencia, setHistorialAsistencia] = useState<Asistencia[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Asistencia | null>(null);

  // Filtros
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
     status: "all"
  });

  const [editForm, setEditForm] = useState({
    manualCheckIn: "",
    manualCheckOut: "",
    notes: ""
  });

  // Cargar lista de empleados
  useEffect(() => {
    getEmpleadosAction()
      .then((r) => {
        if (r.success) setEmpleados(r.data ?? [])
      })
      .catch((error) => console.error("Error cargando empleados:", error));
  }, []);

  const fetchAttendanceHistory = useCallback(async () => {
    if (!selectedEmpleado) return;

    setLoading(true);
    try {
      const r = await getAsistenciaAction({
        employeeId: selectedEmpleado,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      });

      if (r.success) {
        let data = r.data ?? [];

        // Aplicar filtro de estado si está seleccionado
        if (filters.status && filters.status !== "all") {
          data = data.filter((record: any) => record.status === filters.status);
        }

        setHistorialAsistencia(data as any);
      }
    } catch (error) {
      console.error("Error cargando historial de asistencia:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedEmpleado, filters]);

  // Cargar historial cuando cambie el empleado o filtros
  useEffect(() => {
    if (selectedEmpleado) {
      fetchAttendanceHistory();
    } else {
      setHistorialAsistencia([]);
    }
  }, [selectedEmpleado, fetchAttendanceHistory]);

  const openEditDialog = (record: Asistencia) => {
    setEditingRecord(record);
    setEditForm({
      manualCheckIn: record.manualCheckIn || record.checkIn || "",
      manualCheckOut: record.manualCheckOut || record.checkOut || "",
      notes: record.notes || ""
    });
  };

  const handleSaveManualEdit = async () => {
    if (!editingRecord) return;

    setLoading(true);
    try {
      const r = await updateAsistenciaAction({
        attendanceId: editingRecord.attendanceId,
        manualCheckIn: editForm.manualCheckIn || undefined,
        manualCheckOut: editForm.manualCheckOut || undefined,
        notes: editForm.notes || undefined,
        approvedBy: "admin", // TODO: Get from current user context
      });

      if (r.success) {
        const data = r.data;
        // Update the record in the history
        setHistorialAsistencia(prev =>
          prev.map(record =>
            record.attendanceId === editingRecord.attendanceId ? (data as any) : record
          )
        );

        setEditingRecord(null);
        toast.success('Registro actualizado correctamente');
      } else {
        toast.error(r.error?.message || 'Error al actualizar registro');
      }
    } catch (error) {
      console.error("Error actualizando asistencia:", error);
      toast.error('Error interno del servidor');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (historialAsistencia.length === 0) return;

    const headers = [
      "Fecha",
      "Empleado",
      "Estado",
      "Entrada",
      "Salida",
      "Horas Trabajadas",
      "Horas Programadas",
      "Horas Extras",
      "Notas",
      "Manual"
    ];

    const csvData = historialAsistencia.map(record => [
      new Date(record.date).toLocaleDateString('es-ES'),
      `${record.employee?.nombre} ${record.employee?.apellido}`,
      record.status,
      record.manualCheckIn || record.checkIn ? new Date(record.manualCheckIn || record.checkIn!).toLocaleTimeString('es-ES') : "",
      record.manualCheckOut || record.checkOut ? new Date(record.manualCheckOut || record.checkOut!).toLocaleTimeString('es-ES') : "",
      record.totalHours ? Number(record.totalHours).toFixed(2) : "",
      record.scheduledHours ? Number(record.scheduledHours).toFixed(2) : "",
      record.overtimeHours ? Number(record.overtimeHours).toFixed(2) : "",
      record.notes || "",
      record.isManualEntry ? "Sí" : "No"
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `asistencia_${selectedEmpleado}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string, isManual?: boolean) => {
    const variants = {
      present: "default",
      absent: "destructive",
      late: "secondary",
      "half-day": "outline"
    };

    return (
      <div className="flex items-center gap-2">
        <Badge variant={(variants[status as keyof typeof variants] as "default" | "destructive" | "secondary" | "outline") || "default"}>
          {status === 'present' ? 'Presente' :
           status === 'absent' ? 'Ausente' :
           status === 'late' ? 'Tarde' :
           status === 'half-day' ? 'Medio día' : status}
        </Badge>
        {isManual && (
          <Badge variant="outline" className="text-xs">
            Manual
          </Badge>
        )}
      </div>
    );
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return "N/A";
    return new Date(timeString).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateStats = () => {
    const totalDays = historialAsistencia.length;
    const presentDays = historialAsistencia.filter(r => r.status === 'present').length;
    const absentDays = historialAsistencia.filter(r => r.status === 'absent').length;
    const totalHours = historialAsistencia.reduce((sum, r) => sum + (r.totalHours || 0), 0);
    const overtimeHours = historialAsistencia.reduce((sum, r) => sum + (r.overtimeHours || 0), 0);

    return {
      totalDays,
      presentDays,
      absentDays,
      attendanceRate: totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(1) : "0",
      totalHours: totalHours.toFixed(2),
      overtimeHours: overtimeHours.toFixed(2)
    };
  };

  const stats = calculateStats();

  return (
    <div className="space-y-6">
      <Card className="w-full max-w-6xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Historial de Asistencia
          </CardTitle>
          <CardDescription>
            Visualiza y edita el historial completo de asistencia de empleados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="empleado-select">Empleado</Label>
              <Select value={selectedEmpleado} onValueChange={setSelectedEmpleado}>
                <SelectTrigger id="empleado-select">
                  <SelectValue placeholder="Seleccionar empleado" />
                </SelectTrigger>
                <SelectContent>
                  {empleados.map((empleado) => (
                    <SelectItem key={empleado.empleadoId} value={empleado.empleadoId}>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {empleado.nombre} {empleado.apellido} - {empleado.cargo}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="start-date">Fecha inicio</Label>
              <Input
                id="start-date"
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-date">Fecha fin</Label>
              <Input
                id="end-date"
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status-filter">Estado</Label>
              <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                <SelectTrigger id="status-filter">
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                   <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="present">Presente</SelectItem>
                  <SelectItem value="absent">Ausente</SelectItem>
                  <SelectItem value="late">Tarde</SelectItem>
                  <SelectItem value="half-day">Medio día</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Estadísticas */}
          {selectedEmpleado && historialAsistencia.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.totalDays}</div>
                <div className="text-sm text-muted-foreground">Días totales</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{stats.presentDays}</div>
                <div className="text-sm text-muted-foreground">Presentes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.absentDays}</div>
                <div className="text-sm text-muted-foreground">Ausentes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.attendanceRate}%</div>
                <div className="text-sm text-muted-foreground">Asistencia</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.totalHours}h</div>
                <div className="text-sm text-muted-foreground">Horas totales</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.overtimeHours}h</div>
                <div className="text-sm text-muted-foreground">Horas extras</div>
              </div>
            </div>
          )}

          {/* Acciones */}
          {selectedEmpleado && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportToCSV} disabled={historialAsistencia.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
            </div>
          )}

          {/* Tabla de historial */}
          {selectedEmpleado && (
            <div className="border rounded-lg">
              <div className="max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="p-8 text-center">Cargando...</div>
                ) : historialAsistencia.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No hay registros de asistencia para los filtros seleccionados
                  </div>
                ) : (
                  <div className="divide-y">
                    {historialAsistencia.map((record) => (
                      <div key={record.attendanceId} className="p-4 hover:bg-muted/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="font-medium">
                              {new Date(record.date).toLocaleDateString('es-ES', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric'
                              })}
                            </div>
                            {getStatusBadge(record.status, record.isManualEntry)}
                          </div>
                          <div className="flex items-center gap-6 text-sm">
                            <div className="text-center">
                              <div className="text-muted-foreground">Entrada</div>
                              <div className="font-medium">{formatTime(record.manualCheckIn || record.checkIn)}</div>
                            </div>
                            <div className="text-center">
                              <div className="text-muted-foreground">Salida</div>
                              <div className="font-medium">{formatTime(record.manualCheckOut || record.checkOut)}</div>
                            </div>
                            <div className="text-center">
                              <div className="text-muted-foreground">Horas</div>
                              <div className="font-medium">
                                {record.totalHours ? `${Number(record.totalHours).toFixed(2)}h` : "N/A"}
                              </div>
                            </div>
                            {record.overtimeHours && Number(record.overtimeHours) > 0 && (
                              <div className="text-center">
                                <div className="text-muted-foreground">Extras</div>
                                <div className="font-medium text-orange-600">
                                  +{Number(record.overtimeHours).toFixed(2)}h
                                </div>
                              </div>
                            )}
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" onClick={() => openEditDialog(record)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Editar Registro de Asistencia</DialogTitle>
                                  <DialogDescription>
                                    Modifica manualmente las horas de entrada y salida
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="text-sm text-muted-foreground">
                                    Fecha: {new Date(record.date).toLocaleDateString('es-ES')}
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="manual-checkin">Entrada Manual</Label>
                                      <Input
                                        id="manual-checkin"
                                        type="datetime-local"
                                        value={editForm.manualCheckIn}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, manualCheckIn: e.target.value }))}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="manual-checkout">Salida Manual</Label>
                                      <Input
                                        id="manual-checkout"
                                        type="datetime-local"
                                        value={editForm.manualCheckOut}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, manualCheckOut: e.target.value }))}
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="notes">Notas</Label>
                                    <Input
                                      id="notes"
                                      placeholder="Notas adicionales sobre este registro..."
                                      value={editForm.notes}
                                      onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                                    />
                                  </div>
                                  <div className="flex justify-end gap-2">
                                    <Button variant="outline" onClick={() => setEditingRecord(null)}>
                                      Cancelar
                                    </Button>
                                    <Button onClick={handleSaveManualEdit} disabled={loading}>
                                      <Save className="h-4 w-4 mr-2" />
                                      Guardar Cambios
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                        {record.notes && (
                          <div className="mt-2 text-sm text-muted-foreground">
                            <strong>Notas:</strong> {record.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}