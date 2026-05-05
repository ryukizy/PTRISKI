// ════════════════════════════════════════════════════════════════
// ui-col-vis.js — Pengaturan Visibilitas Kolom
//
// Tugas modul ini:
//  1. Buka/tutup panel dropdown pilihan kolom
//  2. Ubah status setiap kolom dan simpan ke localStorage
//  3. Sinkronisasi checkbox dengan state saat ini
//  4. Sinkronisasi class hide-col pada <th> thead tabel absensi
// ════════════════════════════════════════════════════════════════

import { cfg, DAYS } from '../core/state.js';
import { saveToLS } from '../core/storage.js';
import { renderTable } from './tabel.js';
import { renderPayroll } from './payroll.js';

// ─── Buka / Tutup Panel Dropdown ───────────────────────────────
export function toggleColVisPanel(tab) {
  const panel = document.getElementById('col-vis-panel-' + tab);
  if (!panel) return;
  const sedangTerbuka = panel.classList.contains('open');
  // Tutup semua panel yang sedang terbuka
  document.querySelectorAll('.col-vis-panel.open').forEach(p => p.classList.remove('open'));
  if (!sedangTerbuka) panel.classList.add('open');
}

// ─── Ubah Status Satu Kolom ────────────────────────────────────
export function setColVis(kunci, ditampilkan) {
  cfg.columnVisibility[kunci] = ditampilkan;
  saveToLS();
  renderTable();
  renderPayroll();
  sinkronisasiHeaderKolom();
}

// ─── Sinkronisasi <th> Thead ───────────────────────────────────
// Menambah/menghapus class hide-col pada baris header kolom agar
// header ikut tersembunyi selaras dengan <td> di tbody.
export function sinkronisasiHeaderKolom() {
  const cv    = cfg.columnVisibility;
  const table = document.getElementById('main-table');
  if (!table) return;
  const trCol = table.querySelector('thead tr.row-col');
  if (!trCol) return;

  const thAll = trCol.querySelectorAll('th');

  // Kolom identitas tetap (indeks di thead sebelum kolom hari dinamis):
  // 0=No, 1=Nama, 2=NIK, 3=Rekening, 4=Tgl Masuk, 5=Divisi
  const petaIdentitas = { 3: 'rek', 4: 'tgl', 5: 'div' };
  Object.entries(petaIdentitas).forEach(([idx, kunci]) => {
    if (thAll[idx]) thAll[idx].classList.toggle('hide-col', !cv[kunci]);
  });

  // Kolom kalkulasi (th-pay) mulai setelah:
  // 6 kolom identitas + DAYS.length kolom hari + 6 kolom rekap (th-sum)
  const mulaiKalkulasi = 6 + DAYS.length + 6;
  const JUMLAH_KOLOM_KALKULASI = 7;
  for (let i = mulaiKalkulasi; i < mulaiKalkulasi + JUMLAH_KOLOM_KALKULASI; i++) {
    if (thAll[i]) thAll[i].classList.toggle('hide-col', !cv.kalkulasi);
  }

  // Perbarui colspan grup header jika ada
  sinkronisasiGroupHeader();
}

// ─── Sinkronisasi colspan pada baris grup header ───────────────
function sinkronisasiGroupHeader() {
  const cv    = cfg.columnVisibility;
  const table = document.getElementById('main-table');
  if (!table) return;
  const trGroup = table.querySelector('thead tr.row-group');
  if (!trGroup) return;

  // Hitung kolom identitas yang masih terlihat:
  // No(1) + Nama(1) + NIK(1) + Rek(?) + Tgl(?) + Div(?)
  const colIdentitas = 3 + (cv.rek ? 1 : 0) + (cv.tgl ? 1 : 0) + (cv.div ? 1 : 0);
  const thIdentitas  = trGroup.cells[0];
  if (thIdentitas) thIdentitas.colSpan = colIdentitas;

  // Grup kalkulasi (indeks ke-3 di row-group = th-pay)
  const thKalkulasi = trGroup.cells[3];
  if (thKalkulasi) {
    thKalkulasi.colSpan = cv.kalkulasi ? 7 : 1;
    thKalkulasi.classList.toggle('hide-col', !cv.kalkulasi);
  }
}

// ─── Sinkronisasi Status Checkbox ──────────────────────────────
// Dipanggil saat halaman pertama dimuat agar checkbox langsung
// mencerminkan nilai yang tersimpan di localStorage.
export function sinkronisasiCheckboxColVis() {
  const cv = cfg.columnVisibility;
  const petaCheckbox = {
    'cv-rek':         'rek',
    'cv-tgl':         'tgl',
    'cv-div':         'div',
    'cv-kalkulasi':   'kalkulasi',
    'cv-p-transport': 'p_transport',
    'cv-p-makan':     'p_makan',
    'cv-p-lembur':    'p_lembur',
    'cv-p-potongan':  'p_potongan',
    'cv-p-bpjs':      'p_bpjs',
  };
  Object.entries(petaCheckbox).forEach(([id, kunci]) => {
    const el = document.getElementById(id);
    if (el) el.checked = (cv[kunci] !== false);
  });
}

// ─── Tutup Panel Saat Klik di Luar Area Dropdown ───────────────
export function initColVisPanelDismiss() {
  document.addEventListener('click', e => {
    if (!e.target.closest('.col-vis-wrap')) {
      document.querySelectorAll('.col-vis-panel.open').forEach(p => p.classList.remove('open'));
    }
  });
}
