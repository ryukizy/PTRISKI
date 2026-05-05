// ════════════════════════════════════════════════════════════════
// utils.js — Fungsi helper murni tanpa efek samping
// ════════════════════════════════════════════════════════════════

let _toastTimer = null;

export function tampilkanToast(pesan, durasi = 2800) {
  const toast = document.getElementById('edit-lock-toast');
  const msg   = document.getElementById('edit-lock-toast-msg');
  if (!toast) return;
  if (msg) msg.textContent = pesan;
  toast.classList.add('tampil');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toast.classList.remove('tampil'), durasi);
}

export function divClass(div) {
  if (div === 'WS') return 'bws';
  if (div.includes('TEMPEL')) return 'bst';
  if (div.includes('1,2')) return 'bsj12';
  return 'bsj2';
}

export function hitungUsia(tglLahir) {
  if (!tglLahir) return '';
  const lahir = new Date(tglLahir);
  if (isNaN(lahir)) return '';
  const sekarang = new Date();
  let usia = sekarang.getFullYear() - lahir.getFullYear();
  const selisihBulan = sekarang.getMonth() - lahir.getMonth();
  if (selisihBulan < 0 || (selisihBulan === 0 && sekarang.getDate() < lahir.getDate())) usia--;
  return usia + ' tahun';
}

export function hitungTenure(tglMasukStr, tglKeluarStr) {
  if (!tglMasukStr) return null;
  let masuk;
  const tStr = String(tglMasukStr).trim();
  const mBulan = {jan:0,feb:1,mar:2,apr:3,may:4,mei:4,jun:5,jul:6,aug:7,agu:7,sep:8,oct:9,okt:9,nov:10,dec:11,des:11};
  const reShort = /^(\d{1,2})[-\/]([a-zA-Z]+)[-\/](\d{2,4})$/;
  const mShort = tStr.match(reShort);
  if (mShort) {
    const thn = parseInt(mShort[3]);
    const bln = mBulan[mShort[2].toLowerCase().substring(0,3)];
    masuk = new Date(thn < 100 ? 2000 + thn : thn, bln, parseInt(mShort[1]));
  } else {
    masuk = new Date(tStr);
  }
  if (isNaN(masuk)) return null;

  const akhir = tglKeluarStr ? new Date(tglKeluarStr) : new Date();
  if (isNaN(akhir) || akhir < masuk) return { tahun: 0, bulan: 0, label: '< 1 bln', totalBulan: 0 };

  let tahun  = akhir.getFullYear() - masuk.getFullYear();
  let bulan  = akhir.getMonth()   - masuk.getMonth();
  if (bulan < 0) { tahun--; bulan += 12; }
  if (tahun < 0)  tahun = 0;
  const totalBulan = tahun * 12 + bulan;

  let label = '';
  if (tahun > 0) label += tahun + ' thn ';
  if (bulan > 0 || tahun === 0) label += bulan + ' bln';
  label = label.trim() || '< 1 bln';
  return { tahun, bulan, label, totalBulan };
}

export function fmtTgl(str) {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d)) return str;
  return d.toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric'});
}

export function fmtRp(v) {
  return 'Rp\u00a0' + Math.abs(Math.round(v)).toLocaleString('id-ID');
}

export function fmtRpAnalitik(v) {
  if (v >= 1000000000) return 'Rp ' + (v/1000000000).toFixed(1).replace('.',',') + ' M';
  if (v >= 1000000)    return 'Rp ' + (v/1000000).toFixed(1).replace('.',',') + ' Jt';
  if (v >= 1000)       return 'Rp ' + (v/1000).toFixed(0) + ' Rb';
  return 'Rp ' + Math.round(v).toLocaleString('id-ID');
}

export function hitungHariKerja(tglMulai, tglSelesai) {
  if (!tglMulai || !tglSelesai) return 0;
  const mulai   = new Date(tglMulai);
  const selesai = new Date(tglSelesai);
  if (isNaN(mulai) || isNaN(selesai) || selesai < mulai) return 0;
  let count = 0;
  const cur = new Date(mulai);
  while (cur <= selesai) {
    const hari = cur.getDay();
    if (hari !== 0 && hari !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export function hitungHariKalender(tglMulai, tglSelesai) {
  if (!tglMulai || !tglSelesai) return 0;
  const mulai   = new Date(tglMulai);
  const selesai = new Date(tglSelesai);
  if (isNaN(mulai) || isNaN(selesai) || selesai < mulai) return 0;
  return Math.round((selesai - mulai) / (1000*60*60*24)) + 1;
}

export function formatRpInput(el) {
  const selStart = el.selectionStart;
  const oldVal   = el.value;
  const dotsBefore = (oldVal.slice(0, selStart).match(/\./g) || []).length;
  const digits = oldVal.replace(/\D/g, '');
  if (digits === '' || (digits === '0' && oldVal === '')) {
    el.dataset.raw = '0';
    return;
  }
  const num = parseInt(digits, 10);
  el.dataset.raw = String(num);
  const newVal = num.toLocaleString('id-ID');
  if (el.value !== newVal) {
    el.value = newVal;
    const logicalPos = selStart - dotsBefore;
    let newCursor = 0;
    let digitCount = 0;
    for (let i = 0; i < newVal.length; i++) {
      if (digitCount >= logicalPos) { newCursor = i; break; }
      if (/\d/.test(newVal[i])) digitCount++;
      newCursor = i + 1;
    }
    try { el.setSelectionRange(newCursor, newCursor); } catch(e) {}
  }
}

export function rpFocus(el) {
  if (el.value === '0' || el.dataset.raw === '0') {
    el.value = '';
    el.dataset.raw = '0';
  }
}

export function rpBlur(el) {
  const digits = el.value.replace(/\D/g, '');
  if (!digits || parseInt(digits, 10) === 0) {
    el.value = '0';
    el.dataset.raw = '0';
  } else {
    const num = parseInt(digits, 10);
    el.dataset.raw = String(num);
    el.value = num.toLocaleString('id-ID');
  }
}

export function readRp(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  const raw = el.dataset.raw !== undefined ? el.dataset.raw : el.value.replace(/\./g,'').replace(/\D/g,'');
  return parseFloat(raw) || 0;
}

export function initRpInputs() {
  document.querySelectorAll('.rp-input').forEach(el => {
    if (!el.dataset.raw) el.dataset.raw = el.value.replace(/\D/g,'') || '0';
    const num = parseInt(el.dataset.raw, 10);
    el.value = isNaN(num) || num === 0 ? '0' : num.toLocaleString('id-ID');
  });
}

// ─── CSV Parse Helpers ───
export function _parseCSVManual(teks, delimiter) {
  const baris = [];
  for (const barisMentah of teks.split(/\r?\n/)) {
    if (barisMentah.trim() === '') continue;
    const sel = [];
    let dalamKutipan = false;
    let nilai = '';
    for (let i = 0; i < barisMentah.length; i++) {
      const ch = barisMentah[i];
      if (ch === '"') {
        if (dalamKutipan && barisMentah[i + 1] === '"') { nilai += '"'; i++; }
        else dalamKutipan = !dalamKutipan;
      } else if (ch === delimiter && !dalamKutipan) {
        sel.push(nilai.trim()); nilai = '';
      } else {
        nilai += ch;
      }
    }
    sel.push(nilai.trim());
    baris.push(sel);
  }
  return baris;
}

export function _ambilSel(row, idx) {
  if (idx < 0 || idx === undefined || row[idx] === undefined || row[idx] === null) return '';
  return String(row[idx]).trim();
}

export function _normHeader(h) {
  return String(h)
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-_\.\/\\()\[\]'"]+/g, '');
}

export function _cariKolom(header, ...kandidat) {
  const normKandidat = kandidat.map(k => k.toLowerCase().replace(/[\s\-_\.\/\\]+/g, ''));
  for (const nk of normKandidat) {
    const idx = header.indexOf(nk);
    if (idx >= 0) return idx;
  }
  for (const nk of normKandidat) {
    const idx = header.findIndex(h => h.includes(nk));
    if (idx >= 0) return idx;
  }
  for (const nk of normKandidat) {
    const idx = header.findIndex(h => h.length >= 3 && nk.includes(h));
    if (idx >= 0) return idx;
  }
  return -1;
}

export function _normDivisi(raw) {
  const up = raw.toUpperCase().replace(/\s+/g, ' ').trim();
  if (/^S\.?\s*TEMPEL$/i.test(up))             return 'S. TEMPEL';
  if (/^S\.?\s*JARUM\s*1[,\/]?\s*2$/i.test(up)) return 'S. JARUM 1,2';
  if (/^S\.?\s*JARUM\s*2$/i.test(up))           return 'S. JARUM 2';
  if (/^WS$/i.test(up))                         return 'WS';
  return up || 'S. JARUM 2';
}

export function _normNilaiAbsensi(raw, noBaris, namaKaryawan, hari, errors) {
  const r = raw.trim().toUpperCase();
  if (!r || r === '0' || r === '-' || r === '—' || r === 'KOSONG') return 0;
  if (['A', 'I', 'S', 'L', 'C'].includes(r)) return r;
  if (r === '√' || r === 'V' || r === 'v' || r === 'SETENGAH' || r === '1/2') return '√';
  const angka = parseFloat(r.replace(',', '.'));
  if (!isNaN(angka) && angka >= 0) return angka;
  errors.push(`Baris ke-${noBaris} (${namaKaryawan || 'nama tidak diketahui'}): nilai absensi Tgl${hari} tidak dikenal → "${raw}" diabaikan, diisi 0.`);
  return 0;
}
