export async function hasUnrevertedAnticipoExecution(
  db: {
    anticipoMovimiento: {
      findMany: (args: any) => Promise<Array<{ anticipoId: string; tipoMovimiento: string }>>
    }
  },
  documentoDestinoId: string
) {
  const movimientos = await db.anticipoMovimiento.findMany({
    where: {
      documentoDestinoId,
      tipoMovimiento: {
        in: ['EJECUCION', 'REVERSO']
      }
    },
    select: {
      anticipoId: true,
      tipoMovimiento: true
    }
  })

  if (!movimientos.length) {
    return false
  }

  const balanceByAnticipo = new Map<string, number>()
  for (const mov of movimientos) {
    const current = balanceByAnticipo.get(mov.anticipoId) || 0
    if (mov.tipoMovimiento === 'EJECUCION') {
      balanceByAnticipo.set(mov.anticipoId, current + 1)
    } else if (mov.tipoMovimiento === 'REVERSO') {
      balanceByAnticipo.set(mov.anticipoId, current - 1)
    }
  }

  for (const balance of balanceByAnticipo.values()) {
    if (balance > 0) {
      return true
    }
  }

  return false
}
