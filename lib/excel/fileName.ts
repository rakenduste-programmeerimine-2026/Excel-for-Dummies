// File name contract (CLAUDE.md): <project-name>-<yyyy-mm-dd>.xlsx, sent with an RFC 5987
// filename* parameter because project names like "Õie tänav 5" contain non-ASCII letters.

const FORBIDDEN = /[\\/:*?"<>|\u0000-\u001f\u007f]/g;

/** yyyy-mm-dd of `date` in Tallinn time. */
export function isoDateInTallinn(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Tallinn', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** "Õie tänav 5" + 19.11.2026 -> "Õie tänav 5-2026-11-19.xlsx". Characters Windows forbids become "-". */
export function exportFileName(projectName: string, exportDate: Date): string {
  const name = projectName.replace(/\s+/g, ' ').replace(FORBIDDEN, '-').trim().replace(/^\.+/, '').slice(0, 120).trim() || 'projekt';
  return `${name}-${isoDateInTallinn(exportDate)}.xlsx`;
}

/** Plain-ASCII version for old clients: "Õie tänav 5-…" -> "Oie tanav 5-…". */
export function asciiFallback(fileName: string): string {
  return fileName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '_');
}

/** RFC 5987 encoding: percent-encode everything except attr-char. */
function encodeRfc5987(value: string): string {
  return encodeURIComponent(value).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function contentDisposition(fileName: string): string {
  return `attachment; filename="${asciiFallback(fileName)}"; filename*=UTF-8''${encodeRfc5987(fileName)}`;
}
