import { describe, expect, it } from "vitest";
import {
  validateDocumentMagicBytes,
} from "../src/lib/documentTypes";

// QA BUG-1 (26/10/2026): a 34-byte text file renamed to .pdf passed the
// extension-only upload check. The magic-byte sniff must reject it.
const FAKE_PDF = Buffer.from("isto nao e um pdf de verdade, so texto\n", "latin1");

const REAL_PDF = Buffer.concat([
  Buffer.from("%PDF-1.7\n", "latin1"),
  Buffer.alloc(64, 0x00),
]);

const REAL_DOCX = Buffer.concat([
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.alloc(64, 0x01),
]);

const REAL_DOC = Buffer.concat([
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  Buffer.alloc(64, 0x02),
]);

describe("validateDocumentMagicBytes (QA BUG-1)", () => {
  it("rejects a 34-byte text file renamed to .pdf", () => {
    const problem = validateDocumentMagicBytes("pdf", FAKE_PDF);
    expect(problem).toBeTruthy();
    expect(problem).toMatch(/not a valid .pdf/i);
  });

  it("rejects an empty buffer for every known type", () => {
    for (const suffix of ["pdf", "docx", "doc", "xlsx", "pptx"]) {
      expect(validateDocumentMagicBytes(suffix, Buffer.alloc(0))).toBeTruthy();
    }
  });

  it("accepts real signatures: pdf, zip-based docx/xlsx/pptx, OLE doc", () => {
    expect(validateDocumentMagicBytes("pdf", REAL_PDF)).toBeNull();
    expect(validateDocumentMagicBytes("docx", REAL_DOCX)).toBeNull();
    expect(validateDocumentMagicBytes("xlsx", REAL_DOCX)).toBeNull();
    expect(validateDocumentMagicBytes("pptx", REAL_DOCX)).toBeNull();
    expect(validateDocumentMagicBytes("doc", REAL_DOC)).toBeNull();
    expect(validateDocumentMagicBytes("xls", REAL_DOC)).toBeNull();
  });

  it("cross-type mismatch is rejected (docx content declared as pdf)", () => {
    expect(validateDocumentMagicBytes("pdf", REAL_DOCX)).toBeTruthy();
    expect(validateDocumentMagicBytes("docx", REAL_PDF)).toBeTruthy();
  });

  it("returns null for suffixes without a signature rule", () => {
    expect(validateDocumentMagicBytes("zzz", FAKE_PDF)).toBeNull();
  });
});
