/*
 * SYNTHETISCHE Testzeilen im Format der pdf.js-Textextraktion eines BaBella-Stundennachweises.
 * Keine echten Daten: erfundene Zeitraeume, Klient "Musterhaus".
 * Echte Stundennachweise gehoeren nach private/ (gitignored) und NIE in dieses Repo.
 */
'use strict';

const LINES_NOV_2025 = [
  'Stundennachweis November 2025',
  'Mo 03.11.2025 Früh 8 > Musterhaus 06:00 14:30 30 Min. 100,0 % 08:00',
  'Di 04.11.2025 Spät 4 > Musterhaus 14:00 22:30 30 Min. 100,0 % 08:00',
  'Mi 05.11.2025 Frei 00:00 00:00 0 Min. 100,0 % 00:00',
  // Fall 1: kein Leerzeichen vor der Uhrzeit (Grund fuer \s* in ROW_RE)
  'Do 06.11.2025 zur besonderen Verwendung08:00 16:30 30 Min. 100,0 % 08:00',
  // Fall 2: "Nacht-Frei" ist KEIN Nachtdienst (Grund fuer SHIFT_RE mit Ziffer + ">")
  'Fr 07.11.2025 Nacht-Frei 00:00 00:00 0 Min. 100,0 % 00:00',
  'Sa 08.11.2025 Tag 8 > Musterhaus 06:00 18:30 120 Min. 100,0 % 10:00',
  // gleicher Tag, Zusatzzeile -> Haupt-Schichttyp bleibt "Tag"
  'Sa 08.11.2025 2h bei 12 Stunden 19:00 21:00 0 Min. 100,0 % 02:00',
  'So 09.11.2025 Nacht 4 > Musterhaus 22:00 06:30 30 Min. 100,0 % 08:00',
  'Mo 10.11.2025 Urlaub 00:00 00:00 0 Min. 100,0 % 08:00',
  'Gesamtdauer in Std.: 52,00',
  'Summe Ist-Arbeitszeit: 52,00'
];

module.exports = { LINES_NOV_2025 };
