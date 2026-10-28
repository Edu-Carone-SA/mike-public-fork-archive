/**
 * QA BUG-1 follow-up (27/10/2026): the backend now rejects renamed/corrupt
 * files with a 400 ({ detail }) at upload time, but every upload catch in
 * the app only did console.error — the rejection was invisible to the
 * user, who thought the upload succeeded ("accepted silently").
 *
 * Parses the error thrown by mikeApi upload helpers (Error whose message
 * is the raw response body, usually JSON { detail }) into a human-readable
 * message naming the file, so surfaces can render it in their warning
 * banners instead of swallowing it.
 */
export function formatUploadErrorMessage(err: unknown, fileName?: string): string {
    let detail = "";
    if (err instanceof Error && err.message) {
        try {
            const parsed: unknown = JSON.parse(err.message);
            if (
                typeof parsed === "object" &&
                parsed !== null &&
                typeof (parsed as { detail?: unknown }).detail === "string"
            ) {
                detail = (parsed as { detail: string }).detail;
            } else {
                detail = err.message;
            }
        } catch {
            detail = err.message;
        }
    } else if (typeof err === "string") {
        detail = err;
    }
    const name = fileName && fileName.trim() ? ` "${fileName.trim()}"` : "";
    if (!detail) {
        return `Upload of${name || " the file"} failed. Please try again.`;
    }
    // Common transport-level text that adds nothing for the user.
    if (/^failed to fetch$/i.test(detail)) {
        return `Upload of${name || " the file"} failed — network error. Please try again.`;
    }
    return `Upload of${name || " the file"} failed: ${detail}`;
}
