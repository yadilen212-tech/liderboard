/**
 * Typed parse failures. Separate from parse.ts so UI code can catch/inspect them
 * without pulling SheetJS into the initial bundle.
 */

export type PygParseErrorCode =
  | "invalid-file"
  | "no-accounts"
  | "no-header"
  | "consolidated-unsupported";

const MESSAGES: Record<PygParseErrorCode, string> = {
  "invalid-file": "No se pudo leer el archivo. Verifica que sea un Excel (.xls o .xlsx) válido.",
  "no-accounts": "El archivo no contiene filas de cuentas contables reconocibles.",
  "no-header": "No se encontró la fila de cabecera con los períodos del reporte.",
  "consolidated-unsupported":
    "Este archivo es un consolidado por centros de costo; ese formato estará disponible próximamente. Sube el reporte mensual.",
};

export class PygParseError extends Error {
  readonly code: PygParseErrorCode;

  constructor(code: PygParseErrorCode) {
    super(MESSAGES[code]);
    this.name = "PygParseError";
    this.code = code;
  }
}
