"use client";

import { useState, useEffect } from "react";
import { FileText, Search, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageTransition } from "@/components/ui/animations";
import { getAuditLogsAction } from "@/features/admin/actions";

interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: any;
  createdAt: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const result = await getAuditLogsAction({ limit: 100 });
      if (result.success && result.data) {
        setLogs(result.data);
        setFilteredLogs(result.data);
      }
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    let filtered = logs;

    if (searchQuery) {
      filtered = filtered.filter(log =>
        log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.entityType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.entityId.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filterAction !== "all") {
      filtered = filtered.filter(log => log.action === filterAction);
    }

    setFilteredLogs(filtered);
  }, [searchQuery, filterAction, logs]);

  const getActionBadgeColor = (action: string) => {
    const actionLower = action.toLowerCase();
    if (actionLower.includes("create") || actionLower.includes("crear")) return "bg-green-500";
    if (actionLower.includes("update") || actionLower.includes("actualizar")) return "bg-blue-500";
    if (actionLower.includes("delete") || actionLower.includes("eliminar")) return "bg-red-500";
    if (actionLower.includes("login")) return "bg-purple-500";
    return "bg-gray-500";
  };

  const uniqueActions = Array.from(new Set(logs.map(log => log.action)));

  return (
    <PageTransition className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 shadow-lg">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Logs de Auditoría</h1>
            <p className="text-muted-foreground text-sm">Historial de acciones en el sistema</p>
          </div>
        </div>
        <Button
          onClick={fetchLogs}
          variant="outline"
          disabled={isLoading}
          className="border-slate-200/70 bg-white/70 backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/60"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      <Card className="rounded-xl border bg-card/80 backdrop-blur-sm shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por usuario, acción, entidad..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">Todas las acciones</option>
                {uniqueActions.map(action => (
                  <option key={action} value={action}>{action}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border bg-card/80 backdrop-blur-sm shadow-sm">
        <CardHeader>
          <CardTitle>Historial de Acciones</CardTitle>
          <CardDescription>
            {filteredLogs.length} de {logs.length} registros
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {searchQuery || filterAction !== "all" ? "No se encontraron logs con los filtros aplicados" : "No hay logs de auditoría"}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="pb-3 pr-4 font-medium">Fecha</th>
                    <th className="pb-3 pr-4 font-medium">Usuario</th>
                    <th className="pb-3 pr-4 font-medium">Acción</th>
                    <th className="pb-3 pr-4 font-medium">Entidad</th>
                    <th className="pb-3 font-medium">ID</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="py-3 pr-4 text-xs">
                        {new Date(log.createdAt).toLocaleString("es-CU")}
                      </td>
                      <td className="py-3 pr-4 font-medium">{log.userName}</td>
                      <td className="py-3 pr-4">
                        <Badge className={getActionBadgeColor(log.action)}>
                          {log.action}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">{log.entityType}</td>
                      <td className="py-3 text-xs font-mono">{log.entityId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </PageTransition>
  );
}
