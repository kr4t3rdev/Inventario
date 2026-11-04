/**
 * @description Muestra la precarga mientras el servidor obtiene las listas de precios.
 * @returns {JSX.Element} Esqueleto de la pantalla de gestión.
 */
export default function ListasPreciosLoading() {
  return (
    <div role='status' className='container mx-auto px-4 py-4'>
      <span className='sr-only'>Cargando listas de precios</span>
      <div aria-hidden='true' className='space-y-6 motion-safe:animate-pulse'>
        <div className='flex items-center gap-3'>
          <div className='size-10 rounded-xl bg-primary/10' />
          <div className='min-w-0 space-y-2'>
            <div className='h-8 w-48 max-w-full rounded bg-primary/10' />
            <div className='h-4 w-64 max-w-full rounded bg-primary/10' />
          </div>
        </div>
        <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
          {['total', 'default', 'prices', 'points'].map((metric) => (
            <div key={metric} className='h-20 rounded-lg bg-primary/10' />
          ))}
        </div>
        <div className='h-36 rounded-lg bg-primary/10' />
        <div className='h-96 rounded-lg bg-primary/10' />
      </div>
    </div>
  );
}
