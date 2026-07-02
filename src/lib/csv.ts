// Minimal, correct CSV serialization (RFC 4180). No dependency needed.
// Handles the fields that actually break naive CSV: commas, quotes, newlines,
// and — importantly for a spreadsheet — leading "+" on phone numbers and any
// value that Excel might interpret as a formula (=, +, -, @).

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = String(value);

  // CSV-injection / formula guard: prefix a risky leading char with a quote.
  // (Phone numbers start with "+", so this also keeps them intact as text.)
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;

  // Quote if the cell contains a comma, quote, or newline.
  if (/[",\n\r]/.test(s)) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function toCsv(
  headers: string[],
  rows: (unknown[])[],
): string {
  const lines = [headers.map(escapeCell).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(","));
  }
  // \r\n line endings for maximum spreadsheet compatibility.
  return lines.join("\r\n");
}
