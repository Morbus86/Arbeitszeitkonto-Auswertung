# BaBella Stunden-Auswertung

Client-seitige Web-App (PWA): liest BaBella-Stundennachweise (PDF) im Browser per pdf.js,
wertet Schichten, Wochenenden, Feiertage und das Soll/Ist-Konto aus, Export als CSV/XLSX.
Kein Server, kein Build, keine npm-Abhängigkeiten. Läuft über GitHub Pages.

## Dateien
- `index.html` – UI, lädt pdf.js 3.11.174 und SheetJS 0.18.5 vom CDN (cdnjs), dann `app.js`
- `app.js` – gesamte Logik: PDF-Text → Zeilen → `parseLines()` → `aggregate()` / `computeKonto()` → Render
- `sw.js` – Service Worker, Cache-Name `CACHE` (network-first für App-Shell)
- `tests/` – Node-Tests mit **synthetischen** Zeilen (`node --test`)

## Datenfluss in app.js
1. `extractLines()` – pdf.js-Textobjekte nach y-Koordinate (±3 px) zu Zeilen gruppieren
2. `parseLines()` – jede Zeile gegen `ROW_RE`: Wochentag, Datum, Dienstart, von, bis, Pause, Faktor, Gesamt
3. `extractFooterValues()` – „Gesamtdauer in Std.“ (= Selbst-Check gegen eigene Zeilensumme) und „Summe Ist-Arbeitszeit“ (BaBellas Kontostand, kann abweichen)
4. `aggregate()` – pro Kalendertag Haupt-Schichttyp = Schichtzeile mit den meisten Minuten
5. `computeKonto()` – Soll = Wochenstunden/Arbeitstage je Mo–Fr ohne Feiertag, pro Datei-Zeitraum (Lücken zwischen Monaten werden nicht überbrückt)

## Fachregeln (nicht ohne Rückfrage ändern)
- Echte Schicht nur bei `SHIFT_RE`: Präfix + Ziffer + `>` (z. B. „Früh 8 > …“). Grund: „Nacht-Frei“ ist kein Nachtdienst.
- `ROW_RE` nutzt `\s*` vor der ersten Uhrzeit. Grund: „zur besonderen Verwendung“ hat in der Extraktion kein Leerzeichen davor.
- Zusatzzeile „2h bei 12 Stunden“ gehört zum Tagdienst desselben Tages, ist keine eigene Schicht.
- Ignorierte Dienstarten: Frei, Einarbeitung, Urlaub, Wunschfrei, WX.
- Feiertage: BaBella rechnet nach **Baden-Württemberg** (Firmensitz Mannheim), nicht nach Hessen.
- Zahlen im PDF haben deutsches Format (`1.234,56`) – beim Parsen Tausenderpunkt entfernen, Komma → Punkt.

## Datenschutz – hart
- Repo ist **öffentlich**. Echte Stundennachweise enthalten personenbezogene Daten (eigene und von Klienten).
- Echte PDFs nur lokal in `private/` (gitignored). Nie lesen, nie zitieren, nie in Tests oder Commits übernehmen.
- Testdaten nur synthetisch: erfundene Daten, Klient „Musterhaus“, keine echten Namen.
- Keine API-Keys/Tokens im Code. Hook `secret-scan` blockiert das automatisch.

## Arbeitsweise
- Erst erklären und Vorschau zeigen, umsetzen erst nach ausdrücklichem **„bau“**. Bei Unsicherheit fragen, nicht raten.
- Bei Fehlern erklären, **warum** sie entstanden sind (Lernziel), nicht nur fixen.
- Antworten auf Deutsch, kurz und direkt.
- Nach jeder Änderung an `app.js`: `node --test`. Neue Fehlerfälle als Regressionstest in `tests/` ergänzen.
- Nie direkt auf `main` pushen: eigener Branch + Pull Request.
- Bei Änderungen an ausgelieferten Dateien `CACHE` in `sw.js` hochzählen (siehe `/release`).

## Hooks & Skills
- `secret-scan` (vor jedem Schreiben): blockiert Keys/Tokens
- `syntax-check` (nach jedem Schreiben): kompiliert `.js`, Inline-Scripts in `.html`, prüft `.json`
- `/parser-test [Zeile]` – Tests laufen lassen, neue Zeile gegen die Regex prüfen
- `/release [Beschreibung]` – Cache-Version, Changelog
