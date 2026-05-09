/**
 * @description Loading skeleton para la página de almacenes.
 * Se muestra mientras el Server Component resuelve las promesas de datos.
 * @returns {JSX.Element} Skeleton con animación CSS.
 */
export default function AlmacenLoading() {
  return (
    <div className="container mx-auto py-4 animate-pulse">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-xl bg-primary/10" />
        <div>
          <div className="h-8 w-48 rounded bg-primary/10 mb-2" />
          <div className="h-4 w-64 rounded bg-primary/10" />
        </div>
      </div>
      <div className="h-96 w-full rounded-lg bg-primary/10" />
    </div>
  )
}
