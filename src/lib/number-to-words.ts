
export function numeroALetras(num: number, currency: { plural: string; singular: string; centPlural: string; centSingular: string } = { plural: 'PESOS', singular: 'PESO', centPlural: 'CENTAVOS', centSingular: 'CENTAVO' }): string {
  const data = {
    numero: num,
    enteros: Math.floor(num),
    centavos: Math.round(num * 100) - Math.floor(num) * 100,
    letrasCentavos: '',
    letrasMonedaPlural: currency.plural,
    letrasMonedaSingular: currency.singular,
    letrasMonedaCentavoPlural: currency.centPlural,
    letrasMonedaCentavoSingular: currency.centSingular
  };

  if (data.centavos > 0) {
    data.letrasCentavos = 'CON ' + (data.centavos === 1 ? '01' : data.centavos < 10 ? '0' + data.centavos : data.centavos) + '/100';
  } else {
    data.letrasCentavos = 'CON 00 /100';
  }

  if(data.enteros === 0) return `CERO ${data.letrasMonedaPlural} ${data.letrasCentavos}`;
  if (data.enteros === 1) return `UN ${data.letrasMonedaSingular} ${data.letrasCentavos}`;

  return `${millones(data.enteros)} ${data.letrasMonedaPlural} ${data.letrasCentavos}`;
}

function unidades(num: number): string {
  switch (num) {
    case 1: return 'UN';
    case 2: return 'DOS';
    case 3: return 'TRES';
    case 4: return 'CUATRO';
    case 5: return 'CINCO';
    case 6: return 'SEIS';
    case 7: return 'SIETE';
    case 8: return 'OCHO';
    case 9: return 'NUEVE';
    default: return '';
  }
}

function decenas(num: number): string {
  const decena = Math.floor(num / 10);
  const unidad = num - (decena * 10);

  switch (decena) {
    case 1:
      switch (unidad) {
        case 0: return 'DIEZ';
        case 1: return 'ONCE';
        case 2: return 'DOCE';
        case 3: return 'TRECE';
        case 4: return 'CATORCE';
        case 5: return 'QUINCE';
        default: return 'DIECI' + unidades(unidad);
      }
    case 2:
      switch (unidad) {
        case 0: return 'VEINTE';
        default: return 'VEINTI' + unidades(unidad);
      }
    case 3: return decenasY('TREINTA', unidad);
    case 4: return decenasY('CUARENTA', unidad);
    case 5: return decenasY('CINCUENTA', unidad);
    case 6: return decenasY('SESENTA', unidad);
    case 7: return decenasY('SETENTA', unidad);
    case 8: return decenasY('OCHENTA', unidad);
    case 9: return decenasY('NOVENTA', unidad);
    case 0: return unidades(unidad);
    default: return '';
  }
}

function decenasY(str: string, num: number): string {
  if (num > 0) return str + ' Y ' + unidades(num);
  return str;
}

function centenas(num: number): string {
  const centenas = Math.floor(num / 100);
  const decenasNum = num - (centenas * 100);

  switch (centenas) {
    case 1:
      if (decenasNum > 0) return 'CIENTO ' + decenas(decenasNum);
      return 'CIEN';
    case 2: return 'DOSCIENTOS ' + decenas(decenasNum);
    case 3: return 'TRECIENTOS ' + decenas(decenasNum);
    case 4: return 'CUATROCIENTOS ' + decenas(decenasNum);
    case 5: return 'QUINIENTOS ' + decenas(decenasNum);
    case 6: return 'SEISCIENTOS ' + decenas(decenasNum);
    case 7: return 'SETECIENTOS ' + decenas(decenasNum);
    case 8: return 'OCHOCIENTOS ' + decenas(decenasNum);
    case 9: return 'NOVECIENTOS ' + decenas(decenasNum);
    default: return decenas(decenasNum);
  }
}

function seccion(num: number, divisor: number, strSingular: string, strPlural: string): string {
  const cientos = Math.floor(num / divisor);
  const resto = num - (cientos * divisor);

  let letras = '';

  if (cientos > 0) {
    if (cientos > 1) {
      letras = centenas(cientos) + ' ' + strPlural;
    } else {
      letras = strSingular;
    }
  }

  if (resto > 0) {
    letras += '';
  }

  return letras;
}

function miles(num: number): string {
  const divisor = 1000;
  const cientos = Math.floor(num / divisor);
  const resto = num - (cientos * divisor);

  const strMiles = seccion(num, divisor, 'UN MIL', 'MIL');
  const strCentenas = centenas(resto);

  if (strMiles === '') return strCentenas;

  return strMiles + ' ' + strCentenas;
}

function millones(num: number): string {
  const divisor = 1000000;
  const cientos = Math.floor(num / divisor);
  const resto = num - (cientos * divisor);

  const strMillones = seccion(num, divisor, 'UN MILLON', 'MILLONES');
  const strMiles = miles(resto);

  if (strMillones === '') return strMiles;

  return strMillones + ' ' + strMiles;
}
