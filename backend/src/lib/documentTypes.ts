export const ALLOWED_DOCUMENT_TYPES = new Set([
  "pdf",
  "docx",
  "doc",
  "xlsx",
  "xlsm",
  "xls",
  "pptx",
  "ppt",
]);

export const ALLOWED_DOCUMENT_TYPES_LABEL =
  "pdf, docx, doc, xlsx, xlsm, xls, pptx, ppt";

const WORD_TYPES = new Set(["docx", "doc"]);
const SPREADSHEET_TYPES = new Set(["xlsx", "xlsm", "xls"]);
const PRESENTATION_TYPES = new Set(["pptx", "ppt"]);

export function isWordDocumentType(fileType: string | null | undefined) {
  return WORD_TYPES.has((fileType ?? "").toLowerCase());
}

export function isSpreadsheetDocumentType(fileType: string | null | undefined) {
  return SPREADSHEET_TYPES.has((fileType ?? "").toLowerCase());
}

export function isPresentationDocumentType(fileType: string | null | undefined) {
  return PRESENTATION_TYPES.has((fileType ?? "").toLowerCase());
}

export function shouldConvertToPdf(fileType: string | null | undefined) {
  const normalized = (fileType ?? "").toLowerCase();
  // Spreadsheets are intentionally excluded: they are rendered natively as a
  // grid in the frontend (Fortune-sheet) from the raw file bytes rather than a
  // PDF rendition, which clipped wide/large sheets.
  return (
    isWordDocumentType(normalized) || isPresentationDocumentType(normalized)
  );
}

export function contentTypeForDocumentType(fileType: string | null | undefined) {
  switch ((fileType ?? "").toLowerCase()) {
    case "pdf":
      return "application/pdf";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "xlsm":
      return "application/vnd.ms-excel.sheet.macroEnabled.12";
    case "xls":
      return "application/vnd.ms-excel";
    case "pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "ppt":
      return "application/vnd.ms-powerpoint";
    default:
      return "application/octet-stream";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Magic-byte sniffing (QA BUG-1, 26/10/2026): the extension check alone let a
// 34-byte text file renamed to .pdf through upload — the failure only surfaced
// later when the assistant tried to read it. Validate the actual content
// before persisting: every accepted type has a well-known signature at the
// start of the file. Returns a human-readable problem, or null when valid.
// ─────────────────────────────────────────────────────────────────────────────

const MAGIC_BY_SUFFIX: Record<string, (bytes: Buffer) => boolean> = {
  pdf: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-",
  // OOXML formats are ZIP containers (PK\x03\x04).
  docx: isZipMagic,
  xlsx: isZipMagic,
  xlsm: isZipMagic,
  pptx: isZipMagic,
  // Legacy Office binaries are OLE2 compound files.
  doc: isOleMagic,
  xls: isOleMagic,
  ppt: isOleMagic,
};

function isZipMagic(b: Buffer): boolean {
  return b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
}

function isOleMagic(b: Buffer): boolean {
  return (
    b.length >= 8 &&
    b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0 &&
    b[4] === 0xa1 && b[5] === 0xb1 && b[6] === 0x1a && b[7] === 0xe1
  );
}

/**
 * Returns null when the buffer plausibly matches the declared type, or a
 * short error message describing the mismatch. Empty buffers are always
 * rejected. Kept intentionally permissive (signature-only) — deeper
 * structural validation belongs to the extraction pipeline.
 */
export function validateDocumentMagicBytes(
  suffix: string,
  buffer: Buffer,
): string | null {
  const check = MAGIC_BY_SUFFIX[suffix];
  if (!check) return null; // unknown-but-allowed type: no signature rule
  if (!buffer || buffer.length === 0) {
    return "The file is empty.";
  }
  if (!check(buffer)) {
    return `This file is not a valid .${suffix} document (its content does not match the ${suffix.toUpperCase()} format). It may be corrupted or renamed from another type.`;
  }
  return null;
}
