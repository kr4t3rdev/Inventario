import { render, screen } from '@testing-library/react';

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

describe('Pagination navigation links', () => {
  it('Previous/Next usan el tamaño default para que el texto quepa dentro de la caja', () => {
    // Regresión: size="icon" (caja fija 40px) hacía que "Previous"/"Next"
    // desbordaran ~24px sobre los números de página y el hover se viera corrido.
    render(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href="#" />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#" isActive>
              1
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext href="#" />
          </PaginationItem>
        </PaginationContent>
      </Pagination>,
    );

    const previous = screen.getByRole('link', { name: /página anterior/i });
    const next = screen.getByRole('link', { name: /página siguiente/i });

    for (const link of [previous, next]) {
      expect(link).not.toHaveClass('size-10');
      expect(link).toHaveClass('h-10');
      expect(link).toHaveClass('py-2');
    }
  });

  it('etiqueta los controles de navegación en español', () => {
    render(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href="#" />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext href="#" />
          </PaginationItem>
        </PaginationContent>
      </Pagination>,
    );

    expect(screen.getByRole('link', { name: 'Ir a la página anterior' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a la página siguiente' })).toBeInTheDocument();
  });
});
