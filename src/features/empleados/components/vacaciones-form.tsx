"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus, Palmtree, Clock, CheckCircle2, XCircle, Search, User, FileText, CalendarDays } from "lucide-react";
import { getEmpleadosAction, getVacacionesAction, getVacacionAccumulacionAction, createVacacionAction } from '@/features/empleados/actions';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { LazyMotion, m as motion, AnimatePresence } from "framer-motion";

interface Empleado {
  empleadoId: string;
  nombre: string;
  apellido: string;
  cargo: string;
  vacationDaysAccrued: number;
  vacationDaysUsed: number;
  fechaContratacion?: Date;
  diasVacacionesAnuales?: number;
}

interface VacationRequest {
  requestId: string;
  startDate: string;
  endDate: string;
  daysRequested: number;
  reason: string | null;
  status: string;
  createdAt: string;
  employee: Empleado;
}

/**
 * Componente mejorado para gestión de solicitudes de vacaciones con UI/UX Pro Max
 * @returns Componente de formulario de vacaciones
 */
export function VacacionesForm() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [selectedEmpleado, setSelectedEmpleado] = useState("");
  const [vacationRequests, setVacationRequests] = useState<VacationRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [employeeSummary, setEmployeeSummary] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Formulario
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  // Cargar lista de empleados
  useEffect(() => {
    getEmpleadosAction()
      .then((r) => { if (r.success) setEmpleados(r.data ?? []); })
      .catch((error) => console.error("Error cargando empleados:", error));
  }, []);

  // Cargar solicitudes de vacaciones
  useEffect(() => {
    getVacacionesAction({})
      .then((r) => { if (r.success) setVacationRequests(r.data ?? []); })
      .catch((error) => console.error("Error cargando solicitudes de vacaciones:", error));
  }, []);

  // Cargar resumen de vacaciones del empleado seleccionado
  useEffect(() => {
    if (!selectedEmpleado) {
      setEmployeeSummary(null);
      return;
    }
    getVacacionAccumulacionAction({ employeeId: selectedEmpleado })
      .then((r) => { if (r.success) setEmployeeSummary(r.data ?? null); })
      .catch((error) => console.error("Error cargando resumen de vacaciones:", error));
  }, [selectedEmpleado]);

  /**
   * Calcula los días de vacaciones disponibles para un empleado
   */
  const getAvailableDays = (empleado: Empleado) => {
    // Usar datos del resumen si está disponible, sino calcular con datos básicos
    if (employeeSummary && employeeSummary.resumen) {
      return employeeSummary.resumen.diasDisponibles;
    }
    return empleado.vacationDaysAccrued - empleado.vacationDaysUsed;
  };

  /**
   * Calcula los días entre dos fechas
   */
  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return 0;
    
    // Si la fecha fin es anterior a inicio, retornar 0
    if (endDate < startDate) return 0;
    
    return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  /**
   * Envía una solicitud de vacaciones
   */
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedEmpleado || !startDate || !endDate) {
      toast.error('Completá todos los campos requeridos');
      return;
    }

    const empleado = empleados.find(e => e.empleadoId === selectedEmpleado);
    if (!empleado) {
      toast.error('Empleado no encontrado');
      return;
    }

    const daysRequested = calculateDays(startDate, endDate);
    const availableDays = getAvailableDays(empleado);

    if (daysRequested <= 0) {
      toast.error('La fecha de fin debe ser posterior a la fecha de inicio');
      return;
    }

    if (daysRequested > availableDays) {
      toast.error(`Días insuficientes. Disponibles: ${availableDays}, Solicitados: ${daysRequested}`);
      return;
    }

    setLoading(true);
    try {
      const r = await createVacacionAction({
        employeeId: selectedEmpleado,
        startDate,
        endDate,
        reason: reason || undefined,
      });

      if (r.success) {
        setVacationRequests(prev => [r.data, ...prev]);
        setIsDialogOpen(false);
        setStartDate("");
        setEndDate("");
        setReason("");
        setSelectedEmpleado("");
        toast.success('Solicitud de vacaciones enviada correctamente');
      } else {
        toast.error(r.error?.message || 'Error al enviar solicitud');
      }
    } catch (error) {
      console.error("Error enviando solicitud:", error);
      toast.error('Error interno del servidor');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
      approved: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
      rejected: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
    };

    const icons = {
      pending: <Clock className="w-3 h-3 mr-1" />,
      approved: <CheckCircle2 className="w-3 h-3 mr-1" />,
      rejected: <XCircle className="w-3 h-3 mr-1" />
    };

    const label = {
      pending: 'Pendiente',
      approved: 'Aprobada',
      rejected: 'Rechazada'
    };

    const statusKey = status as keyof typeof variants;

    return (
      <Badge variant="outline" className={`${variants[statusKey] || variants.pending} flex items-center w-fit`}>
        {icons[statusKey] || icons.pending}
        {label[statusKey] || status}
      </Badge>
    );
  };

  // Filtrar solicitudes
  const filteredRequests = vacationRequests.filter(req => 
    req.employee.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.employee.apellido.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (req.reason && req.reason.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-8">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-center p-4 rounded-xl border shadow-sm bg-slate-900/10">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input 
            placeholder="Buscar solicitud..." 
            className="pl-10 bg-background/10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto bg-linear-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md hover:shadow-lg transition-all">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Solicitud
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] overflow-hidden">
            <DialogHeader className="bg-linear-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 p-6 -mx-6 -mt-6 border-b mb-6">
              <DialogTitle className="flex items-center gap-2 text-2xl text-orange-700 dark:text-orange-400">
                <Palmtree className="h-6 w-6" />
                Solicitar Vacaciones
              </DialogTitle>
              <DialogDescription>
                Crea una nueva solicitud de vacaciones para un empleado.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmitRequest} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="empleado" className="text-base font-semibold">Empleado</Label>
                  <Select value={selectedEmpleado} onValueChange={setSelectedEmpleado}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Selecciona un empleado" />
                    </SelectTrigger>
                    <SelectContent>
                      {empleados.map((empleado) => (
                        <SelectItem key={empleado.empleadoId} value={empleado.empleadoId} className="py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-900/10 flex items-center justify-center text-xs font-bold text-orange-700 dark:text-orange-400">
                              {empleado.nombre.charAt(0)}{empleado.apellido.charAt(0)}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-medium">{empleado.nombre} {empleado.apellido}</span>
                              <span className="text-xs text-muted-foreground">{empleado.cargo}</span>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Resumen de vacaciones del empleado seleccionado */}
                <AnimatePresence>
                  {employeeSummary && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-muted/50 rounded-xl p-4 border space-y-3"
                    >
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground border-b pb-2">
                        <FileText className="h-4 w-4" />
                        Resumen de Saldos
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="bg-background rounded-lg p-3 shadow-sm border">
                          <span className="text-xs text-muted-foreground block mb-1">Acumulados</span>
                          <span className="text-lg font-bold text-primary">{employeeSummary.resumen.diasAcumulados}</span>
                        </div>
                        <div className="bg-background rounded-lg p-3 shadow-sm border">
                          <span className="text-xs text-muted-foreground block mb-1">Usados</span>
                          <span className="text-lg font-bold text-orange-600">{employeeSummary.resumen.diasUsados}</span>
                        </div>
                        <div className="bg-background rounded-lg p-3 shadow-sm border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-900">
                          <span className="text-xs text-green-700 dark:text-green-400 block mb-1 font-medium">Disponibles</span>
                          <span className="text-2xl font-bold text-green-700 dark:text-green-400">{employeeSummary.resumen.diasDisponibles}</span>
                        </div>
                      </div>
                      {employeeSummary.empleado.fechaContratacion && (
                        <div className="text-xs text-center text-muted-foreground pt-1">
                          Fecha de contratación: {new Date(employeeSummary.empleado.fechaContratacion).toLocaleDateString()}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Fecha de Inicio</Label>
                    <div className="relative">
                      <CalendarDays className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        id="startDate"
                        type="date"
                        className="pl-10"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endDate">Fecha de Fin</Label>
                    <div className="relative">
                      <CalendarDays className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        id="endDate"
                        type="date"
                        className="pl-10"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        min={startDate || new Date().toISOString().split('T')[0]}
                      />
                    </div>
                  </div>
                </div>
                
                {startDate && endDate && (
                  <div className="flex justify-end">
                    <Badge variant="secondary" className="px-3 py-1">
                      Días solicitados: {calculateDays(startDate, endDate)}
                    </Badge>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="reason">Motivo (opcional)</Label>
                  <Textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Describe el motivo de la solicitud..."
                    className="resize-none"
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="bg-linear-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
                >
                  {loading ? "Enviando..." : "Enviar Solicitud"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-primary shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Solicitudes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vacationRequests.length}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-accent shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vacationRequests.filter(r => r.status === 'pending').length}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-chart-2 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Aprobadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vacationRequests.filter(r => r.status === 'approved').length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de solicitudes mejorada */}
      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-xl">Historial de Solicitudes</CardTitle>
          <CardDescription>Registro completo de todas las solicitudes realizadas</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center border rounded-xl bg-card border-dashed">
              <div className="p-4 bg-muted rounded-full mb-4">
                <Palmtree className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">No hay solicitudes</h3>
              <p className="text-muted-foreground max-w-sm mt-1">
                No se encontraron solicitudes de vacaciones que coincidan con tu búsqueda.
              </p>
              <Button 
                onClick={() => setIsDialogOpen(true)} 
                variant="outline" 
                className="mt-6"
              >
                Crear primera solicitud
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredRequests.map((request) => (
                <motion.div 
                  key={request.requestId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="overflow-hidden hover:shadow-md transition-shadow border-l-4 border-l-transparent hover:border-l-primary">
                    <CardContent className="p-0">
                      <div className="flex flex-col md:flex-row">
                        {/* Fecha y Estado (Left) */}
                        <div className="p-6 md:w-1/4 bg-muted/30 border-b md:border-b-0 md:border-r flex flex-col justify-center items-center md:items-start space-y-3">
                          <div className="text-center md:text-left">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fecha Solicitud</span>
                            <div className="font-medium">{new Date(request.createdAt).toLocaleDateString()}</div>
                          </div>
                          <div className="flex flex-col items-center md:items-start gap-1">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estado</span>
                            {getStatusBadge(request.status)}
                          </div>
                        </div>

                        {/* Detalles (Center/Right) */}
                        <div className="p-6 flex-1 flex flex-col justify-center">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                                {request.employee.nombre.charAt(0)}{request.employee.apellido.charAt(0)}
                              </div>
                              <div>
                                <h4 className="font-bold text-lg">{request.employee.nombre} {request.employee.apellido}</h4>
                                <span className="text-sm text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full">{request.employee.cargo}</span>
                              </div>
                            </div>
                            <div className="text-right hidden sm:block">
                              <span className="text-2xl font-bold">{request.daysRequested}</span>
                              <span className="text-xs text-muted-foreground block uppercase font-bold">Días</span>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">Desde:</span> {new Date(request.startDate).toLocaleDateString()}
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">Hasta:</span> {new Date(request.endDate).toLocaleDateString()}
                            </div>
                          </div>

                          {request.reason && (
                            <div className="mt-4 pt-4 border-t text-sm text-muted-foreground italic">
                              "{request.reason}"
                            </div>
                          )}
                          
                          <div className="sm:hidden mt-4 pt-4 border-t flex justify-between items-center">
                            <span className="font-medium">Total días:</span>
                            <span className="font-bold text-lg">{request.daysRequested}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
