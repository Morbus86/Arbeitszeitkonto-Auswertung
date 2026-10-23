#!/usr/bin/env node
/*
 * PostToolUse-Hook (Write / Edit / MultiEdit)
 * Prueft die gerade geaenderte Datei auf Syntaxfehler, ohne sie auszufuehren:
 *   .js / .gs  -> JavaScript kompilieren (vm.Script)
 *   .html      -> jedes Inline-<script> ohne src kompilieren
 *   .json / .webmanifest -> JSON.parse
 *
 * Warum vm.Script statt "node --check": node lehnt die Endung .gs ab
 * (ERR_UNKNOWN_FILE_EXTENSION). vm.Script kompiliert nur – es laeuft nichts.
 *
 * Exit 2 bei Fehler: Die Aenderung ist schon geschrieben, aber Claude bekommt die
 * Fehlermeldung sofort zurueck und muss sie korrigieren.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function check(file) {
  const ext = path.extname(file).toLowerCase();
  const src = fs.readFileSync(file, 'utf8');
  if (ext === '.js' || ext === '.gs') {
    new vm.Script(src, { filename: file });
  } else if (ext === '.html') {
    const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
    let m, i = 0;
    while ((m = re.exec(src))) {
      i++;
      // Zeilennummer des Blocks im HTML ermitteln, damit Fehlermeldungen passen
      const line = src.slice(0, m.index).split('\n').length;
      new vm.Script(m[1], { filename: file + ' (Inline-Script #' + i + ')', lineOffset: line - 1 });
    }
  } else if (ext === '.json' || ext === '.webmanifest') {
    JSON.parse(src);
  }
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => { raw += c; });
process.stdin.on('end', () => {
  let file;
  try { file = JSON.parse(raw).tool_input.file_path; } catch (e) { process.exit(0); }
  if (!file || !fs.existsSync(file)) process.exit(0);
  try {
    check(file);
  } catch (err) {
    const where = (err.stack || '').split('\n')[0];
    process.stderr.write('SYNTAXFEHLER (syntax-check) in ' + file + ':\n' + where + '\n' + err.message + '\n');
    process.exit(2);
  }
  process.exit(0);
});
