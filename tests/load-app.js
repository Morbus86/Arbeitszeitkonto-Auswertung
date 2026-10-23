/*
 * Laedt app.js in eine isolierte Node-VM, ohne Browser.
 * DOM, pdf.js und SheetJS werden durch einen "Alles-schluckt"-Stub ersetzt,
 * damit die UI-Zeilen beim Laden nicht abstuerzen. Getestet wird nur die reine Logik.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Ein Objekt, das jeden Zugriff und jeden Aufruf mit sich selbst beantwortet.
function blackhole() {
  const fn = function () { return proxy; };
  const proxy = new Proxy(fn, {
    get: (t, k) => (k === Symbol.toPrimitive ? () => '' : proxy),
    set: () => true,
    apply: () => proxy
  });
  return proxy;
}

function loadApp() {
  const file = path.join(__dirname, '..', 'app.js');
  const src = fs.readFileSync(file, 'utf8') +
    '\n;globalThis.__app = { parseLines, extractFooterValues, shiftTypeOf, isIgnored,' +
    ' aggregate, computeKonto, ROW_RE, SHIFT_RE };';
  const sandbox = {
    pdfjsLib: blackhole(), XLSX: blackhole(),
    document: blackhole(), window: blackhole(), navigator: {},
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: file });
  return sandbox.__app;
}

module.exports = { loadApp };
