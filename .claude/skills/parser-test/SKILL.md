---
name: parser-test
description: Parser-Tests ausführen und bei Fehlern die Ursache in ROW_RE/SHIFT_RE/Aggregation erklären. Nutzen nach jeder Änderung an app.js oder bei neuen Zeilenformaten aus BaBella-Stundennachweisen.
argument-hint: "[optional: neue Beispielzeile in Anführungszeichen]"
allowed-tools: Bash(node --test) Bash(node --test *)
---

1. Führe `node --test` im Repo-Root aus.
2. Bei Fehlern: Erkläre für jeden fehlgeschlagenen Test **warum** er scheitert (welcher Regex-Teil, welche Annahme), bevor du etwas änderst. Schlage den Fix vor und warte auf Freigabe ("bau").
3. Wenn eine neue Beispielzeile übergeben wurde (`$ARGUMENTS`):
   - Prüfe sie gegen `ROW_RE` und `SHIFT_RE` und zeige die erkannten Felder (Wochentag, Datum, Dienstart, von, bis, Pause, Faktor, Gesamt).
   - Wird sie nicht erkannt: zeige, an welcher Stelle der Regex scheitert.
   - Schlage vor, sie **anonymisiert** in `tests/fixtures.js` aufzunehmen (erfundenes Datum, Klient "Musterhaus", keine Personennamen) plus passenden Test.
4. Niemals echte Stundennachweise oder Inhalte aus `private/` lesen oder in Tests übernehmen.
