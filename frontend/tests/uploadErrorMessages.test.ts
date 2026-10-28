import { describe, expect, it } from "vitest";
import { formatUploadErrorMessage } from "../src/app/lib/uploadErrorMessages";

// QA BUG-1 follow-up (27/10/2026): upload rejections must be user-visible.
// mikeApi helpers throw Error(message = raw response body), usually JSON
// with a { detail } payload from the backend (400 invalid magic bytes).
describe("formatUploadErrorMessage", () => {
  it("extracts detail from a JSON body error", () => {
    const err = new Error(
      JSON.stringify({
        detail:
          "File appears to be invalid or corrupt: its content does not match a valid .pdf file.",
      }),
    );
    expect(formatUploadErrorMessage(err, "fake.pdf")).toBe(
      'Upload of "fake.pdf" failed: File appears to be invalid or corrupt: its content does not match a valid .pdf file.',
    );
  });

  it("falls back to the raw message when the body is not JSON", () => {
    expect(formatUploadErrorMessage(new Error("gateway timeout"), "a.pdf")).toBe(
      'Upload of "a.pdf" failed: gateway timeout',
    );
  });

  it("handles network-level failures", () => {
    expect(formatUploadErrorMessage(new Error("Failed to fetch"))).toBe(
      "Upload of the file failed — network error. Please try again.",
    );
  });

  it("handles non-Error and empty payloads", () => {
    expect(formatUploadErrorMessage("boom", "x.docx")).toBe(
      'Upload of "x.docx" failed: boom',
    );
    expect(formatUploadErrorMessage(null)).toBe(
      "Upload of the file failed. Please try again.",
    );
  });
});
