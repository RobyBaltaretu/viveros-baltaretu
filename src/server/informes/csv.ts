/** Texto no ejecutable en hojas de cálculo; los números siguen siendo números. */
export function campoCsv(valor: string | number): string {
  const texto = typeof valor === 'string' && /^[\s]*[=+\-@\t\r]/.test(valor) ? `'${valor}` : String(valor);
  return `"${texto.replaceAll('"', '""')}"`;
}
