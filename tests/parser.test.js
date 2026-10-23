/*
 * Parser-Tests – laufen mit reinem Node (>= 18), ohne npm-Abhaengigkeiten:
 *   node --test
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./load-app');
const { LINES_NOV_2025 } = require('./fixtures');

const app = loadApp();
const rows = app.parseLines(LINES_NOV_2025, 'test-nov.pdf');
const byDate = d => rows.filter(r => r.datum === d);

test('alle Tageszeilen werden erkannt, Kopf/Fusszeilen nicht', () => {
  assert.equal(rows.length, 9);
});

test('Felder einer normalen Zeile', () => {
  const [r] = byDate('03.11.2025');
  assert.equal(r.wochentag, 'Mo');
  assert.equal(r.dienstart, 'Früh 8 > Musterhaus');
  assert.equal(r.von, '06:00');
  assert.equal(r.bis, '14:30');
  assert.equal(r.pauseMin, 30);
  assert.equal(r.gesamtMin, 480);
  assert.equal(r.iso, '2025-11-03');
});

test('Regression: "zur besonderen Verwendung" ohne Leerzeichen vor der Uhrzeit', () => {
  const [r] = byDate('06.11.2025');
  assert.ok(r, 'Zeile wurde nicht erkannt – ROW_RE braucht \\s* vor der ersten Uhrzeit');
  assert.equal(r.dienstart, 'zur besonderen Verwendung');
  assert.equal(r.von, '08:00');
});

test('Regression: "Nacht-Frei" ist kein Nachtdienst', () => {
  assert.equal(app.shiftTypeOf('Nacht-Frei'), null);
  assert.equal(app.shiftTypeOf('Nacht 4 > Musterhaus'), 'Nacht');
  assert.equal(app.shiftTypeOf('Früh 8 > Musterhaus'), 'Früh');
});

test('Fusszeile: Gesamtdauer stimmt mit eigener Zeilensumme ueberein (Selbst-Check)', () => {
  const footer = app.extractFooterValues(LINES_NOV_2025);
  const summeStd = rows.reduce((s, r) => s + r.gesamtMin, 0) / 60;
  assert.equal(footer.gesamtdauer, 52);
  assert.equal(footer.istArbeitszeit, 52);
  assert.equal(summeStd, footer.gesamtdauer);
});

test('Aggregation: Schichtzaehlung pro Typ, Zusatzzeile zaehlt nicht als eigene Schicht', () => {
  const agg = app.aggregate(rows);
  assert.equal(agg.shiftStats['Früh'].count, 1);
  assert.equal(agg.shiftStats['Spät'].count, 1);
  assert.equal(agg.shiftStats['Tag'].count, 1);
  assert.equal(agg.shiftStats['Nacht'].count, 1);
  assert.equal(agg.totalWorkDays, 4);
  assert.equal(agg.urlaubDays, 1);
  // Samstag: Tag (10h) + Zusatzzeile (2h) = 12h am selben Tag
  const sa = agg.days.find(d => d.iso === '2025-11-08');
  assert.equal(sa.type, 'Tag');
  assert.equal(sa.totalMin, 720);
  // Wochenende 08./09.11. gearbeitet
  assert.equal(agg.weekendDaysWorked.length, 2);
});
