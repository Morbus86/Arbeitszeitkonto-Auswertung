/*
 * Feiertage Baden-Württemberg (BaBella rechnet nach Firmensitz Mannheim).
 * Referenzdaten 2026: Ostersonntag = 05.04.2026.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./load-app');

const app = loadApp();

test('BW 2026: genau 12 gesetzliche Feiertage mit korrekten Daten', () => {
  const f = app.bwFeiertage(2026);
  assert.deepEqual(Object.keys(f).sort(), [
    '2026-01-01', // Neujahr
    '2026-01-06', // Heilige Drei Könige (BW, nicht Hessen)
    '2026-04-03', // Karfreitag
    '2026-04-06', // Ostermontag
    '2026-05-01', // Tag der Arbeit
    '2026-05-14', // Christi Himmelfahrt
    '2026-05-25', // Pfingstmontag
    '2026-06-04', // Fronleichnam
    '2026-10-03', // Tag der Deutschen Einheit
    '2026-11-01', // Allerheiligen (BW, nicht Hessen)
    '2026-12-25',
    '2026-12-26'
  ]);
  assert.equal(f['2026-01-06'], 'Heilige Drei Könige');
  assert.equal(f['2026-11-01'], 'Allerheiligen');
});

test('Soll/Ist: 06.01.2026 (Di) senkt das Soll um einen Arbeitstag', () => {
  // Synthetische Woche Mo 05.01. – Fr 09.01.2026
  const lines = [
    'Mo 05.01.2026 Früh 8 > Musterhaus 06:00 14:30 30 Min. 100,0 % 08:00',
    'Di 06.01.2026 Frei 00:00 00:00 0 Min. 100,0 % 00:00',
    'Mi 07.01.2026 Früh 8 > Musterhaus 06:00 14:30 30 Min. 100,0 % 08:00',
    'Do 08.01.2026 Früh 8 > Musterhaus 06:00 14:30 30 Min. 100,0 % 08:00',
    'Fr 09.01.2026 Früh 8 > Musterhaus 06:00 14:30 30 Min. 100,0 % 08:00'
  ];
  const rows = app.parseLines(lines, 'test-jan.pdf');
  const konto = app.computeKonto(rows, 40, 5);
  assert.equal(konto.sollMin, 4 * 8 * 60); // 4 Arbeitstage, nicht 5
  assert.equal(konto.istMin, 4 * 8 * 60);
  assert.equal(konto.saldoMin, 0);
});
