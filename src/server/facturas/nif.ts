/**
 * Comprobación de NIF españoles (DNI, NIE y CIF de empresas) con su dígito de
 * control. Para clientes de otros países se acepta el número de IVA tal cual.
 */
const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE';

export const normalizarNif = (nif: string) => nif.toUpperCase().replace(/[\s.-]/g, '').replace(/^ES(?=[0-9A-Z]{9}$)/, '');

export function nifValido(entrada: string): boolean {
  const nif = normalizarNif(entrada);
  if (/^\d{8}[A-Z]$/.test(nif)) return LETRAS_DNI[Number(nif.slice(0, 8)) % 23] === nif[8];
  if (/^[XYZ]\d{7}[A-Z]$/.test(nif)) {
    const numero = String('XYZ'.indexOf(nif[0])) + nif.slice(1, 8);
    return LETRAS_DNI[Number(numero) % 23] === nif[8];
  }
  if (/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(nif)) {
    const digitos = nif.slice(1, 8);
    let suma = 0;
    for (let i = 0; i < 7; i++) {
      const d = Number(digitos[i]);
      if (i % 2 === 0) {
        const doble = d * 2;
        suma += Math.floor(doble / 10) + (doble % 10);
      } else suma += d;
    }
    const control = (10 - (suma % 10)) % 10;
    const letra = 'JABCDEFGHI'[control];
    const final = nif[8];
    // Unas organizaciones llevan letra, otras número y otras cualquiera de los dos.
    if ('PQRSNW'.includes(nif[0])) return final === letra;
    if ('ABEH'.includes(nif[0])) return final === String(control);
    return final === letra || final === String(control);
  }
  return false;
}
