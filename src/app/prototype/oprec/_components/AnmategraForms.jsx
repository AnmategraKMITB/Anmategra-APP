// @ts-nocheck -- purwarupa satu-file dalam JS biasa, tidak ikut type-check.
"use client";
/* =====================================================================
   Anmategra Forms — purwarupa (Typeform-style)
   Satu komponen React, tanpa library eksternal.
   Bagian: core (model, logika alur, ikon) · editor Konten · Alur · Pratinjau · Respons · Daftar
   ===================================================================== */
import React, { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect, memo } from "react";

/* ---------- util ---------- */
let __id = 0;
const uid = (p = "b") => `${p}_${Date.now().toString(36)}${(++__id).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const clone = (o) => JSON.parse(JSON.stringify(o));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const stripHtml = (h) => {
  if (!h) return "";
  const d = typeof document !== "undefined" ? document.createElement("div") : null;
  if (!d) return String(h).replace(/<[^>]*>/g, "");
  d.innerHTML = h;
  return (d.textContent || "").trim();
};
const fmtDate = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const fmtDeadline = (iso) => {
  if (!iso) return "Tanpa tenggat";
  const d = new Date(iso);
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")} WIB`;
};
const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/* Sanitasi HTML rich-text: hanya b/strong/i/em/u/a/br yang lolos */
const ALLOWED = { B: 1, STRONG: 1, I: 1, EM: 1, U: 1, A: 1, BR: 1 };
function sanitize(html) {
  if (!html) return "";
  if (typeof DOMParser === "undefined") return String(html).replace(/<[^>]*>/g, "");
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const walk = (node) => {
    let out = "";
    node.childNodes.forEach((n) => {
      if (n.nodeType === 3) out += n.textContent.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
      else if (n.nodeType === 1) {
        const tag = n.tagName;
        const inner = walk(n);
        if (tag === "DIV" || tag === "P") out += (out ? "<br>" : "") + inner;
        else if (!ALLOWED[tag]) out += inner;
        else if (tag === "BR") out += "<br>";
        else if (tag === "A") {
          const href = n.getAttribute("href") || "";
          out += /^(https?:|mailto:)/i.test(href) ? `<a href="${href.replace(/"/g, "&quot;")}" target="_blank" rel="noopener noreferrer">${inner}</a>` : inner;
        } else out += `<${tag.toLowerCase()}>${inner}</${tag.toLowerCase()}>`;
      }
    });
    return out;
  };
  return walk(doc.body.firstChild);
}
const Rich = ({ html, className, as: Tag = "span" }) => <Tag className={className} dangerouslySetInnerHTML={{ __html: sanitize(html) }} />;

/* ---------- ikon (dibuat manual, 24x24 stroke) ---------- */
const P = {
  home: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z",
  calendar: "M4 6h16v15H4zM4 10h16M8 3v4M16 3v4",
  users: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6",
  inbox: "M3 13h5l1.5 3h5L16 13h5M5 4h14l2 9v7H3v-7z",
  alert: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v5M12 16v.5",
  list: "M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01",
  logout: "M15 4h4v16h-4M10 17l5-5-5-5M15 12H3",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5",
  filter: "M4 6h16M7 12h10M10 18h4",
  tag: "M3 12V3h9l9 9-9 9zM7.5 7.5h.01",
  display: "M3 4h18v12H3zM8 20h8M12 16v4M7 8h6M7 11h10",
  pin: "M9 3h6l-1 6 4 4H6l4-4zM12 13v8",
  external: "M7 17 17 7M9 7h8v8",
  more: "M12 5h.01M12 12h.01M12 19h.01",
  plus: "M12 5v14M5 12h14",
  palette: "M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4A4.6 4.6 0 0 0 22 9.8C22 6 17.5 3 12 3zM7.5 12h.01M9.5 7.5h.01M14.5 7.5h.01",
  laptop: "M4 5h16v11H4zM2 19h20",
  phone: "M7 2h10v20H7zM11 18h2",
  play: "M7 4v16l13-8z",
  image: "M3 4h18v16H3zM3 16l5-5 5 5 3-3 5 5M15.5 8.5h.01",
  bold: "M7 4h6a4 4 0 0 1 0 8H7zM7 12h7a4 4 0 0 1 0 8H7z",
  italic: "M10 4h9M5 20h9M15 4 9 20",
  underline: "M7 4v6a5 5 0 0 0 10 0V4M5 21h14",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  clearfmt: "M5 5h12M11 5 7 19M4 20 20 4",
  copy: "M8 8h12v12H8zM4 16V4h12",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  grip: "M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01",
  chevDown: "M6 9l6 6 6-6",
  chevUp: "M6 15l6-6 6 6",
  chevLeft: "M15 6l-6 6 6 6",
  chevRight: "M9 6l6 6-6 6",
  check: "M5 12.5l4.5 4.5L19 7",
  x: "M6 6l12 12M18 6 6 18",
  star: "M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.3L12 17.5l-5.5 2.9 1-6.3L3 9.7l6.2-.9z",
  upload: "M12 16V4M7 9l5-5 5 5M4 16v4h16v-4",
  hash: "M5 9h15M4 15h15M10 3 8 21M16 3l-2 18",
  short: "M4 8h16M4 12h10M4 16h6",
  long: "M4 6h16M4 10h16M4 14h16M4 18h10",
  choice: "M10 6h10M10 12h10M10 18h10M4.5 4.5h2v3h-2zM5.5 10.5v3M4.5 16.5h2v3h-2z",
  checkbox: "M4 4h16v16H4zM8 12l3 3 5-6",
  matrix: "M4 4h16v16H4zM9 9h.01M15 9h.01M9 15h.01M15 15h.01M12 12h.01",
  scale: "M5 12h.01M12 12h.01M19 12h.01M3 12h18",
  dropdown: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 10.5l4 4 4-4",
  date: "M4 6h16v15H4zM4 10h16M8 3v4M16 3v4M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01",
  file: "M3 6h7l2 2h9v12H3zM12 17v-6M9.5 13.5 12 11l2.5 2.5",
  welcome: "M3 4h18v16H3zM3 16l5-5 5 5 3-3 5 5M15.5 8.5h.01",
  ending: "M3 5h18v14H3zM13 13h5v3h-5z",
  flow: "M6 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM18 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM18 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM8 5h8M6 7v6a6 6 0 0 0 6 6h4",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  undo: "M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3",
  redo: "M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3",
  zoomIn: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5M11 8v6M8 11h6",
  zoomOut: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5M8 11h6",
  fit: "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5",
  branch: "M6 4v8a4 4 0 0 0 4 4h8M14 12l4 4-4 4M6 4h.01",
  arrowLeft: "M19 12H5M11 6l-6 6 6 6",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  share: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  menu: "M4 6h16M4 12h16M4 18h16",
  edit: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
  refresh: "M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5",
  checkCircle: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 12.5l3 3 5-6",
  save: "M5 3h11l4 4v14H5zM8 3v5h7M8 14h8v7H8z",
  table: "M3 5h18v14H3zM3 10h18M3 15h18M9 5v14",
  download: "M12 4v12M7 11l5 5 5-5M4 20h16",
  gear: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  cond: "M4 5h16l-6 7v6l-4 2v-8z",
  eyeOff: "M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3 3.6M6.6 6.6A17 17 0 0 0 2 12s4 6 10 6a9.7 9.7 0 0 0 4.4-1M9.9 9.9a3 3 0 0 0 4.2 4.2",
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  sparkle: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6",
};
const Icon = ({ name, size = 18, fill = "none", sw = 1.8, className, style }) => (
  <svg className={className} style={style} width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={P[name] || P.x} />
  </svg>
);

const Logo = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
    <g fill="var(--accent)">
      {[0, 60, 120, 180, 240, 300].map((a) => {
        const r = (a * Math.PI) / 180;
        return <circle key={a} cx={20 + 15 * Math.cos(r)} cy={20 + 15 * Math.sin(r)} r="3.6" />;
      })}
    </g>
    <circle cx="20" cy="20" r="10" fill="none" stroke="var(--navy)" strokeWidth="4" />
    <path d="M14.5 22.5 20 15.5l5.5 7z" fill="var(--navy)" />
  </svg>
);

/* ---------- tipe blok ---------- */
const TYPES = {
  welcome: { label: "Welcome Screen", icon: "welcome", screen: true },
  short: { label: "Teks Pendek", icon: "short" },
  long: { label: "Teks Panjang", icon: "long" },
  number: { label: "Angka", icon: "hash" },
  choice: { label: "Pilihan Ganda", icon: "choice", options: true },
  checkbox: { label: "Check Box", icon: "checkbox", options: true },
  matrix: { label: "Matriks", icon: "matrix" },
  scale: { label: "Skala", icon: "scale" },
  dropdown: { label: "Dropdown", icon: "dropdown", options: true },
  date: { label: "Tanggal", icon: "date" },
  file: { label: "Unggah Dokumen", icon: "file" },
  ending: { label: "Ending Screen", icon: "ending", screen: true },
};
const TYPE_ORDER = ["welcome", "short", "long", "number", "choice", "checkbox", "matrix", "scale", "dropdown", "date", "file", "ending"];
const QTYPES = TYPE_ORDER.filter((t) => !TYPES[t].screen);
const isQuestion = (b) => b && !TYPES[b.type].screen;

const opt = (label) => ({ id: uid("o"), label });
function defaultProps(type) {
  switch (type) {
    case "welcome": return { button: "Mulai", subtitle: "" };
    case "ending": return { button: "", url: "" };
    case "short": return { placeholder: "", maxLen: "" };
    case "long": return { placeholder: "", maxLen: "" };
    case "number": return { min: "", max: "" };
    case "choice": case "dropdown": return { options: [opt("Pilihan 1"), opt("Pilihan 2")] };
    case "checkbox": return { options: [opt("Pilihan 1"), opt("Pilihan 2")], minSel: "", maxSel: "" };
    case "matrix": return { rows: [opt("Baris 1")], cols: [opt("Pilihan 1")], multi: false };
    case "scale": return { min: 1, max: 5, minLabel: "", maxLabel: "", style: "number" };
    case "date": return { mode: "date" };
    case "file": return { accept: "", maxFiles: 1, maxSizeMB: 10 };
    default: return {};
  }
}
const emptyCond = () => ({ match: "all", rules: [] });
function newBlock(type, extra = {}) {
  return { id: uid("b"), type, title: "", desc: "", required: false, image: null, props: defaultProps(type), cond: emptyCond(), ...extra };
}

/* Urutan kanonik: welcome selalu di atas, ending selalu di bawah */
function normalizeOrder(blocks) {
  const w = blocks.filter((b) => b.type === "welcome");
  const q = blocks.filter((b) => isQuestion(b));
  const e = blocks.filter((b) => b.type === "ending");
  return [...w.slice(0, 1), ...q, ...e];
}

/* ---------- pengaturan form ---------- */
const DEFAULT_SETTINGS = {
  requiredByDefault: true,
  showNumbers: true,
  showProgress: true,
  shuffleOptions: false,
  autosaveDraft: true,
  reviewBeforeSubmit: false,
  confirmOnLeave: true,
  collectIdentity: true,
  oneResponsePerAccount: true,
  allowEditAfterSubmit: false,
  notifyOnResponse: false,
  closedMessage: "Form ini sudah ditutup. Terima kasih atas minatmu!",
};
function withDefaults(f) {
  return {
    ...f,
    settings: { ...DEFAULT_SETTINGS, ...(f.settings || {}) },
    theme: { accent: "#00AEB3", font: "jakarta", bg: "soft", banner: null, ...(f.theme || {}) },
    blocks: (f.blocks || []).map((b) => ({ ...b, cond: b.cond || emptyCond() })),
  };
}

/* =====================================================================
   KONDISI TAMPIL — gaya "conditional formatting" Excel
   Setiap pertanyaan/ending boleh punya daftar kondisi atas jawaban
   pertanyaan SEBELUMNYA, digabung Semua (AND) / Salah satu (OR).
   ===================================================================== */
// [kunci, label, arity]  arity: 0 tanpa nilai · 1 satu nilai · 2 rentang · "multi" daftar opsi · "cell" baris+kolom
const A0 = [["answered", "diisi", 0], ["unanswered", "kosong", 0]];
const NUM_OPS = [["eq", "=", 1], ["neq", "≠", 1], ["gt", ">", 1], ["gte", "≥", 1], ["lt", "<", 1], ["lte", "≤", 1], ["between", "di antara", 2], ["not_between", "di luar rentang", 2], ...A0];
const OPS = {
  number: NUM_OPS,
  scale: NUM_OPS,
  short: [["eq", "sama dengan", 1], ["neq", "tidak sama dengan", 1], ["contains", "mengandung", 1], ["not_contains", "tidak mengandung", 1], ["starts", "diawali", 1], ["ends", "diakhiri", 1], ["len_gt", "panjang lebih dari", 1], ["len_lt", "panjang kurang dari", 1], ...A0],
  long: [["contains", "mengandung", 1], ["not_contains", "tidak mengandung", 1], ["len_gt", "panjang lebih dari", 1], ["len_lt", "panjang kurang dari", 1], ...A0],
  choice: [["is", "adalah", 1], ["is_not", "bukan", 1], ["in", "salah satu dari", "multi"], ["not_in", "bukan salah satu dari", "multi"], ...A0],
  dropdown: [["is", "adalah", 1], ["is_not", "bukan", 1], ["in", "salah satu dari", "multi"], ["not_in", "bukan salah satu dari", "multi"], ...A0],
  checkbox: [["includes", "mencakup", 1], ["excludes", "tidak mencakup", 1], ["includes_all", "mencakup semua", "multi"], ["includes_any", "mencakup salah satu", "multi"], ["count_gte", "jumlah dipilih ≥", 1], ["count_lte", "jumlah dipilih ≤", 1], ...A0],
  date: [["on", "tepat pada", 1], ["before", "sebelum", 1], ["after", "setelah", 1], ["between", "di antara", 2], ...A0],
  matrix: [["cell", "pada baris … memilih", "cell"], ...A0],
  file: A0,
};
const opsFor = (type) => OPS[type] || A0;
const opDef = (type, op) => opsFor(type).find((o) => o[0] === op);
const newRule = (src, srcType) => ({ id: uid("c"), src, op: opsFor(srcType)[0][0], value: null, value2: null });

function isEmptyAnswer(v) {
  if (v === undefined || v === null || v === "") return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v).every((k) => isEmptyAnswer(v[k]));
  return false;
}
const numOrNull = (x) => (x === "" || x === null || x === undefined || isNaN(Number(x)) ? null : Number(x));
/* Nilai mentah kosong pada kondisi yang butuh nilai = kondisi belum lengkap → dianggap tidak terpenuhi */
function evalCond(src, c, v) {
  const op = c.op;
  if (op === "answered") return !isEmptyAnswer(v);
  if (op === "unanswered") return isEmptyAnswer(v);
  if (isEmptyAnswer(v)) return false;
  const a = c.value, b = c.value2;
  const s = String(v).toLowerCase(), sa = String(a ?? "").toLowerCase();
  switch (op) {
    case "is": return a != null && v === a;
    case "is_not": return a != null && v !== a;
    case "in": return Array.isArray(a) && a.includes(v);
    case "not_in": return Array.isArray(a) && a.length > 0 && !a.includes(v);
    case "includes": return a != null && v.includes(a);
    case "excludes": return a != null && !v.includes(a);
    case "includes_all": return Array.isArray(a) && a.length > 0 && a.every((x) => v.includes(x));
    case "includes_any": return Array.isArray(a) && a.some((x) => v.includes(x));
    case "count_gte": return numOrNull(a) != null && v.length >= Number(a);
    case "count_lte": return numOrNull(a) != null && v.length <= Number(a);
    case "contains": return sa !== "" && s.includes(sa);
    case "not_contains": return sa !== "" && !s.includes(sa);
    case "starts": return sa !== "" && s.startsWith(sa);
    case "ends": return sa !== "" && s.endsWith(sa);
    case "len_gt": return numOrNull(a) != null && String(v).length > Number(a);
    case "len_lt": return numOrNull(a) != null && String(v).length < Number(a);
    case "cell": return a != null && b != null && (v[a] || []).includes(b);
  }
  if (src.type === "date") {
    const d = String(v).slice(0, src.props.mode === "time" ? 5 : 10);
    if (!a) return false;
    if (op === "on") return d === a;
    if (op === "before") return d < a;
    if (op === "after") return d > a;
    if (op === "between") return b ? d >= a && d <= b : false;
  }
  if (src.type === "short") {
    if (op === "eq") return sa !== "" && s.trim() === sa.trim();
    if (op === "neq") return sa !== "" && s.trim() !== sa.trim();
  }
  const n = Number(v), x = numOrNull(a), y = numOrNull(b);
  if (x === null) return false;
  switch (op) {
    case "eq": return n === x;
    case "neq": return n !== x;
    case "gt": return n > x;
    case "gte": return n >= x;
    case "lt": return n < x;
    case "lte": return n <= x;
    case "between": return y !== null && n >= Math.min(x, y) && n <= Math.max(x, y);
    case "not_between": return y !== null && (n < Math.min(x, y) || n > Math.max(x, y));
    default: return false;
  }
}

/* sumber valid = pertanyaan yang ada & letaknya SEBELUM blok target (mencegah ketergantungan melingkar) */
function ruleValid(form, idx, r) {
  const si = form.blocks.findIndex((x) => x.id === r.src);
  return si >= 0 && si < idx && isQuestion(form.blocks[si]);
}
const validRules = (form, b) => {
  const idx = form.blocks.findIndex((x) => x.id === b.id);
  return (b.cond?.rules || []).filter((r) => ruleValid(form, idx, r));
};
const isConditional = (form, b) => validRules(form, b).length > 0;

/* visibilitas semua blok untuk satu set jawaban; sumber yang tersembunyi = kondisinya gagal */
function computeVisibility(form, answers) {
  const vis = {};
  form.blocks.forEach((b) => {
    const rules = validRules(form, b);
    if (!rules.length) { vis[b.id] = true; return; }
    const res = rules.map((r) => !!vis[r.src] && evalCond(form.blocks.find((x) => x.id === r.src), r, answers[r.src]));
    vis[b.id] = b.cond.match === "any" ? res.some(Boolean) : res.every(Boolean);
  });
  return vis;
}
const END = "__end";
/* ending yang dipakai: ending bersyarat pertama yang terpenuhi, lalu ending tanpa syarat pertama */
function chooseEnding(form, vis) {
  const ends = form.blocks.filter((b) => b.type === "ending");
  const c = ends.find((b) => isConditional(form, b) && vis[b.id]);
  if (c) return c.id;
  const u = ends.find((b) => !isConditional(form, b));
  return u ? u.id : END;
}

function questionNumber(form, id) {
  let n = 0;
  for (const b of form.blocks) {
    if (isQuestion(b)) n++;
    if (b.id === id) return isQuestion(b) ? n : null;
  }
  return null;
}
const blockLabel = (form, id, max = 60) => {
  if (id === END) return "Selesai (bawaan)";
  const b = form.blocks.find((x) => x.id === id);
  if (!b) return "(blok dihapus)";
  const n = questionNumber(form, b.id);
  let t = stripHtml(b.title) || TYPES[b.type].label;
  if (t.length > max) t = t.slice(0, max - 1) + "…";
  return `${n ? n + ". " : b.type === "ending" ? "Ending: " : ""}${t}`;
};
function valueText(src, c) {
  const p = src.props || {};
  const lab = (id, list = p.options) => list?.find((o) => o.id === id)?.label ?? "?";
  const d = opDef(src.type, c.op);
  if (!d || d[2] === 0) return "";
  if (d[2] === "multi") return (c.value || []).map((x) => `“${lab(x)}”`).join(", ") || "…";
  if (d[2] === "cell") return `“${lab(c.value, p.rows)}” → “${lab(c.value2, p.cols)}”`;
  if (TYPES[src.type].options) return `“${lab(c.value)}”`;
  if (d[2] === 2) return `${c.value ?? "…"} dan ${c.value2 ?? "…"}`;
  return c.value === null || c.value === "" ? "…" : src.type === "short" || src.type === "long" ? `“${c.value}”` : String(c.value);
}
/* teks ringkas: "3. Jalur … adalah “Staf Ahli”" */
function condText(form, c, withSrc = true) {
  const src = form.blocks.find((x) => x.id === c.src);
  if (!src) return "(pertanyaan sumber dihapus)";
  const d = opDef(src.type, c.op);
  const head = withSrc ? `${blockLabel(form, src.id, 28)} ` : "Jawaban ";
  if (d?.[2] === "cell") return `${head}baris ${valueText(src, c)}`;
  return `${head}${d ? d[1] : c.op} ${valueText(src, c)}`.trim();
}
function condSummary(form, b) {
  const rules = validRules(form, b);
  if (!rules.length) return "";
  return rules.map((r) => condText(form, r)).join(b.cond.match === "any" ? " ATAU " : " DAN ");
}

/* Validasi jawaban satu blok */
function validateAnswer(b, v) {
  const p = b.props || {};
  if (b.required && isEmptyAnswer(v)) return "Pertanyaan ini wajib diisi.";
  if (isEmptyAnswer(v)) return null;
  if (b.type === "number") {
    if (isNaN(Number(v))) return "Masukkan angka yang valid.";
    if (p.min !== "" && p.min != null && Number(v) < Number(p.min)) return `Nilai minimal ${p.min}.`;
    if (p.max !== "" && p.max != null && Number(v) > Number(p.max)) return `Nilai maksimal ${p.max}.`;
  }
  if ((b.type === "short" || b.type === "long") && p.maxLen && String(v).length > Number(p.maxLen)) return `Maksimal ${p.maxLen} karakter.`;
  if (b.type === "checkbox") {
    if (p.minSel && v.length < Number(p.minSel)) return `Pilih minimal ${p.minSel}.`;
    if (p.maxSel && v.length > Number(p.maxSel)) return `Pilih maksimal ${p.maxSel}.`;
  }
  if (b.type === "matrix" && b.required) {
    const missing = p.rows.filter((r) => isEmptyAnswer(v[r.id]));
    if (missing.length) return `Lengkapi baris: ${missing.map((r) => r.label).join(", ")}.`;
  }
  return null;
}

/* ---------- data contoh (proyeksi tabel form/blok/kondisi; lihat skema DBML terlampir) ---------- */
const when = (src, op, value = null, value2 = null) => ({ id: uid("c"), src: src.id, op, value, value2 });
const condAll = (...rules) => ({ match: "all", rules });

/* Oprec kepanitiaan besar (OSKM ITB 2027): tiga pilihan divisi, pertanyaan divisi muncul
   kalau divisi itu dipilih di pilihan 1, 2, atau 3. Dulu di Google Form butuh satu section
   per divisi per pilihan; di sini cukup satu blok per pertanyaan dengan kondisi "salah satu". */
const OSKM_DIV = [
  ["Mentor", ["Apa yang kamu ketahui tentang mentor OSKM?", "Ceritakan pengalamanmu membimbing atau mendampingi orang lain"]],
  ["Medik", ["Apakah kamu punya pengalaman pertolongan pertama? Ceritakan singkat"]],
  ["Keamanan", ["Bagaimana kamu menangani peserta yang tidak mengikuti arahan?"]],
  ["Seremonial", ["Acara seremonial apa yang paling berkesan buatmu, dan kenapa?"]],
  ["Event Organizer", ["Ceritakan acara yang pernah kamu urus dari awal sampai akhir"]],
  ["Logistik", ["Bagaimana caramu memastikan barang tidak tertinggal saat acara besar?"]],
  ["Akomtrans", ["Pernah mengatur transportasi atau akomodasi rombongan? Ceritakan"]],
  ["Publikasi", ["Tautan portofolio desain atau konten media sosialmu"]],
  ["Dokumentasi", ["Tautan portofolio foto atau videomu", "Kamera apa yang kamu punya atau biasa pakai?"]],
  ["Business Unit", ["Produk apa yang menurutmu paling laku dijual saat OSKM, dan kenapa?"]],
  ["Kesekjenan", ["Seberapa terbiasa kamu menyusun notulensi dan administrasi rapat?"]],
];
const OSKM_FAK = ["FMIPA", "SITH", "SF", "FITB", "FTTM", "STEI", "FTSL", "FTI", "FTMD", "SAPPK", "FSRD", "SBM"];
const OSKM_KODE = { FMIPA: "101", SITH: "106", SF: "107", FITB: "120", FTTM: "121", STEI: "135", FTSL: "150", FTI: "134", FTMD: "131", SAPPK: "152", FSRD: "174", SBM: "190" };
const OSKM_FIRST = ["Alya", "Bagas", "Cinta", "Daffa", "Elang", "Fira", "Galih", "Hanum", "Iqbal", "Jihan", "Kenzo", "Laila", "Malik", "Nabila", "Oki", "Puti", "Rafi", "Syifa", "Tegar", "Ulfa", "Vino", "Wulan", "Yusuf", "Zahra"];
const OSKM_LAST = ["Pratama", "Lestari", "Nugraha", "Saputri", "Wibowo", "Rahmawati", "Siregar", "Hasibuan", "Kusuma", "Maharani", "Santoso", "Permata"];
const OSKM_ANS = [
  "Aku pernah jadi panitia acara angkatan waktu SMA dan senang mengurus hal teknis di balik layar.",
  "Belum banyak pengalaman, tapi aku cepat belajar dan siap ikut pelatihan dari awal.",
  "Pernah memegang divisi serupa di OSIS selama satu tahun, jadi cukup paham ritme kerjanya.",
  "Aku ingin mencoba hal baru dan merasa divisi ini paling cocok dengan kebiasaanku sehari-hari.",
  "Sering membantu acara komunitas di kampung, terutama saat hari-H yang serba cepat.",
  "https://drive.google.com/portofolio-contoh",
];

function oskmForm(days) {
  const divOpts = () => OSKM_DIV.map(([d]) => opt(d));
  const W = newBlock("welcome", { title: "<b>Open Recruitment Panitia OSKM ITB 2027</b>", desc: "Pilih sampai tiga divisi. Pertanyaan divisi hanya muncul untuk divisi yang kamu pilih. NIM, nama, dan fakultas terisi otomatis dari akun ITB-mu.", props: { button: "Mulai", subtitle: "Periode 3.1 – 3.3" } });
  const qTw = newBlock("short", { title: "Tautan unggahan twibbon", desc: "Pastikan akunnya tidak dikunci supaya bisa dicek panitia.", required: true, props: { placeholder: "https://instagram.com/p/…", maxLen: "" } });
  const qMot = newBlock("long", { title: "Kenapa kamu ingin jadi panitia OSKM?", required: true, props: { placeholder: "", maxLen: 600 } });
  const P = [1, 2, 3].map((n) => newBlock("dropdown", { title: `Pilihan divisi <b>${n}</b>`, required: n === 1, props: { options: divOpts() } }));
  const qPindah = newBlock("choice", { title: "Bersedia dipindahkan ke divisi lain kalau pilihanmu penuh?", required: true, props: { options: ["Bersedia", "Tidak bersedia"].map(opt) } });
  const qKom = newBlock("choice", { title: "Sanggup mengikuti seluruh rangkaian kepanitiaan?", required: true, props: { options: ["Sanggup", "Ada jadwal yang bentrok"].map(opt) } });
  const divBlocks = [];
  OSKM_DIV.forEach(([d, qs], di) => qs.forEach((t) => {
    divBlocks.push(newBlock(t.startsWith("Tautan") ? "short" : "long", {
      title: `<b>${d}</b> · ${t}`, required: true, divIdx: di,
      cond: { match: "any", rules: P.map((pb) => when(pb, "is", pb.props.options[di].id)) },
    }));
  }));
  const E = newBlock("ending", { title: "Pendaftaranmu sudah masuk!", desc: "Hasil seleksi dikirim lewat Inbox Anmategra. Pantau juga pengumuman periode berikutnya.", props: { button: "", url: "" } });
  const blocks = [W, qTw, qMot, ...P, qPindah, qKom, ...divBlocks, E].map(({ divIdx, ...b }) => b);

  let seed = 7;
  const R = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const pick = (a) => a[Math.floor(R() * a.length)];
  const weights = [10, 4, 3, 3, 5, 3, 2, 4, 3, 3, 2];
  const wPick = (taken) => {
    const ok = weights.map((w, i) => (taken.includes(i) ? 0 : w));
    let x = R() * ok.reduce((s, w) => s + w, 0);
    return ok.findIndex((w) => (x -= w) < 0);
  };
  const responses = Array.from({ length: 48 }, (_, i) => {
    const n = R() < 0.15 ? 1 : R() < 0.3 ? 2 : 3;
    const picks = [];
    while (picks.length < n) picks.push(wPick(picks));
    const a = { [qTw.id]: `https://instagram.com/p/oskm27-${(i + 1).toString(36)}`, [qMot.id]: pick(OSKM_ANS), [qPindah.id]: qPindah.props.options[R() < 0.62 ? 0 : 1].id, [qKom.id]: qKom.props.options[R() < 0.88 ? 0 : 1].id };
    picks.forEach((di, k) => { a[P[k].id] = P[k].props.options[di].id; });
    const fak = pick(OSKM_FAK);
    const r = { id: uid("s"), at: days(-9 + i * 0.17), answers: a, sample: true, who: { nim: `${OSKM_KODE[fak]}26${String(101 + ((i * 37) % 800))}`, name: `${pick(OSKM_FIRST)} ${pick(OSKM_LAST)}`, fak } };
    return r;
  });
  const f = {
    id: "f_oskm", title: "Oprec Panitia OSKM ITB 2027", desc: "Tiga pilihan divisi, pertanyaan per divisi bersyarat.", tags: ["Oprec", "OSKM"], status: "published",
    pinned: true, createdAt: days(-12), closesAt: days(18), maxResponses: "",
    theme: { accent: "#2D5F7A", font: "jakarta", banner: null, bg: "soft" }, blocks, responses,
  };
  const vis0 = (r) => computeVisibility(f, r.answers);
  responses.forEach((r) => {
    const vis = vis0(r);
    divBlocks.forEach((b) => { if (vis[b.id]) r.answers[b.id] = b.type === "short" ? "https://drive.google.com/portofolio-contoh" : pick(OSKM_ANS); });
    r.end = chooseEnding(f, computeVisibility(f, r.answers));
  });
  return f;
}

function sampleForms() {
  const now = Date.now();
  const days = (n) => new Date(now + n * 864e5).toISOString();

  /* 1. Oprec — contoh kondisi bercabang + kondisi numerik */
  const DIV = ["Produk", "Desain", "Engineering", "Data", "Hubungan Lembaga"];
  const W = newBlock("welcome", { title: "<b>Open Recruitment Anmategra 2026</b>", desc: "Bantu kami membangun sistem informasi lembaga KM ITB. Pengisian sekitar 5 menit. Data diri terisi otomatis dari akun ITB-mu.", props: { button: "Mulai", subtitle: "Periode 2026/2027" } });
  const q1 = newBlock("short", { title: "Siapa nama panggilan kamu?", required: true, props: { placeholder: "Contoh: Raka", maxLen: 30 } });
  const q2 = newBlock("dropdown", { title: "Fakultas", required: true, props: { options: ["FSRD", "STEI", "FTI", "FMIPA", "SAPPK", "SBM", "FTSL", "FTTM", "SITH", "SF", "FITB", "FTMD"].map(opt) } });
  const qIpk = newBlock("number", { title: "Berapa IPK terakhirmu?", desc: "Skala 0–4. Tidak menentukan kelulusan.", required: true, props: { min: 0, max: 4 } });
  const qKendala = newBlock("long", { title: "Ceritakan singkat kendala akademik yang sedang kamu hadapi", desc: "Muncul bila IPK < 2,75 — supaya beban kerja bisa kami sesuaikan.", required: false, props: { placeholder: "", maxLen: 400 } });
  const jalurDiv = opt("Staf Divisi"), jalurAhli = opt("Staf Ahli (Tech Lead / Designer)");
  const q3 = newBlock("choice", { title: "Jalur mana yang ingin kamu daftar?", desc: "Pertanyaan berikutnya menyesuaikan jalur yang kamu pilih.", required: true, props: { options: [jalurDiv, jalurAhli] } });
  const q4 = newBlock("choice", { title: "Pilihan divisi <b>pertama</b>", required: true, props: { options: DIV.map(opt) } });
  const q5 = newBlock("dropdown", { title: "Pilihan divisi kedua", props: { options: DIV.map(opt) } });
  const q6 = newBlock("long", { title: "Kenapa kamu tertarik bergabung?", required: true, props: { placeholder: "Ceritakan singkat saja", maxLen: 600 } });
  const q7 = newBlock("file", { title: "Unggah portofolio kamu", desc: "PDF, maksimal 10 MB.", required: true, props: { accept: "pdf", maxFiles: 1, maxSizeMB: 10 } });
  const q8 = newBlock("short", { title: "Tautan GitHub / Behance", props: { placeholder: "https://", maxLen: "" } });
  const tools = ["Figma", "React", "SQL", "Notion", "Python"].map(opt);
  const q9 = newBlock("checkbox", { title: "Tools yang pernah kamu pakai", required: false, props: { options: tools, minSel: "", maxSel: "" } });
  const q10 = newBlock("scale", { title: "Seberapa siap kamu berkomitmen 6 jam per minggu?", required: true, props: { min: 1, max: 5, minLabel: "Belum siap", maxLabel: "Sangat siap", style: "star" } });
  const q11 = newBlock("date", { title: "Kapan kamu bisa mulai?", required: true, props: { mode: "date" } });
  const days5 = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"].map(opt);
  const slots = ["Pagi", "Siang", "Malam"].map(opt);
  const q12 = newBlock("matrix", { title: "Kapan kamu bisa diwawancara?", desc: "Pilih semua yang memungkinkan.", props: { rows: days5, cols: slots, multi: true } });
  const eA = newBlock("ending", { title: "Pendaftaranmu sudah kami terima", desc: "Pengumuman tahap wawancara dikirim lewat Inbox Anmategra.", props: { button: "", url: "" } });
  const eB = newBlock("ending", { title: "Terima kasih sudah jujur", desc: "Komitmen waktu jadi syarat utama. Kami akan menghubungimu bila ada peran yang lebih ringan.", props: { button: "", url: "" } });
  qKendala.cond = condAll(when(qIpk, "lt", "2.75"));
  [q4, q5, q6].forEach((b) => (b.cond = condAll(when(q3, "is", jalurDiv.id))));
  [q7, q8].forEach((b) => (b.cond = condAll(when(q3, "is", jalurAhli.id))));
  [q11, q12].forEach((b) => (b.cond = condAll(when(q10, "gte", "3"))));
  eB.cond = condAll(when(q10, "lt", "3"));

  const oprec = {
    id: "f_oprec", title: "Oprec Anmategra 2026", desc: "Rekrutmen staf periode 2026/2027.", tags: ["Oprec", "Internal"], status: "published",
    pinned: true, createdAt: days(-14), closesAt: days(20), maxResponses: 300,
    theme: { accent: "#00AEB3", font: "jakarta", banner: null, bg: "soft" },
    blocks: [W, q1, q2, qIpk, qKendala, q3, q4, q5, q6, q7, q8, q9, q10, q11, q12, eA, eB],
  };

  /* respons contoh (ditandai sebagai contoh) */
  const names = ["Raka", "Nadia", "Bima", "Salsa", "Dimas", "Kirana", "Fikri"];
  const fak = q2.props.options;
  oprec.responses = names.map((n, i) => {
    const ahli = i % 3 === 1;
    const a = { [q1.id]: n, [q2.id]: fak[(i * 5) % fak.length].id, [qIpk.id]: [3.61, 3.2, 2.6, 3.85, 3.02, 2.9, 3.44][i], [q3.id]: ahli ? jalurAhli.id : jalurDiv.id };
    if (a[qIpk.id] < 2.75) a[qKendala.id] = "Sedang mengulang dua mata kuliah semester ini.";
    if (ahli) { a[q7.id] = [{ name: `portofolio-${n.toLowerCase()}.pdf`, size: 2_400_000 }]; a[q8.id] = `https://github.com/${n.toLowerCase()}`; }
    else { a[q4.id] = q4.props.options[i % 5].id; a[q5.id] = q5.props.options[(i + 2) % 5].id; a[q6.id] = "Ingin belajar membangun produk yang dipakai lembaga sungguhan."; }
    a[q9.id] = tools.filter((_, k) => (i + k) % 2 === 0).map((t) => t.id);
    a[q10.id] = [5, 4, 2, 5, 3, 4, 5][i];
    if (a[q10.id] >= 3) { a[q11.id] = days(7 + i).slice(0, 10); a[q12.id] = { [days5[i % 5].id]: [slots[i % 3].id] }; }
    return { id: uid("s"), at: days(-10 + i), answers: a, sample: true };
  });
  oprec.responses.forEach((r) => { r.end = chooseEnding(oprec, computeVisibility(oprec, r.answers)); });

  /* 2. WELL FORM — dari mockup Pratinjau */
  const g = ["Drama", "Comedy", "Horror", "Action", "Psychological", "Documentary", "Romance", "Sci-Fi"].map(opt);
  const wq2 = newBlock("choice", { title: "Kalau hidup kamu saat ini adalah sebuah genre film, pilih yang paling cocok.", required: true, props: { options: g } });
  const wHorror = newBlock("short", { title: "Wah. Apa film horor yang paling menggambarkan minggu ini?", required: false, cond: condAll(when(wq2, "is", g[2].id)) });
  const wYakin = newBlock("scale", { title: "Seberapa yakin kamu dengan keputusan hidupmu saat ini?", required: true, props: { min: 1, max: 5, minLabel: "bingung..", maxLabel: "YAKIN BANGET", style: "number" } });
  const well = {
    id: "f_well", title: "WELL FORM “Seberapa Manusiawi Kamu Hari Ini?”", desc: "Form ini dibuat untuk mengetahui hal-hal yang sebenarnya tidak perlu diketahui siapa pun. Jawablah dengan jujur, atau tidak juga gapapa.",
    tags: ["Wellbeing"], status: "draft", pinned: false, createdAt: days(-3), closesAt: days(30), maxResponses: "",
    theme: { accent: "#0E8FA3", font: "jakarta", banner: null, bg: "soft" },
    responses: [],
    blocks: [
      newBlock("short", { title: "Siapa nama panggilan kamu?", required: true }),
      wq2, wHorror,
      newBlock("checkbox", { title: "Apa saja yang biasanya kamu lakukan ketika deadline sudah di depan mata?", props: { options: ["Bikin to-do list", "Buka TikTok “sebentar”", "Tiba-tiba menjadi sangat religius", "Mengandalkan kekuatan AI", "“Ah masih sempet ini mah”", "Santai aja gasih"].map(opt), minSel: "", maxSel: "" } }),
      newBlock("dropdown", { title: "Pilih makanan yang paling menggambarkan kepribadianmu.", props: { options: ["Indomie", "Pizza", "Nasi Padang", "Sushi", "Burger", "Salad", "Kopi"].map(opt) } }),
      newBlock("long", { title: "Ceritakan satu keputusan paling random yang pernah kamu buat." }),
      wYakin,
      newBlock("long", { title: "Apa yang bikin kamu ragu?", desc: "Muncul kalau keyakinanmu 1–2.", cond: condAll(when(wYakin, "lte", "2")) }),
      newBlock("scale", { title: "Seberapa tangguh diri kamu sendiri dalam menghadapi setiap rintangan yang ada?", props: { min: 1, max: 5, minLabel: "yaudah gitu", maxLabel: "TANGGUH BANGET", style: "star" } }),
      newBlock("date", { title: "Jam berapa biasanya kamu merasa paling produktif?", props: { mode: "time" } }),
      newBlock("date", { title: "Kapan terakhir kali kamu merasa benar-benar puas dengan hasil kerja sendiri?", props: { mode: "date" } }),
      newBlock("file", { title: "Upload foto terakhir yang ada di galeri kamu.", props: { accept: "jpg,png,heic", maxFiles: 1, maxSizeMB: 10 } }),
      newBlock("matrix", { title: "Seberapa sering kamu melakukan aktivitas berikut dalam satu minggu?", props: { rows: ["Olahraga", "Memasak Sendiri", "Nongkrong bersama teman", "Belajar di luar rumah", "Begadang"].map(opt), cols: ["Tidak Pernah", "Jarang", "Sering", "Setiap Hari"].map(opt), multi: false } }),
      newBlock("matrix", { title: "Dalam situasi berikut, hal apa saja yang biasanya kamu lakukan?", props: { rows: ["Saat Bosan", "Saat stres", "Saat menunggu", "Saat Deadline"].map(opt), cols: ["Buka HP", "Makan", "Tidur", "Musik", "Chattingan"].map(opt), multi: true } }),
      newBlock("ending", { title: "Makasih udah jujur hari ini", desc: "Jangan lupa minum air." }),
    ],
  };

  const kader = {
    id: "f_kader", title: "Evaluasi Kaderisasi Awal PSDM", desc: "Umpan balik peserta setelah rangkaian kaderisasi awal.", tags: ["PSDM", "Evaluasi"], status: "closed",
    pinned: false, createdAt: days(-40), closesAt: days(-5), maxResponses: "", theme: { accent: "#2D5F7A", font: "jakarta", banner: null, bg: "soft" }, responses: [],
    settings: { collectIdentity: false },
    blocks: [
      newBlock("welcome", { title: "Evaluasi Kaderisasi Awal", desc: "Jawabanmu anonim.", props: { button: "Mulai", subtitle: "" } }),
      newBlock("scale", { title: "Secara keseluruhan, seberapa bermanfaat rangkaian kaderisasi?", required: true, props: { min: 1, max: 10, minLabel: "Tidak", maxLabel: "Sangat", style: "number" } }),
      newBlock("long", { title: "Apa yang perlu dipertahankan?" }),
      newBlock("long", { title: "Apa yang perlu diubah?" }),
      newBlock("ending", { title: "Terima kasih!", desc: "" }),
    ],
  };
  const inbox = {
    id: "f_inbox", title: "Survei Kepuasan Inbox Lembaga", desc: "", tags: ["Internal"], status: "draft", pinned: false, createdAt: days(-1), closesAt: null, maxResponses: "",
    theme: { accent: "#00AEB3", font: "jakarta", banner: null, bg: "soft" }, responses: [],
    blocks: [newBlock("number", { title: "Berapa pesan yang kamu terima per minggu?", required: true, props: { min: 0, max: "" } }), newBlock("choice", { title: "Fitur yang paling sering kamu pakai?", required: true, props: { options: ["Arsip", "Penanda", "Balas cepat"].map(opt) } })],
  };
  return [oskmForm(days), oprec, well, kader, inbox].map(withDefaults);
}
function blankForm() {
  return withDefaults({
    id: uid("f"), title: "Form Baru", desc: "", tags: [], status: "draft", pinned: false, createdAt: new Date().toISOString(),
    closesAt: null, maxResponses: "", theme: { accent: "#00AEB3", font: "jakarta", banner: null, bg: "soft" },
    responses: [],
    blocks: [newBlock("welcome", { title: "Judul", desc: "", props: { button: "Mulai", subtitle: "" } }), newBlock("short", { title: "", required: true }), newBlock("ending", { title: "Terima kasih!", desc: "Jawabanmu sudah tersimpan." })],
  });
}
const STATUS = { draft: { label: "Draf", tone: "warn" }, published: { label: "Dirilis", tone: "ok" }, closed: { label: "Ditutup", tone: "muted" } };
const ACCENTS = ["#00AEB3", "#0E8FA3", "#2D5F7A", "#5B5BD6", "#C2185B", "#D9622B", "#3E7D3A", "#3A3F44"];
const FONTS = {
  jakarta: { label: "Jakarta Sans", css: "'Plus Jakarta Sans', system-ui, sans-serif" },
  fraunces: { label: "Fraunces (serif)", css: "'Fraunces', Georgia, serif" },
  mono: { label: "IBM Plex Mono", css: "'IBM Plex Mono', ui-monospace, monospace" },
};

/* ---------- UI dasar ---------- */
const Toggle = ({ on, onChange, label, id }) => (
  <label className="tgl" htmlFor={id}>
    {label && <span>{label}</span>}
    <input id={id} type="checkbox" checked={!!on} onChange={(e) => onChange(e.target.checked)} />
    <i aria-hidden="true" />
  </label>
);

function Modal({ open, title, children, onClose, actions, wide }) {
  useEffect(() => {
    if (!open) return;
    const k = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-scrim" onPointerDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={"modal" + (wide ? " wide" : "")} role="dialog" aria-modal="true" aria-label={title}>
        <h3>{title}</h3>
        <div className="modal-body">{children}</div>
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
}

/* Popover yang menutup saat klik di luar */
function Popover({ open, onClose, children, className = "", anchorRef }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (ref.current?.contains(e.target) || anchorRef?.current?.contains(e.target) || e.target.closest?.('[aria-expanded="true"]')) return;
      onClose();
    };
    const k = (e) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", h);
    window.addEventListener("keydown", k);
    return () => { document.removeEventListener("pointerdown", h); window.removeEventListener("keydown", k); };
  }, [open, onClose, anchorRef]);
  if (!open) return null;
  return <div ref={ref} className={"pop " + className}>{children}</div>;
}

function Toast({ msg }) {
  return <div className={"toast" + (msg ? " show" : "")} role="status" aria-live="polite">{msg}</div>;
}
function useToast() {
  const [msg, setMsg] = useState("");
  const t = useRef();
  const show = useCallback((m) => { setMsg(m); clearTimeout(t.current); t.current = setTimeout(() => setMsg(""), 2200); }, []);
  return [msg, show];
}

const readImage = (file) => new Promise((res, rej) => {
  if (!file) return rej();
  if (file.size > 3 * 1024 * 1024) return rej(new Error("Gambar maksimal 3 MB untuk purwarupa."));
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = rej;
  r.readAsDataURL(file);
});
function ImagePick({ onPick, children, className, title }) {
  const inp = useRef(null);
  return (
    <>
      <button type="button" className={className} title={title} aria-label={title} onClick={() => inp.current?.click()}>{children}</button>
      <input ref={inp} type="file" accept="image/*" hidden onChange={async (e) => { try { onPick(await readImage(e.target.files[0])); } catch (err) { err && onPick(null, err.message); } e.target.value = ""; }} />
    </>
  );
}

/* =====================================================================
   EDITOR — KONTEN
   ===================================================================== */

/* contentEditable tak-terkontrol: DOM hanya ditimpa jika nilai datang dari luar (undo, ganti blok) */
function RichInput({ value, onChange, placeholder, className = "", single, id, onFocus }) {
  const ref = useRef(null);
  const last = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (value !== last.current && el.innerHTML !== (value || "")) el.innerHTML = value || "";
    last.current = value;
  }, [value]);
  return (
    <div
      id={id}
      ref={ref}
      className={"rich " + className}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={placeholder}
      data-ph={placeholder}
      onFocus={onFocus}
      onInput={(e) => {
        const el = e.currentTarget;
        let html = el.innerHTML;
        if (!el.textContent.trim() && !el.querySelector("img")) { html = ""; if (el.innerHTML !== "") el.innerHTML = ""; }
        last.current = html;
        onChange(html);
      }}
      onKeyDown={(e) => {
        if (single && e.key === "Enter") e.preventDefault();
        if ((e.metaKey || e.ctrlKey) && ["b", "i", "u"].includes(e.key.toLowerCase())) {
          e.preventDefault();
          document.execCommand({ b: "bold", i: "italic", u: "underline" }[e.key.toLowerCase()]);
        }
      }}
      onPaste={(e) => {
        e.preventDefault();
        const t = e.clipboardData.getData("text/plain");
        document.execCommand("insertText", false, single ? t.replace(/\s*\n\s*/g, " ") : t);
      }}
    />
  );
}

function FormatBar() {
  const [linking, setLinking] = useState(false);
  const [url, setUrl] = useState("https://");
  const range = useRef(null);
  const cmd = (c) => (e) => { e.preventDefault(); document.execCommand(c); };
  const startLink = (e) => {
    e.preventDefault();
    const s = window.getSelection();
    if (!s.rangeCount || s.isCollapsed) { setLinking("empty"); return; }
    range.current = s.getRangeAt(0).cloneRange();
    setLinking(true);
  };
  const apply = () => {
    if (range.current && /^https?:\/\/.+/.test(url)) {
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(range.current);
      document.execCommand("createLink", false, url);
    }
    setLinking(false);
    setUrl("https://");
  };
  return (
    <div className="fmt" role="toolbar" aria-label="Format teks">
      <button type="button" title="Tebal (Ctrl+B)" aria-label="Tebal" onMouseDown={cmd("bold")}><Icon name="bold" size={15} sw={2.2} /></button>
      <button type="button" title="Miring (Ctrl+I)" aria-label="Miring" onMouseDown={cmd("italic")}><Icon name="italic" size={15} sw={2.2} /></button>
      <button type="button" title="Garis bawah (Ctrl+U)" aria-label="Garis bawah" onMouseDown={cmd("underline")}><Icon name="underline" size={15} sw={2.2} /></button>
      <button type="button" title="Tautan" aria-label="Tautan" onMouseDown={startLink}><Icon name="link" size={15} sw={2.2} /></button>
      <button type="button" title="Hapus format" aria-label="Hapus format" onMouseDown={(e) => { e.preventDefault(); document.execCommand("removeFormat"); document.execCommand("unlink"); }}><Icon name="clearfmt" size={15} sw={2.2} /></button>
      {linking === "empty" && <span className="fmt-hint">Blok teksnya dulu, lalu klik tautan. <button type="button" className="lnk" onClick={() => setLinking(false)}>Tutup</button></span>}
      {linking === true && (
        <span className="fmt-link">
          <input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") apply(); if (e.key === "Escape") setLinking(false); }} aria-label="URL tautan" />
          <button type="button" className="btn sm accent" onClick={apply}>Pasang</button>
        </span>
      )}
    </div>
  );
}

/* ---------- editor opsi (pilihan ganda / checkbox / dropdown) ---------- */
function OptionsEditor({ block, api }) {
  const opts = block.props.options;
  const refs = useRef({});
  const focusNext = useRef(null);
  useEffect(() => {
    if (focusNext.current && refs.current[focusNext.current]) { refs.current[focusNext.current].focus(); refs.current[focusNext.current].select(); focusNext.current = null; }
  });
  const set = (options, key) => api.updateProps(block.id, { options }, key);
  const add = (at = opts.length, label) => {
    const o = opt(label ?? `Pilihan ${opts.length + 1}`);
    const n = [...opts];
    n.splice(at, 0, o);
    focusNext.current = o.id;
    set(n);
  };
  const marker = (i) => block.type === "choice" ? LETTERS[i] : block.type === "dropdown" ? i + 1 : <Icon name="check" size={12} sw={2.4} />;
  return (
    <div className="opts">
      {opts.map((o, i) => (
        <div className="opt-row" key={o.id}>
          <span className={"opt-mark " + block.type}>{marker(i)}</span>
          <input
            ref={(el) => (refs.current[o.id] = el)}
            className="opt-in"
            value={o.label}
            aria-label={`Pilihan ${i + 1}`}
            onChange={(e) => set(opts.map((x) => (x.id === o.id ? { ...x, label: e.target.value } : x)), `opt:${o.id}`)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); add(i + 1, ""); }
              if (e.key === "Backspace" && !o.label && opts.length > 1) { e.preventDefault(); const prev = opts[i - 1] || opts[i + 1]; focusNext.current = prev.id; set(opts.filter((x) => x.id !== o.id)); }
              if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
                e.preventDefault();
                const j = i + (e.key === "ArrowUp" ? -1 : 1);
                if (j < 0 || j >= opts.length) return;
                const n = [...opts];
                [n[i], n[j]] = [n[j], n[i]];
                focusNext.current = o.id;
                set(n);
              }
            }}
            onPaste={(e) => {
              const t = e.clipboardData.getData("text/plain");
              if (!t.includes("\n")) return;
              e.preventDefault();
              const lines = t.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
              const n = [...opts];
              n.splice(i, 1, { ...o, label: lines[0] }, ...lines.slice(1).map(opt));
              set(n);
              api.toast(`${lines.length} pilihan ditempel`);
            }}
          />
          {opts.length > 1 && <button type="button" className="icon-btn ghost" aria-label="Hapus pilihan" title="Hapus pilihan" onClick={() => set(opts.filter((x) => x.id !== o.id))}><Icon name="x" size={14} /></button>}
        </div>
      ))}
      <div className="opt-foot">
        <button type="button" className="lnk" onClick={() => add()}>Tambah pilihan</button>
        <span className="hint">Enter = pilihan baru · tempel daftar multi-baris · Alt+↑↓ geser</span>
      </div>
      {block.type === "checkbox" && (
        <div className="settings-row">
          <label>Minimal dipilih <input type="number" min="0" value={block.props.minSel} onChange={(e) => api.updateProps(block.id, { minSel: e.target.value }, `min:${block.id}`)} /></label>
          <label>Maksimal dipilih <input type="number" min="0" value={block.props.maxSel} onChange={(e) => api.updateProps(block.id, { maxSel: e.target.value }, `max:${block.id}`)} /></label>
        </div>
      )}
    </div>
  );
}

function MatrixEditor({ block, api }) {
  const { rows, cols, multi } = block.props;
  const up = (patch, key) => api.updateProps(block.id, patch, key);
  return (
    <div className="mx-edit">
      <div className="mx-scroll">
        <table className="mx">
          <thead>
            <tr>
              <th />
              {cols.map((c) => (
                <th key={c.id}>
                  <div className="mx-hd">
                    <input value={c.label} aria-label="Nama kolom" onChange={(e) => up({ cols: cols.map((x) => (x.id === c.id ? { ...x, label: e.target.value } : x)) }, `c:${c.id}`)} />
                    {cols.length > 1 && <button type="button" className="icon-btn ghost xs" aria-label="Hapus kolom" onClick={() => up({ cols: cols.filter((x) => x.id !== c.id) })}><Icon name="x" size={12} /></button>}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <th>
                  <div className="mx-hd row">
                    <input value={r.label} aria-label="Nama baris" onChange={(e) => up({ rows: rows.map((x) => (x.id === r.id ? { ...x, label: e.target.value } : x)) }, `r:${r.id}`)} />
                    {rows.length > 1 && <button type="button" className="icon-btn ghost xs" aria-label="Hapus baris" onClick={() => up({ rows: rows.filter((x) => x.id !== r.id) })}><Icon name="x" size={12} /></button>}
                  </div>
                </th>
                {cols.map((c) => <td key={c.id}><span className={multi ? "fake-cb" : "fake-rd"} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="opt-foot">
        <button type="button" className="lnk" onClick={() => up({ rows: [...rows, opt(`Baris ${rows.length + 1}`)] })}>Tambah Baris</button>
        <button type="button" className="lnk" onClick={() => up({ cols: [...cols, opt(`Pilihan ${cols.length + 1}`)] })}>Tambah Kolom</button>
        <Toggle id={`mx-${block.id}`} label="Boleh lebih dari satu per baris" on={multi} onChange={(v) => up({ multi: v })} />
      </div>
    </div>
  );
}

function ScaleEditor({ block, api }) {
  const p = block.props;
  const up = (patch, key) => api.updateProps(block.id, patch, key);
  const n = [];
  for (let i = p.min; i <= p.max; i++) n.push(i);
  return (
    <div className="scale-edit">
      <div className="settings-row">
        <select aria-label="Nilai awal" value={p.min} onChange={(e) => up({ min: Number(e.target.value) })}>{[0, 1].map((v) => <option key={v}>{v}</option>)}</select>
        <span className="muted">sampai</span>
        <select aria-label="Nilai akhir" value={p.max} onChange={(e) => up({ max: Number(e.target.value) })}>{[2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => <option key={v}>{v}</option>)}</select>
        <div className="seg" role="radiogroup" aria-label="Gaya skala">
          {[["number", "Angka"], ["star", "Bintang"]].map(([k, l]) => <button type="button" key={k} role="radio" aria-checked={p.style === k} className={p.style === k ? "on" : ""} onClick={() => up({ style: k })}>{l}</button>)}
        </div>
      </div>
      <div className="lbl-row"><span className="num">{p.min}</span><input placeholder="Label (opsional)" value={p.minLabel} onChange={(e) => up({ minLabel: e.target.value }, `ml:${block.id}`)} /></div>
      <div className="lbl-row"><span className="num">{p.max}</span><input placeholder="Label (opsional)" value={p.maxLabel} onChange={(e) => up({ maxLabel: e.target.value }, `xl:${block.id}`)} /></div>
      <div className="scale-prev" aria-hidden="true">
        {n.map((i) => <span key={i} className={p.style === "star" ? "st" : "nb"}>{p.style === "star" ? <Icon name="star" size={18} /> : i}</span>)}
      </div>
    </div>
  );
}

function TypeBody({ block, api }) {
  const p = block.props;
  const up = (patch, key) => api.updateProps(block.id, patch, key);
  switch (block.type) {
    case "short":
    case "long":
      return (
        <div>
          <div className={"ans-line" + (block.type === "long" ? " tall" : "")}>{p.placeholder || "Masukan jawaban..."}</div>
          <div className="settings-row">
            <label>Placeholder <input value={p.placeholder} onChange={(e) => up({ placeholder: e.target.value }, `ph:${block.id}`)} /></label>
            <label>Maks. karakter <input type="number" min="1" value={p.maxLen} onChange={(e) => up({ maxLen: e.target.value }, `ml:${block.id}`)} /></label>
          </div>
        </div>
      );
    case "number":
      return (
        <div>
          <div className="ans-line">0</div>
          <div className="settings-row">
            <label>Minimum <input type="number" value={p.min} onChange={(e) => up({ min: e.target.value }, `mn:${block.id}`)} /></label>
            <label>Maksimum <input type="number" value={p.max} onChange={(e) => up({ max: e.target.value }, `mx:${block.id}`)} /></label>
          </div>
        </div>
      );
    case "choice":
    case "checkbox":
    case "dropdown":
      return <OptionsEditor block={block} api={api} />;
    case "matrix":
      return <MatrixEditor block={block} api={api} />;
    case "scale":
      return <ScaleEditor block={block} api={api} />;
    case "date":
      return (
        <div className="date-edit">
          <div className="ans-line inline">{p.mode === "time" ? "HH : MM" : p.mode === "datetime" ? "DD / MM / YYYY  HH : MM" : "DD / MM / YYYY"}<Icon name={p.mode === "time" ? "clock" : "date"} size={18} /></div>
          <div className="seg" role="radiogroup" aria-label="Jenis isian">
            {[["date", "Tanggal"], ["time", "Waktu"], ["datetime", "Tanggal & waktu"]].map(([k, l]) => <button type="button" key={k} role="radio" aria-checked={p.mode === k} className={p.mode === k ? "on" : ""} onClick={() => up({ mode: k })}>{l}</button>)}
          </div>
        </div>
      );
    case "file":
      return (
        <div className="file-edit">
          <label className="pill-in"><span>Hanya izinkan jenis file tertentu</span><input placeholder="mis. pdf, jpg (kosong = semua)" value={p.accept} onChange={(e) => up({ accept: e.target.value }, `ac:${block.id}`)} /></label>
          <label className="pill-in"><span>Jumlah maksimum file</span><input type="number" min="1" max="10" value={p.maxFiles} onChange={(e) => up({ maxFiles: clamp(Number(e.target.value) || 1, 1, 10) }, `mf:${block.id}`)} /></label>
          <label className="pill-in"><span>Ukuran file maksimum (MB)</span><input type="number" min="1" max="100" value={p.maxSizeMB} onChange={(e) => up({ maxSizeMB: clamp(Number(e.target.value) || 1, 1, 100) }, `ms:${block.id}`)} /></label>
        </div>
      );
    default:
      return null;
  }
}

/* ---------- kartu blok ---------- */
const BlockCard = memo(function BlockCard({ block, number, selected, api, condSum, deps, condOpen, form }) {
  const T = TYPES[block.type];
  const sel = () => !selected && api.select(block.id);
  if (block.type === "welcome") {
    return (
      <section id={`card-${block.id}`} className={"card welcome" + (selected ? " sel" : "")} onPointerDownCapture={sel} onFocusCapture={sel} aria-label="Welcome screen">
        <div className="card-tag"><Icon name={T.icon} size={14} />Welcome screen</div>
        <div className="wel-top">
          <ImagePick className={"img-circle" + (block.image ? " has" : "")} title="Pilih gambar" onPick={(img, err) => (err ? api.toast(err) : api.update(block.id, { image: img }))}>
            {block.image ? <img src={block.image} alt="" /> : <><Icon name="image" size={22} /><small>Pilih gambar</small></>}
          </ImagePick>
          <div className="wel-titles">
            <RichInput className="h-judul" value={block.title} single placeholder="JUDUL" onChange={(v) => api.update(block.id, { title: v }, `t:${block.id}`)} />
            <input className="h-sub" placeholder="SUB JUDUL" value={block.props.subtitle || ""} onChange={(e) => api.updateProps(block.id, { subtitle: e.target.value }, `st:${block.id}`)} />
          </div>
        </div>
        <FormatBar />
        <label className="fld"><span>Deskripsi</span>
          <textarea rows="3" placeholder="Masukkan deskripsi..." value={block.desc} onChange={(e) => api.update(block.id, { desc: e.target.value }, `d:${block.id}`)} />
        </label>
        <div className="wel-btn"><input aria-label="Label tombol mulai" className="btn-edit" value={block.props.button} onChange={(e) => api.updateProps(block.id, { button: e.target.value }, `bt:${block.id}`)} /></div>
        <small className="muted center-note">Di tampilan responden, welcome screen jadi kepala halaman form.</small>
        <CardFoot block={block} api={api} />
      </section>
    );
  }
  const isEnd = block.type === "ending";
  return (
    <section id={`card-${block.id}`} className={"card" + (selected ? " sel" : "") + (isEnd ? " ending" : "") + (condSum ? " is-cond" : "")} onPointerDownCapture={sel} onFocusCapture={sel} aria-label={`${T.label} ${number || ""}`}>
      <div className="card-head">
        <span className={"qnum" + (isEnd ? " end" : "")}>{isEnd ? <Icon name="ending" size={14} /> : number}</span>
        <div className="q-main">
          <RichInput className="q-title" value={block.title} single placeholder={isEnd ? "Masukan Judul" : "Masukan pertanyaan"} onChange={(v) => api.update(block.id, { title: v }, `t:${block.id}`)} />
          <FormatBar />
          <input className="q-desc" placeholder={isEnd ? "Pesan penutup (opsional)" : "Deskripsi (opsional)"} value={block.desc} onChange={(e) => api.update(block.id, { desc: e.target.value }, `d:${block.id}`)} />
        </div>
        <ImagePick className={"img-btn" + (block.image ? " has" : "")} title={block.image ? "Ganti gambar" : "Tambah gambar"} onPick={(img, err) => (err ? api.toast(err) : api.update(block.id, { image: img }))}>
          {block.image ? <img src={block.image} alt="" /> : <Icon name="image" size={26} sw={1.6} />}
        </ImagePick>
      </div>
      {block.image && <div className="img-row"><img src={block.image} alt="" /><button type="button" className="lnk danger" onClick={() => api.update(block.id, { image: null })}>Hapus gambar</button></div>}
      <div className="card-body">
        {isEnd ? (
          <div className="settings-row">
            <label>Label tombol <input placeholder="mis. Kunjungi situs" value={block.props.button} onChange={(e) => api.updateProps(block.id, { button: e.target.value }, `eb:${block.id}`)} /></label>
            <label className="grow">Tautan tombol <input placeholder="https://" value={block.props.url} onChange={(e) => api.updateProps(block.id, { url: e.target.value }, `eu:${block.id}`)} /></label>
          </div>
        ) : (
          <TypeBody block={block} api={api} />
        )}
      </div>
      <CondArea block={block} api={api} condSum={condSum} deps={deps} condOpen={condOpen} form={form} />
      <CardFoot block={block} api={api} condOpen={condOpen} hasCond={!!condSum} />
    </section>
  );
});

function CondArea({ block, api, condSum, deps, condOpen, form }) {
  if (block.type === "welcome") return null;
  return (
    <>
      {(condSum || deps > 0) && !condOpen && (
        <div className="cond-chips">
          {condSum && <button type="button" className="cond-chip" onClick={() => api.toggleCond(block.id)} title="Ubah kondisi"><Icon name="cond" size={13} /><span>Tampil jika {condSum}</span></button>}
          {deps > 0 && <button type="button" className="cond-chip alt" onClick={() => api.openFlow(block.id)}><Icon name="branch" size={13} />Memunculkan {deps} blok</button>}
        </div>
      )}
      {condOpen && form && (
        <div className="cond-box">
          <div className="cond-box-hd"><b><Icon name="cond" size={14} />Tampilkan blok ini jika</b><button type="button" className="lnk" onClick={() => api.openFlow(block.id)}>Lihat di Alur</button><button type="button" className="icon-btn xs ghost" aria-label="Tutup kondisi" onClick={() => api.toggleCond(block.id)}><Icon name="x" size={14} /></button></div>
          <ConditionBuilder form={form} block={block} api={api} />
        </div>
      )}
    </>
  );
}

function CardFoot({ block, api, condOpen, hasCond }) {
  const q = isQuestion(block);
  return (
    <div className="card-foot">
      {q && (
        <select className="type-sw" aria-label="Ubah tipe" value={block.type} onChange={(e) => api.changeType(block.id, e.target.value)}>
          {TYPE_ORDER.filter((t) => !TYPES[t].screen).map((t) => <option key={t} value={t}>{TYPES[t].label}</option>)}
        </select>
      )}
      <span className="sp" />
      {block.type !== "welcome" && <button type="button" className={"btn sm ghost cond-btn" + (condOpen || hasCond ? " on" : "")} aria-pressed={!!condOpen} onClick={() => api.toggleCond(block.id)}><Icon name="cond" size={14} />Kondisi{hasCond ? " ✓" : ""}</button>}
      <button type="button" className="icon-btn" title="Duplikat" aria-label="Duplikat" onClick={() => api.duplicate(block.id)} disabled={block.type === "welcome"}><Icon name="copy" /></button>
      <button type="button" className="icon-btn" title="Hapus" aria-label="Hapus" onClick={() => api.askDelete(block.id)}><Icon name="trash" /></button>
      {q && <><span className="vr" /><Toggle id={`req-${block.id}`} label="Wajib" on={block.required} onChange={(v) => api.update(block.id, { required: v })} /></>}
    </div>
  );
}

/* ---------- daftar Halaman (drag pointer untuk urutan) ---------- */
function PageList({ form, selected, api }) {
  const listRef = useRef(null);
  const drag = useRef(null);
  const [dragId, setDragId] = useState(null);
  const [dropAt, setDropAt] = useState(null);

  const onDown = (e, b) => {
    if (e.button !== 0 || !isQuestion(b)) return;
    drag.current = { id: b.id, y0: e.clientY, started: false, el: e.currentTarget, pid: e.pointerId };
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.y0;
    if (!d.started) {
      if (Math.abs(dy) < 5) return;
      d.started = true;
      try { d.el.setPointerCapture(d.pid); } catch {}
      setDragId(d.id);
    }
    d.el.style.transform = `translateY(${dy}px)`;
    const items = [...listRef.current.querySelectorAll("[data-q]")];
    let at = items.length;
    for (let i = 0; i < items.length; i++) {
      const r = items[i].getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) { at = i; break; }
    }
    setDropAt(at);
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    d.el.style.transform = "";
    if (d.started) {
      const qs = form.blocks.filter(isQuestion);
      const from = qs.findIndex((x) => x.id === d.id);
      let to = dropAt ?? from;
      if (to > from) to--;
      if (to !== from) {
        const n = [...qs];
        const [m] = n.splice(from, 1);
        n.splice(to, 0, m);
        api.reorderQuestions(n.map((x) => x.id));
      }
    } else api.select(d.id, true);
    setDragId(null);
    setDropAt(null);
  };
  let qi = 0;
  return (
    <div className="pages" ref={listRef} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      {form.blocks.map((b) => {
        const q = isQuestion(b);
        const n = q ? ++qi : null;
        const idx = q ? n - 1 : -1;
        const T = TYPES[b.type];
        return (
          <React.Fragment key={b.id}>
            {q && dropAt === idx && dragId && <div className="drop-line" />}
            <div
              data-q={q ? "1" : undefined}
              className={"page-item" + (selected === b.id ? " sel" : "") + (dragId === b.id ? " dragging" : "") + (isConditional(form, b) ? " cnd" : "")}
              onPointerDown={(e) => (q ? onDown(e, b) : null)}
              onClick={() => !q && api.select(b.id, true)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); api.select(b.id, true); } }}
              role="button"
              tabIndex={0}
              title={isConditional(form, b) ? "Tampil jika " + condSummary(form, b) : undefined}
            >
              {q && <Icon name="grip" size={14} className="grip" />}
              <Icon name={T.icon} size={16} />
              <span className="pi-text"><b>{q ? `${n}. ` : ""}{T.label}:</b> {stripHtml(b.title) || (q ? (b.required ? "Wajib" : "Optional") : "Optional")}</span>
              {q && b.required && <span className="req-dot" title="Wajib" />}
              {isConditional(form, b) && <Icon name="cond" size={13} className="pi-branch" />}
            </div>
          </React.Fragment>
        );
      })}
      {dragId && dropAt === form.blocks.filter(isQuestion).length && <div className="drop-line" />}
    </div>
  );
}

function FormMeta({ form, api }) {
  const [tagDraft, setTagDraft] = useState(null);
  const responses = form.responses?.length || 0;
  return (
    <div className="meta">
      <div className="meta-name">
        <Icon name="menu" size={24} sw={1.6} className="muted" />
        <input aria-label="Nama form" value={form.title} onChange={(e) => api.setMeta({ title: e.target.value }, "title")} />
        <Icon name="edit" size={15} className="muted" />
      </div>
      <div className="tags">
        {form.tags.map((t) => (
          <span key={t} className="tag">{t}<button type="button" aria-label={`Hapus tag ${t}`} onClick={() => api.setMeta({ tags: form.tags.filter((x) => x !== t) })}><Icon name="x" size={11} sw={2.4} /></button></span>
        ))}
        {tagDraft === null ? (
          <button type="button" className="tag add" aria-label="Tambah tag" onClick={() => setTagDraft("")}><Icon name="plus" size={12} sw={2.4} /></button>
        ) : (
          <input className="tag-in" autoFocus value={tagDraft} placeholder="Tag baru" onChange={(e) => setTagDraft(e.target.value)}
            onBlur={() => { const t = tagDraft.trim(); if (t && !form.tags.includes(t)) api.setMeta({ tags: [...form.tags, t] }); setTagDraft(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setTagDraft(null); }} />
        )}
      </div>
      <div className="meta-row">
        <label className="meta-cell">
          <span className="meta-lbl">Tenggat Penutupan Form</span>
          <span className="meta-val"><Icon name="calendar" size={22} sw={1.6} /><input type="datetime-local" value={toLocalInput(form.closesAt)} onChange={(e) => api.setMeta({ closesAt: e.target.value ? new Date(e.target.value).toISOString() : null }, "closes")} aria-label="Tenggat penutupan" /></span>
        </label>
        <label className="meta-cell">
          <span className="meta-lbl">Kuota responden</span>
          <span className="meta-val"><Icon name="users" size={22} sw={1.6} /><input type="number" min="1" placeholder="∞" value={form.maxResponses} onChange={(e) => api.setMeta({ maxResponses: e.target.value }, "max")} aria-label="Kuota responden" /></span>
        </label>
      </div>
      <div className="meta-count">{responses} respons masuk{form.maxResponses ? ` dari ${form.maxResponses}` : ""}</div>
      <textarea className="meta-desc" rows="2" placeholder="Deskripsi Form (Opsional)..." value={form.desc} onChange={(e) => api.setMeta({ desc: e.target.value }, "desc")} />
    </div>
  );
}

function DesignPanel({ form, api }) {
  const t = form.theme;
  const set = (patch) => api.setMeta({ theme: { ...t, ...patch } });
  return (
    <div className="design">
      <h4>Desain</h4>
      <small className="muted">Perubahan langsung terlihat di editor dan pratinjau.</small>
      <div className="d-sec">
        <span className="d-lbl">Warna aksen</span>
        <div className="swatches">
          {ACCENTS.map((c) => <button type="button" key={c} className={"sw" + (t.accent === c ? " on" : "")} style={{ background: c }} aria-label={`Aksen ${c}`} onClick={() => set({ accent: c })} />)}
          <label className="sw custom" title="Warna lain"><input type="color" value={t.accent} onChange={(e) => set({ accent: e.target.value })} aria-label="Warna lain" /><Icon name="plus" size={12} /></label>
        </div>
      </div>
      <div className="d-sec">
        <span className="d-lbl">Huruf</span>
        <select value={t.font} onChange={(e) => set({ font: e.target.value })} aria-label="Huruf">{Object.entries(FONTS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}</select>
      </div>
      <div className="d-sec">
        <span className="d-lbl">Latar</span>
        <div className="seg full" role="radiogroup" aria-label="Latar">
          {[["soft", "Lembut"], ["plain", "Polos"], ["tint", "Warna aksen"]].map(([k, l]) => <button type="button" key={k} role="radio" aria-checked={t.bg === k} className={t.bg === k ? "on" : ""} onClick={() => set({ bg: k })}>{l}</button>)}
        </div>
      </div>
      <div className="d-sec">
        <span className="d-lbl">Banner</span>
        {t.banner ? (
          <div className="banner-prev"><img src={t.banner} alt="" /><button type="button" className="lnk danger" onClick={() => set({ banner: null })}>Hapus banner</button></div>
        ) : (
          <ImagePick className="btn ghost full" title="Unggah banner" onPick={(img, err) => (err ? api.toast(err) : set({ banner: img }))}><Icon name="upload" size={16} />Unggah banner</ImagePick>
        )}
      </div>
    </div>
  );
}

function KontenView({ form, selected, api, panelOpen, condOpen }) {
  const [addOpen, setAddOpen] = useState(false);
  const [designOpen, setDesignOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const addRef = useRef(null);
  const desRef = useRef(null);
  const condInfo = useMemo(() => {
    const sum = {}, deps = {};
    form.blocks.forEach((b) => {
      sum[b.id] = condSummary(form, b);
      validRules(form, b).forEach((r) => (deps[r.src] = (deps[r.src] || 0) + 1));
    });
    return { sum, deps };
  }, [form]);
  const th = form.theme;
  let n = 0;
  const hasWelcome = form.blocks.some((b) => b.type === "welcome");
  return (
    <div className={"konten" + (panelOpen ? " panel-open" : "")}>
      <aside className="side">
        <FormMeta form={form} api={api} />
        <div className="pages-box">
          <h4>Halaman</h4>
          <PageList form={form} selected={selected} api={api} />
        </div>
      </aside>
      <div className={"main canvas-" + (th.bg || "soft")} id="konten-main" style={{ "--accent": th.accent, "--fa": th.accent, "--ffont": (FONTS[th.font] || FONTS.jakarta).css }}>
        <div className="toolbar">
          <div className="tb-group">
            <button ref={addRef} type="button" className={"btn tb" + (addOpen ? " on" : "")} aria-expanded={addOpen} onClick={() => setAddOpen((v) => !v)}><Icon name="plus" size={16} />Tambah Konten</button>
            <Popover open={addOpen} onClose={() => setAddOpen(false)} anchorRef={addRef} className="add-menu">
              {TYPE_ORDER.map((t) => (
                <button type="button" key={t} disabled={t === "welcome" && hasWelcome} onClick={() => { api.add(t); setAddOpen(false); }}>
                  <Icon name={TYPES[t].icon} size={17} />{TYPES[t].label}{t === "welcome" && hasWelcome && <small>sudah ada</small>}
                </button>
              ))}
            </Popover>
          </div>
          <span className="vr" />
          <div className="tb-group">
            <button ref={desRef} type="button" className={"btn tb" + (designOpen ? " on" : "")} aria-expanded={designOpen} onClick={() => setDesignOpen((v) => !v)}><Icon name="palette" size={16} />Desain</button>
            <Popover open={designOpen} onClose={() => setDesignOpen(false)} anchorRef={desRef} className="design-pop"><DesignPanel form={form} api={api} /></Popover>
          </div>
          <button type="button" className={"btn tb sm-tb" + (settingsOpen ? " on" : "")} aria-expanded={settingsOpen} onClick={() => setSettingsOpen(true)}><Icon name="gear" size={16} />Pengaturan</button>
          <span className="sp" />
          <button type="button" className="icon-btn lg" title="Pratinjau desktop" aria-label="Pratinjau desktop" onClick={() => api.preview(null, "desktop")}><Icon name="laptop" size={22} /></button>
          <button type="button" className="icon-btn lg" title="Pratinjau di blok terpilih" aria-label="Pratinjau di blok terpilih" onClick={() => api.preview(selected)}><Icon name="play" size={20} fill="currentColor" /></button>
        </div>
        <div className="cards">
          {th.banner && <div className="ed-banner"><img src={th.banner} alt="" /></div>}
          {form.blocks.map((b) => (
            <BlockCard key={b.id} block={b} number={isQuestion(b) ? ++n : null} selected={selected === b.id} api={api} condSum={condInfo.sum[b.id]} deps={condInfo.deps[b.id] || 0} condOpen={condOpen === b.id} form={condOpen === b.id ? form : null} />
          ))}
          <button type="button" className="add-tail" onClick={() => setAddOpen(true) || document.getElementById("konten-main")?.scrollTo({ top: 0, behavior: "smooth" })}><Icon name="plus" size={16} />Tambah konten</button>
        </div>
      </div>
      {settingsOpen && <SettingsDrawer form={form} api={api} onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

/* ---------- pengaturan form (drawer kanan) ---------- */
const SETTING_GROUPS = [
  ["Saat menyusun", [
    ["requiredByDefault", "Pertanyaan baru otomatis wajib", "Lebih aman: pengurus jarang lupa mewajibkan, tapi sering lupa melepas. Ubah per pertanyaan lewat toggle Wajib."],
  ]],
  ["Tampilan responden", [
    ["showNumbers", "Tampilkan nomor pertanyaan", "Nomor dihitung ulang dari pertanyaan yang sedang tampil, jadi tidak ada nomor yang loncat."],
    ["showProgress", "Tampilkan progres pengisian", "Bilah tipis di atas: berapa pertanyaan tampil yang sudah terjawab."],
    ["shuffleOptions", "Acak urutan pilihan jawaban", "Mengurangi bias urutan (pilihan pertama cenderung dipilih). Jangan dipakai untuk opsi yang berurutan logis, seperti skala atau angkatan."],
    ["reviewBeforeSubmit", "Tampilkan ringkasan sebelum kirim", "Responden memeriksa semua jawaban dulu. Disarankan untuk form panjang seperti oprec."],
  ]],
  ["Keamanan data responden", [
    ["autosaveDraft", "Simpan draf otomatis", "Jawaban tidak hilang saat tab tertutup atau sinyal putus; dipulihkan saat form dibuka lagi."],
    ["confirmOnLeave", "Peringatkan saat meninggalkan halaman", "Muncul hanya bila ada jawaban yang belum terkirim."],
  ]],
  ["Akses & pengumpulan", [
    ["collectIdentity", "Catat identitas dari akun ITB", "Nama dan NIM terisi otomatis. Matikan untuk survei anonim seperti evaluasi."],
    ["oneResponsePerAccount", "Batasi satu respons per akun", "Mencegah pendaftaran ganda."],
    ["allowEditAfterSubmit", "Izinkan mengedit setelah mengirim", "Responden bisa memperbaiki jawaban sampai form ditutup."],
    ["notifyOnResponse", "Kirim notifikasi ke Inbox pengurus", "Satu notifikasi per respons masuk."],
  ]],
];
function SettingsDrawer({ form, api, onClose }) {
  const S = form.settings;
  const set = (patch, key) => api.setMeta({ settings: { ...S, ...patch } }, key);
  const qs = form.blocks.filter(isQuestion);
  const optionalCount = qs.filter((b) => !b.required).length;
  useEffect(() => { const k = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return (
    <div className="drawer-scrim" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Pengaturan form">
        <div className="drawer-hd"><h3><Icon name="gear" size={18} />Pengaturan form</h3><button type="button" className="icon-btn" aria-label="Tutup" onClick={onClose}><Icon name="x" /></button></div>
        <div className="drawer-body">
          {SETTING_GROUPS.map(([g, items]) => (
            <section key={g} className="set-group">
              <h4>{g}</h4>
              {items.map(([k, label, help]) => (
                <div key={k} className="set-row">
                  <div className="set-txt"><label htmlFor={`set-${k}`}>{label}</label><small>{help}</small>
                    {k === "requiredByDefault" && optionalCount > 0 && <button type="button" className="lnk" onClick={() => { api.mutateBlocks((bs) => bs.map((b) => (isQuestion(b) ? { ...b, required: true } : b))); api.toast(`${optionalCount} pertanyaan dijadikan wajib`); }}>Jadikan {optionalCount} pertanyaan opsional yang ada sebagai wajib</button>}
                    {k === "oneResponsePerAccount" && !S.collectIdentity && S.oneResponsePerAccount && <small className="warn-txt">Form anonim: pembatasan tetap berjalan lewat sidik akun, tapi identitas tidak disimpan.</small>}
                  </div>
                  <Toggle id={`set-${k}`} on={S[k]} onChange={(v) => set({ [k]: v })} />
                </div>
              ))}
            </section>
          ))}
          <section className="set-group">
            <h4>Penutupan</h4>
            <div className="set-row col">
              <label htmlFor="set-closed">Pesan saat form ditutup</label>
              <small>Tampil saat tenggat lewat ({fmtDeadline(form.closesAt)}) atau kuota {form.maxResponses || "∞"} responden terpenuhi.</small>
              <textarea id="set-closed" rows="2" value={S.closedMessage} onChange={(e) => set({ closedMessage: e.target.value }, "closedMsg")} />
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

/* =====================================================================
   PEMBANGUN KONDISI (dipakai di Konten & Alur)
   ===================================================================== */
function RuleValueInput({ src, rule, onChange }) {
  const d = opDef(src.type, rule.op);
  if (!d || d[2] === 0) return null;
  const p = src.props || {};
  if (d[2] === "multi") {
    const cur = rule.value || [];
    return (
      <div className="cv-multi" role="group" aria-label="Pilih opsi">
        {p.options.map((o) => {
          const on = cur.includes(o.id);
          return <button type="button" key={o.id} aria-pressed={on} className={"cv-chip" + (on ? " on" : "")} onClick={() => onChange({ value: on ? cur.filter((x) => x !== o.id) : [...cur, o.id] })}>{on && <Icon name="check" size={12} sw={2.6} />}{o.label || "(kosong)"}</button>;
        })}
      </div>
    );
  }
  if (d[2] === "cell") {
    return (
      <>
        <select aria-label="Baris" value={rule.value || ""} onChange={(e) => onChange({ value: e.target.value })}><option value="" disabled>Baris…</option>{p.rows.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select>
        <select aria-label="Kolom" value={rule.value2 || ""} onChange={(e) => onChange({ value2: e.target.value })}><option value="" disabled>Kolom…</option>{p.cols.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
      </>
    );
  }
  if (TYPES[src.type].options && !["count_gte", "count_lte"].includes(rule.op)) {
    return <select aria-label="Nilai" value={rule.value || ""} onChange={(e) => onChange({ value: e.target.value })}><option value="" disabled>Pilih opsi…</option>{p.options.map((o) => <option key={o.id} value={o.id}>{o.label || "(kosong)"}</option>)}</select>;
  }
  let type = "text", ph = "teks";
  if (src.type === "number" || src.type === "scale" || /^(count|len)_/.test(rule.op)) { type = "number"; ph = "0"; }
  if (src.type === "date") type = p.mode === "time" ? "time" : "date";
  const one = (k) => <input aria-label={k === "value" ? "Nilai" : "Nilai akhir"} type={type} step="any" placeholder={ph} value={rule[k] ?? ""} onChange={(e) => onChange({ [k]: e.target.value })} />;
  return d[2] === 2 ? <>{one("value")}<span className="cv-and">dan</span>{one("value2")}</> : one("value");
}

function ConditionRow({ form, sources, rule, onChange, onRemove, fixedSrc, invalid }) {
  const src = form.blocks.find((b) => b.id === rule.src);
  return (
    <div className={"cv-row" + (invalid ? " bad" : "")}>
      {!fixedSrc && (
        <select className="cv-src" aria-label="Pertanyaan sumber" value={src ? rule.src : ""} onChange={(e) => { const s = form.blocks.find((b) => b.id === e.target.value); onChange({ src: s.id, op: opsFor(s.type)[0][0], value: null, value2: null }); }}>
          {!src && <option value="" disabled>(sumber dihapus)</option>}
          {invalid && src && <option value={src.id}>⚠ {blockLabel(form, src.id, 34)} (ada di bawah)</option>}
          {sources.map((s) => <option key={s.id} value={s.id}>{blockLabel(form, s.id, 40)}</option>)}
        </select>
      )}
      {src && (
        <select className="cv-op" aria-label="Operator" value={rule.op} onChange={(e) => onChange({ op: e.target.value, value: opDef(src.type, e.target.value)?.[2] === "multi" ? [] : null, value2: null })}>
          {opsFor(src.type).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      )}
      {src && <RuleValueInput src={src} rule={rule} onChange={onChange} />}
      {onRemove && <button type="button" className="icon-btn ghost xs cv-x" aria-label="Hapus kondisi" title="Hapus kondisi" onClick={onRemove}><Icon name="x" size={14} /></button>}
    </div>
  );
}

function ConditionBuilder({ form, block, api }) {
  const idx = form.blocks.findIndex((b) => b.id === block.id);
  const sources = form.blocks.slice(0, idx).filter(isQuestion);
  const cond = block.cond || emptyCond();
  const set = (c, key) => api.update(block.id, { cond: c }, key);
  const upd = (rid, patch, key) => set({ ...cond, rules: cond.rules.map((r) => (r.id === rid ? { ...r, ...patch } : r)) }, key);
  if (!sources.length) return <p className="muted small">Belum ada pertanyaan sebelum blok ini yang bisa dijadikan syarat. Pindahkan blok ini ke bawah atau tambah pertanyaan di atasnya.</p>;
  return (
    <div className="cv">
      {cond.rules.length === 0 ? (
        <p className="muted small">Selalu tampil. Tambah kondisi agar blok ini hanya muncul setelah prasyaratnya terjawab sesuai aturan.</p>
      ) : (
        <>
          {cond.rules.length > 1 && (
            <div className="cv-match">
              Tampilkan bila
              <select aria-label="Cara menggabungkan kondisi" value={cond.match} onChange={(e) => set({ ...cond, match: e.target.value })}>
                <option value="all">SEMUA kondisi terpenuhi</option>
                <option value="any">SALAH SATU kondisi terpenuhi</option>
              </select>
            </div>
          )}
          {cond.rules.map((r, i) => (
            <React.Fragment key={r.id}>
              {i > 0 && <span className="cv-join">{cond.match === "any" ? "ATAU" : "DAN"}</span>}
              <ConditionRow form={form} sources={sources} rule={r} invalid={!ruleValid(form, idx, r)} onChange={(patch) => upd(r.id, patch, `cv:${r.id}`)} onRemove={() => set({ ...cond, rules: cond.rules.filter((x) => x.id !== r.id) })} />
            </React.Fragment>
          ))}
        </>
      )}
      <button type="button" className="lnk" onClick={() => { const s = sources[sources.length - 1]; set({ ...cond, rules: [...cond.rules, newRule(s.id, s.type)] }); }}><Icon name="plus" size={13} /> Tambah kondisi</button>
    </div>
  );
}

/* =====================================================================
   ALUR — kanvas ketergantungan (layout sendiri, pan/zoom imperatif)
   Jalur utama = blok tanpa syarat. Cabang = blok bersyarat, digantung di
   bawah/atas sumbernya; blok berurutan dengan syarat identik jadi satu cabang.
   ===================================================================== */
const NW = 210, NH = 86, COLX = 300, ROWY = 132;
const condKey = (form, b) => JSON.stringify([b.cond.match, validRules(form, b).map((r) => [r.src, r.op, r.value, r.value2])]);

function layoutFlow(form) {
  const blocks = form.blocks;
  const pos = {}, col = {}, row = {}, edges = [];
  const rowLast = { 0: -1 };
  let maxCol = -1, prevSpine = null, prev = null;
  const nonEnd = blocks.filter((b) => b.type !== "ending");
  nonEnd.forEach((b) => {
    const cnd = isConditional(form, b);
    if (!cnd) {
      col[b.id] = maxCol + 1; row[b.id] = 0;
      if (prevSpine) edges.push({ id: `s-${b.id}`, from: prevSpine, to: b.id, kind: "seq" });
      prevSpine = b.id;
    } else if (prev && isConditional(form, prev) && condKey(form, prev) === condKey(form, b)) {
      col[b.id] = col[prev.id] + 1; row[b.id] = row[prev.id];
      edges.push({ id: `c-${b.id}`, from: prev.id, to: b.id, kind: "seq" });
    } else {
      const rules = validRules(form, b);
      const anchor = rules.map((r) => r.src).sort((x, y) => blocks.findIndex((q) => q.id === y) - blocks.findIndex((q) => q.id === x))[0];
      const c = col[anchor] + 1;
      let r = null;
      if (row[anchor] !== 0 && (rowLast[row[anchor]] ?? -1) < c) r = row[anchor];
      for (const cand of [1, -1, 2, -2, 3, -3, 4, -4, 5, -5]) { if (r !== null) break; if ((rowLast[cand] ?? -1) < c) r = cand; }
      col[b.id] = c; row[b.id] = r ?? 6;
      rules.forEach((rl) => edges.push({ id: `k-${b.id}-${rl.id}`, from: rl.src, to: b.id, kind: "cond", rule: rl, match: b.cond.match, multi: rules.length > 1 }));
    }
    rowLast[row[b.id]] = Math.max(rowLast[row[b.id]] ?? -1, col[b.id]);
    maxCol = Math.max(maxCol, col[b.id]);
    prev = b;
  });
  /* cabang kembali ke jalur utama: dari ujung tiap cabang ke blok tanpa syarat berikutnya */
  const ends = blocks.filter((b) => b.type === "ending");
  const uncondEnd = ends.find((e) => !isConditional(form, e));
  const endCol = maxCol + 1;
  nonEnd.forEach((b, i) => {
    if (!isConditional(form, b)) return;
    const nx = nonEnd[i + 1];
    if (nx && isConditional(form, nx) && condKey(form, nx) === condKey(form, b)) return;
    const target = nonEnd.slice(i + 1).find((x) => !isConditional(form, x));
    const to = target ? target.id : uncondEnd ? uncondEnd.id : END;
    edges.push({ id: `j-${b.id}`, from: b.id, to, kind: "rejoin" });
    if (target) col[target.id] = Math.max(col[target.id], col[b.id] + 1);
  });
  /* rapikan ulang kolom jalur utama setelah rejoin mendorong ke kanan */
  let shift = 0, last = -1;
  nonEnd.forEach((b) => { if (!isConditional(form, b)) { col[b.id] = Math.max(col[b.id], last + 1); last = col[b.id]; } else last = Math.max(last, col[b.id]); });
  maxCol = Math.max(-1, ...nonEnd.map((b) => col[b.id]));
  /* ending di kolom terakhir */
  const ids = nonEnd.map((b) => b.id);
  const endRows = [0, 1, -1, 2, -2, 3, -3];
  const endList = ends.length ? ends : [{ id: END }];
  endList.forEach((e, i) => {
    col[e.id] = maxCol + 1; row[e.id] = endRows[i] ?? i;
    ids.push(e.id);
    if (e.id === END || !isConditional(form, e)) { if (prevSpine) edges.push({ id: `e-${e.id}`, from: prevSpine, to: e.id, kind: "seq" }); }
    else validRules(form, e).forEach((rl) => edges.push({ id: `k-${e.id}-${rl.id}`, from: rl.src, to: e.id, kind: "cond", rule: rl, match: e.cond.match, multi: validRules(form, e).length > 1 }));
  });
  ids.forEach((id) => (pos[id] = { x: col[id] * COLX, y: row[id] * ROWY }));
  void shift;
  return { pos, edges, ids };
}

function FlowView({ form, api, focusId }) {
  const [sel, setSel] = useState(focusId || null);
  const wrapRef = useRef(null);
  const worldRef = useRef(null);
  const view = useRef({ x: 40, y: 0, k: 1 });
  const { pos, edges, ids } = useMemo(() => layoutFlow(form), [form]);
  const invalidCount = useMemo(() => form.blocks.reduce((n, b, i) => n + (b.cond?.rules || []).filter((r) => !ruleValid(form, i, r)).length, 0), [form]);
  const condCount = form.blocks.filter((b) => isConditional(form, b)).length;

  const apply = () => { const v = view.current; if (worldRef.current) worldRef.current.style.transform = `translate(${v.x}px,${v.y}px) scale(${v.k})`; };
  const fit = useCallback(() => {
    const w = wrapRef.current;
    if (!w) return;
    const xs = Object.values(pos);
    if (!xs.length) return;
    const minX = Math.min(...xs.map((p) => p.x)), maxX = Math.max(...xs.map((p) => p.x)) + NW;
    const minY = Math.min(...xs.map((p) => p.y)) - NH / 2 - 20, maxY = Math.max(...xs.map((p) => p.y)) + NH / 2 + 20;
    const W = w.clientWidth, H = w.clientHeight;
    const k = clamp(Math.min((W - 80) / (maxX - minX), (H - 80) / (maxY - minY)), 0.62, 1.1);
    const fitsX = (maxX - minX) * k <= W - 80;
    view.current = { k, x: fitsX ? (W - (maxX - minX) * k) / 2 - minX * k : 40 - minX * k, y: (H - (maxY - minY) * k) / 2 - minY * k };
    apply();
  }, [pos]);
  useLayoutEffect(() => { fit(); }, [form.id]); // eslint-disable-line
  useEffect(() => { const r = () => fit(); window.addEventListener("resize", r); return () => window.removeEventListener("resize", r); }, [fit]);

  const zoomAt = (factor, cx, cy) => {
    const v = view.current;
    const k = clamp(v.k * factor, 0.3, 2);
    const r = wrapRef.current.getBoundingClientRect();
    const px = cx ?? r.width / 2, py = cy ?? r.height / 2;
    v.x = px - ((px - v.x) * k) / v.k; v.y = py - ((py - v.y) * k) / v.k; v.k = k;
    apply();
  };
  useEffect(() => {
    const w = wrapRef.current;
    if (!w) return;
    const onWheel = (e) => {
      e.preventDefault();
      const r = w.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
      else { view.current.x -= e.deltaX; view.current.y -= e.deltaY; apply(); }
    };
    w.addEventListener("wheel", onWheel, { passive: false });
    return () => w.removeEventListener("wheel", onWheel);
  });

  /* pan: rAF + transform langsung; seleksi di pointerdown (pointer capture menelan click) */
  const pan = useRef(null);
  const raf = useRef(0);
  const onDown = (e) => {
    if (e.button !== 0) return;
    const node = e.target.closest("[data-node]");
    pan.current = { x0: e.clientX, y0: e.clientY, vx: view.current.x, vy: view.current.y, node: node?.dataset.node, moved: false };
    if (node && node.dataset.node !== END) setSel(node.dataset.node);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };
  const onMove = (e) => {
    const p = pan.current;
    if (!p) return;
    const dx = e.clientX - p.x0, dy = e.clientY - p.y0;
    if (!p.moved && Math.hypot(dx, dy) < 3) return;
    p.moved = true;
    view.current.x = p.vx + dx; view.current.y = p.vy + dy;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(apply);
    wrapRef.current.classList.add("panning");
  };
  const onUp = () => {
    const p = pan.current;
    pan.current = null;
    wrapRef.current?.classList.remove("panning");
    if (p && !p.moved && !p.node) setSel(null);
  };

  const selBlock = form.blocks.find((b) => b.id === sel);
  const bounds = useMemo(() => {
    const xs = Object.values(pos);
    return { w: Math.max(...xs.map((p) => p.x)) + NW + 400, minY: Math.min(...xs.map((p) => p.y)) - 400, maxY: Math.max(...xs.map((p) => p.y)) + 400 };
  }, [pos]);

  return (
    <div className="flow">
      <div className="flow-bar">
        <span className="legend"><i className="lg-def" />Jalur utama</span>
        <span className="legend"><i className="lg-rule" />Kondisi tampil</span>
        <span className="legend"><i className="lg-else" />Kembali ke jalur utama</span>
        <span className="sp" />
        <span className="muted small">{condCount} blok bersyarat</span>
        {invalidCount > 0 && <span className="warn-chip danger"><Icon name="alert" size={14} />{invalidCount} kondisi merujuk pertanyaan di bawahnya, diabaikan</span>}
      </div>
      <div className="flow-body">
        <div className="flow-canvas" ref={wrapRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <div className="world" ref={worldRef}>
            <svg className="edges" width={bounds.w} height={bounds.maxY - bounds.minY} style={{ top: bounds.minY }} viewBox={`0 ${bounds.minY} ${bounds.w} ${bounds.maxY - bounds.minY}`} aria-hidden="true">
              <defs>
                <marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="var(--edge)" /></marker>
                <marker id="ahr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="var(--accent)" /></marker>
              </defs>
              {edges.map((e) => {
                const a = pos[e.from], b = pos[e.to];
                if (!a || !b) return null;
                const x1 = a.x + NW, y1 = a.y, x2 = b.x - 4, y2 = b.y;
                const mx = (x1 + x2) / 2;
                const d = `M${x1} ${y1} C${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
                const hl = sel && (e.from === sel || e.to === sel);
                return <path key={e.id} d={d} className={`edge ${e.kind}${hl ? " hl" : ""}`} markerEnd={e.kind === "cond" ? "url(#ahr)" : "url(#ah)"} />;
              })}
            </svg>
            {edges.filter((e) => e.kind === "cond").map((e) => {
              const a = pos[e.from], b = pos[e.to];
              if (!a || !b) return null;
              const txt = (e.multi ? (e.match === "any" ? "atau " : "dan ") : "") + condText(form, e.rule, false).replace(/^Jawaban /, "");
              const x = b.x - 70, y = b.y - NH / 2 - 14;
              return <div key={e.id + "l"} className="edge-lbl rule" style={{ left: x, top: y }} title={condText(form, e.rule)}>{txt}</div>;
            })}
            {ids.map((id) => {
              const p = pos[id];
              if (id === END) return <div key={id} data-node={id} className="node end-node" style={{ left: p.x, top: p.y - NH / 2 }}><div className="node-hd"><Icon name="checkCircle" size={14} />Selesai (bawaan)</div><div className="node-tx">Belum ada ending screen</div></div>;
              const b = form.blocks.find((x) => x.id === id);
              const num = questionNumber(form, id);
              const cnd = isConditional(form, b);
              const deps = form.blocks.filter((x) => validRules(form, x).some((r) => r.src === id)).length;
              return (
                <div key={id} data-node={id} className={"node t-" + b.type + (sel === id ? " sel" : "") + (cnd ? " cnd" : "")} style={{ left: p.x, top: p.y - NH / 2 }}>
                  <div className="node-hd"><Icon name={cnd ? "cond" : TYPES[b.type].icon} size={14} />{num ? `${num} · ` : ""}{TYPES[b.type].label}{b.required && isQuestion(b) && <span className="req-dot" />}</div>
                  <div className="node-tx">{stripHtml(b.title) || <i className="muted">Tanpa judul</i>}</div>
                  {deps > 0 && <span className="node-branch" title={`Memicu ${deps} blok`}>{deps}</span>}
                </div>
              );
            })}
          </div>
          <div className="zoom">
            <button type="button" className="icon-btn" aria-label="Perkecil" title="Perkecil" onClick={() => zoomAt(1 / 1.2)}><Icon name="zoomOut" size={20} /></button>
            <button type="button" className="icon-btn" aria-label="Perbesar" title="Perbesar" onClick={() => zoomAt(1.2)}><Icon name="zoomIn" size={20} /></button>
            <button type="button" className="icon-btn" aria-label="Paskan ke layar" title="Paskan ke layar" onClick={fit}><Icon name="fit" size={20} /></button>
          </div>
          <div className="flow-hint">Seret untuk geser · Ctrl + scroll untuk zoom · klik node untuk atur kondisi</div>
        </div>
        {selBlock && <LogicPanel key={selBlock.id} form={form} block={selBlock} api={api} onClose={() => setSel(null)} onSelect={setSel} />}
      </div>
    </div>
  );
}

/* Satu aturan dari sisi sumber: "Jika jawaban [op] [nilai] → tampilkan [tujuan…]".
   Disimpan sebagai kondisi pada tiap blok tujuan; aturan dengan kondisi identik dikelompokkan. */
function TriggerGroup({ form, source, rule, items, onRule, onAddTarget, onRemoveTarget, onRemove, onCreate, onSelect }) {
  const [creating, setCreating] = useState(null);
  const [nType, setNType] = useState("short");
  const [nTitle, setNTitle] = useState("");
  const sIdx = form.blocks.findIndex((b) => b.id === source.id);
  const taken = new Set(items.map((x) => x.target.id));
  const later = form.blocks.slice(sIdx + 1).filter((t) => !taken.has(t.id));
  const pick = (v) => {
    if (v === "__new_q") { setCreating("q"); setNTitle(""); }
    else if (v === "__new_e") { setCreating("e"); setNTitle("Terima kasih!"); }
    else if (v) onAddTarget(v);
  };
  const create = () => { onCreate(creating === "e" ? "ending" : nType, nTitle); setCreating(null); };
  return (
    <div className={"rule" + (!items.length ? " draft" : "")}>
      <div className="rule-hd"><span>Jika jawaban</span><button type="button" className="icon-btn ghost xs" aria-label="Hapus aturan" title="Hapus aturan beserta semua tujuannya" onClick={onRemove}><Icon name="trash" size={14} /></button></div>
      <ConditionRow form={form} sources={[]} fixedSrc rule={rule} onChange={onRule} />
      <div className="rule-hd"><span>maka tampilkan</span></div>
      {items.length > 0 && (
        <div className="tg-list">
          {items.map((x) => (
            <span key={x.rule.id} className="tg-chip" title={x.target.cond.rules.length > 1 ? `Juga punya ${x.target.cond.rules.length - 1} syarat lain (${x.target.cond.match === "any" ? "salah satu cukup" : "semua harus terpenuhi"})` : undefined}>
              <Icon name={x.target.type === "ending" ? "ending" : TYPES[x.target.type].icon} size={13} />
              <button type="button" className="tg-go" title="Buka node ini" onClick={() => onSelect?.(x.target.id)}>{blockLabel(form, x.target.id, 34)}</button>
              {x.target.cond.rules.length > 1 && <b className="tg-more">+{x.target.cond.rules.length - 1}</b>}
              <button type="button" aria-label={`Lepas ${blockLabel(form, x.target.id, 20)}`} onClick={() => onRemoveTarget(x)}><Icon name="x" size={12} /></button>
            </span>
          ))}
        </div>
      )}
      <select aria-label="Tambah tujuan" value={creating ? (creating === "q" ? "__new_q" : "__new_e") : ""} onChange={(e) => pick(e.target.value)} className={"tg-add" + (!items.length && !creating ? " need" : "")}>
        <option value="">{items.length ? "+ Tambah tujuan…" : "Pilih atau buat tujuan…"}</option>
        <optgroup label="Buat baru">
          <option value="__new_q">+ Pertanyaan baru…</option>
          <option value="__new_e">+ Ending baru…</option>
        </optgroup>
        {later.some(isQuestion) && <optgroup label="Pertanyaan yang ada">{later.filter(isQuestion).map((t) => <option key={t.id} value={t.id}>{blockLabel(form, t.id, 46)}</option>)}</optgroup>}
        {later.some((t) => t.type === "ending") && <optgroup label="Ending">{later.filter((t) => t.type === "ending").map((t) => <option key={t.id} value={t.id}>{blockLabel(form, t.id, 46)}</option>)}</optgroup>}
      </select>
      {creating && (
        <div className="creator">
          {creating === "q" && (
            <select aria-label="Tipe pertanyaan baru" value={nType} onChange={(e) => setNType(e.target.value)}>
              {QTYPES.map((t) => <option key={t} value={t}>{TYPES[t].label}</option>)}
            </select>
          )}
          <input autoFocus aria-label="Judul" placeholder={creating === "q" ? "Tulis pertanyaannya…" : "Judul ending"} value={nTitle} onChange={(e) => setNTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); create(); } if (e.key === "Escape") setCreating(null); }} />
          <div className="creator-act">
            <button type="button" className="btn sm accent" onClick={create}>Buat & sambungkan</button>
            <button type="button" className="lnk" onClick={() => setCreating(null)}>Batal</button>
          </div>
          <small className="muted">{creating === "q" ? "Disisipkan setelah cabang dari pertanyaan ini dan tersembunyi sampai kondisinya terpenuhi. Isinya bisa dilengkapi di Konten." : "Ending ini dipakai bila kondisinya terpenuhi."}</small>
        </div>
      )}
    </div>
  );
}

function LogicPanel({ form, block, api, onClose, onSelect }) {
  const [drafts, setDrafts] = useState([]);
  const T = TYPES[block.type];
  const q = isQuestion(block);
  const sIdx = form.blocks.findIndex((b) => b.id === block.id);
  /* aturan yang dipicu jawaban blok ini = kondisi di blok sesudahnya yang sumbernya blok ini, dikelompokkan per kondisi */
  const groups = [];
  form.blocks.forEach((t, i) => {
    if (i <= sIdx) return;
    (t.cond?.rules || []).forEach((r) => {
      if (r.src !== block.id) return;
      const key = JSON.stringify([r.op, r.value, r.value2]);
      let g = groups.find((x) => x.key === key);
      if (!g) groups.push((g = { key, rule: r, items: [] }));
      g.items.push({ target: t, rule: r });
    });
  });
  const addRule = (toId, rule) => api.mutateBlocks((bs) => bs.map((b) => (b.id === toId ? { ...b, cond: { ...b.cond, rules: [...b.cond.rules, { ...rule, id: uid("c") }] } } : b)));
  const removeRules = (ids) => api.mutateBlocks((bs) => bs.map((b) => (b.cond?.rules?.some((r) => ids.includes(r.id)) ? { ...b, cond: { ...b.cond, rules: b.cond.rules.filter((r) => !ids.includes(r.id)) } } : b)));
  const patchRules = (ids, patch, key) => api.mutateBlocks((bs) => bs.map((b) => (b.cond?.rules?.some((r) => ids.includes(r.id)) ? { ...b, cond: { ...b.cond, rules: b.cond.rules.map((r) => (ids.includes(r.id) ? { ...r, ...patch } : r)) } } : b)), key);
  return (
    <aside className="logic" aria-label="Panel logika">
      <div className="logic-hd">
        <span className="qnum sm">{questionNumber(form, block.id) || <Icon name={T.icon} size={13} />}</span>
        <div className="grow"><small className="muted">{T.label}</small><div className="logic-title">{stripHtml(block.title) || "Tanpa judul"}</div></div>
        <button type="button" className="icon-btn" aria-label="Tutup panel" onClick={onClose}><Icon name="x" /></button>
      </div>

      {block.type !== "welcome" && (
        <section className="lp-sec">
          <h5><Icon name="cond" size={14} />Blok ini tampil jika</h5>
          <ConditionBuilder form={form} block={block} api={api} />
        </section>
      )}
      {block.type === "welcome" && <p className="muted small">Welcome screen selalu tampil paling atas.</p>}

      {q && (
        <section className="lp-sec">
          <h5><Icon name="branch" size={14} />Aturan dari jawaban ini</h5>
          <p className="muted small">Seperti conditional formatting: tulis kondisinya, lalu pilih blok yang dimunculkan. Blok tujuan tersembunyi sampai kondisinya terpenuhi.</p>
          {groups.map((g) => {
            const ids = g.items.map((x) => x.rule.id);
            return (
              <TriggerGroup key={g.key + ids[0]} form={form} source={block} rule={g.rule} items={g.items} onSelect={onSelect}
                onRule={(patch) => patchRules(ids, patch, `tg:${ids[0]}`)}
                onAddTarget={(to) => addRule(to, g.rule)}
                onRemoveTarget={(x) => removeRules([x.rule.id])}
                onRemove={() => removeRules(ids)}
                onCreate={(type, title) => { api.createConditional(block.id, type, title, { ...g.rule, id: uid("c") }); api.toast(type === "ending" ? "Ending baru dibuat" : "Pertanyaan baru dibuat & tersembunyi sampai kondisinya terpenuhi"); }} />
            );
          })}
          {drafts.map((d) => (
            <TriggerGroup key={d.id} form={form} source={block} rule={d} items={[]}
              onRule={(patch) => setDrafts((ds) => ds.map((x) => (x.id === d.id ? { ...x, ...patch } : x)))}
              onAddTarget={(to) => { addRule(to, d); setDrafts((ds) => ds.filter((x) => x.id !== d.id)); }}
              onRemoveTarget={() => {}}
              onRemove={() => setDrafts((ds) => ds.filter((x) => x.id !== d.id))}
              onCreate={(type, title) => { api.createConditional(block.id, type, title, { ...d, id: uid("c") }); setDrafts((ds) => ds.filter((x) => x.id !== d.id)); api.toast(type === "ending" ? "Ending baru dibuat" : "Pertanyaan baru dibuat & tersembunyi sampai kondisinya terpenuhi"); }} />
          ))}
          <button type="button" className="btn ghost full" onClick={() => setDrafts((ds) => [...ds, newRule(block.id, block.type)])}><Icon name="plus" size={15} />Tambah aturan</button>
        </section>
      )}
      <button type="button" className="btn ghost full" onClick={() => api.gotoBlock(block.id)}><Icon name="edit" size={15} />Edit isi di Konten</button>
    </aside>
  );
}

/* ---------- gaya (token mengikuti Figma Anmategra: teal + netral abu kehijauan) ---------- */
const CSS = `
/* layout: sidebar navigasi + area kerja; editor = panel kiri (meta + halaman) | kanvas kartu.
   Satu tema terang sesuai skema Figma Anmategra (sengaja tanpa mode gelap). */
.af-root{
  --bg:#F3F5F5; --surface:#FFFFFF; --surface-2:#ECEFEF; --surface-3:#DDE2E2; --line:#D8DEDE;
  --fg:#1D2829; --fg-2:#3E4B4C; --muted:#6B7A7B; --accent:#00AEB3; --accent-ink:#FFFFFF; --accent-soft:#D3F1F2;
  --navy:#2D5F7A; --navy-ink:#FFFFFF; --edge:#8A9797; --ok:#2E9E6A; --warn:#E9B43C; --danger:#D4483A; --danger-soft:#FBE7E4;
  --shadow:0 1px 2px rgba(20,40,40,.06),0 6px 20px rgba(20,40,40,.06);
  --font:'Plus Jakarta Sans',system-ui,-apple-system,'Segoe UI',sans-serif;
  --r:14px;
  font-family:var(--font); color:var(--fg); background:var(--bg); font-size:14px; line-height:1.45; color-scheme:light;
  height:100%; min-height:100vh; -webkit-font-smoothing:antialiased;
}
.af-root *{box-sizing:border-box}
:where(.af-root) button{font:inherit;color:inherit;cursor:pointer;background:none;border:0;padding:0}
:where(.af-root) button:disabled{cursor:not-allowed;opacity:.45}
:where(.af-root) :is(input,textarea,select){font:inherit;color:var(--fg)}
:where(.af-root) :focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:6px}
:where(.af-root) :is(h1,h2,h3,h4){margin:0;text-wrap:balance}
:where(.af-root) p{margin:0}
.muted{color:var(--muted)} .small{font-size:12.5px} .grow{flex:1;min-width:0} .sp{flex:1} .rel{position:relative} .nowrap{white-space:nowrap}
.err{color:var(--danger)} .pa{color:var(--pa,var(--accent))}
.vr{width:1px;align-self:stretch;background:var(--line);margin:4px 2px}

/* tombol */
.btn{display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 14px;border-radius:10px;background:var(--surface-2);border:1px solid var(--line)!important;font-weight:600;white-space:nowrap;transition:background .15s,border-color .15s}
.btn:hover{background:var(--surface-3)}
.btn.sm{height:32px;padding:0 10px;font-size:13px;border-radius:8px}
.btn.accent{background:var(--accent);color:var(--accent-ink);border-color:transparent!important}
.btn.accent:hover{filter:brightness(.95)}
.btn.ghost{background:var(--surface)}
.btn.ghost:hover,.btn.on{background:var(--surface-2)}
.btn.outline{background:var(--surface);color:var(--accent);border-color:var(--accent)!important}
.btn.danger{background:var(--danger);color:#fff;border-color:transparent!important}
.btn.full{width:100%;justify-content:center}
.icon-btn{display:inline-grid;place-items:center;width:34px;height:34px;border-radius:9px;color:var(--fg-2)}
.icon-btn:hover:not(:disabled){background:var(--surface-2);color:var(--fg)}
.icon-btn.lg{width:42px;height:42px}
.icon-btn.xs{width:24px;height:24px;border-radius:6px}
.icon-btn.ghost{color:var(--muted)}
.lnk{color:var(--fg-2);text-decoration:underline;text-underline-offset:3px;font-size:13px}
.lnk:hover{color:var(--accent)} .lnk.danger{color:var(--danger)} .lnk.pa{color:var(--pa,var(--accent));text-decoration:none}
.tgl{display:inline-flex;align-items:center;gap:10px;cursor:pointer;font-size:13px;color:var(--fg-2);user-select:none}
.tgl input{position:absolute;opacity:0;width:1px;height:1px}
.tgl i{width:40px;height:22px;border-radius:99px;background:var(--surface-3);position:relative;transition:background .2s;flex:none}
.tgl i::after{content:"";position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .2s}
.tgl input:checked+i{background:var(--accent)}
.tgl input:checked+i::after{transform:translateX(18px)}
.tgl input:focus-visible+i{outline:2px solid var(--accent);outline-offset:2px}
.seg{display:inline-flex;background:var(--surface-2);border-radius:10px;padding:3px;gap:2px;flex-wrap:wrap}
.seg button{height:30px;padding:0 12px;border-radius:8px;font-size:13px;font-weight:600;color:var(--muted);display:inline-flex;align-items:center;gap:6px}
.seg button.on{background:var(--surface);color:var(--fg);box-shadow:0 1px 3px rgba(0,0,0,.08)}
.seg.full{display:flex} .seg.full button{flex:1;justify-content:center}
.dot{width:10px;height:10px;border-radius:50%;display:inline-block;flex:none}
.dot.ok{background:var(--ok)} .dot.warn{background:var(--warn)} .dot.muted{background:var(--edge)}
.pill{display:inline-block;padding:2px 9px;border-radius:99px;font-size:12px;font-weight:600;background:var(--surface-2)}
.pill.ok{background:color-mix(in srgb,var(--ok) 16%,transparent);color:var(--ok)}
.pill.warn{background:color-mix(in srgb,var(--warn) 22%,transparent);color:color-mix(in srgb,var(--warn) 60%,var(--fg))}
.warn-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:99px;background:color-mix(in srgb,var(--warn) 20%,transparent);color:color-mix(in srgb,var(--warn) 55%,var(--fg));font-size:12.5px;font-weight:600}
.warn-chip.danger{background:var(--danger-soft);color:var(--danger)}
.warn-box{background:color-mix(in srgb,var(--warn) 16%,transparent);border-radius:10px;padding:10px 12px;font-size:13px;margin-top:8px}
.req-dot{width:6px;height:6px;border-radius:50%;background:var(--danger);display:inline-block;flex:none}

/* popover, modal, toast */
.pop{position:absolute;z-index:40;top:calc(100% + 6px);left:0;background:var(--surface);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow);padding:6px;min-width:220px}
.add-menu{display:flex;flex-direction:column;width:250px}
.add-menu button,.row-menu button{display:flex;align-items:center;gap:12px;padding:9px 12px;border-radius:9px;font-size:15px;color:var(--fg-2);text-align:left}
.add-menu button:not(:last-child){border-bottom:1px solid var(--surface-2)}
.add-menu button:hover:not(:disabled),.row-menu button:hover{background:var(--surface-2);color:var(--fg)}
.add-menu small{margin-left:auto;font-size:11px;color:var(--muted)}
.row-menu{left:auto;right:0;min-width:190px}
.row-menu button{font-size:14px;width:100%}
.row-menu .danger{color:var(--danger)}
.filter-pop{display:flex;flex-direction:column;gap:2px;min-width:180px}
.filter-pop label{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer}
.filter-pop label:hover{background:var(--surface-2)}
.filter-pop input{accent-color:var(--accent);width:16px;height:16px}
.modal-scrim{position:fixed;inset:0;z-index:100;background:rgba(10,20,20,.45);display:grid;place-items:center;padding:16px;animation:fade .15s}
.modal{background:var(--surface);border-radius:18px;padding:22px;width:min(440px,100%);box-shadow:0 20px 60px rgba(0,0,0,.3);animation:pop .18s}
.modal.wide{width:min(620px,100%)}
.modal h3{font-size:18px;margin-bottom:10px}
.modal-body{display:flex;flex-direction:column;gap:8px;color:var(--fg-2)}
.modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
.copy-row{display:flex;gap:8px;margin:6px 0}
.copy-row input{flex:1;min-width:0;height:38px;border:1px solid var(--line);border-radius:10px;padding:0 12px;background:var(--surface-2)}
.toast{position:fixed;left:50%;bottom:calc(20px + env(safe-area-inset-bottom,0px));transform:translate(-50%,30px);opacity:0;background:var(--fg);color:var(--bg);padding:10px 16px;border-radius:12px;font-weight:600;font-size:13px;pointer-events:none;transition:.2s;z-index:200;max-width:calc(100vw - 32px)}
.toast.show{opacity:1;transform:translate(-50%,0)}
@keyframes fade{from{opacity:0}}
@keyframes pop{from{opacity:0;transform:scale(.96)}}

/* shell & sidebar */
.shell{display:flex;min-height:100vh}
.app-side{width:250px;flex:none;background:var(--surface);border-right:1px solid var(--line);display:flex;flex-direction:column;padding:28px 18px 24px;position:sticky;top:0;height:100vh}
.brand{display:flex;align-items:center;gap:8px;font-weight:800;font-size:24px;color:var(--navy);letter-spacing:-.02em;padding:0 8px 28px}
.app-side ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.app-side li button{display:flex;align-items:center;gap:14px;width:100%;padding:10px 12px;border-radius:10px;font-size:16px;color:var(--fg-2)}
.app-side li button:hover{background:var(--surface-2)}
.app-side li button.on{background:color-mix(in srgb,var(--navy) 14%,var(--surface));color:var(--navy);font-weight:600}
.org{margin-top:auto;display:flex;align-items:center;gap:12px;padding:8px}
.org-av{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:#2B2B2B;color:#F2C230;font-weight:800;font-size:14px;letter-spacing:.04em;flex:none}
.org b{display:block;font-size:15px} .org small{color:var(--muted)}
.logout{display:flex;align-items:center;gap:12px;padding:12px 8px 0;color:var(--danger)!important;font-size:15px}
.shell-main{flex:1;min-width:0;padding-block:36px 48px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}

/* daftar forms */
.list-page{max-width:1100px;margin:0 auto;display:flex;flex-direction:column;gap:18px}
.lp-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.lp-head h1{font-size:30px;font-weight:700;letter-spacing:-.02em}
.search{display:flex;align-items:center;gap:12px;height:54px;border:1px solid var(--line);border-radius:99px;padding:0 22px;background:var(--surface);color:var(--muted)}
.search input{flex:1;min-width:0;border:0;outline:0;background:none;font-size:16px}
.filters{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.chip-btn{display:inline-flex;align-items:center;gap:10px;height:52px;padding:0 20px;border:1px solid var(--line)!important;border-radius:99px;background:var(--surface)!important;font-weight:600;font-size:16px}
.chip-btn.on{border-color:var(--accent)!important;color:var(--accent)}
.chip-btn.square{border-radius:12px;height:50px}
.ftable{display:flex;flex-direction:column}
.fr{display:grid;grid-template-columns:150px minmax(0,2.2fr) 1fr .9fr .7fr auto;align-items:center;gap:16px;padding:14px 22px;border-bottom:1px solid var(--line)}
.fh{color:var(--muted);font-size:15px;padding-block:8px}
.fr.pinned{background:color-mix(in srgb,var(--navy) 9%,var(--surface));border-radius:14px;border-bottom-color:transparent}
.thumb{width:130px;height:90px;border-radius:12px;background:var(--surface-2);position:relative;overflow:hidden;flex:none}
.thumb img{width:100%;height:100%;object-fit:cover}
.thumb-gen{position:absolute;inset:14px 16px;display:flex;flex-direction:column;gap:7px}
.thumb-gen i{height:8px;border-radius:4px;background:color-mix(in srgb,var(--ta) 45%,var(--surface-3))}
.thumb-gen i:first-child{width:70%;height:12px;background:var(--ta)} .thumb-gen i:last-child{width:45%}
.thumb-pin{position:absolute;top:8px;left:10px;color:var(--accent)}
.f-title{text-align:left;display:flex;flex-direction:column;gap:2px;min-width:0}
.f-title b{font-weight:500;font-size:16px;overflow-wrap:anywhere}
.f-title small{color:var(--muted)}
.f-title:hover b{color:var(--accent)}
.f-date,.f-resp{font-size:16px;font-variant-numeric:tabular-nums;color:var(--fg-2)}
.f-resp small{color:var(--muted)}
.f-status{display:flex;align-items:center;gap:10px;font-size:16px}
.row-act{display:flex;align-items:center;gap:8px}
.fgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px}
.fcard{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:10px}
.fcard .thumb{width:100%;height:120px}
.fcard-meta{display:flex;gap:12px;flex-wrap:wrap;font-size:13px}
.fcard-meta .f-status{font-size:13px}
.pager{display:flex;justify-content:center;gap:10px;padding-top:8px}
.pager button{width:42px;height:42px;border:1px solid var(--line)!important;border-radius:8px;background:var(--surface)!important;display:grid;place-items:center;font-weight:600;font-variant-numeric:tabular-nums}
.pager button.on{background:var(--accent)!important;color:var(--accent-ink);border-color:transparent!important}
.empty{display:flex;flex-direction:column;align-items:center;gap:10px;padding:48px 16px;color:var(--muted);text-align:center}

/* editor shell */
.editor{display:flex;flex-direction:column;height:100vh;background:var(--bg)}
.ed-top{display:flex;align-items:center;gap:14px;height:72px;padding:0 max(16px,env(safe-area-inset-right,0px)) 0 max(16px,env(safe-area-inset-left,0px));background:var(--surface);border-bottom:1px solid var(--line);flex:none;position:relative;z-index:20}
.brand-btn{display:grid;place-items:center}
.burger{display:none}
.crumb{display:flex;align-items:center;gap:8px;font-size:17px;color:var(--fg-2);min-width:0;flex:0 1 auto}
.crumb button:hover{color:var(--accent)}
.crumb b{font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:280px}
.crumb.plain{margin:0 auto 18px;max-width:1100px;font-size:15px}
.tabs{display:flex;gap:12px;margin:0 auto}
.tabs button{display:inline-flex;align-items:center;gap:8px;height:44px;padding:0 14px;border-radius:9px;border:2px solid var(--accent)!important;color:var(--accent);font-weight:600;font-size:18px}
.tabs button.on{background:var(--accent);color:var(--accent-ink)}
.ed-right{display:flex;align-items:center;gap:6px}
.status-pill{font-size:12px;font-weight:700;padding:4px 10px;border-radius:99px;background:var(--surface-2)}
.status-pill.ok{color:var(--ok)} .status-pill.warn{color:color-mix(in srgb,var(--warn) 60%,var(--fg))}

/* konten */
.konten{flex:1;min-height:0;display:grid;grid-template-columns:minmax(300px,380px) 1fr}
.side{overflow:auto;padding:18px;display:flex;flex-direction:column;gap:18px;border-right:1px solid var(--line);background:var(--surface)}
.meta{background:var(--surface-2);border-radius:var(--r);padding:18px 18px 16px;display:flex;flex-direction:column;gap:12px}
.meta-name{display:flex;align-items:center;gap:10px}
.meta-name input{flex:1;min-width:0;border:0;background:none;font-size:20px;font-weight:600;color:var(--fg-2);padding:2px 4px;border-radius:6px}
.meta-name input:focus{background:var(--surface);outline:2px solid var(--accent)}
.tags{display:flex;flex-wrap:wrap;gap:6px}
.tag{display:inline-flex;align-items:center;gap:4px;height:26px;padding:0 6px 0 12px;border-radius:8px;background:color-mix(in srgb,var(--accent) 35%,var(--surface));color:var(--fg);font-size:12px;font-weight:600}
.tag button{display:grid;place-items:center;width:18px;height:18px;border-radius:5px;opacity:.6}
.tag button:hover{opacity:1;background:rgba(0,0,0,.08)}
.tag.add{padding:0;width:28px;justify-content:center}
.tag-in{height:26px;width:110px;border:1px solid var(--accent);border-radius:8px;padding:0 8px;font-size:12px;background:var(--surface)}
.meta-row{display:grid;grid-template-columns:1fr;gap:12px}
.meta-cell{display:flex;flex-direction:column;gap:6px;min-width:0}
.meta-lbl{font-size:12px;font-weight:700;color:var(--fg-2)}
.meta-val{display:flex;align-items:center;gap:8px;min-width:0}
.meta-val input{min-width:0;width:100%;border:1px solid transparent;background:none;font-size:12.5px;padding:4px;border-radius:6px}
.meta-val input:hover,.meta-val input:focus{border-color:var(--line);background:var(--surface)}
.meta-count{font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
.meta-desc{border:1px solid transparent;background:none;resize:vertical;font-size:13px;padding:6px;border-radius:8px}
.meta-desc:hover,.meta-desc:focus{border-color:var(--line);background:var(--surface)}
.pages-box{background:var(--surface-2);border-radius:var(--r);padding:18px 14px}
.pages-box h4{font-size:19px;font-weight:600;color:var(--fg-2);padding:0 6px 10px}
.pages{display:flex;flex-direction:column;gap:8px;user-select:none;-webkit-user-select:none}
.page-item{display:flex;align-items:center;gap:8px;padding:12px 14px;border-radius:16px;background:var(--surface-3);color:var(--fg-2);font-size:15px;cursor:pointer;touch-action:none;position:relative;border:1.5px solid transparent;transition:background .12s}
.page-item:hover{background:color-mix(in srgb,var(--surface-3) 70%,var(--fg) 6%)}
.page-item.sel{border-color:var(--fg-2);box-shadow:0 2px 6px rgba(0,0,0,.12);background:var(--surface)}
.page-item.dragging{z-index:5;box-shadow:0 10px 26px rgba(0,0,0,.22);background:var(--surface);transition:none;cursor:grabbing}
.page-item.unreach{opacity:.55;border-style:dashed;border-color:var(--edge)}
.page-item .grip{color:var(--muted);cursor:grab;flex:none}
.pi-text{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pi-text b{font-weight:700}
.pi-branch{color:var(--accent);flex:none}
.drop-line{height:3px;border-radius:3px;background:var(--accent);margin:-5px 8px}
.main{overflow:auto;padding:16px max(16px,2vw) 80px;position:relative}
.toolbar{position:sticky;top:0;z-index:15;display:flex;align-items:center;gap:8px;background:var(--surface);border:1px solid var(--line);border-radius:22px;padding:10px 14px;margin:0 auto 18px;max-width:960px;box-shadow:var(--shadow);flex-wrap:wrap}
.tb-group{position:relative}
.btn.tb{height:46px;padding:0 24px;font-size:16px;background:var(--surface-2);border-color:transparent!important;border-radius:10px;min-width:190px;justify-content:flex-start}
.btn.tb.on,.btn.tb:hover{background:var(--surface-3)}
.design-pop{width:320px}
.design{display:flex;flex-direction:column;gap:14px;padding:10px}
.design h4{font-size:16px}
.d-sec{display:flex;flex-direction:column;gap:7px}
.d-lbl{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.design select{height:36px;border:1px solid var(--line);border-radius:9px;padding:0 10px;background:var(--surface)}
.swatches{display:flex;gap:8px;flex-wrap:wrap}
.sw{width:28px;height:28px;border-radius:50%;border:2px solid var(--surface)!important;box-shadow:0 0 0 1px var(--line);display:grid;place-items:center;cursor:pointer;position:relative}
.sw.on{box-shadow:0 0 0 2px var(--fg)}
.sw.custom{background:conic-gradient(#f44,#fd4,#4d6,#4cf,#64f,#f4c,#f44);color:#fff}
.sw.custom input{position:absolute;inset:0;opacity:0;cursor:pointer}
.banner-prev{display:flex;flex-direction:column;gap:6px}
.banner-prev img{border-radius:10px;height:70px;object-fit:cover;width:100%}
.cards{display:flex;flex-direction:column;gap:22px;max-width:900px;margin:0 auto}
.card{background:var(--surface);border-radius:22px;padding:28px 36px 18px 40px;position:relative;box-shadow:0 1px 2px rgba(0,0,0,.04);border-left:10px solid var(--accent);transition:box-shadow .2s;scroll-margin:90px}
.card.sel{box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 55%,transparent),var(--shadow)}
.card.ending{border-left-color:var(--navy)}
.card-tag{display:inline-flex;gap:6px;align-items:center;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
.wel-top{display:flex;align-items:center;gap:28px;justify-content:center;padding:6px 0 4px}
.img-circle{width:124px;height:124px;border-radius:50%;border:2px dashed var(--edge)!important;display:flex!important;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:var(--muted);flex:none;overflow:hidden}
.img-circle small{font-size:10px}
.img-circle.has{border-style:solid!important}
.img-circle img{width:100%;height:100%;object-fit:cover}
.wel-titles{display:flex;flex-direction:column;gap:2px;min-width:0;flex:0 1 380px}
.h-judul{font-size:30px;font-weight:600;color:var(--fg-2);letter-spacing:-.01em}
.h-sub{border:0;background:none;font-size:20px;color:var(--muted);padding:2px 0;text-transform:none}
.h-sub:focus{outline:0;border-bottom:1px solid var(--accent)}
.fld{display:flex;flex-direction:column;gap:6px;margin-top:12px;font-size:16px}
.fld textarea{border:1px solid var(--line);border-radius:6px;padding:10px 14px;resize:vertical;background:var(--surface);font-size:15px}
.wel-btn{display:flex;justify-content:center;margin-top:18px}
.btn-edit{height:40px;width:120px;border-radius:10px;border:0;background:var(--navy);color:var(--navy-ink)!important;text-align:center;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
.card-head{display:flex;align-items:flex-start;gap:24px}
.qnum{display:inline-grid;place-items:center;min-width:28px;height:30px;padding:0 6px;border-radius:7px;background:var(--accent);color:var(--accent-ink);font-size:20px;margin-top:20px;flex:none;font-variant-numeric:tabular-nums}
.qnum.end{background:var(--navy);color:var(--surface)}
.qnum.sm{min-width:24px;height:24px;font-size:13px;margin:0;border-radius:6px}
.q-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}
.rich{outline:0;min-height:1.4em;overflow-wrap:anywhere;user-select:text;-webkit-user-select:text}
.rich:empty::before{content:attr(data-ph);color:var(--muted);pointer-events:none}
.rich a{color:var(--accent)}
.q-title{border:1px solid var(--line);border-radius:10px;padding:20px 30px;font-size:22px;color:var(--fg)}
.q-title:focus{border-color:var(--accent)}
.fmt{display:flex;align-items:center;gap:4px;padding-left:4px;flex-wrap:wrap;position:relative}
.fmt>button{width:34px;height:28px;border-radius:6px;display:grid;place-items:center;color:var(--fg-2)}
.fmt>button:hover{background:var(--surface-2)}
.fmt-hint{font-size:12px;color:var(--muted);display:inline-flex;gap:8px;align-items:center}
.fmt-link{display:inline-flex;gap:6px;align-items:center}
.fmt-link input{height:30px;border:1px solid var(--accent);border-radius:8px;padding:0 8px;width:220px;max-width:50vw;background:var(--surface)}
.q-desc{border:0;background:none;font-style:italic;color:var(--fg-2);font-size:15px;padding:4px}
.q-desc:focus{outline:0;border-bottom:1px solid var(--line)}
.img-btn{width:46px;height:46px;border-radius:8px;display:grid!important;place-items:center;color:var(--fg-2);margin-top:20px;flex:none;overflow:hidden}
.img-btn:hover{background:var(--surface-2)}
.img-btn.has{outline:2px solid var(--accent)}
.img-btn img{width:100%;height:100%;object-fit:cover}
.img-row{display:flex;align-items:flex-end;gap:12px;margin:12px 0 0 54px}
.img-row img{max-height:140px;border-radius:10px}
.card-body{margin:18px 0 0 -16px;padding-left:16px}
.ans-line{font-size:22px;color:var(--surface-3);border-bottom:1px solid var(--line);padding:6px 0;display:flex;align-items:center;gap:16px;color:color-mix(in srgb,var(--muted) 55%,transparent)}
.ans-line.tall{min-height:76px;align-items:flex-start}
.ans-line.inline{display:inline-flex;font-size:20px}
.settings-row{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-top:14px}
.settings-row label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--muted);font-weight:600}
.settings-row label.grow{flex:1;min-width:180px}
.settings-row input,.settings-row select{height:34px;border:1px solid var(--line);border-radius:8px;padding:0 10px;background:var(--surface-2);min-width:0;width:150px}
.settings-row label.grow input{width:100%}
.opts{display:flex;flex-direction:column;gap:10px}
.opt-row{display:flex;align-items:center;gap:6px;max-width:440px}
.opt-mark{display:grid;place-items:center;width:22px;height:22px;border:1px solid var(--edge);border-radius:4px;font-size:12px;color:var(--muted);margin-right:-34px;position:relative;z-index:1;margin-left:10px;flex:none;background:var(--surface-2)}
.opt-in{flex:1;min-width:0;height:40px;border:1px solid transparent;border-radius:10px;background:var(--surface-2);padding:0 12px 0 42px;font-size:15px}
.opt-in:focus{border-color:var(--accent);outline:0;background:var(--surface)}
.opt-foot{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-top:4px}
.hint{font-size:11.5px;color:var(--muted)}
.mx-scroll{overflow-x:auto;max-width:100%}
.mx{border-collapse:separate;border-spacing:6px;min-width:100%}
.mx th{font-weight:500}
.mx td{background:var(--surface-2);text-align:center;height:38px;border-radius:8px;min-width:80px}
.mx-hd{display:flex;align-items:center;gap:2px;justify-content:center}
.mx-hd input{border:1px solid transparent;background:none;text-align:center;font-size:14px;padding:4px;border-radius:6px;width:100%;min-width:60px}
.mx-hd.row input{text-align:left}
.mx-hd input:focus{border-color:var(--accent);outline:0;background:var(--surface)}
.fake-rd,.fake-cb{display:inline-block;width:18px;height:18px;border:1.6px solid var(--edge);border-radius:50%;vertical-align:middle;position:relative;flex:none;background:var(--surface)}
.fake-cb{border-radius:4px}
.fake-rd.on{border-color:var(--pa,var(--accent));box-shadow:inset 0 0 0 3px var(--surface);background:var(--pa,var(--accent))}
.fake-cb.on{border-color:var(--pa,var(--accent));background:var(--pa,var(--accent))}
.fake-cb.on::after{content:"";position:absolute;left:5px;top:1px;width:5px;height:10px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg)}
.scale-edit{display:flex;flex-direction:column;gap:10px}
.lbl-row{display:flex;align-items:center;gap:12px}
.lbl-row .num{width:22px;text-align:right;color:var(--muted);font-variant-numeric:tabular-nums}
.lbl-row input{height:38px;width:240px;max-width:100%;border:0;border-radius:10px;background:var(--surface-2);padding:0 12px}
.scale-prev{display:flex;gap:8px;flex-wrap:wrap;padding-left:34px}
.scale-prev .nb{width:34px;height:34px;border-radius:8px;border:1px solid var(--line);display:grid;place-items:center;color:var(--muted);font-variant-numeric:tabular-nums}
.scale-prev .st{color:var(--muted)}
.date-edit{display:flex;flex-direction:column;gap:12px;align-items:flex-start}
.file-edit{display:flex;flex-direction:column;gap:8px;max-width:440px}
.pill-in{display:flex;align-items:center;gap:10px;background:var(--surface-2);border-radius:10px;padding:4px 6px 4px 12px;font-size:13.5px;color:var(--fg-2)}
.pill-in span{flex:1}
.pill-in input{width:170px;min-width:0;height:30px;border:1px solid var(--line);border-radius:8px;padding:0 8px;background:var(--surface)}
.logic-chip{display:inline-flex;align-items:center;gap:6px;margin-top:14px;padding:5px 10px;border-radius:99px;background:var(--accent-soft);color:var(--accent);font-size:12.5px;font-weight:600}
.card-foot{display:flex;align-items:center;gap:8px;margin-top:16px;padding-top:12px;flex-wrap:wrap}
.type-sw{height:32px;border:1px solid var(--line);border-radius:8px;padding:0 8px;background:var(--surface);font-size:13px;color:var(--fg-2)}
.add-tail{display:flex;align-items:center;justify-content:center;gap:8px;height:56px;border:2px dashed var(--line)!important;border-radius:18px;color:var(--muted);font-weight:600}
.add-tail:hover{border-color:var(--accent)!important;color:var(--accent)}

/* alur */
.flow{flex:1;min-height:0;display:flex;flex-direction:column}
.flow-bar{display:flex;align-items:center;gap:16px;padding:10px max(16px,2vw);background:var(--surface);border-bottom:1px solid var(--line);flex-wrap:wrap;min-height:56px}
.legend{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--fg-2)}
.legend i{width:28px;height:0;border-top:2px solid var(--edge)}
.legend i.lg-rule{border-color:var(--accent)} .legend i.lg-else{border-top-style:dashed}
.flow-body{flex:1;min-height:0;display:flex}
.flow-canvas{flex:1;min-width:0;position:relative;overflow:hidden;background:var(--bg);background-image:radial-gradient(color-mix(in srgb,var(--edge) 35%,transparent) 1px,transparent 1px);background-size:22px 22px;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none}
.flow-canvas.panning{cursor:grabbing}
.world{position:absolute;left:0;top:0;transform-origin:0 0}
.edges{position:absolute;left:0;overflow:visible;pointer-events:none}
.edge{fill:none;stroke:var(--edge);stroke-width:1.6}
.edge.cond{stroke:var(--accent);stroke-width:2}
.edge.rejoin{stroke-dasharray:6 5;opacity:.8}
.edge.hl{stroke-width:3}
.edge-lbl{position:absolute;transform:translate(-50%,-50%);max-width:122px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11.5px;font-weight:600;padding:3px 8px;border-radius:99px;background:var(--surface);border:1px solid var(--line);color:var(--fg-2);pointer-events:none}
.edge-lbl.rule{border-color:var(--accent);color:var(--accent)}
.edge-lbl.invalid{border-color:var(--danger);color:var(--danger);text-decoration:line-through}
.node{position:absolute;width:${NW}px;height:${NH}px;background:var(--surface-3);border-radius:16px;padding:8px;display:flex;flex-direction:column;gap:6px;cursor:pointer;border:2px solid transparent;transition:border-color .12s,box-shadow .12s}
.node:hover{border-color:color-mix(in srgb,var(--accent) 50%,transparent)}
.node.sel{border-color:var(--accent);box-shadow:0 6px 18px rgba(0,0,0,.14);background:var(--surface)}
.node.unreach{opacity:.55;border:2px dashed var(--edge)}
.node.t-ending,.node.end-node{background:color-mix(in srgb,var(--navy) 18%,var(--surface))}
.node.t-welcome{background:color-mix(in srgb,var(--accent) 18%,var(--surface))}
.node-hd{display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;color:var(--fg-2);background:color-mix(in srgb,var(--surface) 55%,transparent);border-radius:9px;padding:5px 8px}
.node-hd .req-dot{margin-left:auto}
.node-tx{font-size:12.5px;color:var(--fg);padding:0 6px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.3}
.node-flag{position:absolute;bottom:-11px;left:12px;font-size:10.5px;font-weight:700;background:var(--warn);color:#2B2100;padding:1px 7px;border-radius:99px}
.node-branch{position:absolute;right:-12px;top:50%;transform:translateY(-50%);width:22px;height:22px;border-radius:50%;background:var(--fg-2);color:var(--surface);display:grid;place-items:center;border:2px solid var(--bg)}
.zoom{position:absolute;left:max(16px,env(safe-area-inset-left,0px));bottom:calc(16px + env(safe-area-inset-bottom,0px));display:flex;gap:6px;background:var(--surface);border-radius:12px;padding:4px;box-shadow:var(--shadow)}
.flow-hint{position:absolute;right:16px;bottom:calc(20px + env(safe-area-inset-bottom,0px));font-size:12px;color:var(--muted);pointer-events:none}
.logic{width:360px;flex:none;background:var(--surface);border-left:1px solid var(--line);overflow:auto;padding:18px;display:flex;flex-direction:column;gap:12px}
.logic-hd{display:flex;align-items:flex-start;gap:10px}
.logic-title{font-weight:700;font-size:15px;overflow-wrap:anywhere}
.rule{border:1px solid var(--line);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px;background:var(--surface-2)}
.rule.bad{border-color:var(--danger)}
.rule.else{background:none;border-style:dashed}
.rule-hd{display:flex;justify-content:space-between;align-items:center;font-size:13px}
.rule-line{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:13px;color:var(--fg-2)}
.rule-line select,.rule-line input{height:34px;border:1px solid var(--line);border-radius:8px;padding:0 8px;background:var(--surface);min-width:0;max-width:100%;flex:1 1 120px}
.rule-line select.bad{border-color:var(--danger);color:var(--danger)}

/* pratinjau */
.preview{flex:1;min-height:0;display:flex;flex-direction:column}
.pv-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px max(16px,2vw);background:var(--surface);border-bottom:1px solid var(--line)}
.pv-body{flex:1;min-height:0;display:flex;gap:16px;padding:18px max(16px,2vw);overflow:hidden}
.device{flex:1;min-width:0;min-height:0;display:flex;justify-content:center;align-items:stretch}
.trace{width:280px;flex:none;max-height:100%;overflow:auto;background:var(--surface);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:10px;align-self:flex-start;border:1px solid var(--line)}
.trace h4{font-size:15px}
.trace ul{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:10px;font-size:13px;color:var(--fg-2)}
.trace li{display:flex;flex-direction:column;gap:3px;align-items:flex-start;padding:8px 10px;border-radius:10px;background:var(--surface-2)}
.trace li.on{background:var(--accent-soft)}
.trace li b{font-weight:600}

.player{--pbg:color-mix(in srgb,var(--pa) 6%,var(--surface));background:var(--pbg);font-family:var(--pfont);color:var(--fg);overflow-y:auto;overscroll-behavior:contain;flex:1;min-height:0;scroll-behavior:smooth}
.player.bg-plain{--pbg:var(--surface)}
.player.bg-tint{--pbg:color-mix(in srgb,var(--pa) 16%,var(--surface))}
.pl-single{position:relative;min-height:100%;display:flex;flex-direction:column}
.pl-progress{position:sticky;top:0;height:4px;background:color-mix(in srgb,var(--pa) 18%,transparent);z-index:2}
.pl-progress i{display:block;height:100%;background:var(--pa);transition:width .35s ease}
.pl-stage{flex:1;display:flex;align-items:center;justify-content:center;padding:48px 28px 96px}
.pl-stage.in-up{animation:inUp .38s cubic-bezier(.2,.8,.2,1)}
.pl-stage.in-down{animation:inDown .38s cubic-bezier(.2,.8,.2,1)}
@keyframes inUp{from{opacity:0;transform:translateY(40px)}}
@keyframes inDown{from{opacity:0;transform:translateY(-40px)}}
.pl-screen{max-width:640px;width:100%;display:flex;flex-direction:column;align-items:center;text-align:center;gap:14px}
.pl-screen h1{font-size:clamp(26px,4vw,38px);font-weight:700;letter-spacing:-.02em;line-height:1.15}
.pl-screen h2{font-size:clamp(22px,3vw,30px);font-weight:700}
.pl-screen p{color:var(--fg-2);font-size:17px;max-width:52ch}
.pl-screen .sub{font-size:19px;color:var(--muted)}
.scr-img{max-height:180px;border-radius:14px}
.scr-img.round{width:120px;height:120px;border-radius:50%;object-fit:cover}
.pl-actions{display:flex;align-items:center;gap:14px;margin-top:10px;flex-wrap:wrap}
.pl-btn{display:inline-flex;align-items:center;gap:8px;height:46px;padding:0 22px;border-radius:10px;background:var(--pa)!important;color:#fff!important;font-weight:700;font-size:17px;text-decoration:none;box-shadow:0 2px 8px color-mix(in srgb,var(--pa) 35%,transparent)}
.pl-btn:hover{filter:brightness(1.06)}
.a-hint{font-size:12.5px;color:var(--muted)}
.pl-q{max-width:720px;width:100%;display:flex;flex-direction:column;gap:18px}
.pl-q-head{display:flex;gap:12px;align-items:flex-start}
.pl-num{display:inline-flex;align-items:center;gap:2px;color:var(--pa);font-weight:700;font-size:17px;padding-top:6px;font-variant-numeric:tabular-nums}
.pl-title{font-size:clamp(20px,2.6vw,26px);font-weight:600;line-height:1.3}
.pl-title a,.pp-q h3 a{color:var(--pa)}
.req{color:var(--danger);margin-left:4px}
.pl-desc{color:var(--muted);font-size:16px;margin-top:6px}
.pl-img{max-height:240px;border-radius:12px;align-self:flex-start;max-width:100%}
.pl-input{padding-left:32px}
.pl-err{display:inline-flex;align-items:center;gap:8px;align-self:flex-start;background:var(--danger-soft);color:var(--danger);padding:7px 12px;border-radius:8px;font-size:14px;font-weight:600;margin-left:32px}
.pl-q .pl-actions{padding-left:32px}
.pl-nav{position:absolute;right:max(16px,env(safe-area-inset-right,0px));bottom:calc(16px + env(safe-area-inset-bottom,0px));display:flex;border-radius:8px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,.15)}
.pl-nav button{width:40px;height:36px;background:var(--pa)!important;color:#fff;display:grid;place-items:center}
.pl-nav button+button{border-left:1px solid color-mix(in srgb,#000 15%,var(--pa))!important}
.a-text{width:100%;border:0;border-bottom:2px solid color-mix(in srgb,var(--pa) 40%,transparent);background:none;font-size:clamp(20px,2.4vw,26px);padding:8px 0;color:var(--pa)!important;outline:0;font-family:inherit}
.a-text:focus{border-bottom-color:var(--pa)} .a-text:focus-visible{outline:none}
.a-text::placeholder{color:color-mix(in srgb,var(--pa) 45%,transparent)}
.a-text.area{resize:none;min-height:60px;overflow:hidden}
.a-choices{display:flex;flex-direction:column;gap:8px;align-items:flex-start}
.a-choices.tf .a-choice{display:flex;align-items:center;gap:12px;min-width:min(320px,100%);max-width:100%;padding:8px 12px 8px 8px;border-radius:8px;border:1px solid color-mix(in srgb,var(--pa) 50%,transparent)!important;background:color-mix(in srgb,var(--pa) 8%,transparent)!important;color:var(--pa);font-size:18px;text-align:left;transition:background .12s}
.a-choices.tf .a-choice:hover{background:color-mix(in srgb,var(--pa) 18%,transparent)!important}
.a-choices.tf .a-choice.on{background:color-mix(in srgb,var(--pa) 26%,transparent)!important;border-color:var(--pa)!important;box-shadow:inset 0 0 0 1px var(--pa)}
.a-choice .key{display:grid;place-items:center;width:26px;height:26px;border-radius:5px;border:1px solid color-mix(in srgb,var(--pa) 55%,transparent);font-size:13px;font-weight:700;background:var(--surface);flex:none}
.a-choice.on .key{background:var(--pa);color:#fff}
.a-lbl{flex:1;min-width:0;overflow-wrap:anywhere}
.a-tick{margin-left:auto}
.a-choices.plain{gap:4px}
.a-choices.plain .a-choice{display:flex;align-items:center;gap:12px;padding:7px 4px;font-size:15px;text-align:left}
.a-select{position:relative;max-width:520px}
.a-select select{width:100%;appearance:none;height:52px;border:1px solid var(--line);border-radius:10px;padding:0 44px 0 14px;background:var(--surface);font-size:17px}
.a-select svg{position:absolute;right:14px;top:50%;transform:translateY(-50%);color:var(--pa);pointer-events:none}
.a-mx-wrap{overflow-x:auto;max-width:100%}
.a-mx{border-collapse:separate;border-spacing:0 8px;width:100%;min-width:420px}
.a-mx thead th{font-weight:500;font-size:13.5px;color:var(--fg-2);padding:0 6px;text-align:center}
.a-mx tbody th{text-align:left;font-weight:500;font-size:14px;padding:12px 14px;border:1px solid var(--line);border-right:0;border-radius:10px 0 0 10px;background:var(--surface)}
.a-mx td{text-align:center;border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:var(--surface)}
.a-mx td:last-child{border-right:1px solid var(--line);border-radius:0 10px 10px 0}
.a-mx td button{width:20px;height:20px}
.a-scale{display:inline-flex;flex-direction:column;max-width:100%}
.a-scale-row{display:flex;gap:8px;flex-wrap:wrap}
.a-sc{min-width:48px;height:52px;border-radius:8px;border:1px solid color-mix(in srgb,var(--pa) 50%,transparent)!important;background:color-mix(in srgb,var(--pa) 8%,transparent)!important;color:var(--pa);font-size:18px;font-weight:600;font-variant-numeric:tabular-nums;flex:1;max-width:72px}
.a-sc.on{background:var(--pa)!important;color:#fff}
.a-scale.star .a-sc{background:none!important;border:0!important;display:flex;flex-direction:column;align-items:center;gap:2px;height:auto;color:color-mix(in srgb,var(--pa) 55%,var(--muted))}
.a-scale.star .a-sc.on{color:var(--pa);background:none!important}
.a-scale.star .a-sc small{font-size:12px;color:var(--fg-2)}
.a-scale-lbl{display:flex;justify-content:space-between;font-size:13px;color:var(--muted);margin-top:8px;gap:16px}
.a-scale.page .a-sc{min-width:38px;height:40px;font-size:15px}
.a-date{display:flex;flex-direction:column;gap:6px;align-items:flex-start}
.a-date-lbl{font-size:12.5px;color:var(--muted)}
.a-date input{height:48px;border:1px solid var(--line);border-radius:10px;padding:0 12px;background:var(--surface);font-size:17px;accent-color:var(--pa)}
.a-file{display:flex;flex-direction:column;gap:10px;align-items:flex-start}
.a-file-btn{display:inline-flex;align-items:center;gap:8px;height:44px;padding:0 18px;border-radius:10px;background:var(--pa);color:#fff;font-weight:700;cursor:pointer}
.a-file-btn.dis{opacity:.5;cursor:not-allowed}
.a-file-item{display:flex;align-items:center;gap:8px;padding:6px 8px 6px 12px;border:1px solid var(--line);border-radius:10px;background:var(--surface);font-size:14px;max-width:100%}
.a-file-item span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pl-page{max-width:640px;margin:0 auto;padding:28px 16px 48px;display:flex;flex-direction:column;gap:14px}
.pp-banner{border-radius:12px;overflow:hidden;height:130px}
.pp-banner img{width:100%;height:100%;object-fit:cover}
.pp-card{background:var(--surface);border-radius:12px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,.08);display:flex;flex-direction:column;gap:12px}
.pp-head{border-top:10px solid var(--pa)}
.pp-head h1{font-size:24px;font-weight:600;line-height:1.3}
.pp-head p{font-size:14px;color:var(--fg-2)}
.pp-head hr{border:0;border-top:1px solid var(--line);width:100%;margin:2px 0}
.pp-acct{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--muted);flex-wrap:wrap}
.pp-req{border:1px solid color-mix(in srgb,var(--danger) 50%,transparent);background:var(--danger-soft);color:var(--danger);text-align:center;border-radius:8px;padding:8px;font-size:13px}
.pp-q h3{font-size:15.5px;font-weight:600;line-height:1.35}
.pp-q.has-err{box-shadow:0 0 0 1.5px var(--danger)}
.pp-q .a-text{font-size:15px;border-bottom-width:1px;color:var(--fg)!important}
.pp-q .a-text.area{border:1px solid var(--line);border-radius:8px;padding:10px 12px;min-height:110px;resize:vertical}
.pp-q .a-text::placeholder{color:var(--muted)}
.pp-q .a-select select{height:44px;font-size:15px}
.pp-q .pl-err{margin-left:0}
.pp-q .pl-desc{font-size:13.5px;margin-top:-4px}
.pp-foot{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.pp-foot .pl-btn{height:42px;font-size:15px}
.pp-confirm{display:inline-flex;gap:10px;align-items:center;font-size:13px}
.pl-page .ending-scr{padding:24px 0}
.ending-scr svg{color:var(--pa)}

/* respons */
.resp{max-width:1100px;margin:0 auto;display:flex;flex-direction:column;gap:18px}
.resp-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.resp-head h2{font-size:24px}
.summary{display:grid;align-items:start;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
.sum-card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:8px;min-width:0}
.sum-hd{display:flex;gap:8px;align-items:flex-start;font-size:14px}
.bars{display:flex;flex-direction:column;gap:5px}
.bar{display:grid;grid-template-columns:minmax(0,110px) 1fr 28px;gap:8px;align-items:center;font-size:12.5px}
.bar-l{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--fg-2)}
.bar-t{height:10px;background:var(--surface-2);border-radius:5px;overflow:hidden}
.bar-t i{display:block;height:100%;background:var(--accent);border-radius:5px}
.bar-n{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
.tbl-wrap{overflow-x:auto;background:var(--surface);border:1px solid var(--line);border-radius:14px}
.tbl{border-collapse:collapse;width:100%;font-size:13px}
.tbl th{text-align:left;font-weight:600;color:var(--muted);padding:10px 12px;border-bottom:1px solid var(--line);white-space:nowrap;max-width:220px;overflow:hidden;text-overflow:ellipsis;background:var(--surface-2)}
.tbl td{padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top;min-width:120px;max-width:280px;user-select:text}
.tbl td.nowrap{min-width:0}
.dash{color:var(--muted)}

/* responsif */
@media (max-width:1100px){
  .trace{display:none}
  .sm-tb{min-width:0!important;padding:0 14px!important}
  .tabs button span{display:none}
  .tabs button{padding:0 12px}
  .resp-btn span{display:none}
}
@media (max-width:900px){
  .app-side{display:none}
  .konten{grid-template-columns:1fr;position:relative}
  .burger{display:inline-grid}
  .side{position:absolute;inset:0 auto 0 0;width:min(360px,92vw);z-index:30;transform:translateX(-105%);transition:transform .25s;box-shadow:var(--shadow)}
  .konten.panel-open .side{transform:none}
  .crumb{display:none}
  .fr{grid-template-columns:88px minmax(0,1fr) auto;row-gap:6px}
  .fr .thumb{width:80px;height:58px}
  .fh{display:none}
  .f-date,.f-resp{display:none}
  .f-status{grid-column:2;font-size:13px}
  .row-act{grid-column:2 / -1;justify-content:flex-start}
  .logic{position:absolute;right:0;top:0;bottom:0;width:min(360px,100%);z-index:10;box-shadow:var(--shadow)}
  .flow-body{position:relative}
}
@media (max-width:640px){
  .ed-top{gap:6px;height:62px}
  .ed-right .status-pill,.ed-right .resp-btn{display:none}
  .tabs{gap:6px}
  .tabs button{height:40px;font-size:15px;padding:0 10px}
  .card{padding:20px 16px 14px 20px;border-left-width:6px;border-radius:16px}
  .card-head{gap:10px}
  .q-title{padding:12px 14px;font-size:18px}
  .qnum{margin-top:10px;font-size:16px}
  .img-btn{margin-top:8px;width:36px;height:36px}
  .wel-top{flex-direction:column;gap:12px}
  .wel-titles{flex:none;width:100%}
  .btn.tb{min-width:0;padding:0 14px;height:42px}
  .toolbar{border-radius:16px}
  .pl-input,.pl-q .pl-actions{padding-left:0}
  .pl-err{margin-left:0}
  .pl-stage{padding:32px 18px 90px}
  .lp-head h1{font-size:24px}
  .chip-btn{height:44px;padding:0 14px;font-size:14px}
  .flow-hint{display:none}
  .meta-row{grid-template-columns:1fr}
}

/* kondisi tampil */
.cv{display:flex;flex-direction:column;gap:8px;align-items:flex-start}
.cv-match{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;color:var(--fg-2)}
.cv-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;width:100%;padding:8px;border-radius:10px;background:var(--surface);border:1px solid var(--line)}
.cv-row.bad{border-color:var(--danger)}
.cv-row select,.cv-row input,.cv-match select{height:34px;border:1px solid var(--line);border-radius:8px;padding:0 8px;background:var(--surface);min-width:0;max-width:100%;font-size:13px}
.cv-src{flex:2 1 200px} .cv-op{flex:1 1 120px} .cv-row input{flex:1 1 90px;width:90px}
.cv-and{font-size:12px;color:var(--muted)}
.cv-x{margin-left:auto}
.cv-join{font-size:11px;font-weight:800;letter-spacing:.08em;color:var(--accent);padding-left:10px}
.cv-multi{display:flex;flex-wrap:wrap;gap:5px;flex:1 1 100%}
.cv-chip{display:inline-flex;align-items:center;gap:4px;height:28px;padding:0 10px;border-radius:99px;border:1px solid var(--line)!important;font-size:12.5px;background:var(--surface)!important}
.cv-chip.on{background:var(--accent-soft)!important;border-color:var(--accent)!important;color:var(--fg)}
.cond-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.cond-chip{display:inline-flex;align-items:center;gap:6px;max-width:100%;padding:5px 11px;border-radius:99px;background:var(--accent-soft)!important;color:color-mix(in srgb,var(--accent) 70%,var(--fg));font-size:12.5px;font-weight:600;text-align:left}
.cond-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cond-chip.alt{background:var(--surface-2)!important;color:var(--fg-2)}
.cond-box{margin-top:16px;padding:14px;border-radius:14px;background:color-mix(in srgb,var(--accent) 7%,var(--surface-2));display:flex;flex-direction:column;gap:10px}
.cond-box-hd{display:flex;align-items:center;gap:12px}
.cond-box-hd b{display:inline-flex;gap:6px;align-items:center;flex:1}
.cond-btn.on{border-color:var(--accent)!important;color:color-mix(in srgb,var(--accent) 75%,var(--fg))}
.card.is-cond{border-left-color:color-mix(in srgb,var(--accent) 45%,var(--surface))}
.page-item.cnd{background:color-mix(in srgb,var(--accent) 12%,var(--surface-3))}
.center-note{display:block;text-align:center;margin-top:8px}
/* tema form di editor */
.main.canvas-soft{background:color-mix(in srgb,var(--fa) 6%,var(--bg))}
.main.canvas-plain{background:var(--bg)}
.main.canvas-tint{background:color-mix(in srgb,var(--fa) 16%,var(--bg))}
.main .cards{font-family:var(--ffont)}
.ed-banner{border-radius:18px;overflow:hidden;height:140px}
.ed-banner img{width:100%;height:100%;object-fit:cover}
.btn.tb.sm-tb{min-width:0}
/* drawer pengaturan */
.drawer-scrim{position:fixed;inset:0;z-index:90;background:rgba(10,20,20,.3);animation:fade .15s}
.drawer{position:absolute;top:0;right:0;bottom:0;width:min(440px,100%);background:var(--surface);box-shadow:-10px 0 40px rgba(0,0,0,.15);display:flex;flex-direction:column;animation:slideIn .2s ease}
@keyframes slideIn{from{transform:translateX(40px);opacity:0}}
.drawer-hd{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid var(--line)}
.drawer-hd h3{display:flex;align-items:center;gap:10px;font-size:18px}
.drawer-body{overflow:auto;padding:8px 20px calc(24px + env(safe-area-inset-bottom,0px))}
.set-group{padding:14px 0;border-bottom:1px solid var(--surface-2)}
.set-group h4{font-size:12px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:6px}
.set-row{display:flex;gap:16px;align-items:flex-start;padding:10px 0}
.set-row.col{flex-direction:column;gap:6px}
.set-txt{flex:1;display:flex;flex-direction:column;gap:3px;align-items:flex-start}
.set-txt label,.set-row.col label{font-weight:600;font-size:14px;cursor:pointer}
.set-row small{color:var(--muted);font-size:12.5px;line-height:1.4}
.set-row textarea{width:100%;border:1px solid var(--line);border-radius:10px;padding:10px;resize:vertical}
.warn-txt{color:color-mix(in srgb,var(--warn) 60%,var(--fg))!important}
/* panel alur */
.lp-sec{display:flex;flex-direction:column;gap:10px;padding-bottom:14px;border-bottom:1px solid var(--surface-2)}
.lp-sec h5{display:flex;align-items:center;gap:6px;font-size:13px;margin:0}
.rule.draft{border-style:dashed;background:var(--surface)}
.rule .cv-row{padding:0;border:0;background:none}
.rule .rule-hd span{font-size:13px;color:var(--fg-2);font-weight:600}
.tg-list{display:flex;flex-direction:column;gap:6px}
.tg-chip{display:flex;align-items:center;gap:6px;padding:6px 6px 6px 10px;border-radius:9px;background:var(--surface);border:1px solid color-mix(in srgb,var(--accent) 45%,var(--line));font-size:13px;min-width:0}
.tg-chip .tg-go{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left;width:auto;height:auto;display:block;color:var(--fg)}
.tg-chip .tg-go:hover{color:var(--accent);background:none}
.tg-chip button{display:grid;place-items:center;width:22px;height:22px;border-radius:6px;color:var(--muted)}
.tg-chip button:hover{background:var(--surface-2);color:var(--danger)}
.tg-more{font-size:11px;color:var(--muted)}
.tg-add{height:36px;border:1px dashed var(--line);border-radius:9px;padding:0 10px;background:var(--surface);font-size:13px;color:var(--fg-2)}
.tg-add.need{border:1px solid var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.rule-line .cv-row{padding:0;border:0;background:none;flex:1}
.rule-line.stack{flex-direction:column;align-items:stretch}
.rule-line.stack .cv-row{width:100%}
.rule-line select.need{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.creator{display:flex;flex-direction:column;gap:8px;padding:10px;border-radius:10px;background:var(--surface);border:1px solid var(--accent)}
.creator select,.creator input{height:36px;border:1px solid var(--line);border-radius:8px;padding:0 10px;background:var(--surface)}
.creator-act{display:flex;align-items:center;gap:12px}
.lp-links{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center}
.node.cnd{border:2px dashed color-mix(in srgb,var(--accent) 55%,transparent);background:color-mix(in srgb,var(--accent) 8%,var(--surface))}
.node.cnd.sel{border-style:solid}
.node-branch{font-size:11px;font-weight:800}
/* bingkai pratinjau */
.browser{width:100%;max-width:1180px;height:100%;display:flex;flex-direction:column;border-radius:14px;overflow:hidden;box-shadow:var(--shadow);border:1px solid var(--line);background:var(--surface)}
.browser-bar{display:flex;align-items:center;gap:7px;height:40px;padding:0 14px;background:var(--surface-2);border-bottom:1px solid var(--line);flex:none}
.browser-bar i{width:11px;height:11px;border-radius:50%;background:var(--surface-3)}
.browser-bar .url{margin-left:14px;flex:1;max-width:520px;height:26px;border-radius:8px;background:var(--surface);display:flex;align-items:center;gap:6px;padding:0 12px;font-size:12px;color:var(--muted);overflow:hidden;white-space:nowrap}
.phone{width:390px;max-width:100%;height:min(100%,820px);border:12px solid #1B1F20;border-radius:46px;overflow:hidden;display:flex;flex-direction:column;position:relative;background:#1B1F20;box-shadow:var(--shadow)}
.phone-notch{position:absolute;top:0;left:50%;transform:translateX(-50%);width:120px;height:24px;background:#1B1F20;border-radius:0 0 16px 16px;z-index:5}
.phone .player{border-radius:34px;padding-top:18px}
.phone .pl-page{padding:18px 12px 40px}
.pp-progress{position:sticky;top:0;z-index:4;margin:-28px -16px 0;padding:10px 16px 8px;background:color-mix(in srgb,var(--pbg) 88%,transparent);backdrop-filter:blur(6px);display:flex;flex-direction:column;gap:6px}
.phone .pp-progress{margin:-18px -12px 0}
.pp-progress i{display:block;height:4px;border-radius:2px;background:var(--pa);transition:width .3s ease;max-width:100%}
.pp-progress span{font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
.pp-note{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;background:color-mix(in srgb,var(--pa) 10%,var(--surface));padding:8px 12px;border-radius:8px}
.pp-logo{width:64px;height:64px;border-radius:50%;object-fit:cover}
.pp-head .sub{color:var(--muted);font-size:15px}
.pp-cond{animation:revealIn .5s cubic-bezier(.2,.8,.2,1);border-left:4px solid var(--pa)}
@keyframes revealIn{from{opacity:0;transform:translateY(-8px);box-shadow:0 0 0 3px color-mix(in srgb,var(--pa) 50%,transparent)}}
.pp-cond-tag{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;color:var(--pa);text-transform:uppercase;letter-spacing:.05em}
.pp-trig{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)}
.review{gap:0;padding:6px 20px}
.rv-row{display:flex;flex-direction:column;gap:3px;padding:12px 0;border-bottom:1px solid var(--line)}
.rv-row:last-child{border-bottom:0}
.rv-q{font-size:13px;color:var(--muted)}
.rv-a{font-size:15px;overflow-wrap:anywhere}
.pl-actions.center{justify-content:center}
@media (max-width:900px){.pv-body{padding:10px}.phone{border-width:8px}}
@media (prefers-reduced-motion:reduce){.af-root *{animation:none!important;transition:none!important}}
/* prototipe: tampilan sheets respons */
.sheet-box{display:flex;flex-direction:column;gap:10px}
.sheet-bar{display:flex;flex-wrap:wrap;align-items:center;gap:10px 18px}
.sheet-field{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--muted)}
.sheet-field select{height:34px;border:1px solid var(--line);border-radius:8px;background:var(--surface);padding:0 8px;color:var(--fg);font-weight:600}
.sheet-wrap{overflow:auto;max-height:calc(100vh - 260px);background:var(--surface);border:1px solid var(--line);border-radius:10px}
.sheet{border-collapse:separate;border-spacing:0;font-size:13px;width:max-content;min-width:100%}
.sheet th,.sheet td{border-right:1px solid var(--line);border-bottom:1px solid var(--line);padding:6px 10px;text-align:left;vertical-align:top}
.sheet th{position:sticky;top:0;z-index:2;background:var(--surface-2);font-weight:600;max-width:240px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sheet th.cond{background:color-mix(in srgb,var(--accent) 12%,var(--surface-2))}
.sheet td{max-width:240px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sheet-wrap.wrap td{white-space:normal;min-width:200px}
.sheet .rn{position:sticky;left:0;z-index:1;background:var(--surface-2);color:var(--muted);text-align:right;font-variant-numeric:tabular-nums;width:1%}
.sheet th.rn{z-index:3}
.sheet tbody tr:hover td{background:color-mix(in srgb,var(--accent) 5%,var(--surface))}
.sheet tbody tr:hover td.rn{background:var(--surface-3)}
`;

/* =====================================================================
   PRATINJAU — pemutar responden (satu per satu / satu halaman)
   ===================================================================== */
const extOf = (n) => (n.split(".").pop() || "").toLowerCase();
const fmtSize = (b) => (b > 1e6 ? (b / 1e6).toFixed(1) + " MB" : Math.ceil(b / 1e3) + " KB");

function AnswerInput({ block, value, onChange, onEnter, variant, autoFocus, setError, order }) {
  const p = block.props || {};
  const ref = useRef(null);
  useEffect(() => { if (autoFocus && ref.current) setTimeout(() => ref.current?.focus({ preventScroll: true }), 260); }, [autoFocus, block.id]);
  const idb = `in-${block.id}`;
  switch (block.type) {
    case "short":
      return <input id={idb} ref={ref} className="a-text" value={value || ""} placeholder={p.placeholder || (variant === "page" ? "Jawabanmu" : "Ketik jawabanmu di sini...")} maxLength={p.maxLen || undefined} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onEnter?.())} />;
    case "long":
      return (
        <>
          <textarea id={idb} ref={ref} className="a-text area" rows={variant === "page" ? 4 : 3} value={value || ""} placeholder={p.placeholder || (variant === "page" ? "Jawabanmu" : "Ketik jawabanmu di sini...")} maxLength={p.maxLen || undefined}
            onChange={(e) => { onChange(e.target.value); if (variant !== "page") { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; } }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && variant !== "page") { e.preventDefault(); onEnter?.(); } }} />
          {variant !== "page" && <small className="a-hint">Shift + Enter ↵ untuk baris baru{p.maxLen ? ` · ${String(value || "").length}/${p.maxLen}` : ""}</small>}
        </>
      );
    case "number":
      return <input id={idb} ref={ref} className="a-text" type="number" inputMode="decimal" value={value ?? ""} placeholder={variant === "page" ? "Jawabanmu" : "Ketik angka..."} min={p.min} max={p.max} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onEnter?.())} />;
    case "choice":
    case "checkbox": {
      const multi = block.type === "checkbox";
      const cur = multi ? value || [] : value;
      return (
        <div className={"a-choices " + (variant === "page" ? "plain" : "tf")} role={multi ? "group" : "radiogroup"} aria-label={stripHtml(block.title)}>
          {(order || p.options).map((o, i) => {
            const on = multi ? cur.includes(o.id) : cur === o.id;
            return (
              <button type="button" key={o.id} role={multi ? "checkbox" : "radio"} aria-checked={on} className={"a-choice" + (on ? " on" : "")}
                onClick={() => onChange(multi ? (on ? cur.filter((x) => x !== o.id) : [...cur, o.id]) : on && !block.required ? null : o.id, !multi)}>
                {variant === "page" ? <span className={multi ? "fake-cb" : "fake-rd"} /> : <span className="key">{LETTERS[i]}</span>}
                <span className="a-lbl">{o.label}</span>
                {variant !== "page" && on && <Icon name="check" size={18} sw={2.4} className="a-tick" />}
              </button>
            );
          })}
          {multi && variant !== "page" && <small className="a-hint">Bisa pilih lebih dari satu{p.minSel ? ` · minimal ${p.minSel}` : ""}{p.maxSel ? ` · maksimal ${p.maxSel}` : ""}</small>}
        </div>
      );
    }
    case "dropdown":
      return (
        <div className="a-select">
          <select id={idb} ref={ref} value={value || ""} onChange={(e) => onChange(e.target.value || null, true)} aria-label={stripHtml(block.title)}>
            <option value="">Pilih jawaban…</option>
            {(order || p.options).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <Icon name="chevDown" size={18} />
        </div>
      );
    case "matrix": {
      const v = value || {};
      return (
        <div className="a-mx-wrap">
          <table className="a-mx">
            <thead><tr><th />{p.cols.map((c) => <th key={c.id}>{c.label}</th>)}</tr></thead>
            <tbody>
              {p.rows.map((r) => (
                <tr key={r.id}>
                  <th>{r.label}</th>
                  {p.cols.map((c) => {
                    const rv = v[r.id] || [];
                    const on = rv.includes(c.id);
                    return (
                      <td key={c.id}>
                        <button type="button" role={p.multi ? "checkbox" : "radio"} aria-checked={on} aria-label={`${r.label}: ${c.label}`} className={(p.multi ? "fake-cb" : "fake-rd") + (on ? " on" : "")}
                          onClick={() => onChange({ ...v, [r.id]: p.multi ? (on ? rv.filter((x) => x !== c.id) : [...rv, c.id]) : on ? [] : [c.id] })} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case "scale": {
      const n = [];
      for (let i = p.min; i <= p.max; i++) n.push(i);
      const star = p.style === "star";
      return (
        <div className={"a-scale" + (star ? " star" : "") + (variant === "page" ? " page" : "")}>
          <div className="a-scale-row" role="radiogroup" aria-label={stripHtml(block.title)}>
            {n.map((i) => {
              const on = star ? value != null && i <= value : value === i;
              return (
                <button type="button" key={i} role="radio" aria-checked={value === i} aria-label={String(i)} className={"a-sc" + (on ? " on" : "")} onClick={() => onChange(value === i && !block.required ? null : i, true)}>
                  {star ? <><Icon name="star" size={30} sw={1.5} fill={on ? "currentColor" : "none"} /><small>{i}</small></> : i}
                </button>
              );
            })}
          </div>
          {(p.minLabel || p.maxLabel) && <div className="a-scale-lbl"><span>{p.minLabel}</span><span>{p.maxLabel}</span></div>}
        </div>
      );
    }
    case "date": {
      const type = p.mode === "time" ? "time" : p.mode === "datetime" ? "datetime-local" : "date";
      return (
        <div className="a-date">
          <span className="a-date-lbl">{p.mode === "time" ? "Waktu" : p.mode === "datetime" ? "Tanggal & waktu" : "Tanggal"}</span>
          <input id={idb} ref={ref} type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onEnter?.())} />
        </div>
      );
    }
    case "file": {
      const files = value || [];
      const accept = (p.accept || "").split(",").map((s) => s.trim().replace(/^\./, "").toLowerCase()).filter(Boolean);
      const add = (list) => {
        const next = [...files];
        for (const f of list) {
          if (next.length >= p.maxFiles) { setError?.(`Maksimal ${p.maxFiles} file.`); break; }
          if (accept.length && !accept.includes(extOf(f.name))) { setError?.(`Jenis file .${extOf(f.name)} tidak didukung. Gunakan: ${accept.join(", ")}.`); continue; }
          if (f.size > p.maxSizeMB * 1e6) { setError?.(`${f.name} lebih dari ${p.maxSizeMB} MB.`); continue; }
          next.push({ name: f.name, size: f.size });
        }
        onChange(next);
      };
      return (
        <div className="a-file">
          <small className="muted">Unggah {p.maxFiles} file{accept.length ? ` (${accept.join(", ")})` : ""}. Maks {p.maxSizeMB} MB.</small>
          <label className={"a-file-btn" + (files.length >= p.maxFiles ? " dis" : "")}>
            <Icon name="upload" size={17} />Tambahkan File
            <input type="file" hidden multiple={p.maxFiles > 1} accept={accept.map((a) => "." + a).join(",") || undefined} disabled={files.length >= p.maxFiles} onChange={(e) => { add([...e.target.files]); e.target.value = ""; }} />
          </label>
          {files.map((f, i) => (
            <div key={i} className="a-file-item"><Icon name="file" size={16} /><span>{f.name}</span><small className="muted">{fmtSize(f.size)}</small><button type="button" className="icon-btn ghost xs" aria-label={`Hapus ${f.name}`} onClick={() => onChange(files.filter((_, j) => j !== i))}><Icon name="x" size={13} /></button></div>
          ))}
        </div>
      );
    }
    default:
      return null;
  }
}

function themeStyle(theme) {
  return { "--pa": theme.accent, "--pfont": (FONTS[theme.font] || FONTS.jakarta).css };
}
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function EndingScreen({ form, endId, children }) {
  const b = form.blocks.find((x) => x.id === endId);
  return (
    <div className="pl-screen ending-scr">
      {b?.image && <img className="scr-img" src={b.image} alt="" />}
      <Icon name="checkCircle" size={44} className="pa" />
      <Rich as="h2" html={b?.title || "Terima kasih!"} />
      {b?.desc ? <p>{b.desc}</p> : !b && <p>Jawabanmu sudah tersimpan.</p>}
      {b?.props?.button && b.props.url && <a className="pl-btn" href={b.props.url} target="_blank" rel="noopener noreferrer">{b.props.button}</a>}
      {children}
    </div>
  );
}

const readDraft = (key) => { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } };

/* ---------- tampilan responden: satu halaman, pertanyaan bersyarat muncul saat syaratnya terpenuhi ---------- */
function Respondent({ form, onSubmit, onTrace, focusId, scrollRef }) {
  const S = form.settings;
  const draftKey = `anmategra-draft-${form.id}`;
  const [initial] = useState(() => (S.autosaveDraft ? readDraft(draftKey) : null));
  const [answers, setAnswers] = useState(initial || {});
  const [restored, setRestored] = useState(!!initial && Object.keys(initial).length > 0);
  const [errors, setErrors] = useState({});
  const [stage, setStage] = useState("form");
  const [endId, setEndId] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [override, setOverride] = useState(false);
  const orderRef = useRef({});
  const dirty = Object.keys(answers).some((k) => !isEmptyAnswer(answers[k]));

  const vis = useMemo(() => computeVisibility(form, answers), [form, answers]);
  useEffect(() => { onTrace?.(vis); }, [vis]); // eslint-disable-line
  const visible = form.blocks.filter((b) => isQuestion(b) && vis[b.id]);
  const triggers = useMemo(() => { const s = new Set(); form.blocks.forEach((b) => validRules(form, b).forEach((r) => s.add(r.src))); return s; }, [form]);
  const welcome = form.blocks.find((b) => b.type === "welcome");

  /* simpan draf otomatis */
  useEffect(() => {
    if (!S.autosaveDraft || stage !== "form" || !dirty) return;
    const t = setTimeout(() => { try { localStorage.setItem(draftKey, JSON.stringify(answers)); setSavedAt(new Date()); } catch {} }, 500);
    return () => clearTimeout(t);
  }, [answers, S.autosaveDraft, stage]); // eslint-disable-line
  /* peringatan saat meninggalkan halaman dengan jawaban belum terkirim */
  useEffect(() => {
    if (!S.confirmOnLeave || !dirty || stage === "done") return;
    const h = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [S.confirmOnLeave, dirty, stage]);
  useEffect(() => {
    if (!focusId) return;
    const t = setTimeout(() => document.getElementById(`pq-${focusId}`)?.scrollIntoView({ block: "center" }), 120);
    return () => clearTimeout(t);
  }, [focusId]);

  const orderFor = (b) => {
    if (!S.shuffleOptions || !TYPES[b.type].options) return null;
    const cur = orderRef.current[b.id];
    if (!cur || cur.length !== b.props.options.length || cur.some((o) => !b.props.options.find((x) => x.id === o.id))) orderRef.current[b.id] = shuffle(b.props.options);
    return orderRef.current[b.id].map((o) => b.props.options.find((x) => x.id === o.id));
  };
  const set = (id, v) => { setAnswers((a) => ({ ...a, [id]: v })); setErrors((e) => ({ ...e, [id]: null })); };
  const toTop = () => scrollRef?.current?.scrollTo({ top: 0 });
  const finalize = () => {
    const clean = {};
    visible.forEach((b) => { if (!isEmptyAnswer(answers[b.id])) clean[b.id] = answers[b.id]; });
    const end = chooseEnding(form, vis);
    onSubmit(clean, end);
    try { localStorage.removeItem(draftKey); } catch {}
    setEndId(end); setStage("done"); toTop();
  };
  const submit = () => {
    const errs = {};
    visible.forEach((b) => { const e = validateAnswer(b, answers[b.id]); if (e) errs[b.id] = e; });
    setErrors(errs);
    const firstErr = visible.find((b) => errs[b.id]);
    if (firstErr) { document.getElementById(`pq-${firstErr.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    if (S.reviewBeforeSubmit) { setStage("review"); toTop(); } else finalize();
  };

  const closed = form.closesAt && new Date(form.closesAt) < new Date();
  const full = form.maxResponses && (form.responses || []).filter((r) => !r.test).length >= Number(form.maxResponses);
  if ((closed || full) && !override) {
    return (
      <div className="pl-page"><div className="pp-card"><div className="pl-screen ending-scr">
        <Icon name="lock" size={40} className="pa" />
        <h2>{closed ? "Form sudah ditutup" : "Kuota responden penuh"}</h2>
        <p>{S.closedMessage}</p>
        <button type="button" className="lnk" onClick={() => setOverride(true)}>Tetap uji (khusus pratinjau)</button>
      </div></div></div>
    );
  }
  if (stage === "done") {
    return (
      <div className="pl-page"><div className="pp-card">
        <EndingScreen form={form} endId={endId}>
          {S.oneResponsePerAccount && <small className="muted">Satu akun ITB hanya bisa mengirim satu respons{S.allowEditAfterSubmit ? ", tetapi kamu masih bisa mengubahnya." : "."}</small>}
          <div className="pl-actions center">
            {S.allowEditAfterSubmit && <button type="button" className="btn outline" onClick={() => { setStage("form"); toTop(); }}><Icon name="edit" size={15} />Edit jawaban</button>}
            <button type="button" className="lnk" onClick={() => { setAnswers({}); setStage("form"); setErrors({}); toTop(); }}>Isi ulang (pratinjau)</button>
          </div>
        </EndingScreen>
      </div></div>
    );
  }
  if (stage === "review") {
    return (
      <div className="pl-page">
        <div className="pp-card pp-head"><h1>Periksa jawabanmu</h1><p>Pastikan semuanya benar sebelum dikirim. Setelah terkirim, {S.allowEditAfterSubmit ? "kamu masih bisa mengubahnya." : "jawaban tidak bisa diubah."}</p></div>
        <div className="pp-card review">
          {visible.map((b, i) => (
            <div key={b.id} className="rv-row">
              <span className="rv-q">{S.showNumbers ? `${i + 1}. ` : ""}{stripHtml(b.title) || "Tanpa judul"}</span>
              <span className={"rv-a" + (isEmptyAnswer(answers[b.id]) ? " muted" : "")}>{fmtAnswer(b, answers[b.id]) || "Tidak dijawab"}</span>
            </div>
          ))}
        </div>
        <div className="pp-foot">
          <button type="button" className="btn ghost" onClick={() => setStage("form")}><Icon name="arrowLeft" size={15} />Ubah jawaban</button>
          <button type="button" className="pl-btn" onClick={finalize}>Kirim sekarang</button>
        </div>
      </div>
    );
  }
  const answered = visible.filter((b) => !isEmptyAnswer(answers[b.id])).length;
  return (
    <div className="pl-page">
      {S.showProgress && (
        <div className="pp-progress" role="progressbar" aria-valuemin={0} aria-valuemax={visible.length} aria-valuenow={answered} aria-label="Kemajuan pengisian">
          <i style={{ width: `${visible.length ? (answered / visible.length) * 100 : 0}%` }} />
          <span>{answered}/{visible.length} terjawab{S.autosaveDraft && savedAt ? " · draf tersimpan" : ""}</span>
        </div>
      )}
      {form.theme.banner && <div className="pp-banner"><img src={form.theme.banner} alt="" /></div>}
      <div className="pp-card pp-head">
        {welcome?.image && <img className="pp-logo" src={welcome.image} alt="" />}
        <Rich as="h1" html={welcome?.title || form.title} />
        {welcome?.props?.subtitle && <p className="sub">{welcome.props.subtitle}</p>}
        {(welcome?.desc || form.desc) && <p>{welcome?.desc || form.desc}</p>}
        <hr />
        {S.collectIdentity ? (
          <div className="pp-acct"><span>mahasiswa@mahasiswa.itb.ac.id</span><button type="button" className="lnk pa">Ganti Akun</button><span className="sp" /><small className="muted">Nama & NIM tercatat otomatis</small></div>
        ) : (
          <div className="pp-acct"><Icon name="eyeOff" size={15} /><span>Respons anonim: identitasmu tidak dicatat.</span></div>
        )}
        {restored && <div className="pp-note"><Icon name="save" size={15} />Draf terakhirmu dipulihkan.<button type="button" className="lnk" onClick={() => { setAnswers({}); setRestored(false); try { localStorage.removeItem(draftKey); } catch {} }}>Mulai dari awal</button></div>}
        {visible.some((b) => b.required) && <div className="pp-req">* Menunjukkan pertanyaan yang wajib diisi</div>}
      </div>
      {visible.map((b, i) => {
        const cnd = isConditional(form, b);
        return (
          <div key={b.id} id={`pq-${b.id}`} className={"pp-card pp-q" + (errors[b.id] ? " has-err" : "") + (cnd ? " pp-cond" : "")}>
            {cnd && <span className="pp-cond-tag"><Icon name="sparkle" size={13} />Pertanyaan lanjutan dari jawabanmu</span>}
            <h3>{S.showNumbers ? `${i + 1}. ` : ""}<Rich html={b.title || "Tanpa judul"} />{b.required && <span className="req">*</span>}</h3>
            {b.desc && <p className="pl-desc">{b.desc}</p>}
            {b.image && <img className="pl-img" src={b.image} alt="" />}
            <AnswerInput block={b} value={answers[b.id]} onChange={(v) => set(b.id, v)} variant="page" order={orderFor(b)} setError={(e) => setErrors((x) => ({ ...x, [b.id]: e }))} />
            {errors[b.id] && <div className="pl-err" role="alert"><Icon name="alert" size={15} />{errors[b.id]}</div>}
            {triggers.has(b.id) && <small className="pp-trig"><Icon name="branch" size={13} />Jawabanmu di sini bisa memunculkan pertanyaan lanjutan.</small>}
          </div>
        );
      })}
      <div className="pp-foot">
        <button type="button" className="pl-btn" onClick={submit}>{S.reviewBeforeSubmit ? "Periksa & kirim" : "Kirim"}</button>
        <span className="sp" />
        {confirmReset ? (
          <span className="pp-confirm">Hapus semua jawaban? <button type="button" className="lnk danger" onClick={() => { setAnswers({}); setErrors({}); setConfirmReset(false); try { localStorage.removeItem(draftKey); } catch {} }}>Ya, kosongkan</button><button type="button" className="lnk" onClick={() => setConfirmReset(false)}>Batal</button></span>
        ) : (
          <button type="button" className="lnk danger" onClick={() => setConfirmReset(true)}>Kosongkan Formulir</button>
        )}
      </div>
    </div>
  );
}

function PreviewView({ form, api, focusId, device: dev0 }) {
  const [device, setDevice] = useState(dev0 || "desktop");
  const [runKey, setRunKey] = useState(0);
  const [vis, setVis] = useState({});
  const [share, setShare] = useState(false);
  const [showTrace, setShowTrace] = useState(true);
  const scrollRef = useRef(null);
  const closed = form.closesAt && new Date(form.closesAt) < new Date();
  const full = form.maxResponses && (form.responses || []).filter((r) => !r.test).length >= Number(form.maxResponses);
  const onSubmit = useCallback((answers, end) => api.recordResponse(answers, end), [api]);
  const link = `anmategra.km.itb.ac.id/f/${form.id.replace(/^f_/, "")}`;
  const conds = form.blocks.filter((b) => isConditional(form, b));
  const restart = () => { try { localStorage.removeItem(`anmategra-draft-${form.id}`); } catch {} setRunKey((k) => k + 1); };
  const player = (
    <div ref={scrollRef} className={"player bg-" + (form.theme.bg || "soft")} style={themeStyle(form.theme)}>
      <Respondent key={runKey} form={form} onSubmit={onSubmit} onTrace={setVis} focusId={focusId} scrollRef={scrollRef} />
    </div>
  );
  return (
    <div className="preview">
      <div className="pv-bar">
        <div className="seg" role="radiogroup" aria-label="Perangkat">
          <button type="button" role="radio" aria-checked={device === "desktop"} className={device === "desktop" ? "on" : ""} onClick={() => setDevice("desktop")}><Icon name="laptop" size={16} />Desktop</button>
          <button type="button" role="radio" aria-checked={device === "mobile"} className={device === "mobile" ? "on" : ""} onClick={() => setDevice("mobile")}><Icon name="phone" size={16} />Mobile</button>
        </div>
        <button type="button" className="btn ghost" onClick={restart}><Icon name="refresh" size={16} />Ulang dari awal</button>
        <button type="button" className={"btn ghost" + (showTrace ? " on" : "")} aria-pressed={showTrace} onClick={() => setShowTrace((v) => !v)}><Icon name="cond" size={16} />Logika aktif</button>
        <span className="sp" />
        {(closed || full) && <span className="warn-chip"><Icon name="alert" size={14} />{closed ? "Tenggat sudah lewat" : "Kuota responden penuh"}</span>}
        <button type="button" className={"btn " + (form.status === "published" ? "ghost" : "outline")} onClick={() => api.setMeta({ status: form.status === "published" ? "draft" : "published" })}>
          <Icon name="checkCircle" size={16} />{form.status === "published" ? "Batalkan rilis" : "Publikasikan"}
        </button>
        <button type="button" className="btn accent" onClick={() => setShare(true)}><Icon name="share" size={16} />Share</button>
      </div>
      <div className="pv-body">
        <div className={"device " + device}>
          {device === "desktop" ? (
            <div className="browser">
              <div className="browser-bar" aria-hidden="true"><i /><i /><i /><span className="url"><Icon name="lock" size={12} />{link}</span></div>
              {player}
            </div>
          ) : (
            <div className="phone"><div className="phone-notch" aria-hidden="true" />{player}</div>
          )}
        </div>
        {showTrace && (
          <aside className="trace" aria-label="Logika aktif">
            <h4>Logika aktif</h4>
            <p className="muted small">Isi form di sebelah kiri; status di bawah ikut berubah. Blok tersembunyi tidak terlihat dan jawabannya tidak ikut terkirim.</p>
            {conds.length === 0 ? <p className="muted small">Form ini belum punya pertanyaan bersyarat.</p> : (
              <ul>
                {conds.map((b) => (
                  <li key={b.id} className={vis[b.id] ? "on" : ""}>
                    <span className={"pill " + (vis[b.id] ? "ok" : "muted")}>{vis[b.id] ? "Tampil" : "Tersembunyi"}</span>
                    <b>{blockLabel(form, b.id, 44)}</b>
                    <small className="muted">jika {condSummary(form, b)}</small>
                  </li>
                ))}
              </ul>
            )}
            <p className="muted small">Kiriman dari pratinjau dicatat sebagai respons <b>uji</b>.</p>
          </aside>
        )}
      </div>
      <Modal open={share} title="Bagikan form" onClose={() => setShare(false)} actions={<button type="button" className="btn" onClick={() => setShare(false)}>Tutup</button>}>
        {form.status !== "published" && <p className="warn-box">Form masih <b>Draf</b>. Tautan baru bisa dibuka responden setelah dipublikasikan.</p>}
        <div className="copy-row">
          <input readOnly value={"https://" + link} id="share-link" onFocus={(e) => e.target.select()} />
          <button type="button" className="btn accent" onClick={async () => {
            try { await navigator.clipboard.writeText("https://" + link); api.toast("Tautan disalin"); }
            catch { document.getElementById("share-link")?.select(); api.toast("Tekan Ctrl+C untuk menyalin"); }
          }}><Icon name="copy" size={16} />Salin</button>
        </div>
        <p className="muted small">{form.settings.collectIdentity ? "Responden masuk dengan akun ITB, jadi nama dan NIM tercatat otomatis." : "Form anonim: identitas responden tidak dicatat."}{form.settings.oneResponsePerAccount ? " Satu akun hanya bisa mengirim satu respons." : ""}</p>
      </Modal>
    </div>
  );
}

/* =====================================================================
   RESPONS · DAFTAR FORMS · APP
   ===================================================================== */
function fmtAnswer(b, v) {
  if (isEmptyAnswer(v)) return "";
  const p = b.props || {};
  const lab = (id, list = p.options) => list?.find((o) => o.id === id)?.label ?? "?";
  switch (b.type) {
    case "choice": case "dropdown": return lab(v);
    case "checkbox": return v.map((x) => lab(x)).join(", ");
    case "matrix": return p.rows.filter((r) => !isEmptyAnswer(v[r.id])).map((r) => `${r.label}: ${v[r.id].map((c) => lab(c, p.cols)).join("/")}`).join("; ");
    case "file": return v.map((f) => f.name).join(", ");
    case "scale": return p.style === "star" ? `${v} ★` : String(v);
    case "date": return p.mode === "date" ? fmtDate(v) : String(v).replace("T", " ");
    default: return String(v);
  }
}

/* Cabang = opsi yang dipakai sebagai syarat tampil (mis. "Pilihan 1/2/3 adalah Mentor").
   Opsi dengan label sama di beberapa pertanyaan digabung jadi satu cabang. */
function branchesOf(form) {
  const m = new Map();
  form.blocks.forEach((b) => validRules(form, b).forEach((r) => {
    if (r.op !== "is" || !r.value) return;
    const src = form.blocks.find((x) => x.id === r.src);
    const label = src?.props?.options?.find((o) => o.id === r.value)?.label;
    if (!label) return;
    if (!m.has(label)) m.set(label, { label, blocks: new Set(), srcs: new Map() });
    m.get(label).blocks.add(b.id);
    m.get(label).srcs.set(r.src, r.value);
  }));
  return [...m.values()];
}

function SheetView({ form, rows, qs }) {
  const branches = useMemo(() => branchesOf(form), [form]);
  const [br, setBr] = useState("");
  const [hideGen, setHideGen] = useState(false);
  const [wrap, setWrap] = useState(false);
  const B = branches.find((b) => b.label === br);
  const condIds = new Set(qs.filter((q) => isConditional(form, q)).map((q) => q.id));
  const general = qs.filter((q) => !condIds.has(q.id));
  const cols = B ? [...(hideGen ? [] : general), ...qs.filter((q) => B.blocks.has(q.id))] : qs;
  const list = B ? rows.filter((r) => { const v = computeVisibility(form, r.answers); return [...B.blocks].some((id) => v[id]); }) : rows;
  const via = (r) => [...B.srcs].filter(([src, val]) => r.answers[src] === val).map(([src]) => stripHtml(form.blocks.find((x) => x.id === src).title).replace(/^Pilihan divisi /, "Pilihan ")).join(", ");
  const ident = form.settings?.collectIdentity !== false && rows.some((r) => r.who);
  return (
    <div className="sheet-box" data-tour="forms-sheet">
      <div className="sheet-bar">
        {branches.length > 0 && (
          <label className="sheet-field"><span>Saring per cabang</span>
            <select value={br} onChange={(e) => setBr(e.target.value)}>
              <option value="">Semua respons, semua kolom</option>
              {branches.map((b) => <option key={b.label} value={b.label}>{b.label} ({rows.filter((r) => [...b.srcs].some(([s, v]) => r.answers[s] === v)).length})</option>)}
            </select>
          </label>
        )}
        {B && <Toggle id="hide-gen" label="Sembunyikan pertanyaan umum" on={hideGen} onChange={setHideGen} />}
        <Toggle id="wrap" label="Tampilkan jawaban utuh" on={wrap} onChange={setWrap} />
        <span className="sp" />
        <span className="muted small">{list.length} baris · {cols.length} kolom pertanyaan</span>
      </div>
      {B && <p className="muted small">Hanya pendaftar yang memilih <b>{B.label}</b> di salah satu pilihannya, dengan kolom pertanyaan khusus {B.label}. Mirip satu tab sheet pendivisian.</p>}
      <div className={"sheet-wrap" + (wrap ? " wrap" : "")}>
        <table className="sheet">
          <thead>
            <tr>
              <th className="rn">#</th><th>Waktu</th>
              {ident && <><th>NIM</th><th>Nama</th><th>Fakultas</th></>}
              {B && <th>Memilih di</th>}
              {cols.map((q) => <th key={q.id} className={condIds.has(q.id) ? "cond" : ""} title={stripHtml(q.title)}>{questionNumber(form, q.id)}. {stripHtml(q.title) || TYPES[q.type].label}</th>)}
            </tr>
          </thead>
          <tbody>
            {list.map((r, i) => (
              <tr key={r.id}>
                <td className="rn">{i + 1}</td>
                <td className="nowrap">{new Date(r.at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</td>
                {ident && <><td className="nowrap">{r.who?.nim ?? "—"}</td><td className="nowrap">{r.who?.name ?? (r.test ? "Respons uji" : "—")}</td><td className="nowrap">{r.who?.fak ?? "—"}</td></>}
                {B && <td className="nowrap">{via(r)}</td>}
                {cols.map((q) => { const t = fmtAnswer(q, r.answers[q.id]); return <td key={q.id} title={t}>{t || <span className="dash">—</span>}</td>; })}
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length && <div className="empty"><p>Belum ada respons di cabang ini.</p></div>}
      </div>
    </div>
  );
}

function ResponsesView({ form, api, mode, setMode }) {
  const [withTest, setWithTest] = useState(true);
  const qs = form.blocks.filter(isQuestion);
  const all = form.responses || [];
  const rows = all.filter((r) => withTest || !r.test).slice().sort((a, b) => b.at.localeCompare(a.at));
  const csv = () => {
    const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
    const head = ["Waktu", "Jenis", "Penutup", ...qs.map((q) => stripHtml(q.title) || TYPES[q.type].label)];
    const body = rows.map((r) => [new Date(r.at).toLocaleString("id-ID"), r.test ? "Uji" : r.sample ? "Contoh" : "Asli", blockLabel(form, r.end || END), ...qs.map((q) => fmtAnswer(q, r.answers[q.id]))]);
    return [head, ...body].map((l) => l.map(esc).join(",")).join("\n");
  };
  return (
    <div className="resp">
      <div className="resp-head">
        <div>
          <h2>{form.title}</h2>
          <p className="muted">{rows.length} respons ditampilkan · {all.filter((r) => r.test).length} uji · {all.filter((r) => r.sample).length} contoh</p>
        </div>
        <span className="sp" />
        <Toggle id="with-test" label="Sertakan respons uji" on={withTest} onChange={setWithTest} />
        <button type="button" className="btn ghost" onClick={async () => { try { await navigator.clipboard.writeText(csv()); api.toast("CSV disalin ke clipboard"); } catch { api.toast("Clipboard ditolak browser"); } }}><Icon name="copy" size={16} />Salin CSV</button>
        <button type="button" className="btn accent" onClick={() => api.edit(form.id)}><Icon name="edit" size={16} />Edit form</button>
      </div>
      <div className="seg" role="radiogroup" aria-label="Tampilan respons" data-tour="forms-resp-mode">
        {[["ringkasan", "grid", "Ringkasan"], ["sheets", "table", "Sheets"]].map(([k, ic, l]) => (
          <button type="button" key={k} role="radio" aria-checked={mode === k} className={mode === k ? "on" : ""} onClick={() => setMode(k)}><Icon name={ic} size={15} />{l}</button>
        ))}
      </div>
      {mode === "sheets" ? <SheetView form={form} rows={rows} qs={qs} /> : <>
      <div className="summary">
        {qs.filter((q) => ["choice", "dropdown", "checkbox", "scale"].includes(q.type)).map((q) => {
          const ans = rows.map((r) => r.answers[q.id]).filter((v) => !isEmptyAnswer(v));
          let bars;
          if (q.type === "scale") {
            bars = [];
            for (let i = q.props.min; i <= q.props.max; i++) bars.push({ label: String(i), n: ans.filter((v) => v === i).length });
          } else bars = q.props.options.map((o) => ({ label: o.label, n: ans.filter((v) => (Array.isArray(v) ? v.includes(o.id) : v === o.id)).length }));
          const max = Math.max(1, ...bars.map((b) => b.n));
          const avg = q.type === "scale" && ans.length ? (ans.reduce((s, v) => s + v, 0) / ans.length).toFixed(1) : null;
          return (
            <div className="sum-card" key={q.id}>
              <div className="sum-hd"><span className="qnum sm">{questionNumber(form, q.id)}</span><b>{stripHtml(q.title)}</b></div>
              <small className="muted">{ans.length} menjawab{avg ? ` · rata-rata ${avg}` : ""}</small>
              <div className="bars">
                {bars.map((b, i) => (
                  <div className="bar" key={i}><span className="bar-l" title={b.label}>{b.label}</span><span className="bar-t"><i style={{ width: `${(b.n / max) * 100}%` }} /></span><span className="bar-n">{b.n}</span></div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="tbl-wrap">
        {rows.length === 0 ? (
          <div className="empty"><Icon name="inbox" size={30} /><p>Belum ada respons. Coba isi lewat <button type="button" className="lnk" onClick={() => api.edit(form.id, "pratinjau")}>Pratinjau</button>.</p></div>
        ) : (
          <table className="tbl">
            <thead><tr><th>Waktu</th><th>Jenis</th><th>Penutup</th>{qs.map((q) => <th key={q.id} title={stripHtml(q.title)}>{questionNumber(form, q.id)}. {stripHtml(q.title) || TYPES[q.type].label}</th>)}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="nowrap">{new Date(r.at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</td>
                  <td><span className={"pill " + (r.test ? "warn" : r.sample ? "muted" : "ok")}>{r.test ? "Uji" : r.sample ? "Contoh" : "Asli"}</span></td>
                  <td className="nowrap">{r.end ? blockLabel(form, r.end) : "-"}</td>
                  {qs.map((q) => <td key={q.id}>{fmtAnswer(q, r.answers[q.id]) || <span className="dash">—</span>}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      </>}
    </div>
  );
}

/* ---------- daftar Forms ---------- */
const NAV = [["home", "Beranda"], ["calendar", "Kegiatan"], ["users", "Anggota"], ["inbox", "Inbox"], ["alert", "Laporan"], ["list", "Forms"]];
function AppSidebar({ api }) {
  return (
    <nav className="app-side" aria-label="Navigasi utama">
      <div className="brand"><Logo /><span>anmategra</span></div>
      <ul>
        {NAV.map(([i, l]) => (
          <li key={l}><button type="button" className={l === "Forms" ? "on" : ""} aria-current={l === "Forms" ? "page" : undefined} onClick={() => l !== "Forms" && api.toast(`${l} di luar cakupan purwarupa ini`)}><Icon name={i} size={19} />{l}</button></li>
        ))}
      </ul>
      <div className="org">
        <span className="org-av">IF</span>
        <div><b>HMIF ITB</b><small>Lembaga</small></div>
      </div>
      <button type="button" className="logout" onClick={() => api.toast("Logout dinonaktifkan di purwarupa")}><Icon name="logout" size={18} />Logout</button>
    </nav>
  );
}

function FormsList({ forms, api }) {
  const [q, setQ] = useState("");
  const [st, setSt] = useState([]);
  const [tg, setTg] = useState([]);
  const [disp, setDisp] = useState("list");
  const [open, setOpen] = useState(null);
  const [page, setPage] = useState(1);
  const [menu, setMenu] = useState(null);
  const [del, setDel] = useState(null);
  const stRef = useRef(null), tgRef = useRef(null);
  const allTags = [...new Set(forms.flatMap((f) => f.tags))].sort();
  const list = forms
    .filter((f) => !q || f.title.toLowerCase().includes(q.toLowerCase()) || f.tags.some((t) => t.toLowerCase().includes(q.toLowerCase())))
    .filter((f) => !st.length || st.includes(f.status))
    .filter((f) => !tg.length || tg.some((t) => f.tags.includes(t)))
    .sort((a, b) => (b.pinned - a.pinned) || b.createdAt.localeCompare(a.createdAt));
  const PER = 6;
  const pages = Math.max(1, Math.ceil(list.length / PER));
  const pg = Math.min(page, pages);
  const shown = list.slice((pg - 1) * PER, pg * PER);
  const tog = (arr, set, v) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const Thumb = ({ f }) => (
    <div className="thumb" style={{ "--ta": f.theme.accent }}>
      {f.theme.banner ? <img src={f.theme.banner} alt="" /> : <span className="thumb-gen"><i /><i /><i /></span>}
      {f.pinned && <Icon name="pin" size={16} className="thumb-pin" fill="currentColor" />}
    </div>
  );
  const Actions = ({ f }) => (
    <div className="row-act">
      <button type="button" className="btn sm ghost" onClick={() => api.responses(f.id)}>Lihat <Icon name="external" size={14} /></button>
      <button type="button" className="btn sm ghost" onClick={() => api.edit(f.id)}>Edit <Icon name="external" size={14} /></button>
      <div className="rel">
        <button type="button" className="icon-btn" aria-label="Menu lain" aria-expanded={menu === f.id} onClick={(e) => { e.stopPropagation(); setMenu(menu === f.id ? null : f.id); }}><Icon name="more" size={20} sw={2.6} /></button>
        <Popover open={menu === f.id} onClose={() => setMenu(null)} className="row-menu">
          <button type="button" onClick={() => { api.patchForm(f.id, { pinned: !f.pinned }); setMenu(null); }}><Icon name="pin" size={16} />{f.pinned ? "Lepas sematan" : "Sematkan"}</button>
          <button type="button" onClick={() => { api.duplicateForm(f.id); setMenu(null); }}><Icon name="copy" size={16} />Duplikat</button>
          <button type="button" onClick={() => { api.edit(f.id, "pratinjau"); setMenu(null); }}><Icon name="eye" size={16} />Pratinjau</button>
          <button type="button" className="danger" onClick={() => { setDel(f); setMenu(null); }}><Icon name="trash" size={16} />Hapus</button>
        </Popover>
      </div>
    </div>
  );
  return (
    <div className="list-page">
      <div className="lp-head">
        <h1>Forms</h1>
        <button type="button" className="btn accent" onClick={api.create}><Icon name="plus" size={16} />Form Baru</button>
      </div>
      <label className="search"><Icon name="search" size={20} /><input placeholder="Cari forms" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Cari forms" /></label>
      <div className="filters">
        <div className="rel">
          <button ref={stRef} type="button" className={"chip-btn" + (st.length ? " on" : "")} aria-expanded={open === "st"} onClick={() => setOpen(open === "st" ? null : "st")}><Icon name="filter" size={18} />Status{st.length ? ` · ${st.length}` : ""}</button>
          <Popover open={open === "st"} onClose={() => setOpen(null)} anchorRef={stRef} className="filter-pop">
            {Object.entries(STATUS).map(([k, s]) => <label key={k}><input type="checkbox" checked={st.includes(k)} onChange={() => { tog(st, setSt, k); setPage(1); }} /><span className={"dot " + s.tone} />{s.label}</label>)}
          </Popover>
        </div>
        <div className="rel">
          <button ref={tgRef} type="button" className={"chip-btn" + (tg.length ? " on" : "")} aria-expanded={open === "tg"} onClick={() => setOpen(open === "tg" ? null : "tg")}><Icon name="tag" size={18} />Tag{tg.length ? ` · ${tg.length}` : ""}</button>
          <Popover open={open === "tg"} onClose={() => setOpen(null)} anchorRef={tgRef} className="filter-pop">
            {allTags.map((t) => <label key={t}><input type="checkbox" checked={tg.includes(t)} onChange={() => { tog(tg, setTg, t); setPage(1); }} />{t}</label>)}
          </Popover>
        </div>
        {(st.length > 0 || tg.length > 0 || q) && <button type="button" className="lnk" onClick={() => { setSt([]); setTg([]); setQ(""); }}>Reset filter</button>}
        <span className="sp" />
        <button type="button" className="chip-btn square" onClick={() => setDisp(disp === "list" ? "grid" : "list")} aria-label="Ganti tampilan"><Icon name={disp === "list" ? "grid" : "display"} size={18} />{disp === "list" ? "Grid" : "Daftar"}</button>
      </div>
      {shown.length === 0 ? (
        <div className="empty"><Icon name="search" size={30} /><p>Tidak ada form yang cocok dengan filter ini.</p></div>
      ) : disp === "list" ? (
        <div className="ftable" role="table" aria-label="Daftar forms">
          <div className="fr fh" role="row"><span>Thumbnail</span><span>Judul</span><span>Dibuat pada</span><span>Status</span><span>Respons</span><span>Aksi</span></div>
          {shown.map((f) => (
            <div key={f.id} className={"fr" + (f.pinned ? " pinned" : "")} role="row">
              <Thumb f={f} />
              <button type="button" className="f-title" onClick={() => api.edit(f.id)}><b>{f.title}</b>{f.tags.length > 0 && <small>{f.tags.join(" · ")}</small>}</button>
              <span className="f-date">{fmtDate(f.createdAt)}</span>
              <span className="f-status"><span className={"dot " + STATUS[f.status].tone} />{STATUS[f.status].label}</span>
              <span className="f-resp">{(f.responses || []).length}{f.maxResponses ? <small> / {f.maxResponses}</small> : ""}</span>
              <Actions f={f} />
            </div>
          ))}
        </div>
      ) : (
        <div className="fgrid">
          {shown.map((f) => (
            <div key={f.id} className="fcard">
              <Thumb f={f} />
              <button type="button" className="f-title" onClick={() => api.edit(f.id)}><b>{f.title}</b></button>
              <div className="fcard-meta"><span className="f-status"><span className={"dot " + STATUS[f.status].tone} />{STATUS[f.status].label}</span><span className="muted">{fmtDate(f.createdAt)}</span><span className="muted">{(f.responses || []).length} respons</span></div>
              <Actions f={f} />
            </div>
          ))}
        </div>
      )}
      {pages > 1 && (
        <div className="pager">
          <button type="button" aria-label="Sebelumnya" disabled={pg === 1} onClick={() => setPage(pg - 1)}><Icon name="chevLeft" /></button>
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => <button type="button" key={n} className={n === pg ? "on" : ""} onClick={() => setPage(n)}>{n}</button>)}
          <button type="button" aria-label="Berikutnya" disabled={pg === pages} onClick={() => setPage(pg + 1)}><Icon name="chevRight" /></button>
        </div>
      )}
      <Modal open={!!del} title="Hapus form?" onClose={() => setDel(null)} actions={<><button type="button" className="btn ghost" onClick={() => setDel(null)}>Batal</button><button type="button" className="btn danger" onClick={() => { api.deleteForm(del.id); setDel(null); }}>Hapus form</button></>}>
        <p><b>{del?.title}</b> beserta {(del?.responses || []).length} responsnya akan dihapus permanen.</p>
      </Modal>
    </div>
  );
}

/* ---------- editor shell ---------- */
function Editor({ form, api, tab, setTab, hist, startAt, device, flowFocus, selected, setSelected, panelOpen, setPanelOpen, condOpen }) {
  const [delId, setDelId] = useState(null);
  useEffect(() => { api._setAskDelete(setDelId); }, [api]);
  const del = form.blocks.find((b) => b.id === delId);
  const incoming = del ? form.blocks.filter((b) => (b.cond?.rules || []).some((r) => r.src === del.id)).length : 0;
  useEffect(() => {
    const k = (e) => {
      const t = e.target;
      const typing = t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName);
      if (typing || !(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      e.shiftKey ? api.redo() : api.undo();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [api]);
  return (
    <div className="editor">
      <header className="ed-top">
        <button type="button" className="brand-btn" onClick={api.home} aria-label="Kembali ke daftar Forms"><Logo size={36} /></button>
        <button type="button" className="icon-btn burger" aria-label="Panel halaman" aria-expanded={panelOpen} onClick={() => setPanelOpen(!panelOpen)}><Icon name="menu" size={22} /></button>
        <nav className="crumb" aria-label="Breadcrumb"><button type="button" onClick={api.home}>Forms</button><span>›</span><b title={form.title}>{form.title || "Tanpa judul"}</b></nav>
        <div className="tabs" role="tablist" data-tour="forms-editor-tabs">
          {[["konten", "list", "Konten"], ["alur", "flow", "Alur"], ["pratinjau", "eye", "Pratinjau"]].map(([k, i, l]) => (
            <button type="button" key={k} role="tab" aria-label={l} aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}><Icon name={i} size={19} /><span>{l}</span></button>
          ))}
        </div>
        <div className="ed-right">
          <button type="button" className="icon-btn" aria-label="Urungkan" title="Urungkan (Ctrl+Z)" disabled={!hist.past.length} onClick={api.undo}><Icon name="undo" /></button>
          <button type="button" className="icon-btn" aria-label="Ulangi" title="Ulangi (Ctrl+Shift+Z)" disabled={!hist.future.length} onClick={api.redo}><Icon name="redo" /></button>
          <button type="button" className="btn ghost sm resp-btn" data-tour="forms-resp-btn" onClick={() => api.responses(form.id)}><Icon name="table" size={15} />{(form.responses || []).length}<span> respons</span></button>
          <span className={"status-pill " + STATUS[form.status].tone}>{STATUS[form.status].label}</span>
        </div>
      </header>
      {tab === "konten" && <KontenView form={form} selected={selected} api={api} panelOpen={panelOpen} condOpen={condOpen} />}
      {tab === "alur" && <FlowView form={form} api={api} focusId={flowFocus} />}
      {tab === "pratinjau" && <PreviewView form={form} api={api} focusId={startAt} device={device} />}
      <Modal open={!!del} title="Hapus blok ini?" onClose={() => setDelId(null)} actions={<><button type="button" className="btn ghost" onClick={() => setDelId(null)}>Batal</button><button type="button" className="btn danger" onClick={() => { api.remove(delId); setDelId(null); }}>Hapus</button></>}>
        <p><b>{del && (stripHtml(del.title) || TYPES[del.type].label)}</b> akan dihapus.</p>
        {incoming > 0 && <p className="warn-box">{incoming} blok memakai jawaban pertanyaan ini sebagai syarat tampil. Kondisinya ikut dihapus, jadi blok-blok itu akan selalu tampil.</p>}
        {del && (form.responses || []).some((r) => !isEmptyAnswer(r.answers[del.id])) && <p className="muted small">Jawaban lama untuk pertanyaan ini tidak lagi tampil di tabel respons.</p>}
      </Modal>
    </div>
  );
}

/* ---------- App ---------- */
/* Kunci terpisah dari purwarupa Forms biasa supaya contoh oprec OSKM selalu ada. */
const STORE_KEY = "anmategra-proto-oprec-forms-v1";
function loadForms() {
  try { const s = localStorage.getItem(STORE_KEY); if (s) return JSON.parse(s).map(withDefaults); } catch {}
  return sampleForms();
}

export default function AnmategraForms() {
  const [forms, setForms] = useState(loadForms);
  const formsRef = useRef(forms);
  formsRef.current = forms;
  const [route, setRoute] = useState({ view: "list" });
  const [respMode, setRespMode] = useState("ringkasan");
  const routeRef = useRef(route);
  routeRef.current = route;
  const [hist, setHist] = useState({ past: [], future: [] });
  const histMeta = useRef({ key: null, t: 0 });
  const [selected, setSelected] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [condOpen, setCondOpen] = useState(null);
  const [toastMsg, toast] = useToast();
  const askDel = useRef(() => {});

  useEffect(() => { const t = setTimeout(() => { try { localStorage.setItem(STORE_KEY, JSON.stringify(forms)); } catch {} }, 400); return () => clearTimeout(t); }, [forms]);

  const writeForm = (next) => {
    const nf = formsRef.current.map((f) => (f.id === next.id ? next : f));
    formsRef.current = nf;
    setForms(nf);
  };
  /* commit: satu pintu untuk semua perubahan form yang sedang diedit (+ riwayat undo) */
  const commit = (fn, key) => {
    const id = routeRef.current.formId;
    const prev = formsRef.current.find((f) => f.id === id);
    if (!prev) return;
    const next = fn(prev);
    if (next === prev) return;
    const now = Date.now();
    const coalesce = key && histMeta.current.key === key && now - histMeta.current.t < 1200;
    histMeta.current = { key, t: now };
    if (!coalesce) setHist((h) => ({ past: [...h.past.slice(-80), prev], future: [] }));
    else setHist((h) => ({ ...h, future: [] }));
    writeForm(next);
  };
  const mapBlocks = (fn) => (f) => ({ ...f, blocks: fn(f.blocks) });

  const api = useMemo(() => {
    const a = {
      toast,
      home: () => { setRoute({ view: "list" }); setPanelOpen(false); },
      edit: (id, tab = "konten") => { setHist({ past: [], future: [] }); setSelected(null); setCondOpen(null); setRoute({ view: "editor", formId: id, tab }); },
      responses: (id) => setRoute({ view: "responses", formId: id }),
      create: () => { const f = blankForm(); const nf = [f, ...formsRef.current]; formsRef.current = nf; setForms(nf); a.edit(f.id); },
      patchForm: (id, patch) => { const f = formsRef.current.find((x) => x.id === id); writeForm({ ...f, ...patch }); },
      duplicateForm: (id) => {
        const f = clone(formsRef.current.find((x) => x.id === id));
        const idMap = {};
        f.blocks.forEach((b) => { idMap[b.id] = uid("b"); });
        f.blocks.forEach((b) => { b.id = idMap[b.id]; (b.cond?.rules || []).forEach((r) => { r.src = idMap[r.src] || r.src; }); });
        const nf = [{ ...f, id: uid("f"), title: f.title + " (salinan)", status: "draft", pinned: false, responses: [], createdAt: new Date().toISOString() }, ...formsRef.current];
        formsRef.current = nf; setForms(nf); toast("Form diduplikat");
      },
      deleteForm: (id) => { const nf = formsRef.current.filter((f) => f.id !== id); formsRef.current = nf; setForms(nf); toast("Form dihapus"); },
      undo: () => setHist((h) => {
        if (!h.past.length) return h;
        const cur = formsRef.current.find((f) => f.id === routeRef.current.formId);
        const prev = h.past[h.past.length - 1];
        writeForm(prev);
        histMeta.current = { key: null, t: 0 };
        return { past: h.past.slice(0, -1), future: [cur, ...h.future] };
      }),
      redo: () => setHist((h) => {
        if (!h.future.length) return h;
        const cur = formsRef.current.find((f) => f.id === routeRef.current.formId);
        writeForm(h.future[0]);
        histMeta.current = { key: null, t: 0 };
        return { past: [...h.past, cur], future: h.future.slice(1) };
      }),
      select: (id, scroll) => {
        setSelected(id);
        if (scroll) { setPanelOpen(false); requestAnimationFrame(() => document.getElementById(`card-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })); }
      },
      setMeta: (patch, key) => commit((f) => ({ ...f, ...patch }), key && "meta:" + key),
      update: (id, patch, key) => commit(mapBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b))), key),
      mutateBlocks: (fn, key) => commit(mapBlocks(fn), key),
      toggleCond: (id) => { setCondOpen((c) => (c === id ? null : id)); setSelected(id); },
      /* buat blok baru yang tersembunyi sampai kondisi terpenuhi; disisipkan setelah cabang milik sumber */
      createConditional: (srcId, type, title, rule) => {
        const f = formsRef.current.find((x) => x.id === routeRef.current.formId);
        const S = f.settings || DEFAULT_SETTINGS;
        const nb = newBlock(type, { title: title || (type === "ending" ? "Terima kasih!" : ""), required: type !== "ending" && S.requiredByDefault, cond: { match: "all", rules: [{ ...rule, src: srcId }] } });
        commit(mapBlocks((bs) => {
          const n = [...bs];
          if (type === "ending") { n.push(nb); return normalizeOrder(n); }
          const si = n.findIndex((b) => b.id === srcId);
          let at = si + 1;
          while (at < n.length && isQuestion(n[at]) && (n[at].cond?.rules || []).some((r) => r.src === srcId)) at++;
          n.splice(at, 0, nb);
          return normalizeOrder(n);
        }));
        return nb.id;
      },
      updateProps: (id, patch, key) => commit(mapBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, props: { ...b.props, ...patch } } : b))), key),
      add: (type) => {
        const S = formsRef.current.find((x) => x.id === routeRef.current.formId)?.settings || DEFAULT_SETTINGS;
        const nb = newBlock(type, type === "ending" ? { title: "Terima kasih!" } : { required: !TYPES[type].screen && S.requiredByDefault });
        commit(mapBlocks((bs) => {
          const sel = bs.findIndex((b) => b.id === routeRef.current.selectedId);
          const n = [...bs];
          if (type === "welcome") n.unshift(nb);
          else if (type === "ending") n.push(nb);
          else if (sel >= 0 && isQuestion(bs[sel])) n.splice(sel + 1, 0, nb);
          else { const fe = n.findIndex((b) => b.type === "ending"); fe < 0 ? n.push(nb) : n.splice(fe, 0, nb); }
          return normalizeOrder(n);
        }));
        a.select(nb.id, true);
        setTimeout(() => document.querySelector(`#card-${nb.id} .rich`)?.focus(), 350);
      },
      duplicate: (id) => {
        const src = formsRef.current.find((f) => f.id === routeRef.current.formId).blocks.find((b) => b.id === id);
        if (!src) return;
        const c = clone(src);
        c.id = uid("b");
        const m = {};
        ["options", "rows", "cols"].forEach((k) => c.props[k] && (c.props[k] = c.props[k].map((o) => { const nid = uid("o"); m[o.id] = nid; return { ...o, id: nid }; })));
        c.cond = { match: c.cond?.match || "all", rules: (c.cond?.rules || []).map((r) => ({ ...r, id: uid("c") })) };
        commit(mapBlocks((bs) => { const i = bs.findIndex((b) => b.id === id); const n = [...bs]; n.splice(i + 1, 0, c); return normalizeOrder(n); }));
        a.select(c.id, true);
        toast("Blok diduplikat");
      },
      askDelete: (id) => askDel.current(id),
      _setAskDelete: (fn) => { askDel.current = fn; },
      remove: (id) => {
        commit(mapBlocks((bs) => bs.filter((b) => b.id !== id).map((b) => ({ ...b, cond: { ...b.cond, rules: (b.cond?.rules || []).filter((r) => r.src !== id) } }))));
        setSelected(null); setCondOpen(null);
        toast("Blok dihapus · Ctrl+Z untuk urungkan");
      },
      changeType: (id, type) => {
        const f = formsRef.current.find((x) => x.id === routeRef.current.formId);
        const b = f.blocks.find((x) => x.id === id);
        const keepOpts = TYPES[b.type].options && TYPES[type].options;
        const props = { ...defaultProps(type), ...(keepOpts ? { options: b.props.options } : {}) };
        /* kondisi lain yang bersumber dari blok ini: pertahankan yang operatornya masih berlaku */
        let dropped = 0;
        commit(mapBlocks((bs) => bs.map((x) => {
          if (x.id === id) return { ...x, type, props };
          const rules = (x.cond?.rules || []).filter((r) => { const ok = r.src !== id || (opsFor(type).some((o) => o[0] === r.op) && (keepOpts || !TYPES[b.type].options)); if (!ok) dropped++; return ok; });
          return rules.length === (x.cond?.rules || []).length ? x : { ...x, cond: { ...x.cond, rules } };
        })));
        if (dropped) toast(`${dropped} kondisi yang bergantung pada pertanyaan ini dihapus karena tipenya berubah`);
      },
      reorderQuestions: (ids) => commit(mapBlocks((bs) => {
        const qs = ids.map((id) => bs.find((b) => b.id === id));
        return [...bs.filter((b) => b.type === "welcome"), ...qs, ...bs.filter((b) => b.type === "ending")];
      })),
      openFlow: (id) => setRoute((r) => ({ ...r, tab: "alur", flowFocus: id })),
      gotoBlock: (id) => { setRoute((r) => ({ ...r, tab: "konten" })); setTimeout(() => a.select(id, true), 50); },
      preview: (startAt, device) => setRoute((r) => ({ ...r, tab: "pratinjau", startAt: startAt || null, device: device || r.device })),
      recordResponse: (answers, end) => {
        const f = formsRef.current.find((x) => x.id === routeRef.current.formId);
        if (!f) return;
        writeForm({ ...f, responses: [...(f.responses || []), { id: uid("s"), at: new Date().toISOString(), answers, end, test: true }] });
        toast("Respons uji tercatat");
      },
    };
    return a;
  }, []); // eslint-disable-line

  /* Wizard panduan prototipe mengatur tampilan lewat event window. */
  useEffect(() => {
    const on = (e) => {
      const d = e.detail || {};
      if (d.mode) setRespMode(d.mode);
      if (d.view === "list") api.home();
      else if (d.view === "responses" && d.formId) api.responses(d.formId);
      else if (d.view === "editor" && d.formId) {
        if (routeRef.current.view === "editor" && routeRef.current.formId === d.formId) setRoute((r) => ({ ...r, tab: d.tab || "konten" }));
        else api.edit(d.formId, d.tab || "konten");
      }
    };
    window.addEventListener("forms-proto", on);
    return () => window.removeEventListener("forms-proto", on);
  }, [api]);

  routeRef.current = { ...route, selectedId: selected };
  const form = forms.find((f) => f.id === route.formId);

  return (
    <div className="af-root">
      <style>{CSS}</style>
      {route.view === "list" || !form ? (
        <div className="shell">
          <AppSidebar api={api} />
          <main className="shell-main"><FormsList forms={forms} api={api} /></main>
        </div>
      ) : route.view === "responses" ? (
        <div className="shell">
          <AppSidebar api={api} />
          <main className="shell-main">
            <nav className="crumb plain"><button type="button" onClick={api.home}>Forms</button><span>›</span><b>Respons</b></nav>
            <ResponsesView form={form} api={api} mode={respMode} setMode={setRespMode} />
          </main>
        </div>
      ) : (
        <Editor form={form} api={api} tab={route.tab} setTab={(t) => setRoute((r) => ({ ...r, tab: t, startAt: t === "pratinjau" ? r.startAt : null, flowFocus: t === "alur" ? r.flowFocus : null }))}
          hist={hist} startAt={route.startAt} device={route.device} flowFocus={route.flowFocus} selected={selected} setSelected={setSelected} panelOpen={panelOpen} setPanelOpen={setPanelOpen} condOpen={condOpen} />
      )}
      <Toast msg={toastMsg} />
    </div>
  );
}
