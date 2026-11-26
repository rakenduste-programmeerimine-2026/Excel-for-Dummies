// Recalculates .xlsx files with headless LibreOffice and returns each first sheet as CSV rows.
// LibreOffice normally trusts the cached formula results stored in the file; this uses a private
// profile with "always recalculate on load" for Excel files, so every formula is really computed.
import { execFile } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);

const ALWAYS_RECALC = `<?xml version="1.0" encoding="UTF-8"?>
<oor:items xmlns:oor="http://openoffice.org/2001/registry" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<item oor:path="/org.openoffice.Office.Calc/Formula/Load"><prop oor:name="OOXMLRecalcMode" oor:op="fuse"><value>0</value></prop></item>
</oor:items>
`;

// CSV export: comma, quote, UTF-8, from row 1, language en-US (1033), cell values not "as shown".
const CSV_FILTER = 'csv:Text - txt - csv (StarCalc):44,34,76,1,,1033,false,false,false,false';

export async function libreOfficeAvailable(): Promise<boolean> {
  try {
    await run('soffice', ['--version'], { timeout: 60_000 });
    return true;
  } catch {
    return false;
  }
}

/** Minimal CSV parser (quoted fields, "" escapes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Converts all files in one LibreOffice run (much faster than one run per file). */
export async function recalculate(files: Record<string, Uint8Array>): Promise<Record<string, string[][]>> {
  const dir = mkdtempSync(join(tmpdir(), 'parity-'));
  try {
    const profile = join(dir, 'profile');
    mkdirSync(join(profile, 'user'), { recursive: true });
    writeFileSync(join(profile, 'user', 'registrymodifications.xcu'), ALWAYS_RECALC);
    const inputs = Object.entries(files).map(([name, bytes]) => {
      const path = join(dir, `${name}.xlsx`);
      writeFileSync(path, bytes);
      return path;
    });
    await run('soffice', [`-env:UserInstallation=${pathToFileURL(profile).href}`, '--headless', '--convert-to', CSV_FILTER, '--outdir', dir, ...inputs], {
      timeout: 300_000,
    });
    return Object.fromEntries(Object.keys(files).map((name) => [name, parseCsv(readFileSync(join(dir, `${name}.csv`), 'utf8'))]));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
