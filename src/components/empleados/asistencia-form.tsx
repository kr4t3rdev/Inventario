"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Clock, LogIn, LogOut, Edit, Save, Calendar } from "lucide-react";
import { toast } from "sonner";

interface Empleado {
  empleadoId: string;
  nombre: string;
  apellido: string;
  cargo: string;
}

interface Asistencia {
  attendanceId: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  totalHours: number | null;
  manualCheckIn?: string | null;
  manualCheckOut?: string | null;
  isManualEntry?: boolean;
  notes?: string;
  date: string;
}

/**
 * Componente para registro y visualización de asistencia de empleados
 * @returns Componente de formulario de asistencia
 */
export function AsistenciaForm() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [selectedEmpleado, setSelectedEmpleado] = useState("");
  const [asistenciaHoy, setAsistenciaHoy] = useState<Asistencia | null>(null);
  const [historialAsistencia, setHistorialAsistencia] = useState<Asistencia[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Asistencia | null>(null);
  const [editForm, setEditForm] = useState({
    manualCheckIn: "",
    manualCheckOut: "",
    notes: ""
  });

  // Cargar lista de empleados
  useEffect(() => {
    const fetchEmpleados = async () => {
      try {
        const token = sessionStorage.getItem('token');
        const response = await fetch("/api/empleados", {
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        });
        if (response.ok) {
          const data = await response.json();
          setEmpleados(data);
        }
      } catch (error) {
        console.error("Error cargando empleados:", error);
      }
    };

    fetchEmpleados();
  }, []);

  // Verificar asistencia de hoy y cargar historial para el empleado seleccionado
  useEffect(() => {
    if (selectedEmpleado) {
      const fetchAsistenciaData = async () => {
        try {
          const token = sessionStorage.getItem('token');
          const today = new Date().toISOString().split('T')[0];

          // Fetch today's attendance
          const todayResponse = await fetch(`/api/empleados/asistencia?employeeId=${selectedEmpleado}&date=${today}`, {
            headers: {
              ...(token && { Authorization: `Bearer ${token}` }),
            },
          });

          if (todayResponse.ok) {
            const todayData = await todayResponse.json();
            setAsistenciaHoy(todayData.length > 0 ? todayData[0] : null);
          }

          // Fetch attendance history (last 30 days)
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const historyResponse = await fetch(`/api/empleados/asistencia?employeeId=${selectedEmpleado}&startDate=${thirtyDaysAgo.toISOString().split('T')[0]}`, {
            headers: {
              ...(token && { Authorization: `Bearer ${token}` }),
            },
          });

          if (historyResponse.ok) {
            const historyData = await historyResponse.json();
            setHistorialAsistencia(historyData);
          }
        } catch (error) {
          console.error("Error cargando datos de asistencia:", error);
        }
      };

      fetchAsistenciaData();
    }
  }, [selectedEmpleado]);

  /**
   * Registra entrada o salida del empleado
   * @param action - Acción a realizar ('checkin' o 'checkout')
   */
  const handleAttendanceAction = async (action: 'checkin' | 'checkout') => {
    if (!selectedEmpleado) {
      toast.error("Selecciona un empleado primero");
      return;
    }

    setLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch("/api/empleados/asistencia", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          employeeId: selectedEmpleado,
          action
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setAsistenciaHoy(data);
        toast.success(action === 'checkin'
          ? "Entrada registrada correctamente"
          : "Salida registrada correctamente");
      } else {
        toast.error(data.error || "Error al registrar asistencia");
      }
    } catch (error) {
      console.error("Error registrando asistencia:", error);
      toast.error("Error interno del servidor");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Abre el diálogo de edición para un registro de asistencia
   */
  const openEditDialog = (record: Asistencia) => {
    setEditingRecord(record);
    setEditForm({
      manualCheckIn: record.manualCheckIn || record.checkIn || "",
      manualCheckOut: record.manualCheckOut || record.checkOut || "",
      notes: record.notes || ""
    });
  };

  /**
   * Guarda los cambios manuales en un registro de asistencia
   */
  const handleSaveManualEdit = async () => {
    if (!editingRecord) return;

    setLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch("/api/empleados/asistencia", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          attendanceId: editingRecord.attendanceId,
          manualCheckIn: editForm.manualCheckIn || null,
          manualCheckOut: editForm.manualCheckOut || null,
          notes: editForm.notes || null,
          approvedBy: "admin" // TODO: Get from current user context
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Update the record in the history
        setHistorialAsistencia(prev =>
          prev.map(record =>
            record.attendanceId === editingRecord.attendanceId ? data : record
          )
        );

        // Update today's record if it's the same
        if (asistenciaHoy?.attendanceId === editingRecord.attendanceId) {
          setAsistenciaHoy(data);
        }

        setEditingRecord(null);
        toast.success("Registro actualizado correctamente");
      } else {
        toast.error(data.error || "Error al actualizar registro");
      }
    } catch (error) {
      console.error("Error actualizando asistencia:", error);
      toast.error("Error interno del servidor");
    } finally {
      setLoading(false);
    }
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

  return (
    <div className="space-y-6">
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Registro de Asistencia
          </CardTitle>
          <CardDescription>
            Registra entradas y salidas de empleados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Selector de empleado */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Seleccionar Empleado</label>
            <Select value={selectedEmpleado} onValueChange={setSelectedEmpleado}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un empleado" />
              </SelectTrigger>
              <SelectContent>
                {empleados.map((empleado) => (
                  <SelectItem key={empleado.empleadoId} value={empleado.empleadoId}>
                    {empleado.nombre} {empleado.apellido} - {empleado.cargo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Estado de asistencia actual */}
          {selectedEmpleado && (
            <div className="p-4 border rounded-lg bg-muted/50">
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Estado de Hoy
              </h3>
              {asistenciaHoy ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span>Estado:</span>
                    {getStatusBadge(asistenciaHoy.status, asistenciaHoy.isManualEntry)}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-muted-foreground">Entrada:</span>
                      <p className="font-medium">{formatTime(asistenciaHoy.manualCheckIn || asistenciaHoy.checkIn)}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Salida:</span>
                      <p className="font-medium">{formatTime(asistenciaHoy.manualCheckOut || asistenciaHoy.checkOut)}</p>
                    </div>
                  </div>
                  {asistenciaHoy.totalHours && (
                    <div className="flex justify-between">
                      <span>Horas trabajadas:</span>
                      <span className="font-medium">{Number(asistenciaHoy.totalHours).toFixed(2)}h</span>
                    </div>
                  )}
                  <div className="flex gap-2 mt-4">
                    <Button
                      onClick={() => handleAttendanceAction('checkin')}
                      disabled={loading || !!(asistenciaHoy && (asistenciaHoy.checkIn || asistenciaHoy.manualCheckIn))}
                      size="sm"
                    >
                      <LogIn className="h-4 w-4 mr-2" />
                      Registrar Entrada
                    </Button>
                    <Button
                      onClick={() => handleAttendanceAction('checkout')}
                      disabled={loading || !asistenciaHoy || (!asistenciaHoy.checkIn && !asistenciaHoy.manualCheckIn) || !!(asistenciaHoy.checkOut || asistenciaHoy.manualCheckOut)}
                      variant="outline"
                      size="sm"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Registrar Salida
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => openEditDialog(asistenciaHoy)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Editar Manual
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
                            <Textarea
                              id="notes"
                              placeholder="Notas adicionales sobre este registro..."
                              value={editForm.notes}
                              onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button type="button" variant="destructive" onClick={() => setEditingRecord(null)}>
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
              ) : (
                <p className="text-muted-foreground">No hay registro de asistencia para hoy</p>
              )}
            </div>
          )}

          {/* Botones de acción */}
          {selectedEmpleado && !asistenciaHoy && (
            <div className="flex gap-2">
              <Button
                onClick={() => handleAttendanceAction('checkin')}
                disabled={loading}
                className="flex-1"
              >
                <LogIn className="h-4 w-4 mr-2" />
                Registrar Entrada
              </Button>
              <Button
                onClick={() => handleAttendanceAction('checkout')}
                disabled={loading}
                variant="outline"
                className="flex-1"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Registrar Salida
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historial de asistencia */}
      {selectedEmpleado && historialAsistencia.length > 0 && (
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Historial de Asistencia (Últimos 30 días)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {historialAsistencia.map((record) => (
                <div key={record.attendanceId} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="font-medium">
                      {new Date(record.date).toLocaleDateString('es-ES', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short'
                      })}
                    </div>
                    {getStatusBadge(record.status, record.isManualEntry)}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Entrada:</span>
                      <span className="ml-1 font-medium">{formatTime(record.manualCheckIn || record.checkIn)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Salida:</span>
                      <span className="ml-1 font-medium">{formatTime(record.manualCheckOut || record.checkOut)}</span>
                    </div>
                    {record.totalHours && (
                      <div>
                        <span className="text-muted-foreground">Total:</span>
                        <span className="ml-1 font-medium">{Number(record.totalHours).toFixed(2)}h</span>
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(record)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}