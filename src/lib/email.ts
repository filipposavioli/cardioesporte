/** Forma canônica de um e-mail: sem espaços nas pontas e em minúsculas. */
export function normalizarEmail(s: string): string {
  return s.trim().toLowerCase();
}
