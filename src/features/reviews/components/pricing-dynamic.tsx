"use client";

import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Users,
  Archive,
  Package,
  Building2,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SpringSection } from "@/features/landing/utils";
import {
  type PlanDisplay,
} from "@/features/planes";
import { getPlansPublicAction } from "@/features/planes";

/** Iconos por categoría de feature */
const CATEGORY_ICONS: Record<string, string> = {
  Inventario: "📦",
  Operaciones: "🏭",
  Ventas: "🛒",
  Compras: "📋",
  Financiero: "💰",
  Producción: "⚙️",
  "RRHH": "👥",
  "Empresa y Configuración": "⚡",
  Infraestructura: "🛡️",
};

/**
 * @description Sección de planes y precios con datos reales desde la BD.
 * Muestra módulos agrupados por categoría y límites del plan.
 * @returns {JSX.Element | null} Grid de planes o null
 */
export function PricingDynamic(): React.JSX.Element | null {
  const [plans, setPlans] = useState<PlanDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    getPlansPublicAction()
      .then((data) => setPlans(data))
      .catch(() => setHasError(true))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <section id="precios" className="space-y-10 scroll-mt-24">
      <SpringSection reduceMotion={Boolean(reduceMotion)} className="mx-auto max-w-3xl space-y-3 text-center">
        <span className="inline-flex rounded-full border border-cyan-accent bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-accent font-mono">
          Planes
        </span>
        <h2 className="text-4xl font-bold tracking-tight sm:text-5xl font-mono leading-[1.05] tracking-display">
          Escalá con un plan alineado a tu operación
        </h2>
        <p className="text-muted-foreground sm:text-lg">
          Elegí una base sólida para tu negocio y evolucioná sin migraciones
          complejas.
        </p>
        <p className="text-sm text-cyan-accent/90 sm:text-base">
          Los tenants elegibles también pueden acumular crédito y perks mediante el programa de
          referidos.
        </p>
      </SpringSection>

      {isLoading || hasError || plans.length === 0 ? (
        <div className="mx-auto max-w-2xl rounded-xl border border-border/60 bg-card/70 p-8 text-center">
          <h3 className="text-xl font-semibold font-mono">
            {isLoading ? "Cargando planes" : "Conocé la opción adecuada para tu operación"}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {isLoading
              ? "Estamos consultando la información comercial actualizada."
              : "Nuestro equipo puede orientarte con información vigente y una propuesta acorde a tu negocio."}
          </p>
          <Button asChild className="mt-5 gap-2">
            <Link href="#contacto">
              {isLoading ? "Hablar con el equipo" : "Solicitar orientación"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      ) : (
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan, index) => (
          <motion.div
            key={plan.planId}
            initial={reduceMotion ? false : { y: 20 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={reduceMotion ? undefined : {
              type: "spring",
              stiffness: 120,
              damping: 20,
              delay: index * 0.1,
            }}
            whileHover={reduceMotion ? undefined : {
              y: -8,
              scale: plan.featured ? 1.025 : 1.015,
              transition: { type: "spring", stiffness: 200, damping: 12 },
            }}
          >
            <Card
              className={`h-full border-border/60 bg-card/85 shadow-md transition-all duration-300 flex flex-col ${
                plan.featured
                  ? "border-primary/35 bg-primary/[0.05] shadow-primary/10 hover:shadow-primary/20"
                  : "shadow-black/[0.03] hover:shadow-lg hover:border-primary/20"
              }`}
            >
              <CardHeader className="space-y-3">
                {plan.featured ? (
                  <span className="w-fit rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary font-mono">
                    Recomendado
                  </span>
                ) : null}
                <span className="w-fit rounded-full border border-cyan-accent/30 bg-cyan-accent/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-cyan-accent font-mono">
                  Referidos para tenants elegibles
                </span>
                <CardTitle className="text-2xl font-mono">
                  {plan.name}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {plan.description}
                </p>

                {/* Price */}
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold font-mono">
                    ${plan.price.toLocaleString()}
                  </span>
                  <span className="text-sm text-muted-foreground font-mono">
                    USD / mes
                  </span>
                </div>

                {/* Límites como badges */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Badge
                    variant="outline"
                    className="text-[10px] font-normal gap-1"
                  >
                    <Users className="h-3 w-3" />
                    {plan.limits.maxUsuarios >= 999
                      ? "∞ usuarios"
                      : `${plan.limits.maxUsuarios} usuarios`}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-normal gap-1"
                  >
                    <Archive className="h-3 w-3" />
                    {plan.limits.maxAlmacenes >= 999
                      ? "∞ almacenes"
                      : `${plan.limits.maxAlmacenes} almacenes`}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-normal gap-1"
                  >
                    <Package className="h-3 w-3" />
                    {plan.limits.maxProductos >= 999999
                      ? "∞ productos"
                      : `${plan.limits.maxProductos.toLocaleString()} prod.`}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-normal gap-1"
                  >
                    <Building2 className="h-3 w-3" />
                    {plan.limits.maxPuntosVenta >= 999
                      ? "∞ PDV"
                      : `${plan.limits.maxPuntosVenta} PDV`}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 flex-1 flex flex-col">
                {/* Módulos agrupados por categoría */}
                {Object.entries(plan.featuresByCategory).length > 0 && (
                  <div className="space-y-2.5 flex-1">
                    {Object.entries(plan.featuresByCategory).map(
                      ([category, features]) => (
                        <div key={category}>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                            {CATEGORY_ICONS[category] || "📋"} {category}
                          </p>
                          <ul className="space-y-1">
                            {features.map((feature) => (
                              <li
                                key={feature}
                                className="flex items-start gap-2 text-xs"
                              >
                                <CheckCircle2 className="mt-[2px] h-3 w-3 text-primary shrink-0" />
                                <span>{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ),
                    )}
                  </div>
                )}

                {/* CTA */}
                  <Button asChild className="mt-auto w-full gap-2" variant={plan.featured ? "default" : "outline"}>
                    <Link href="#contacto">
                    {plan.cta}
                    <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
      )}
    </section>
  );
}
