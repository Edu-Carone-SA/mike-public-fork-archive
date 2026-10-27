import { describe, expect, it } from "vitest";
import { safeGeneratedFilename } from "../src/lib/chat/tools/documentOps";

// QA OBS-4: generated filenames must keep accented base letters and
// underscores instead of mangling "Cláusulas Típicas" → "Clusulas Tpicas".
describe("safeGeneratedFilename (QA OBS-4)", () => {
  it("preserves accented base letters via NFD stripping", () => {
    expect(safeGeneratedFilename("Resumo Cláusulas Típicas Prestação", "docx")).toBe(
      "Resumo Clausulas Tipicas Prestacao.docx",
    );
  });

  it("keeps underscores as separators", () => {
    expect(safeGeneratedFilename("QAG5_Grande_Contrato", "docx")).toBe(
      "QAG5_Grande_Contrato.docx",
    );
  });

  it("still strips unsafe characters", () => {
    expect(safeGeneratedFilename("a/b\\c:d*e?f\"g<h>i|j", "pdf")).toBe("abcdefghij.pdf");
  });

  it("falls back to 'document' when nothing survives", () => {
    expect(safeGeneratedFilename("###", "pdf")).toBe("document.pdf");
  });
});
