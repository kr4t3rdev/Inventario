interface JsonLdProps {
  data: object;
}

/**
 * @description Renderiza un bloque JSON-LD serializado para schema markup.
 * @param {JsonLdProps} props - Props del componente.
 * @returns {JSX.Element} Script de datos estructurados.
 */
export function JsonLd({ data }: JsonLdProps): React.JSX.Element {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
