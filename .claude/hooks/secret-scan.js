#!/usr/bin/env node
/*
 * PreToolUse-Hook (Write / Edit / MultiEdit / NotebookEdit)
 * Blockiert das Schreiben von Geheimnissen in Dateien dieses (oeffentlichen!) Repos.
 *
 * Warum: Ein einmal committeter API-Key ist auf GitHub oeffentlich – auch nach dem
 * Loeschen bleibt er in der Git-Historie. Darum wird schon das Schreiben verhindert.
 *
 * Exit 0 = ok, Exit 2 = blockiert (stderr geht als Begruendung an Claude).
 */
'use strict';

const PATTERNS = [
  { name: 'Anthropic-API-Key',        re: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: 'Telegram-Bot-Token',       re: /\b\d{8,10}:[A-Za-z0-9_-]{30,}/ },
  { name: 'Google-API-Key',           re: /AIza[0-9A-Za-z_-]{35}/ },
  { name: 'GitHub-Token',             re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { name: 'Private Key',              re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  // Dienstplan-Backend: CONFIG-Felder duerfen nur Platzhalter "HIER-..." oder leer enthalten
  { name: 'Echter Wert in CONFIG (statt HIER-Platzhalter)',
    re: /\b(TELEGRAM_TOKEN|ANTHROPIC_KEY|WEBHOOK_TOKEN|APP_PASSPHRASE)\s*:\s*['"](?!HIER-)[^'"]+['"]/ }
];

// Nur der NEUE Text wird geprueft (old_string darf den alten Inhalt enthalten).
function collectNewText(input) {
  const out = [];
  if (!input || typeof input !== 'object') return out;
  for (const key of ['content', 'new_string', 'new_source']) {
    if (typeof input[key] === 'string') out.push(input[key]);
  }
  if (Array.isArray(input.edits)) {
    input.edits.forEach(e => { if (e && typeof e.new_string === 'string') out.push(e.new_string); });
  }
  return out;
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => { raw += c; });
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(raw); } catch (e) { process.exit(0); } // kein JSON -> nicht blockieren
  const texts = collectNewText(data.tool_input);
  const file = (data.tool_input && data.tool_input.file_path) || '?';
  const hits = [];
  for (const t of texts) {
    for (const p of PATTERNS) if (p.re.test(t)) hits.push(p.name);
  }
  if (hits.length) {
    process.stderr.write(
      'BLOCKIERT (secret-scan): ' + [...new Set(hits)].join(', ') + ' in ' + file + '.\n' +
      'Dieses Repo ist oeffentlich. Geheimnisse gehoeren nicht in den Code ' +
      '(Apps Script: Projekteinstellungen -> Skripteigenschaften). Platzhalter "HIER-..." verwenden.\n'
    );
    process.exit(2);
  }
  process.exit(0);
});
