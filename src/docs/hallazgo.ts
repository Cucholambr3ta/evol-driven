/** What a documentation check reports about a file. `archivo` is already safe to print. */
export interface DocFinding {
  archivo: string;
  mensaje: string;
  nivel: "bloqueo" | "aviso";
}
