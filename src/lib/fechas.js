// Fechas en hora LOCAL del salón (no UTC), para que "hoy" y "mañana" nunca se desfasen.
const dos = (n) => String(n).padStart(2, '0');
export const fechaLocal = (d = new Date()) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
export const diaLocal = (desplazamiento = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + desplazamiento);
  return fechaLocal(d);
};
