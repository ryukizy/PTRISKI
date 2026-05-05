// ════════════════════════════════════════════════════════════════
// cuti.js — Manajemen Cuti (VERSI AMAN & TERVALIDASI + ROBUST SALDO)
// ════════════════════════════════════════════════════════════════

import { 
  employees, cutiData, setCutiData, cutiIdCounter, setCutiIdCounter, 
  DAYS, HOL_IDX, cfg, rbac 
} from '../core/state.js';
import { saveToLS } from '../core/storage.js';
import { tampilkanToast, divClass } from '../core/utils.js';

// ─── KONSTANTA ATURAN CUTI ───
const KUOTA_CUTI_TAHUNAN = 12;
const MAX_CARRY_OVER = 6;
const TAHUN_CUTI_BERJALAN = new Date().getFullYear();

// ─── HITUNG HARI KERJA ───
export function hitungHariKerja(tglMulai, tglAkhir) {
  const start = new Date(tglMulai);
  const end   = new Date(tglAkhir);
  if (isNaN(start) || isNaN(end) || start > end) return 0;

  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    const dayNum = current.getDate();
    const isWeekend = (day === 0 || day === 6);
    const isLiburNasional = HOL_IDX.includes(DAYS.indexOf(dayNum));
    if (!isWeekend && !isLiburNasional) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

// ─── CEK OVERLAP ───
function cekOverlapCuti(nik, tglMulai, tglAkhir, excludeId = null) {
  const start = new Date(tglMulai);
  const end = new Date(tglAkhir);
  const cutiAktif = cutiData.filter(c => 
    c.nik === nik && c.status === 'disetujui' && (excludeId === null || c.id !== excludeId)
  );
  for (const cuti of cutiAktif) {
    const cutiStart = new Date(cuti.tglMulai);
    const cutiEnd = new Date(cuti.tglAkhir);
    if (start <= cutiEnd && end >= cutiStart) {
      return { overlap: true, conflictId: cuti.id, conflictRange: `${cuti.tglMulai} s/d ${cuti.tglAkhir}` };
    }
  }
  return { overlap: false };
}

// ─── CEK TANGGAL LIBUR ───
function cekTanggalLibur(tglMulai, tglAkhir) {
  const start = new Date(tglMulai);
  const end = new Date(tglAkhir);
  const current = new Date(start);
  const tanggalLibur = [];
  while (current <= end) {
    const day = current.getDay();
    const dayNum = current.getDate();
    const dateStr = current.toLocaleDateString('id-ID');
    const isWeekend = (day === 0 || day === 6);
    const isLiburNasional = HOL_IDX.includes(DAYS.indexOf(dayNum));
    if (isWeekend) tanggalLibur.push(`${dateStr} (${day === 0 ? 'Minggu' : 'Sabtu'})`);
    else if (isLiburNasional) tanggalLibur.push(`${dateStr} (Libur Nasional)`);
    current.setDate(current.getDate() + 1);
  }
  return tanggalLibur;
}

// ─── PARSE TANGGAL ───
function _parseTglMasuk(tgl) {
  if (!tgl) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(tgl)) {
    const d = new Date(tgl);
    return isNaN(d) ? null : d;
  }
  const bulanMap = {
    jan:0, feb:1, mar:2, apr:3, may:4, mei:4, jun:5,
    jul:6, aug:7, agu:7, sep:8, oct:9, okt:9, nov:10, dec:11, des:11
  };
  const m = tgl.match(/^(\d{1,2})[-/]([A-Za-z]+)[-/](\d{2,4})$/);
  if (m) {
    const day = parseInt(m[1]);
    const month = bulanMap[m[2].toLowerCase().slice(0, 3)];
    let year = parseInt(m[3]);
    if (year < 100) year += year >= 50 ? 1900 : 2000;
    if (month === undefined || isNaN(day) || isNaN(year)) return null;
    return new Date(year, month, day);
  }
  const m2 = tgl.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m2) return new Date(parseInt(m2[3]), parseInt(m2[2]) - 1, parseInt(m2[1]));
  return null;
}

// ─── GET SALDO CUTI (support TglMasuk & tgl) ───
export function getSaldoCuti(nik) {
  const emp = employees.find(e => e.nik === nik);
  if (!emp) {
    return { total: 0, terpakai: 0, sisa: 0, pending: 0, tahun: TAHUN_CUTI_BERJALAN, carryOver: 0 };
  }

  const tglRaw = emp.tgl || emp.TglMasuk || emp.tglMasuk;
  const tglMasukDate = _parseTglMasuk(tglRaw);
  const tahunBergabung = tglMasukDate ? tglMasukDate.getFullYear() : TAHUN_CUTI_BERJALAN;
  const bulanBergabung = tglMasukDate ? tglMasukDate.getMonth() + 1 : 1;

  let kuotaTahunIni = KUOTA_CUTI_TAHUNAN;
  if (tahunBergabung === TAHUN_CUTI_BERJALAN && bulanBergabung > 1) {
    const bulanKerja = 13 - bulanBergabung;
    kuotaTahunIni = Math.floor((bulanKerja / 12) * KUOTA_CUTI_TAHUNAN);
  }

  const carryOver = emp.cutiCarryOver || 0;
  const totalKuota = kuotaTahunIni + Math.min(carryOver, MAX_CARRY_OVER);

  const disetujui = cutiData.filter(c => 
    c.nik === nik && c.status === 'disetujui' && new Date(c.tglMulai).getFullYear() === TAHUN_CUTI_BERJALAN
  );
  const terpakai = disetujui.reduce((sum, c) => sum + hitungHariKerja(c.tglMulai, c.tglAkhir), 0);

  const pending = cutiData.filter(c => 
    c.nik === nik && c.status === 'pending' && new Date(c.tglMulai).getFullYear() === TAHUN_CUTI_BERJALAN
  );
  const pendingHari = pending.reduce((sum, c) => sum + hitungHariKerja(c.tglMulai, c.tglAkhir), 0);

  return {
    total: totalKuota,
    terpakai,
    sisa: totalKuota - terpakai,
    pending: pendingHari,
    tahun: TAHUN_CUTI_BERJALAN,
    carryOver
  };
}

// ─── AJUKAN CUTI (FIX: support new form IDs + jenis cuti) ────────────
export function ajukanCuti() {
  // Read from new form IDs (fc-*)
  const nik = (document.getElementById('fc-karyawan')?.value || document.getElementById('cuti-nik')?.value || '').trim();
  const tglMulai = document.getElementById('fc-tgl-mulai')?.value || document.getElementById('cuti-tgl-mulai')?.value;
  const tglAkhir = document.getElementById('fc-tgl-selesai')?.value || document.getElementById('cuti-tgl-akhir')?.value;
  const alasan = (document.getElementById('fc-alasan')?.value || document.getElementById('cuti-alasan')?.value || '').trim();
  const jenisCuti = document.getElementById('fc-tipe')?.value || 'tahunan';

  if (!nik || !tglMulai || !tglAkhir) {
    tampilkanToast('❌ Mohon lengkapi Karyawan, Tanggal Mulai & Selesai', 3000);
    return;
  }

  const emp = employees.find(e => e.nik === nik);
  if (!emp) {
    tampilkanToast('❌ Karyawan tidak ditemukan dalam database', 3000);
    return;
  }

  const start = new Date(tglMulai);
  const end = new Date(tglAkhir);
  if (isNaN(start) || isNaN(end) || start > end) {
    tampilkanToast('❌ Tanggal tidak valid atau terbalik', 3000);
    return;
  }

  const tanggalLibur = cekTanggalLibur(tglMulai, tglAkhir);
  if (tanggalLibur.length > 0) {
    if (!confirm(`⚠️ Pengajuan mencakup hari libur:\n${tanggalLibur.join('\n')}\n\nTetap ajukan?`)) return;
  }

  const overlapCheck = cekOverlapCuti(nik, tglMulai, tglAkhir);
  if (overlapCheck.overlap) {
    tampilkanToast(`❌ Tanggal bentrok dengan cuti yang sudah disetujui (${overlapCheck.conflictRange})`, 4000);
    return;
  }

  const jumlahHari = hitungHariKerja(tglMulai, tglAkhir);
  if (jumlahHari === 0) {
    tampilkanToast('❌ Tidak ada hari kerja dalam rentang tanggal', 3000);
    return;
  }

  // Validasi saldo hanya untuk jenis yang memotong kuota tahunan
  const jenisYangPotongSaldo = ['tahunan', 'menikah', 'melahirkan', 'haji', 'umroh', 'sakit-panjang'];
  if (jenisYangPotongSaldo.includes(jenisCuti)) {
    const saldo = getSaldoCuti(nik);
    if (jumlahHari > saldo.sisa) {
      tampilkanToast(`❌ Saldo cuti tidak mencukupi! Dibutuhkan: ${jumlahHari} hari, Tersedia: ${saldo.sisa} hari`, 4000);
      return;
    }
  }

  const newId = cutiIdCounter;
  setCutiIdCounter(cutiIdCounter + 1);

  const cutiEntry = {
    id: newId,
    nik,
    nama: emp.nama,
    jenisCuti: jenisCuti,           // NEW: simpan jenis cuti
    tglMulai,
    tglAkhir,
    jumlahHari,
    alasan: alasan || '-',
    catatan: document.getElementById('fc-catatan')?.value?.trim() || '',
    status: 'pending',
    tglPengajuan: new Date().toISOString().split('T')[0],
    disetujuiOleh: null,
    tglDisetujui: null
  };

  cutiData.push(cutiEntry);
  setCutiData(cutiData);
  saveToLS();
  tampilkanToast(`✅ Pengajuan ${jenisCuti} berhasil (${jumlahHari} hari kerja)`, 3000);
  renderCuti();   // refresh table + summary

  // Clear form
  resetFormCuti();
}

export function simpanPengajuanCuti() {
  ajukanCuti();
}

// ─── SETUJUI & TOLAK CUTI ───
export function approveCuti(id) {
  const cuti = cutiData.find(c => c.id === id);
  if (!cuti) return tampilkanToast('❌ Data cuti tidak ditemukan', 3000);
  if (cuti.status !== 'pending') return tampilkanToast(`⚠️ Cuti sudah ${cuti.status}`, 3000);

  const saldo = getSaldoCuti(cuti.nik);
  if (cuti.jumlahHari > saldo.sisa) {
    if (!confirm(`⚠️ Saldo tidak cukup! Tetap setujui?`)) return;
  }

  cuti.status = 'disetujui';
  cuti.disetujuiOleh = rbac.nama || 'Admin';
  cuti.tglDisetujui = new Date().toISOString().split('T')[0];
  setCutiData(cutiData);
  saveToLS();
  tampilkanToast(`✅ Cuti ${cuti.nama} disetujui`, 2500);
  renderCuti();
}

export function ubahStatusCuti(id, aksi) {
  if (aksi === 'disetujui') approveCuti(id);
  else if (aksi === 'ditolak') rejectCuti(id);
  else tampilkanToast(`❌ Aksi tidak dikenal: ${aksi}`, 3000);
}

export function rejectCuti(id) {
  const cuti = cutiData.find(c => c.id === id);
  if (!cuti) return tampilkanToast('❌ Data cuti tidak ditemukan', 3000);
  if (cuti.status !== 'pending') return tampilkanToast(`⚠️ Cuti sudah ${cuti.status}`, 3000);

  const alasan = prompt('Alasan penolakan (opsional):');
  cuti.status = 'ditolak';
  cuti.ditolakOleh = rbac.nama || 'Admin';
  cuti.tglDitolak = new Date().toISOString().split('T')[0];
  cuti.alasanPenolakan = alasan || '-';
  setCutiData(cutiData);
  saveToLS();
  tampilkanToast(`❌ Cuti ${cuti.nama} ditolak`, 2500);
  renderCuti();
}

export function hapusCuti(id) {
  const idx = cutiData.findIndex(c => c.id === id);
  if (idx === -1) return tampilkanToast('❌ Data cuti tidak ditemukan', 3000);
  const cuti = cutiData[idx];
  if (cuti.status === 'disetujui') return tampilkanToast('❌ Cuti yang sudah disetujui tidak dapat dihapus', 3000);
  if (!confirm(`Hapus pengajuan cuti ${cuti.nama} (${cuti.tglMulai} s/d ${cuti.tglAkhir})?`)) return;

  cutiData.splice(idx, 1);
  setCutiData(cutiData);
  saveToLS();
  tampilkanToast('🗑 Data cuti berhasil dihapus', 2500);
  renderCuti();
}

export function resetFormCuti() {
  // Clear new form IDs (current HTML structure)
  ['fc-karyawan', 'fc-tipe', 'fc-tgl-mulai', 'fc-tgl-selesai', 'fc-alasan', 'fc-catatan'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  // Hide previews
  const saldoPreview = document.getElementById('fc-saldo-preview');
  if (saldoPreview) saldoPreview.style.display = 'none';
  const kuotaInfo = document.getElementById('fc-kuota-info');
  if (kuotaInfo) kuotaInfo.style.display = 'none';
  const durasiPreview = document.getElementById('fc-durasi-preview');
  if (durasiPreview) durasiPreview.style.display = 'none';
}

export function updateSaldoPreview() {
  // Support both old input and new select (#fc-karyawan)
  const nikEl = document.getElementById('fc-karyawan') || document.getElementById('cuti-nik');
  const nik = nikEl?.value?.trim();
  const previewEl = document.getElementById('fc-saldo-preview') || document.getElementById('cuti-saldo-preview');
  const detailEl = document.getElementById('fc-saldo-detail');

  if (!previewEl) return;

  if (!nik) {
    previewEl.style.display = 'none';
    return;
  }

  const emp = employees.find(e => e.nik === nik);
  if (!emp) {
    previewEl.style.display = 'block';
    if (detailEl) detailEl.innerHTML = `<span style="color:var(--red);">⚠️ Karyawan tidak ditemukan</span>`;
    else previewEl.innerHTML = `<span style="color:var(--red);">⚠️ Karyawan tidak ditemukan</span>`;
    return;
  }

  const saldo = getSaldoCuti(nik);
  const warna = saldo.sisa === 0 ? 'var(--red)' : saldo.sisa <= 3 ? 'var(--amber)' : 'var(--green)';
  previewEl.style.display = 'block';

  const html = `
    <strong>${emp.nama}</strong> — Saldo Cuti ${saldo.tahun}: 
    <span style="color:${warna};font-weight:700;">${saldo.sisa} hari tersisa</span><br>
    <span style="color:var(--text3);font-size:10.5px;">Total kuota: ${saldo.total} hari • Terpakai: ${saldo.terpakai} • Pending: ${saldo.pending}</span>
  `;

  if (detailEl) detailEl.innerHTML = html;
  else previewEl.innerHTML = html;
}

export function updateKuotaInfo() {
  const el = document.getElementById('fc-kuota-info') || document.getElementById('cuti-kuota-info');
  if (!el) return;
  el.style.display = 'block';
  el.innerHTML = `
    <div style="font-size:11px;color:var(--text3);line-height:1.7;">
      <strong>Aturan Cuti Tahunan ${TAHUN_CUTI_BERJALAN}:</strong><br>
      • Kuota tahunan: <strong>${KUOTA_CUTI_TAHUNAN} hari</strong><br>
      • Carry over maksimal: <strong>${MAX_CARRY_OVER} hari</strong><br>
      • Karyawan bergabung di tengah tahun mendapat kuota proporsional<br>
      • Cuti hanya dihitung pada hari kerja (Senin–Jumat, bukan libur nasional)
    </div>
  `;
}

// ─── HITUNG DURASI CUTI (untuk preview di form) ────────────────────
export function hitungDurasiCuti() {
  const tglMulai = document.getElementById('fc-tgl-mulai')?.value;
  const tglSelesai = document.getElementById('fc-tgl-selesai')?.value;
  const preview = document.getElementById('fc-durasi-preview');
  if (!preview) return;

  if (!tglMulai || !tglSelesai) {
    preview.style.display = 'none';
    return;
  }

  const start = new Date(tglMulai);
  const end = new Date(tglSelesai);
  if (isNaN(start) || isNaN(end) || start > end) {
    preview.style.display = 'block';
    preview.innerHTML = `<span style="color:var(--red);">⚠️ Tanggal tidak valid</span>`;
    return;
  }

  const hariKerja = hitungHariKerja(tglMulai, tglSelesai);
  const totalHariKalender = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

  preview.style.display = 'block';
  preview.innerHTML = `
    <span style="color:var(--accent);font-weight:600;">${hariKerja} hari kerja</span> 
    <span style="color:var(--text3);font-size:10.5px;">(dari ${totalHariKalender} hari kalender)</span>
  `;
}

// ─── RENDER SALDO TABLE (FIX: target #tbl-saldo-body yang ada di HTML) ────────────────────────────
export function renderSaldoTable() {
  const tbody = document.getElementById('tbl-saldo-body');
  if (!tbody) {
    console.warn('[cuti] #tbl-saldo-body tidak ditemukan di DOM');
    return;
  }

  const tryRender = (attempt = 1) => {
    if (!employees || employees.length === 0) {
      if (attempt > 30) {
        tbody.innerHTML = `
          <tr><td colspan="10" style="padding:12px;color:#b45309;background:#fef3c7;border-radius:6px;font-size:13px;text-align:center;">
            ⚠️ Belum ada data karyawan.<br>
            Pastikan kamu sudah <strong>Import Excel master karyawan</strong>.<br>
            <button onclick="window.forceRefreshSaldo()" style="margin-top:8px;padding:6px 14px;background:#f59e0b;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:600;">Refresh Sekarang</button>
          </td></tr>`;
        return;
      }
      tbody.innerHTML = `<tr><td colspan="10" style="padding:12px;color:#64748b;font-size:12px;text-align:center;">⏳ Memuat data karyawan... (${attempt}/30)</td></tr>`;
      setTimeout(() => tryRender(attempt + 1), 250);
      return;
    }

    const karyawanAktif = employees.filter(e => !e.statusKaryawan || (e.statusKaryawan !== 'resign' && e.statusKaryawan !== 'nonaktif'));
    if (karyawanAktif.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="padding:12px;color:#64748b;font-size:12px;text-align:center;">Belum ada karyawan aktif.</td></tr>`;
      return;
    }

    let html = '';
    karyawanAktif.forEach(emp => {
      const s = getSaldoCuti(emp.nik);
      const warna = s.sisa === 0 ? '#ef4444' : s.sisa <= 3 ? '#f59e0b' : '#10b981';
      const progress = s.total > 0 ? Math.round((s.terpakai / s.total) * 100) : 0;
      const progressColor = progress > 80 ? '#ef4444' : progress > 50 ? '#f59e0b' : '#10b981';

      html += `
        <tr>
          <td style="font-weight:600;">${emp.nama}</td>
          <td><span class="badge b-div ${divClass(emp.div || '')}">${emp.div || '-'}</span></td>
          <td style="text-align:center;">${s.total} hari</td>
          <td style="text-align:center;">${s.terpakai} hari</td>
          <td style="text-align:center;"><strong style="color:${warna}">${s.sisa} hari</strong></td>
          <td style="text-align:center;color:#9ca3af;">0</td>
          <td style="text-align:center;color:#9ca3af;">0</td>
          <td style="text-align:center;color:#9ca3af;">0</td>
          <td style="text-align:center;color:#9ca3af;">0</td>
          <td>
            <div style="width:100%;background:#e5e7eb;border-radius:9999px;height:8px;overflow:hidden;">
              <div style="width:${progress}%;height:100%;background:${progressColor};border-radius:9999px;transition:width .3s;"></div>
            </div>
            <div style="font-size:9px;text-align:center;color:#6b7280;margin-top:2px;">${progress}%</div>
          </td>
        </tr>`;
    });

    tbody.innerHTML = html;
  };

  tryRender();
}

// ─── EKSPOR EXCEL (WAJIB ADA) ─────────────────────────────────────
export function exportCutiExcel() {
  if (typeof XLSX === 'undefined') {
    tampilkanToast('❌ Library SheetJS belum dimuat', 3000);
    return;
  }
  if (!cutiData || cutiData.length === 0) {
    tampilkanToast('⚠️ Belum ada data cuti', 2500);
    return;
  }

  const baris = cutiData.map(c => ({
    'ID': c.id, 'NIK': c.nik, 'Nama': c.nama,
    'Tanggal Mulai': c.tglMulai, 'Tanggal Akhir': c.tglAkhir,
    'Jumlah Hari': c.jumlahHari, 'Alasan': c.alasan,
    'Status': c.status.toUpperCase(),
    'Tgl Pengajuan': c.tglPengajuan,
    'Disetujui Oleh': c.disetujuiOleh || '-', 'Tgl Disetujui': c.tglDisetujui || '-',
    'Ditolak Oleh': c.ditolakOleh || '-', 'Tgl Ditolak': c.tglDitolak || '-',
    'Alasan Penolakan': c.alasanPenolakan || '-'
  }));

  const ws = XLSX.utils.json_to_sheet(baris);
  ws['!cols'] = [
    {wch:5}, {wch:12}, {wch:25}, {wch:14}, {wch:14}, {wch:13}, {wch:30}, {wch:12},
    {wch:14}, {wch:20}, {wch:14}, {wch:20}, {wch:14}, {wch:30}
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Manajemen Cuti');
  const namaFile = `Manajemen_Cuti_${TAHUN_CUTI_BERJALAN}.xlsx`;
  XLSX.writeFile(wb, namaFile);
  tampilkanToast(`✅ Data diekspor ke ${namaFile}`, 3000);
}

// ─── RENDER UTAMA (FIX: populate existing HTML structure + search/filter) ─────
export function renderCuti() {
  // 1. Populate datalist for searchable employee input (much better UX for 50+ karyawan)
  const datalist = document.getElementById('fc-karyawan-list');
  if (datalist && datalist.options.length === 0) {  // populate once
    const aktif = employees.filter(e => !e.statusKaryawan || (e.statusKaryawan !== 'resign' && e.statusKaryawan !== 'nonaktif'));
    aktif.forEach(emp => {
      const opt = document.createElement('option');
      opt.value = emp.nik;                    // input.value will be NIK when selected
      opt.textContent = `${emp.nama} (${emp.nik})`;
      datalist.appendChild(opt);
    });
  }

  // 2. Get filter values
  const searchVal = (document.getElementById('cuti-search')?.value || '').toLowerCase().trim();
  const statusFilter = document.getElementById('cuti-filter-status')?.value || '';
  const tipeFilter = document.getElementById('cuti-filter-tipe')?.value || '';

  // 3. Filter cutiData
  let filtered = [...cutiData];
  if (searchVal) {
    filtered = filtered.filter(c =>
      (c.nama || '').toLowerCase().includes(searchVal) ||
      (c.nik || '').toLowerCase().includes(searchVal) ||
      (c.alasan || '').toLowerCase().includes(searchVal)
    );
  }
  if (statusFilter) {
    filtered = filtered.filter(c => c.status === statusFilter);
  }
  if (tipeFilter) {
    filtered = filtered.filter(c => (c.jenisCuti || 'tahunan') === tipeFilter);
  }

  // 4. Render riwayat table (#tbl-cuti-body)
  const tbody = document.getElementById('tbl-cuti-body');
  if (tbody) {
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text3);">Tidak ada data cuti yang cocok dengan filter.</td></tr>`;
    } else {
      const sorted = filtered.sort((a, b) => b.id - a.id);
      let html = '';
      sorted.forEach(c => {
        const statusClass = c.status === 'disetujui' ? 'st-disetujui' : 
                           c.status === 'ditolak' ? 'st-ditolak' : 
                           c.status === 'pending' ? 'st-menunggu' : 'st-dibatalkan';
        const jenis = c.jenisCuti || 'tahunan';
        const jenisBadge = `<span class="tc-badge tc-${jenis}">${jenis}</span>`;
        
        html += `<tr>
          <td>${c.nama || '-'}</td>
          <td class="mono">${c.nik}</td>
          <td>${jenisBadge}</td>
          <td>${c.tglMulai}</td>
          <td>${c.tglAkhir}</td>
          <td style="text-align:center;">${c.jumlahHari}</td>
          <td style="max-width:160px;white-space:normal;">${c.alasan || '-'}</td>
          <td><span class="st-badge ${statusClass}">${c.status.toUpperCase()}</span></td>
          <td>`;
        
        if (c.status === 'pending') {
          if (rbac.role !== 'karyawan') {
            html += `<button onclick="window.approveCuti(${c.id})" class="btn-approve" style="padding:2px 6px;font-size:11px;">✅</button>
                     <button onclick="window.rejectCuti(${c.id})" class="btn-reject" style="padding:2px 6px;font-size:11px;">❌</button>`;
          }
          if (rbac.role === 'admin') {
            html += `<button onclick="window.hapusCuti(${c.id})" class="btn-delete" style="padding:2px 6px;font-size:11px;">🗑</button>`;
          }
        } else {
          html += '—';
        }
        html += '</td></tr>';
      });
      tbody.innerHTML = html;
    }
  }

  // 5. Update summary cards
  updateCutiSummaryCards();

  // 6. Also refresh saldo table (in case employees changed)
  if (typeof renderSaldoTable === 'function') {
    renderSaldoTable();
  }
}

// ─── UPDATE SUMMARY CARDS ──────────────────────────────────────────
function updateCutiSummaryCards() {
  const totalEl = document.getElementById('cs-total-pengajuan');
  const menungguEl = document.getElementById('cs-menunggu');
  const disetujuiEl = document.getElementById('cs-disetujui');
  const habisEl = document.getElementById('cs-saldo-habis');

  if (!totalEl && !menungguEl && !disetujuiEl && !habisEl) return;

  const total = cutiData.length;
  const menunggu = cutiData.filter(c => c.status === 'pending').length;
  const disetujui = cutiData.filter(c => c.status === 'disetujui').length;

  // Karyawan dengan saldo habis (sisa <= 0)
  const aktif = employees.filter(e => !e.statusKaryawan || (e.statusKaryawan !== 'resign' && e.statusKaryawan !== 'nonaktif'));
  const saldoHabis = aktif.filter(e => {
    const s = getSaldoCuti(e.nik);
    return s.sisa <= 0;
  }).length;

  if (totalEl) totalEl.textContent = total;
  if (menungguEl) menungguEl.textContent = menunggu;
  if (disetujuiEl) disetujuiEl.textContent = disetujui;
  if (habisEl) habisEl.textContent = saldoHabis;
}

// ─── RESET CUTI TAHUNAN ───────────────────────────────────────────
export function resetCutiTahunan() {
  const tahunSekarang = new Date().getFullYear();
  const sudahReset = localStorage.getItem('lastCutiReset');
  if (sudahReset === String(tahunSekarang)) return;

  employees.forEach(emp => {
    const saldoLalu = getSaldoCuti(emp.nik);
    emp.cutiCarryOver = Math.min(saldoLalu.sisa, MAX_CARRY_OVER);
  });
  localStorage.setItem('lastCutiReset', String(tahunSekarang));
  saveToLS();
  tampilkanToast('✅ Reset cuti tahunan berhasil', 3000);
}

// ─── EXPOSE KE WINDOW ─────────────────────────────────────────────
if (typeof window !== 'undefined') {
  window.ajukanCuti = ajukanCuti;
  window.simpanPengajuanCuti = simpanPengajuanCuti;
  window.ubahStatusCuti = ubahStatusCuti;
  window.approveCuti = approveCuti;
  window.rejectCuti = rejectCuti;
  window.hapusCuti = hapusCuti;
  window.resetFormCuti = resetFormCuti;
  window.exportCutiExcel = exportCutiExcel;
  window.updateSaldoPreview = updateSaldoPreview;
  window.updateKuotaInfo = updateKuotaInfo;
  window.renderSaldoTable = renderSaldoTable;
  window.renderCuti = renderCuti;
  window.forceRefreshSaldo = renderSaldoTable;
  window.hitungDurasiCuti = hitungDurasiCuti;

  // Auto refresh saldo ketika setEmployees dipanggil
  const originalSetEmployees = window.setEmployees;
  if (originalSetEmployees) {
    window.setEmployees = function(val) {
      originalSetEmployees(val);
      setTimeout(() => window.forceRefreshSaldo && window.forceRefreshSaldo(), 100);
    };
  }
}
