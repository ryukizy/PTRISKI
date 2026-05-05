// ════════════════════════════════════════════════════════════════
// notifikasi.js — Pusat Notifikasi & Deteksi Otomatis
// ════════════════════════════════════════════════════════════════

import { employees, cfg, HOL_IDX, DAYS } from '../core/state.js';
import { LS_KEY_NOTIF } from '../core/config.js';
import { calcEmployee } from '../core/calc.js';
import { getSaldoCuti } from './cuti.js';

let notifList            = [];
let notifFilterAktif     = 'semua';
let premiBannerDismissed = false;
let notifBacaSet         = new Set();

function muatStatusBacaNotif() {
  try {
    const raw = localStorage.getItem(LS_KEY_NOTIF);
    if (raw) notifBacaSet = new Set(JSON.parse(raw));
  } catch(e) { notifBacaSet = new Set(); }
}

function simpanStatusBacaNotif() {
  try { localStorage.setItem(LS_KEY_NOTIF, JSON.stringify([...notifBacaSet])); } catch(e) {}
}

function buatIdNotif(tipe, identifier) {
  // Hapus semua karakter non-alfanumerik agar ID notifikasi konsisten
  // lintas periode sehingga status 'sudah dibaca' tidak hilang.
  const bersih = String(identifier)
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return tipe + '__' + bersih;
}

function fmtTglId(tgl) {
  if (!tgl) return '—';
  const d = new Date(tgl);
  if (isNaN(d)) return tgl;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function selisihHari(tglStr) {
  if (!tglStr) return null;
  const tgl = new Date(tglStr);
  if (isNaN(tgl)) return null;
  const hari = new Date();
  hari.setHours(0,0,0,0);
  tgl.setHours(0,0,0,0);
  return Math.round((tgl - hari) / 86400000);
}

function buatLinkWA(noHp, pesan) {
  if (!noHp) return null;
  let nomor = String(noHp).replace(/\D/g, '');
  if (nomor.startsWith('0')) nomor = '62' + nomor.slice(1);
  if (!nomor.startsWith('62')) nomor = '62' + nomor;
  return 'https://wa.me/' + nomor + '?text=' + encodeURIComponent(pesan);
}

function deteksiAlfaBeruntun() {
  const hasil = [];
  employees.forEach(emp => {
    // Lewati karyawan yang data harinya belum lengkap
    if (!Array.isArray(emp.days) || emp.days.length === 0) return;

    const hariKerja = emp.days
      .map((v, i) => ({ nilai: v, idx: i }))
      .filter(x => !HOL_IDX.includes(x.idx));

    let beruntun = 0, maxBeruntun = 0;
    let posBeruntunMulai = -1, posBeruntunMaks = -1;

    hariKerja.forEach((x, pos) => {
      if (x.nilai === 'A') {
        if (beruntun === 0) posBeruntunMulai = pos;
        beruntun++;
        if (beruntun > maxBeruntun) { maxBeruntun = beruntun; posBeruntunMaks = posBeruntunMulai; }
      } else { beruntun = 0; }
    });

    if (maxBeruntun >= 3) {
      const hariMulai = DAYS[hariKerja[posBeruntunMaks]?.idx] || '?';
      hasil.push({
        id:       buatIdNotif('alfa', emp.nik + '_' + cfg.period),
        severity: 'kritis', kategori: 'alfa', icon: '🚨',
        judul:    `Alfa Beruntun — ${emp.nama}`,
        pesan:    `${emp.nama} (${emp.div}) tidak hadir tanpa keterangan selama ${maxBeruntun} hari berturut-turut sejak tgl ${hariMulai}.`,
        emp, extra: { beruntun: maxBeruntun, hariMulai },
        wa: emp.hp ? buatLinkWA(emp.hp, `Halo ${emp.nama}, HRD mencatat ketidakhadiran ${maxBeruntun} hari berturut-turut (mulai tgl ${hariMulai}, periode ${cfg.period}). Mohon segera hubungi HRD.`) : null,
      });
    }
  });
  return hasil;
}

function deteksiKontrakHabis() {
  const hasil = [];
  employees.forEach(emp => {
    if (emp.kontrak !== 'PKWT' || !emp.tglKontrak) return;
    const sisa = selisihHari(emp.tglKontrak);
    if (sisa === null || sisa > 30) return;
    const tglFmt    = fmtTglId(emp.tglKontrak);
    const severity  = sisa <= 7 ? 'kritis' : 'peringatan';
    const labelSisa = sisa < 0
      ? `sudah berakhir ${Math.abs(sisa)} hari yang lalu`
      : sisa === 0
        ? 'berakhir HARI INI'
        : `berakhir dalam ${sisa} hari (${tglFmt})`;
    hasil.push({
      id:       buatIdNotif('kontrak', emp.nik),
      severity, kategori: 'kontrak', icon: sisa <= 0 ? '📛' : '📋',
      judul:    `Kontrak ${sisa <= 0 ? 'Sudah Berakhir' : 'Segera Berakhir'} — ${emp.nama}`,
      pesan:    `Kontrak PKWT ${emp.nama} (${emp.div}) ${labelSisa}.`,
      emp, extra: { sisa, tglKontrak: emp.tglKontrak, tglFmt },
      wa: emp.hp ? buatLinkWA(emp.hp, `Halo ${emp.nama}, kontrak PKWT akan berakhir pada ${tglFmt}. Mohon segera ke HRD.`) : null,
    });
  });
  hasil.sort((a, b) => (a.extra.sisa ?? 999) - (b.extra.sisa ?? 999));
  return hasil;
}

function deteksiCutiSisa() {
  const hasil = [];
  const bulanIni = new Date().getMonth();

  // Hanya tampilkan peringatan sisa cuti di bulan Desember (bulan ke-11)
  if (bulanIni !== 11) return hasil;

  const thn = new Date().getFullYear();
  employees.forEach(emp => {
    // ✅ PERBAIKAN: getSaldoCuti hanya menerima satu argumen (nik).
    // Argumen kedua (thn) dihapus — fungsi sudah menggunakan
    // TAHUN_CUTI_BERJALAN secara internal dari konstanta modul cuti.js.
    const saldo = getSaldoCuti(emp.nik);

    // Periksa keberadaan saldo bertingkat sebelum mengakses properti
    // agar tidak terjadi TypeError saat karyawan belum memiliki data cuti.
    const sisaHari = saldo?.tahunan?.sisa ?? saldo?.sisa ?? 0;
    if (!saldo || sisaHari <= 0) return;

    hasil.push({
      id:       buatIdNotif('cuti_sisa', emp.nik + '_' + thn),
      severity: 'info', kategori: 'cuti', icon: '🌿',
      judul:    `Sisa Cuti Tahunan — ${emp.nama}`,
      pesan:    `${emp.nama} (${emp.div}) masih memiliki ${sisaHari} hari cuti tahunan yang belum diambil di tahun ${thn}.`,
      emp, extra: { sisaCuti: sisaHari, thn },
      wa: emp.hp ? buatLinkWA(emp.hp, `Halo ${emp.nama}, masih ada ${sisaHari} hari sisa cuti ${thn} yang akan hangus per 31 Desember ${thn}.`) : null,
    });
  });
  hasil.sort((a, b) => b.extra.sisaCuti - a.extra.sisaCuti);
  return hasil;
}

function deteksiPremiCair() {
  const skrg         = new Date();
  const bln5DepanTgl = new Date(skrg.getFullYear(), skrg.getMonth() + 1, 5);
  const tglFmt       = bln5DepanTgl.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const selisih      = Math.ceil((bln5DepanTgl - skrg) / 86400000);
  const jumlahPremi  = employees.filter(e => calcEmployee(e).premiOk).length;
  return [{
    id:       buatIdNotif('premi', cfg.period.replace(/\s+/g,'_')),
    severity: 'sukses', kategori: 'premi', icon: '💰',
    judul:    `Pencairan Premi Hadir — ${cfg.period}`,
    pesan:    `Premi untuk ${jumlahPremi} karyawan dijadwalkan cair pada ${tglFmt} (${selisih} hari lagi).`,
    emp: null, extra: { tglCair: tglFmt, selisih, jumlahPremi }, wa: null,
  }];
}

export function jalankanDeteksiNotifikasi() {
  muatStatusBacaNotif();

  // Isolasi error — satu detektor yang crash tidak menghentikan detektor lain.
  function jalankanAman(fn, nama) {
    try {
      return fn();
    } catch (err) {
      console.error(`[Pusat Notifikasi] Detektor "${nama}" gagal dijalankan:`, err);
      return [];
    }
  }

  const semua = [
    ...jalankanAman(deteksiAlfaBeruntun, 'Alfa Beruntun'),
    ...jalankanAman(deteksiKontrakHabis, 'Kontrak Habis'),
    ...jalankanAman(deteksiCutiSisa,     'Sisa Cuti Tahunan'),
    ...jalankanAman(deteksiPremiCair,    'Premi Hadir'),
  ];
  const urutSeverity = { kritis: 0, peringatan: 1, info: 2, sukses: 3 };
  semua.forEach(n => { n.sudahBaca = notifBacaSet.has(n.id); });
  semua.sort((a, b) => {
    if (a.sudahBaca !== b.sudahBaca) return a.sudahBaca ? 1 : -1;
    return (urutSeverity[a.severity] ?? 9) - (urutSeverity[b.severity] ?? 9);
  });
  notifList = semua;
  perbaruiBadgeNotif();
  if (document.getElementById('notif-panel').classList.contains('open')) renderDaftarNotif();
  perbaruiBannerPremi();
}

export function perbaruiBadgeNotif() {
  const belumBaca = notifList.filter(n => !n.sudahBaca).length;
  const badge     = document.getElementById('notif-badge');
  const bell      = document.getElementById('btn-bell');
  if (!badge || !bell) return;
  if (belumBaca > 0) {
    badge.textContent = belumBaca > 99 ? '99+' : String(belumBaca);
    badge.classList.add('show');
    bell.classList.add('has-notif');
  } else {
    badge.classList.remove('show');
    bell.classList.remove('has-notif');
  }
  const hitungPerKategori = (kat) =>
    kat === 'semua' ? notifList.length : notifList.filter(n => n.severity === kat).length;
  ['semua','kritis','peringatan','info'].forEach(kat => {
    const el = document.getElementById('ntc-' + kat);
    if (el) el.textContent = hitungPerKategori(kat);
  });
  const elFoot = document.getElementById('notif-footer-info');
  if (elFoot) elFoot.textContent = `${notifList.length} peringatan aktif · ${belumBaca} belum dibaca`;
  const elSub = document.getElementById('notif-panel-subtitle');
  if (elSub) elSub.textContent = belumBaca > 0
    ? `${belumBaca} notifikasi belum ditangani`
    : 'Semua notifikasi sudah dibaca';
}

export function renderDaftarNotif() {
  const listEl = document.getElementById('notif-list');
  if (!listEl) return;
  const filtered = notifFilterAktif === 'semua'
    ? notifList
    : notifList.filter(n => n.severity === notifFilterAktif);
  if (!filtered.length) {
    listEl.innerHTML = `<div class="notif-empty"><div class="notif-empty-icon">✅</div><div class="notif-empty-text">Tidak ada peringatan aktif</div></div>`;
    return;
  }
  listEl.innerHTML = filtered.map(n => {
    const icClass   = 'ic-' + n.severity;
    const waBtn     = n.wa ? `<a href="${n.wa}" target="_blank" class="btn-notif-wa">📱 Kirim WA</a>` : '';
    const divBadge  = n.emp?.div ? `<span class="notif-divisi-badge">${n.emp.div}</span>` : '';
    const tandaiTxt = n.sudahBaca ? '↩ Tandai belum dibaca' : '✓ Tandai sudah dibaca';
    return `<div class="notif-item severity-${n.severity} ${n.sudahBaca ? '' : 'unread'}" id="notif-item-${n.id}" style="${n.sudahBaca ? 'opacity:.72;' : ''}">
      <div class="notif-icon ${icClass}">${n.icon}</div>
      <div class="notif-content">
        <div class="notif-judul">${n.judul}</div>
        <div class="notif-pesan">${n.pesan}</div>
        <div class="notif-meta"><span class="notif-waktu">Periode: ${cfg.period}</span>${divBadge}</div>
        <div class="notif-actions">${waBtn}<button class="btn-notif-tandai" onclick="toggleBacaNotif('${n.id}')">${tandaiTxt}</button></div>
      </div>
    </div>`;
  }).join('');
}

export function toggleBacaNotif(id) {
  const n = notifList.find(x => x.id === id);
  if (!n) return;
  if (notifBacaSet.has(id)) { notifBacaSet.delete(id); n.sudahBaca = false; }
  else { notifBacaSet.add(id); n.sudahBaca = true; }
  simpanStatusBacaNotif();
  perbaruiBadgeNotif();
  renderDaftarNotif();
}

export function tandaiSemuaSudahBaca() {
  notifList.forEach(n => { notifBacaSet.add(n.id); n.sudahBaca = true; });
  simpanStatusBacaNotif();
  perbaruiBadgeNotif();
  renderDaftarNotif();
}

export function filterNotif(filter, elTab) {
  notifFilterAktif = filter;
  document.querySelectorAll('.notif-filter-tab').forEach(t => t.classList.remove('active'));
  if (elTab) elTab.classList.add('active');
  renderDaftarNotif();
}

export function toggleNotifPanel() {
  const panel   = document.getElementById('notif-panel');
  const overlay = document.getElementById('notif-overlay');
  if (panel.classList.contains('open')) {
    panel.classList.remove('open');
    overlay.classList.remove('open');
  } else {
    panel.classList.add('open');
    overlay.classList.add('open');
    renderDaftarNotif();
  }
}

export function tutupNotifPanel() {
  document.getElementById('notif-panel').classList.remove('open');
  document.getElementById('notif-overlay').classList.remove('open');
}

export function sesuaikanNotifUntukRBAC(role) {
  const wrap = document.getElementById('notif-bell-wrap');
  if (!wrap) return;
  if (role === 'karyawan') wrap.classList.add('rbac-hidden');
  else wrap.classList.remove('rbac-hidden');
}

function perbaruiBannerPremi() {
  const banner = document.getElementById('premi-banner');
  if (!banner || premiBannerDismissed) return;
  const skrg   = new Date();
  const tgl5   = new Date(skrg.getFullYear(), skrg.getMonth() + 1, 5);
  const sisa   = Math.ceil((tgl5 - skrg) / 86400000);
  const tglFmt = tgl5.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  if (sisa <= 14) {
    const el    = document.getElementById('premi-banner-tgl');
    const elSub = document.getElementById('premi-banner-sub');
    if (el)    el.textContent    = `💰 Premi akan dicairkan pada ${tglFmt} (${sisa} hari lagi)`;
    if (elSub) elSub.textContent = `Pastikan data absensi periode "${cfg.period}" sudah dikunci sebelum tanggal tersebut.`;
    banner.classList.add('show');
  } else {
    banner.classList.remove('show');
  }
}

export function tutupPremiBanner() {
  premiBannerDismissed = true;
  const banner = document.getElementById('premi-banner');
  if (banner) banner.classList.remove('show');
}
