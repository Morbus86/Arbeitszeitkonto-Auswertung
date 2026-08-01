/* BaBella Stunden-Auswertung
   Alles läuft client-seitig. Kein Server, kein Speichern über die Session hinaus. */

pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js".replace("pdf.min.js","pdf.worker.min.js");

const WOCHENTAGE = ["So","Mo","Di","Mi","Do","Fr","Sa"];
const SHIFT_TYPES = ["Früh","Spät","Tag","Nacht"];
const IGNORE_TYPES = ["Frei","Einarbeitung","Urlaub","Wunschfrei","WX"];

let uploadedFiles = []; // {name, status, text}
let allRows = [];       // geparste Zeilen über alle Dateien

/* ---------- Feiertage Hessen (Gauss'sche Osterformel) ---------- */
function easterSunday(year){
  const a = year % 19, b = Math.floor(year/100), c = year % 100;
  const d = Math.floor(b/4), e = b % 4, f = Math.floor((b+8)/25);
  const g = Math.floor((b-f+1)/3), h = (19*a+b-d-g+15) % 30;
  const i = Math.floor(c/4), k = c % 4;
  const l = (32+2*e+2*i-h-k) % 7;
  const m = Math.floor((a+11*h+22*l)/451);
  const month = Math.floor((h+l-7*m+114)/31);
  const day = ((h+l-7*m+114) % 31) + 1;
  return new Date(year, month-1, day);
}
function addDays(date, n){ const d = new Date(date); d.setDate(d.getDate()+n); return d; }
function ymd(d){ return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }

function hessenFeiertage(year){
  const ostern = easterSunday(year);
  const list = [
    [new Date(year,0,1), "Neujahr"],
    [addDays(ostern,-2), "Karfreitag"],
    [addDays(ostern,1), "Ostermontag"],
    [new Date(year,4,1), "Tag der Arbeit"],
    [addDays(ostern,39), "Christi Himmelfahrt"],
    [addDays(ostern,50), "Pfingstmontag"],
    [addDays(ostern,60), "Fronleichnam"],
    [new Date(year,9,3), "Tag der Deutschen Einheit"],
    [new Date(year,11,25), "1. Weihnachtsfeiertag"],
    [new Date(year,11,26), "2. Weihnachtsfeiertag"],
  ];
  const map = {};
  list.forEach(([d,name]) => map[ymd(d)] = name);
  return map;
}

/* ---------- PDF Text extrahieren (zeilenweise, y-gruppiert) ---------- */
async function extractLines(file){
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({data: buf}).promise;
  let lines = [];
  for(let p=1; p<=pdf.numPages; p++){
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = content.items.map(it => ({
      str: it.str,
      x: it.transform[4],
      y: Math.round(it.transform[5])
    })).filter(it => it.str.trim().length > 0);

    // Gruppieren nach y (Toleranz 3px)
    items.sort((a,b) => b.y - a.y || a.x - b.x);
    let rows = [];
    items.forEach(it => {
      let row = rows.find(r => Math.abs(r.y - it.y) <= 3);
      if(!row){ row = {y: it.y, items: []}; rows.push(row); }
      row.items.push(it);
    });
    rows.forEach(r => r.items.sort((a,b) => a.x - b.x));
    rows.forEach(r => lines.push(r.items.map(i => i.str).join(" ").replace(/\s+/g," ").trim()));
  }
  return lines;
}

/* ---------- Zeilen-Parser ---------- */
// \s* statt \s+ vor der ersten Uhrzeit: manche Dienstart-Texte (z.B. "zur besonderen
// verwendung") haben in der PDF-Textextraktion kein Leerzeichen vor der Uhrzeit.
const ROW_RE = /^(Mo|Di|Mi|Do|Fr|Sa|So)\s+(\d{2}\.\d{2}\.\d{4})\s+(.+?)\s*(\d{2}:\d{2})\s+(\d{2}:\d{2})\s+(\d+)\s*Min\.\s+(\d+,\d)\s*%\s+(\d{2}:\d{2})/;
// Echte Schichtzeilen erkennen: Präfix + Ziffer + ">" (z.B. "Früh 8 > Winter").
// Verhindert Fehltreffer wie "Nacht-Frei" (0 Std., kein echter Nachtdienst).
const SHIFT_RE = /^(Früh|Spät|Tag|Nacht)\s+\d+\s*>/;

function parseLines(lines, sourceName){
  const rows = [];
  for(const line of lines){
    const m = line.match(ROW_RE);
    if(!m) continue;
    const [, wtag, datum, dienst, von, bis, pause, faktor, gesamtStr] = m;
    const [dd,mm,yyyy] = datum.split(".").map(Number);
    const dateObj = new Date(yyyy, mm-1, dd);
    const [gh,gm] = gesamtStr.split(":").map(Number);
    rows.push({
      wochentag: wtag,
      datum: datum,
      dateObj,
      iso: ymd(dateObj),
      dienstart: dienst.trim(),
      von, bis,
      pauseMin: Number(pause),
      faktor: faktor.replace(",","."),
      gesamtMin: gh*60+gm,
      quelle: sourceName
    });
  }
  return rows;
}

function extractFooterValues(lines){
  // "Gesamtdauer in Std.:" ist die reine Summe der Gesamt-Spalte (verlässlich, entspricht
  // exakt der eigenen Zeilensumme - dient als Selbst-Check für den Parser).
  // "Summe Ist-Arbeitszeit:" ist BaBellas eigene Kontostand-Zahl (kann von internen
  // Zusatzregeln abweichen, z.B. Gutschriften bei externer Fortbildung).
  let gesamtdauer = null, istArbeitszeit = null;
  for(const line of lines){
    let m = line.match(/Gesamtdauer in Std\.:\s*-?\s*([\d.]+,\d+)/);
    if(m) gesamtdauer = parseFloat(m[1].replace(".","").replace(",","."));
    m = line.match(/Summe Ist-Arbeitszeit:\s*-?\s*([\d.]+,\d+)/);
    if(m) istArbeitszeit = parseFloat(m[1].replace(".","").replace(",","."));
  }
  return {gesamtdauer, istArbeitszeit};
}

function shiftTypeOf(dienstart){
  const m = dienstart.match(SHIFT_RE);
  return m ? m[1] : null;
}
function isIgnored(dienstart){
  return IGNORE_TYPES.some(t => dienstart.startsWith(t));
}
function isWeekend(dateObj){
  const d = dateObj.getDay();
  return d === 0 || d === 6;
}

/* ---------- Aggregation ---------- */
function aggregate(rows){
  // Gruppieren nach Datum
  const byDate = {};
  rows.forEach(r => { (byDate[r.iso] = byDate[r.iso] || []).push(r); });

  const days = []; // ein Eintrag pro Kalendertag mit Haupt-Schichttyp
  Object.keys(byDate).sort().forEach(iso => {
    const dayRows = byDate[iso];
    const shiftRows = dayRows.filter(r => shiftTypeOf(r.dienstart));
    const urlaubRows = dayRows.filter(r => r.dienstart.startsWith("Urlaub"));
    const totalMin = dayRows.reduce((s,r) => s + r.gesamtMin, 0);

    let type = null;
    if(shiftRows.length){
      type = shiftRows.reduce((a,b) => a.gesamtMin >= b.gesamtMin ? a : b).dienstart;
      type = shiftTypeOf(type);
    }
    days.push({
      iso, dateObj: dayRows[0].dateObj, wochentag: dayRows[0].wochentag,
      type, totalMin,
      isUrlaub: !type && urlaubRows.length > 0 && totalMin > 0,
      quelle: dayRows[0].quelle
    });
  });

  // Zeitraum
  const isos = days.map(d => d.iso).sort();
  const minDate = isos.length ? new Date(isos[0]) : null;
  const maxDate = isos.length ? new Date(isos[isos.length-1]) : null;

  // Feiertage über alle betroffenen Jahre
  const years = [...new Set(days.map(d => d.dateObj.getFullYear()))];
  let feiertage = {};
  years.forEach(y => Object.assign(feiertage, hessenFeiertage(y)));

  // Nur Feiertage, die auch im hochgeladenen Zeitraum liegen (zwischen minDate/maxDate der Dateien)
  const uploadedIsos = new Set(days.map(d => d.iso));
  // Feiertage relativ zum tatsächlichen Datumsbereich der Uploads (nicht nur Tage mit Zeile),
  // daher: min/max aus allen geparsten Zeilen (auch Frei/Urlaub) verwenden -> bereits in days enthalten,
  // da jede Kalenderzeile im PDF vorkommt (auch Frei-Tage werden gelistet).
  const feiertageImZeitraum = Object.entries(feiertage)
    .filter(([iso]) => iso >= isos[0] && iso <= isos[isos.length-1])
    .sort(([a],[b]) => a < b ? -1 : 1);

  // Schicht-Statistik
  const shiftStats = {};
  SHIFT_TYPES.forEach(t => shiftStats[t] = {count:0, min:0, weekendCount:0});
  days.forEach(d => {
    if(d.type){
      shiftStats[d.type].count++;
      shiftStats[d.type].min += d.totalMin;
      if(isWeekend(d.dateObj)) shiftStats[d.type].weekendCount++;
    }
  });

  // Wochenenden
  const weekendDaysTotal = days.filter(d => isWeekend(d.dateObj));
  const weekendDaysWorked = weekendDaysTotal.filter(d => d.type);

  // Feiertage gearbeitet
  const feiertageGearbeitet = feiertageImZeitraum.filter(([iso]) => {
    const day = days.find(d => d.iso === iso);
    return day && day.type;
  });

  const totalWorkedMin = days.reduce((s,d) => s + (d.type ? d.totalMin : 0), 0);
  const totalWorkDays = days.filter(d => d.type).length;
  const urlaubDays = days.filter(d => d.isUrlaub).length;

  return {
    days, shiftStats, weekendDaysTotal, weekendDaysWorked,
    feiertageImZeitraum, feiertageGearbeitet,
    totalWorkedMin, totalWorkDays, urlaubDays,
    minDate, maxDate
  };
}

/* ---------- Soll/Ist-Konto (unabhängig von der PDF-Fußzeile) ----------
   Soll = Vertrag (Wochenstunden / Arbeitstage) für jeden Mo-Fr-Tag, der kein
   gesetzlicher Feiertag ist, im Zeitraum jeder einzelnen hochgeladenen Datei
   (Lücken zwischen nicht hochgeladenen Monaten werden NICHT überbrückt).
   Ist = Summe aller Gesamt-Werte (entspricht "Gesamtdauer in Std." der PDFs -
   das schließt Urlaub, Dienstausfall, Fortbildung etc. korrekt als Soll-erfüllend ein). */
function computeKonto(rows, weeklyHours, workdays){
  const byFile = {};
  rows.forEach(r => (byFile[r.quelle] = byFile[r.quelle] || []).push(r));

  const dailyIst = {};
  rows.forEach(r => { dailyIst[r.iso] = (dailyIst[r.iso] || 0) + r.gesamtMin; });

  const coveredIsos = new Set();
  Object.values(byFile).forEach(fileRows => {
    const isos = fileRows.map(r => r.iso).sort();
    let cur = new Date(isos[0]);
    const end = new Date(isos[isos.length-1]);
    while(cur <= end){ coveredIsos.add(ymd(cur)); cur = addDays(cur,1); }
  });

  const years = [...new Set([...coveredIsos].map(iso => Number(iso.slice(0,4))))];
  let feiertage = {};
  years.forEach(y => Object.assign(feiertage, hessenFeiertage(y)));

  const dailySollMin = Math.round(weeklyHours / workdays * 60);
  let sollMin = 0, istMin = 0;
  [...coveredIsos].forEach(iso => {
    const [y,m,d] = iso.split("-").map(Number);
    const weekday = new Date(y, m-1, d).getDay();
    const isWorkday = weekday >= 1 && weekday <= 5;
    const isHoliday = feiertage[iso] !== undefined;
    if(isWorkday && !isHoliday) sollMin += dailySollMin;
    istMin += (dailyIst[iso] || 0);
  });

  return {sollMin, istMin, saldoMin: istMin - sollMin, coveredDays: coveredIsos.size};
}

function fmtH(min){
  const sign = min < 0 ? "-" : "";
  min = Math.abs(min);
  return sign + Math.floor(min/60) + ":" + String(min%60).padStart(2,"0");
}
function fmtDate(iso){
  const [y,m,d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/* ---------- UI ---------- */
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const fileListEl = document.getElementById("fileList");
const processBtn = document.getElementById("processBtn");

dropzone.addEventListener("click", () => fileInput.click());
["dragover","dragenter"].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.add("drag"); }));
["dragleave","drop"].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.remove("drag"); }));
dropzone.addEventListener("drop", e => { addFiles(e.dataTransfer.files); });
fileInput.addEventListener("change", e => addFiles(e.target.files));

function addFiles(fileList){
  Array.from(fileList).forEach(f => {
    if(f.type !== "application/pdf") return;
    if(uploadedFiles.some(u => u.name === f.name)) return;
    uploadedFiles.push({name: f.name, file: f, status: "wartet"});
  });
  renderFileList();
  processBtn.disabled = uploadedFiles.length === 0;
}

function renderFileList(){
  fileListEl.innerHTML = uploadedFiles.map(u => `
    <div class="filerow">
      <span>${u.name}</span>
      <span class="status ${u.status==='ok'?'ok':u.status==='fehler'?'err':''}">${u.status}</span>
    </div>`).join("");
}

let fileFooters = []; // {name, myGesamt, pdfGesamtdauer, pdfIstArbeitszeit}

processBtn.addEventListener("click", async () => {
  processBtn.disabled = true;
  processBtn.textContent = "Verarbeite...";
  allRows = [];
  fileFooters = [];

  for(const u of uploadedFiles){
    try{
      const lines = await extractLines(u.file);
      const rows = parseLines(lines, u.name);
      if(rows.length === 0){
        u.status = "fehler: keine Zeilen erkannt";
      } else {
        allRows.push(...rows);
        const myGesamt = rows.reduce((s,r) => s + r.gesamtMin, 0);
        const footer = extractFooterValues(lines);
        fileFooters.push({name: u.name, myGesamt, ...footer});
        const mismatch = footer.gesamtdauer !== null && Math.abs(myGesamt/60 - footer.gesamtdauer) > 0.02;
        u.status = mismatch
          ? `⚠ ${rows.length} Zeilen, Summe weicht von PDF ab – prüfen`
          : `ok (${rows.length} Zeilen)`;
      }
    }catch(err){
      u.status = "fehler: " + err.message;
    }
    renderFileList();
  }

  processBtn.textContent = "Auswertung starten";
  processBtn.disabled = false;

  if(allRows.length === 0){
    alert("Es konnten keine Zeilen aus den PDFs gelesen werden. Format prüfen.");
    return;
  }

  const agg = aggregate(allRows);
  renderResults(agg);
});

function renderResults(agg){
  document.getElementById("empty").style.display = "none";
  document.getElementById("results").style.display = "block";

  document.getElementById("periodLabel").textContent =
    agg.minDate && agg.maxDate ? `${fmtDate(ymd(agg.minDate))} – ${fmtDate(ymd(agg.maxDate))}` : "";

  // Selbst-Check: eigene Zeilensumme je Datei vs. PDF-eigene "Gesamtdauer in Std." –
  // beide sind reine Summen der Gesamt-Spalte und müssen exakt übereinstimmen.
  // Weicht das ab, deutet das auf ein Parsing-Problem hin (z.B. nicht erkannte Zeile).
  const valEl = document.getElementById("validation");
  const mismatches = fileFooters.filter(f => f.gesamtdauer !== null && Math.abs(f.myGesamt/60 - f.gesamtdauer) > 0.02);
  if(mismatches.length){
    valEl.innerHTML = `<div class="warn-box">⚠️ Bei ${mismatches.length} Datei(en) weicht meine Zeilensumme von der PDF-eigenen "Gesamtdauer" ab: ${mismatches.map(m=>m.name).join(", ")}. Das deutet auf nicht erkannte Zeilen hin – Rohdaten unten prüfen.</div>`;
  } else {
    valEl.innerHTML = `<div class="ok-box">✓ Zeilensumme stimmt in allen ${fileFooters.length} Datei(en) exakt mit der PDF-eigenen "Gesamtdauer" überein.</div>`;
  }

  renderKonto();

  // Stat grid
  document.getElementById("statGrid").innerHTML = `
    <div class="stat"><div class="num">${fmtH(agg.totalWorkedMin)}</div><div class="lbl">Std. gearbeitet</div></div>
    <div class="stat"><div class="num">${agg.totalWorkDays}</div><div class="lbl">Arbeitstage</div></div>
    <div class="stat"><div class="num">${agg.weekendDaysWorked.length} / ${agg.weekendDaysTotal.length}</div><div class="lbl">Wochenendtage gearbeitet</div></div>
    <div class="stat"><div class="num">${agg.feiertageGearbeitet.length} / ${agg.feiertageImZeitraum.length}</div><div class="lbl">Feiertage gearbeitet</div></div>
  `;

  // Schichtverteilung
  document.getElementById("shiftTable").innerHTML = SHIFT_TYPES.map(t => {
    const s = agg.shiftStats[t];
    return `<tr><td><span class="dot ${t}"></span>${t}</td><td>${s.count}</td><td>${fmtH(s.min)}</td><td>${s.weekendCount}</td></tr>`;
  }).join("") + `<tr><td><span class="dot other"></span>Urlaubstage (Info)</td><td>${agg.urlaubDays}</td><td>–</td><td>–</td></tr>`;

  // Wochenenden
  document.getElementById("weekendSub").textContent = `${agg.weekendDaysTotal.length} Wochenendtage im Zeitraum`;
  document.getElementById("weekendTable").innerHTML = agg.weekendDaysTotal.map(d => `
    <tr>
      <td>${fmtDate(d.iso)}</td>
      <td>${d.wochentag}</td>
      <td>${d.type ? `<span class="dot ${d.type}"></span>${d.type}` : (d.isUrlaub ? "Urlaub" : "frei")}</td>
      <td>${d.type ? fmtH(d.totalMin) : "–"}</td>
    </tr>`).join("");

  // Feiertage
  document.getElementById("holidaySub").textContent = `${agg.feiertageImZeitraum.length} Feiertage im Zeitraum`;
  document.getElementById("holidayTable").innerHTML = agg.feiertageImZeitraum.map(([iso,name]) => {
    const day = agg.days.find(d => d.iso === iso);
    const worked = day && day.type;
    return `<tr>
      <td>${fmtDate(iso)}</td>
      <td>${name}</td>
      <td>${worked ? `<span class="badge we">gearbeitet</span>` : `<span class="badge">frei</span>`}</td>
      <td>${worked ? fmtH(day.totalMin) : "–"}</td>
    </tr>`;
  }).join("");

  // Rohdaten
  document.getElementById("rawTable").innerHTML = allRows
    .slice()
    .sort((a,b) => a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0)
    .map(r => `<tr>
      <td>${r.datum}</td><td>${r.wochentag}</td><td>${r.dienstart}</td>
      <td>${r.von}</td><td>${r.bis}</td><td>${fmtH(r.gesamtMin)}</td><td>${r.quelle}</td>
    </tr>`).join("");

  window.__agg = agg; // für Export
}

function renderKonto(){
  const weeklyHours = parseFloat(document.getElementById("weeklyHours").value) || 40;
  const workdays = parseFloat(document.getElementById("workdays").value) || 5;
  const konto = computeKonto(allRows, weeklyHours, workdays);

  document.getElementById("kontoGrid").innerHTML = `
    <div class="stat"><div class="num">${fmtH(konto.sollMin)}</div><div class="lbl">Soll (${weeklyHours}h / ${workdays} Tage)</div></div>
    <div class="stat"><div class="num">${fmtH(konto.istMin)}</div><div class="lbl">Ist (alle erfassten Std.)</div></div>
    <div class="stat"><div class="num" style="color:${konto.saldoMin>=0?'var(--ok)':'var(--warn)'}">${konto.saldoMin>=0?'+':''}${fmtH(konto.saldoMin)}</div><div class="lbl">Saldo</div></div>
    <div class="stat"><div class="num">${konto.coveredDays}</div><div class="lbl">abgedeckte Kalendertage</div></div>
  `;

  // Monatsvergleich: eigene Summe vs. PDF "Gesamtdauer" vs. PDF "Summe Ist-Arbeitszeit"
  document.getElementById("monthlyTable").innerHTML = fileFooters
    .slice()
    .sort((a,b) => a.name < b.name ? -1 : 1)
    .map(f => `<tr>
      <td>${f.name}</td>
      <td>${fmtH(f.myGesamt)}</td>
      <td>${f.gesamtdauer !== null ? f.gesamtdauer.toFixed(2).replace(".",",") : "–"}</td>
      <td>${f.istArbeitszeit !== null ? f.istArbeitszeit.toFixed(2).replace(".",",") : "–"}</td>
    </tr>`).join("");

  const sumIst = fileFooters.reduce((s,f) => s + (f.istArbeitszeit || 0), 0);
  document.getElementById("kontoNote").innerHTML =
    `Summe "Ist-Arbeitszeit" laut PDF-Fußzeilen über alle Dateien: <strong>${sumIst.toFixed(2).replace(".",",")} Std.</strong> ` +
    `(kann von der oben berechneten Ist-Zeile abweichen – BaBellas Portal wendet teils eigene Zusatzregeln an, z.B. bei externer Fortbildung. ` +
    `Der Soll/Ist-Abgleich oben rechnet unabhängig davon nach Vertrag.)`;
}

document.getElementById("weeklyHours").addEventListener("change", () => { if(window.__agg) renderKonto(); });
document.getElementById("workdays").addEventListener("change", () => { if(window.__agg) renderKonto(); });

/* ---------- Export ---------- */
function buildExportRows(){
  return allRows.slice().sort((a,b) => a.iso < b.iso ? -1 : 1).map(r => ({
    Datum: r.datum, Wochentag: r.wochentag, Dienstart: r.dienstart,
    Von: r.von, Bis: r.bis, "Pause (Min)": r.pauseMin, "Faktor %": r.faktor,
    "Stunden": fmtH(r.gesamtMin), Quelle: r.quelle
  }));
}

document.getElementById("exportCsv").addEventListener("click", () => {
  const rows = buildExportRows();
  const header = Object.keys(rows[0]).join(";");
  const body = rows.map(r => Object.values(r).join(";")).join("\n");
  const csv = header + "\n" + body;
  const blob = new Blob([csv], {type: "text/csv;charset=utf-8;"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "babella-stunden-auswertung.csv";
  a.click();
});

document.getElementById("exportXlsx").addEventListener("click", () => {
  const rows = buildExportRows();
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Rohdaten");

  if(window.__agg){
    const agg = window.__agg;
    const weeklyHours = parseFloat(document.getElementById("weeklyHours").value) || 40;
    const workdays = parseFloat(document.getElementById("workdays").value) || 5;
    const konto = computeKonto(allRows, weeklyHours, workdays);
    const summary = [
      {Kennzahl: `Soll (${weeklyHours}h/${workdays}Tage)`, Wert: fmtH(konto.sollMin)},
      {Kennzahl: "Ist (alle erfassten Std.)", Wert: fmtH(konto.istMin)},
      {Kennzahl: "Saldo", Wert: (konto.saldoMin>=0?"+":"") + fmtH(konto.saldoMin)},
      {Kennzahl: "Std. gearbeitet", Wert: fmtH(agg.totalWorkedMin)},
      {Kennzahl: "Arbeitstage", Wert: agg.totalWorkDays},
      {Kennzahl: "Wochenendtage gesamt", Wert: agg.weekendDaysTotal.length},
      {Kennzahl: "Wochenendtage gearbeitet", Wert: agg.weekendDaysWorked.length},
      {Kennzahl: "Feiertage im Zeitraum", Wert: agg.feiertageImZeitraum.length},
      {Kennzahl: "Feiertage gearbeitet", Wert: agg.feiertageGearbeitet.length},
      {Kennzahl: "Urlaubstage", Wert: agg.urlaubDays},
      ...SHIFT_TYPES.map(t => ({Kennzahl: t + "-Schichten", Wert: agg.shiftStats[t].count + " (" + fmtH(agg.shiftStats[t].min) + " Std.)"}))
    ];
    const ws2 = XLSX.utils.json_to_sheet(summary);
    XLSX.utils.book_append_sheet(wb, ws2, "Zusammenfassung");
  }
  XLSX.writeFile(wb, "babella-stunden-auswertung.xlsx");
});

/* ---------- Service Worker (offline-fähig) ---------- */
if("serviceWorker" in navigator){
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
