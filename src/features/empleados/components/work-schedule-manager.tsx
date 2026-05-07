"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Clock, Save, User, Calendar, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { EmployeeWorkSchedule } from "@/app/models/model";

interface Empleado {
  empleadoId: string;
  nombre: string;
  apellido: string;
  cargo: string;
}

/**
 * Componente para gestión de horarios de trabajo de empleados
 * @returns Componente de gestión de horarios
 */
export function WorkScheduleManager() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [selectedEmpleado, setSelectedEmpleado] = useState("");
  const [workSchedules, setWorkSchedules] = useState<EmployeeWorkSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<EmployeeWorkSchedule | null>(null);

  const [scheduleForm, setScheduleForm] = useState({
    dayOfWeek: 1,
    startTime: "09:00",
    endTime: "17:00",
    breakStartTime: "12:00",
    breakEndTime: "13:00",
    isWorkingDay: true,
    scheduledHours: 8
  });

  const daysOfWeek = [
    { value: 0, label: "Domingo" },
    { value: 1, label: "Lunes" },
    { value: 2, label: "Martes" },
    { value: 3, label: "Miércoles" },
    { value: 4, label: "Jueves" },
    { value: 5, label: "Viernes" },
    { value: 6, label: "Sábado" }
  ];

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

  const fetchWorkSchedules = useCallback(async () => {
    if (!selectedEmpleado) return;

    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch(`/api/empleados/work-schedules?employeeId=${selectedEmpleado}`, {
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (response.ok) {
        const data = await response.json();
        setWorkSchedules(data);
      }
    } catch (error) {
      console.error("Error cargando horarios de trabajo:", error);
    }
  }, [selectedEmpleado]);

  // Cargar horarios de trabajo del empleado seleccionado
  useEffect(() => {
    if (selectedEmpleado) {
      fetchWorkSchedules();
    } else {
      setWorkSchedules([]);
    }
  }, [selectedEmpleado, fetchWorkSchedules]);

  const calculateScheduledHours = (startTime: string, endTime: string, breakStart?: string, breakEnd?: string) => {
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    let totalHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

    if (breakStart && breakEnd) {
      const breakStartTime = new Date(`2000-01-01T${breakStart}`);
      const breakEndTime = new Date(`2000-01-01T${breakEnd}`);
      const breakHours = (breakEndTime.getTime() - breakStartTime.getTime()) / (1000 * 60 * 60);
      totalHours -= breakHours;
    }

    return Math.max(0, totalHours);
  };

  const handleSaveSchedule = async () => {
    if (!selectedEmpleado) {
      toast.error("Selecciona un empleado primero");
      return;
    }

    setLoading(true);
    try {
      const calculatedHours = calculateScheduledHours(
        scheduleForm.startTime,
        scheduleForm.endTime,
        scheduleForm.breakStartTime,
        scheduleForm.breakEndTime
      );

      const scheduleData = {
        ...scheduleForm,
        employeeId: selectedEmpleado,
        scheduledHours: calculatedHours
      };

      const token = sessionStorage.getItem('token');
      const response = await fetch("/api/empleados/work-schedules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(scheduleData),
      });

      const data = await response.json();

      if (response.ok) {
        await fetchWorkSchedules(); // Refresh the list
        setScheduleForm({
          dayOfWeek: 1,
          startTime: "09:00",
          endTime: "17:00",
          breakStartTime: "12:00",
          breakEndTime: "13:00",
          isWorkingDay: true,
          scheduledHours: 8
        });
        toast.success("Horario guardado correctamente");
      } else {
        toast.error(data.error || "Error al guardar horario");
      }
    } catch (error) {
      console.error("Error guardando horario:", error);
      toast.error("Error interno del servidor");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch(`/api/empleados/work-schedules?scheduleId=${scheduleId}`, {
        method: "DELETE",
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (response.ok) {
        await fetchWorkSchedules(); // Refresh the list
        toast.success("Horario eliminado correctamente");
      } else {
        const data = await response.json();
        toast.error(data.error || "Error al eliminar horario");
      }
    } catch (error) {
      console.error("Error eliminando horario:", error);
      toast.error("Error interno del servidor");
    } finally {
      setLoading(false);
    }
  };

  const handleEditSchedule = (schedule: EmployeeWorkSchedule) => {
    setEditingSchedule(schedule);
    setScheduleForm({
      dayOfWeek: schedule.dayOfWeek,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      breakStartTime: schedule.breakStartTime || "12:00",
      breakEndTime: schedule.breakEndTime || "13:00",
      isWorkingDay: schedule.isWorkingDay,
      scheduledHours: Number(schedule.scheduledHours)
    });
  };

  const handleCancelEdit = () => {
    setEditingSchedule(null);
    setScheduleForm({
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "17:00",
      breakStartTime: "12:00",
      breakEndTime: "13:00",
      isWorkingDay: true,
      scheduledHours: 8
    });
  };

  const getScheduleForDay = (dayOfWeek: number) => {
    return workSchedules.find(schedule => schedule.dayOfWeek === dayOfWeek);
  };

  return (
    <div className="space-y-6">
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Gestión de Horarios de Trabajo
          </CardTitle>
          <CardDescription>
            Configura los horarios de trabajo por día para cada empleado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Selector de empleado */}
          <div className="space-y-2">
            <Label htmlFor="empleado-select">Seleccionar Empleado</Label>
            <Select value={selectedEmpleado} onValueChange={setSelectedEmpleado}>
              <SelectTrigger id="empleado-select">
                <SelectValue placeholder="Selecciona un empleado" />
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

          {selectedEmpleado && (
            <>
              {/* Formulario de horario */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {editingSchedule ? "Editar Horario" : "Nuevo Horario"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="day-select">Día de la semana</Label>
                      <Select
                        value={scheduleForm.dayOfWeek.toString()}
                        onValueChange={(value) => setScheduleForm(prev => ({ ...prev, dayOfWeek: parseInt(value) }))}
                      >
                        <SelectTrigger id="day-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {daysOfWeek.map((day) => (
                            <SelectItem key={day.value} value={day.value.toString()}>
                              {day.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="working-day">Día laboral</Label>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="working-day"
                          checked={scheduleForm.isWorkingDay}
                          onCheckedChange={(checked) => setScheduleForm(prev => ({ ...prev, isWorkingDay: checked }))}
                        />
                        <Label htmlFor="working-day">
                          {scheduleForm.isWorkingDay ? "Sí" : "No"}
                        </Label>
                      </div>
                    </div>
                  </div>

                  {scheduleForm.isWorkingDay && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="start-time">Hora de inicio</Label>
                          <Input
                            id="start-time"
                            type="time"
                            value={scheduleForm.startTime}
                            onChange={(e) => setScheduleForm(prev => ({ ...prev, startTime: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="end-time">Hora de fin</Label>
                          <Input
                            id="end-time"
                            type="time"
                            value={scheduleForm.endTime}
                            onChange={(e) => setScheduleForm(prev => ({ ...prev, endTime: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="break-start">Inicio de descanso</Label>
                          <Input
                            id="break-start"
                            type="time"
                            value={scheduleForm.breakStartTime}
                            onChange={(e) => setScheduleForm(prev => ({ ...prev, breakStartTime: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="break-end">Fin de descanso</Label>
                          <Input
                            id="break-end"
                            type="time"
                            value={scheduleForm.breakEndTime}
                            onChange={(e) => setScheduleForm(prev => ({ ...prev, breakEndTime: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Horas programadas calculadas: {calculateScheduledHours(
                          scheduleForm.startTime,
                          scheduleForm.endTime,
                          scheduleForm.breakStartTime,
                          scheduleForm.breakEndTime
                        ).toFixed(2)} horas</Label>
                      </div>
                    </>
                  )}

                  <div className="flex gap-2">
                    <Button onClick={handleSaveSchedule} disabled={loading}>
                      <Save className="h-4 w-4 mr-2" />
                      {editingSchedule ? "Actualizar" : "Guardar"} Horario
                    </Button>
                    {editingSchedule && (
                      <Button variant="outline" onClick={handleCancelEdit}>
                        Cancelar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Vista semanal de horarios */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Horarios Semanales</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
                    {daysOfWeek.map((day) => {
                      const schedule = getScheduleForDay(day.value);
                      return (
                        <div key={day.value} className="p-3 border rounded-lg">
                          <div className="font-medium text-sm mb-2">{day.label}</div>
                          {schedule ? (
                            <div className="space-y-1">
                              {schedule.isWorkingDay ? (
                                <>
                                  <div className="text-xs text-muted-foreground">
                                    {schedule.startTime} - {schedule.endTime}
                                  </div>
                                  {schedule.breakStartTime && schedule.breakEndTime && (
                                    <div className="text-xs text-muted-foreground">
                                      Descanso: {schedule.breakStartTime} - {schedule.breakEndTime}
                                    </div>
                                  )}
                                  <div className="text-xs font-medium">
                                    {Number(schedule.scheduledHours).toFixed(1)}h
                                  </div>
                                  <div className="flex gap-1 mt-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      onClick={() => handleEditSchedule(schedule)}
                                    >
                                      <Clock className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-destructive"
                                      onClick={() => handleDeleteSchedule(schedule.scheduleId)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </>
                              ) : (
                                <Badge variant="outline" className="text-xs">No laboral</Badge>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">Sin horario</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}