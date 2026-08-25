import { NextResponse } from "next/server";

/**
 * @description Stub de handler para cuadre diario — funcionalidad migrada a server actions.
 */
export async function getCuadreDiarioHandler() {
  return NextResponse.json(
    { error: "Función migrada a server actions" },
    { status: 410 }
  );
}
