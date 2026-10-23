---
name: release
description: Release vorbereiten – Tests, Service-Worker-Cache-Version hochzählen, Changelog-Eintrag. Nur auf ausdrückliche Anforderung.
disable-model-invocation: true
argument-hint: "[kurze Beschreibung der Änderung]"
---

Bereite ein Release vor. Schritte in dieser Reihenfolge, nach jedem Schritt kurz berichten:

1. `node --test` – bei Fehlern abbrechen und berichten.
2. In `sw.js` die Konstante `CACHE` hochzählen (`babella-stunden-vN` → `vN+1`).
   Warum: Installierte PWAs liefern sonst Dateien aus dem alten Cache. Ohne neue Version
   sieht der Nutzer die Änderung evtl. erst nach mehrfachem Neuladen.
3. Wurden Dateien hinzugefügt, die offline verfügbar sein müssen? Dann `ASSETS` in `sw.js` ergänzen.
4. In `CHANGELOG.md` (anlegen, falls nicht vorhanden) oben einen Eintrag mit Datum, neuer Cache-Version und `$ARGUMENTS` einfügen.
5. Diff zeigen, Commit vorschlagen. **Nie direkt auf `main` pushen** – immer eigener Branch + Pull Request, den Gregor auf GitHub prüft und mergt.
