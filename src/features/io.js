// ════════════════════════════════════════════════════════════════
// io.js — Export Excel, Import Excel/CSV, Import Fingerprint
// ════════════════════════════════════════════════════════════════

import { employees, setEmployees, cfg, DAYS, HOL_IDX, rbac } from '../core/state.js';
import { calcEmployee } from '../core/calc.js';
import { hitungUsia, _parseCSVManual, _ambilSel, _normHeader, _cariKolom, _normDivisi, _normNilaiAbsensi } from '../core/utils.js';
import { saveToLS } from '../core/storage.js';
import { renderTable } from '../ui/tabel.js';
import { jalankanDeteksiNotifikasi } from './notifikasi.js';

// ─── EXPORT EXCEL ───
export function exportExcel() {
  if (rbac.role && rbac.role !== 'admin') { alert('Fitur Export Excel hanya tersedia untuk HR Admin.'); return; }
  if (typeof XLSX === 'undefined') { alert('Library SheetJS belum dimuat. Coba refresh halaman.'); return; }

  const dayHeaders = DAYS.map(d => `Tgl${d}`);
  const headerRow = [
    'No','Nama','NIK','NoKTP','NPWP','TglLahir','Usia','StatusPernikahan','JumlahAnak',
    'Alamat','NoHP','Email','Jabatan','StatusKontrak','TglBerakhirKontrak',
    'Rekening','TglMasuk','Divisi','NoBPJSKesehatan','NoBPJSKetenagakerjaan',
    ...dayHeaders, 'OT','Potongan',
    'TotalHadir','Alfa','Izin','Sakit','Cuti','Libur','TotalTidakMasuk',
    'GajiPokok','UTransport','UMakan','ULembur','UPotongan','Premi','TotalGaji'
  ];

  const rows = employees.map(e => {
    const c = calcEmployee(e);
    return [
      e.no, e.nama, e.nik,
      e.ktp||'', e.npwp||'', e.tglLahir||'', e.usia||hitungUsia(e.tglLahir),
      e.statusNikah||'', e.jmlAnak||0, e.alamat||'',
      e.hp||'', e.email||'', e.jabatan||'', e.kontrak||'', e.tglKontrak||'',
      e.rek||'', e.tgl, e.div, e.noBPJSKes||'', e.noBPJSKtk||'',
      ...e.days.map(v => v === 0 ? '' : v), e.ot||0, e.pot||0,
      c.totalHadir, c.alfa, c.izin, c.sakit, c.cuti, c.libur, c.totalTM,
      c.gajiPokok, c.uTransport, c.uMakan, c.uLembur, c.uPotongan,
      c.premiOk ? cfg.premiVal : 0, c.totalGaji
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...rows]);
  ws['!cols'] = [
    {wch:4},{wch:22},{wch:12},{wch:18},{wch:18},{wch:12},{wch:9},{wch:14},{wch:8},
    {wch:32},{wch:14},{wch:22},{wch:12},{wch:14},{wch:16},
    {wch:14},{wch:11},{wch:12},{wch:16},{wch:18},
    ...DAYS.map(()=>({wch:5})), {wch:5},{wch:8},
    {wch:9},{wch:5},{wch:5},{wch:6},{wch:6},{wch:6},{wch:12},
    {wch:12},{wch:11},{wch:10},{wch:10},{wch:10},{wch:10},{wch:12}
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Absensi');

  const payHead = ['No','Nama','NIK','Divisi','TotalHadir','Alfa','Izin','Sakit','Cuti','Premi','TotalGaji'];
  const payRows = employees.map(e => {
    const c = calcEmployee(e);
    return [e.no, e.nama, e.nik, e.div, c.totalHadir, c.alfa, c.izin, c.sakit, c.cuti, c.premiOk?'Ya':'Tidak', c.totalGaji];
  });
  const ws2 = XLSX.utils.aoa_to_sheet([payHead, ...payRows]);
  ws2['!cols'] = [{wch:4},{wch:22},{wch:12},{wch:12},{wch:9},{wch:5},{wch:5},{wch:6},{wch:6},{wch:13}];
  XLSX.utils.book_append_sheet(wb, ws2, 'Payroll Summary');

  const period = cfg.period.replace(/[–\/\s]/g,'_').replace(/[^a-zA-Z0-9_]/g,'');
  XLSX.writeFile(wb, `absensi_prepit3_${period}.xlsx`);
}

// ─── IMPORT MODAL ───
let importParsedData = null;

export function openImportModal() {
  if (rbac.role && rbac.role !== 'admin') { alert('Fitur Import hanya tersedia untuk HR Admin.'); return; }
  importParsedData = null;
  document.getElementById('import-preview').style.display = 'none';
  document.getElementById('btn-import-apply').disabled = true;
  document.getElementById('import-file-input').value = '';
  const dz = document.getElementById('import-dropzone');
  if (dz) { dz.style.borderColor = ''; dz.style.background = 'var(--surface2)'; }
  document.getElementById('modal-import').classList.add('open');
}

export function closeImportModal() {
  document.getElementById('modal-import').classList.remove('open');
}

export function handleImportFile(file) {
  if (!file) return;
  if (typeof XLSX === 'undefined') { alert('Library SheetJS belum dimuat.'); return; }
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['xlsx','xls','csv'].includes(ext)) { alert('Format tidak didukung. Gunakan .xlsx, .xls, atau .csv'); return; }

  if (ext === 'csv') {
    const readerUtf8 = new FileReader();
    readerUtf8.onload = ev => {
      const teks = ev.target.result;
      if ((teks.match(/\uFFFD/g) || []).length > 2) {
        const readerLatin = new FileReader();
        readerLatin.onload = ev2 => _prosesCSV(ev2.target.result);
        readerLatin.readAsText(file, 'windows-1252');
      } else {
        _prosesCSV(teks);
      }
    };
    readerUtf8.readAsText(file, 'UTF-8');
    return;
  }

  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const wb   = XLSX.read(ev.target.result, { type: 'binary' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      parseImportData(data);
    } catch(err) {
      alert('Gagal membaca file: ' + err.message);
    }
  };
  reader.readAsBinaryString(file);
}

function _prosesCSV(teks) {
  try {
    teks = teks.replace(/^\uFEFF/, '');
    const baris0 = teks.split(/\r?\n/)[0] || '';
    const nKoma = (baris0.match(/,/g)||[]).length;
    const nTK   = (baris0.match(/;/g)||[]).length;
    const nTab  = (baris0.match(/\t/g)||[]).length;
    let delim = ',';
    if (nTK > nKoma && nTK >= nTab) delim = ';';
    else if (nTab > nKoma && nTab > nTK) delim = '\t';

    let data;
    try {
      const wb = XLSX.read(teks, { type:'string', FS:delim });
      const ws = wb.Sheets[wb.SheetNames[0]];
      data = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
      if (data.length > 0 && data[0].filter(c=>String(c).trim()!=='').length <= 1 && baris0.includes(delim)) {
        data = _parseCSVManual(teks, delim);
      }
    } catch(e) {
      data = _parseCSVManual(teks, delim);
    }
    parseImportData(data);
  } catch(err) {
    alert('Gagal membaca file CSV: ' + err.message);
  }
}

function parseImportData(rows) {
  if (!rows || rows.length < 1) { _showImportError('File kosong.'); return; }

  const headerAsli = rows[0];
  const header     = headerAsli.map(_normHeader);

  const dataRows = rows.slice(1).filter(r => r.some(c => String(c).trim() !== ''));
  if (!dataRows.length) { _showImportError('File hanya memiliki header tanpa data.'); return; }

  const C = {
    no:_cariKolom(header,'no','nomor'),nama:_cariKolom(header,'nama','namalengkap','namakaryawan'),
    nik:_cariKolom(header,'nik','nomorinduk','idkaryawan'),ktp:_cariKolom(header,'noktp','ktp'),
    npwp:_cariKolom(header,'npwp'),tglLahir:_cariKolom(header,'tgllahir','tanggallahir','lahir'),
    statusNikah:_cariKolom(header,'statuspernikahan','statusnikah','nikah'),
    jmlAnak:_cariKolom(header,'jumlahanak','jmlanak','anak'),
    alamat:_cariKolom(header,'alamat','address'),hp:_cariKolom(header,'nohp','hp','telp','phone'),
    email:_cariKolom(header,'email'),jabatan:_cariKolom(header,'jabatan','posisi'),
    kontrak:_cariKolom(header,'statuskontrak','kontrak'),tglKontrak:_cariKolom(header,'tglberakhirkontrak','tglkontrak'),
    rek:_cariKolom(header,'rekening','norekening'),tgl:_cariKolom(header,'tglmasuk','tanggalmasuk','masuk'),
    div:_cariKolom(header,'divisi','div','departemen'),
    bpjsKes:_cariKolom(header,'nobpjskesehatan','bpjskes'),bpjsKtk:_cariKolom(header,'nobpjsketenagakerjaan','bpjstk'),
    ot:_cariKolom(header,'ot','overtime','lembur'),pot:_cariKolom(header,'potongan','pot'),
  };

  if (C.nama < 0 || C.nik < 0) {
    _showImportError(`Kolom wajib tidak ditemukan: ${C.nama<0?'"Nama"':''} ${C.nik<0?'"NIK"':''}\nHeader terbaca: ${headerAsli.slice(0,10).join(', ')}`);
    return;
  }

  const dayColMap = {};
  DAYS.forEach(d => {
    const idx = header.findIndex(h => h === `tgl${d}` || h === String(d) || h === `hari${d}`);
    if (idx >= 0) dayColMap[d] = idx;
  });

  const parsed = [], errors = [];

  dataRows.forEach((row, ri) => {
    const noBaris = ri + 2;
    const nama    = _ambilSel(row, C.nama);
    const nik     = _ambilSel(row, C.nik);
    if (!nama && !nik) return;
    if (!nik)  errors.push(`Baris ke-${noBaris}: NIK kosong (${nama})`);
    if (!nama) errors.push(`Baris ke-${noBaris}: Nama kosong (${nik})`);

    const days = DAYS.map(d => {
      if (dayColMap[d] === undefined) return 0;
      return _normNilaiAbsensi(_ambilSel(row, dayColMap[d]), noBaris, nama, d, errors);
    });

    parsed.push({
      no: parsed.length + 1,
      nama: nama || 'Tanpa Nama', nik: nik || '',
      ktp: _ambilSel(row,C.ktp), npwp: _ambilSel(row,C.npwp),
      tglLahir: _ambilSel(row,C.tglLahir), usia: hitungUsia(_ambilSel(row,C.tglLahir)),
      statusNikah: _ambilSel(row,C.statusNikah), jmlAnak: parseInt(_ambilSel(row,C.jmlAnak))||0,
      alamat: _ambilSel(row,C.alamat), hp: _ambilSel(row,C.hp), email: _ambilSel(row,C.email),
      jabatan: _ambilSel(row,C.jabatan), kontrak: _ambilSel(row,C.kontrak),
      tglKontrak: _ambilSel(row,C.tglKontrak), rek: _ambilSel(row,C.rek),
      tgl: _ambilSel(row,C.tgl), div: _normDivisi(_ambilSel(row,C.div)||'S. JARUM 2'),
      statusKaryawan:'aktif', noBPJSKes: _ambilSel(row,C.bpjsKes), noBPJSKtk: _ambilSel(row,C.bpjsKtk),
      days, ot: parseFloat(_ambilSel(row,C.ot).replace(',','.'))||0,
      pot: parseFloat(_ambilSel(row,C.pot).replace(',','.'))||0, bonus:0, bonusKet:'',
    });
  });

  if (!parsed.length) { _showImportError('Tidak ada baris data yang berhasil diproses.'); return; }

  importParsedData = parsed;
  _showImportPreview(parsed, errors);
}

function _showImportError(msg) {
  importParsedData = null;
  document.getElementById('btn-import-apply').disabled = true;
  const dz = document.getElementById('import-dropzone');
  if (dz) { dz.style.borderColor='var(--red)'; dz.style.background='#fff5f5'; }
  const prevEl = document.getElementById('import-preview');
  const errEl  = document.getElementById('import-errors');
  if (prevEl) prevEl.style.display = 'block';
  if (errEl) {
    errEl.style.display = 'block';
    errEl.innerHTML = `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:var(--r);padding:12px 14px;display:flex;gap:10px;">
      <span style="font-size:18px;">⛔</span>
      <div style="color:#7f1d1d;"><div style="font-weight:700;margin-bottom:4px;">Impor gagal</div><div style="font-size:11.5px;line-height:1.75;">${msg.replace(/\n/g,'<br>')}</div></div>
    </div>`;
  }
}

function _showImportPreview(parsed, errors) {
  document.getElementById('import-preview').style.display = 'block';
  document.getElementById('btn-import-apply').disabled = false;
  document.getElementById('import-row-count').textContent = `${parsed.length} karyawan siap diimpor`;
  document.getElementById('import-preview-title').textContent = `Pratinjau Data (${parsed.length} baris valid)`;

  const kol = [
    {lbl:'No',fn:e=>e.no},{lbl:'Nama',fn:e=>e.nama},{lbl:'NIK',fn:e=>e.nik,mono:true},
    {lbl:'Divisi',fn:e=>e.div},{lbl:'Tgl Masuk',fn:e=>e.tgl||'—'},
    {lbl:'Rekening',fn:e=>e.rek||'—',mono:true},{lbl:'OT',fn:e=>e.ot},{lbl:'Pot.',fn:e=>e.pot},
  ];

  document.getElementById('import-preview-head').innerHTML =
    `<tr>${kol.map(c=>`<th style="padding:5px 8px;font-size:10px;font-weight:600;">${c.lbl}</th>`).join('')}</tr>`;

  const MAX = 10;
  document.getElementById('import-preview-body').innerHTML =
    parsed.slice(0,MAX).map(e =>
      `<tr>${kol.map(c=>`<td style="padding:4px 8px;font-size:10.5px;${c.mono?'font-family:monospace;':''}">${c.fn(e)}</td>`).join('')}</tr>`
    ).join('') +
    (parsed.length > MAX ? `<tr><td colspan="${kol.length}" style="padding:6px 8px;font-size:10.5px;color:var(--text3);text-align:center;font-style:italic;">… dan ${parsed.length-MAX} lainnya</td></tr>` : '');

  const errEl = document.getElementById('import-errors');
  if (errors.length) {
    errEl.style.display = 'block';
    errEl.innerHTML = `<div class="alert warning"><span class="ico">⚠</span><div><b>${errors.length} peringatan:</b><br><span style="font-size:11.5px;">${errors.slice(0,8).map(p=>'• '+p).join('<br>')}</span></div></div>`;
  } else {
    errEl.style.display = 'none';
  }
}

export function applyImport() {
  if (!importParsedData || !importParsedData.length) return;
  const mode = document.querySelector('input[name="import-mode"]:checked').value;
  if (mode === 'replace') {
    if (!confirm(`Ganti semua ${employees.length} data dengan ${importParsedData.length} data baru?`)) return;
    setEmployees(importParsedData);
  } else {
    const existNIKs = new Set(employees.map(e => e.nik));
    const toAdd     = importParsedData.filter(e => !existNIKs.has(e.nik));
    const dupCount  = importParsedData.length - toAdd.length;
    if (dupCount > 0 && !confirm(`${dupCount} NIK duplikat dilewati. Tambahkan ${toAdd.length} karyawan?`)) return;
    const startNo = employees.length + 1;
    toAdd.forEach((e, i) => { e.no = startNo + i; });
    setEmployees([...employees, ...toAdd]);
  }

  saveToLS();
  closeImportModal();
  renderTable();
  // Muat ulang modul UI Manajemen Penggajian secara dinamis setelah data berhasil diimpor
  import('../ui/payroll.js').then(m => m.renderPayroll?.());
  jalankanDeteksiNotifikasi();
  alert(`✓ Berhasil mengimpor ${importParsedData.length} karyawan.`);
}

export function downloadImportTemplate() {
  if (typeof XLSX === 'undefined') { alert('Library SheetJS belum dimuat.'); return; }
  const dayCols = DAYS.map(d => `Tgl${d}`);
  const header  = ['No','Nama','NIK','NoKTP','NPWP','TglLahir','StatusPernikahan','JumlahAnak','Alamat','NoHP','Email','Jabatan','StatusKontrak','TglBerakhirKontrak','Rekening','TglMasuk','Divisi','NoBPJSKesehatan','NoBPJSKetenagakerjaan',...dayCols,'OT','Potongan'];
  const sample  = [
    [1,'NAMA KARYAWAN','1234567','3201012345678901','','1990-05-15','Menikah',2,'Jl. Mawar No.5','081234567890','','Operator','PKWTT','','8767940000','30-Apr-24','S. JARUM 2','','', ...DAYS.map((_,i)=>HOL_IDX.includes(i)?0:2),0,0],
    [2,'CONTOH NAMA 2','7654321','','','1995-08-20','Lajang',0,'','089876543210','','Helper','PKWT','2025-12-31','','1-Jan-25','WS','','', ...DAYS.map((_,i)=>HOL_IDX.includes(i)?0:'A'),2,1],
  ];
  const ws = XLSX.utils.aoa_to_sheet([header,...sample]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data Absensi');
  XLSX.writeFile(wb, 'template_import_absensi.xlsx');
}

// ─── IMPORT FINGERPRINT ───
let fpParsedData = null;

export function openImportFingerprint() {
  if (rbac.role && rbac.role !== 'admin') { alert('Fitur Import Fingerprint hanya untuk HR Admin.'); return; }
  fpParsedData = null;
  document.getElementById('fp-preview').style.display = 'none';
  document.getElementById('btn-fp-apply').disabled = true;
  document.getElementById('fp-file-input').value = '';
  document.getElementById('modal-import-fingerprint').classList.add('open');
}

export function closeImportFingerprint() {
  document.getElementById('modal-import-fingerprint').classList.remove('open');
}

export function handleFPDrop(e) {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file) handleFPFile(file);
}

export function handleFPFile(file) {
  if (!file || file.name.split('.').pop().toLowerCase() !== 'csv') {
    alert('Gunakan file .csv dari mesin absensi.');
    return;
  }
  const readerUtf8 = new FileReader();
  readerUtf8.onload = ev => {
    const teks = ev.target.result;
    if ((teks.match(/\uFFFD/g)||[]).length > 2) {
      const r2 = new FileReader();
      r2.onload = ev2 => _prosesFPCSV(ev2.target.result);
      r2.readAsText(file, 'windows-1252');
    } else {
      _prosesFPCSV(teks);
    }
  };
  readerUtf8.readAsText(file, 'UTF-8');
}

function _prosesFPCSV(teks) {
  teks = teks.replace(/^\uFEFF/, '');
  const baris0 = teks.split(/\r?\n/)[0] || '';
  const nKoma = (baris0.match(/,/g)||[]).length, nTK = (baris0.match(/;/g)||[]).length, nTab = (baris0.match(/\t/g)||[]).length;
  let delim = ',';
  if (nTK > nKoma && nTK >= nTab) delim = ';';
  else if (nTab > nKoma && nTab > nTK) delim = '\t';

  const rows   = _parseCSVManual(teks, delim);
  if (rows.length < 2) { alert('File CSV kosong.'); return; }

  const header = rows[0].map(h => String(h).toLowerCase().replace(/\s+/g,''));
  const iNIK   = header.findIndex(h => h.includes('nik') || h === 'id');
  const iTgl   = header.findIndex(h => h.includes('tanggal') || h.includes('date') || h.includes('tgl'));
  const iMasuk = header.findIndex(h => h.includes('masuk') || h.includes('checkin') || h.includes('in'));
  const iKeluar= header.findIndex(h => h.includes('keluar') || h.includes('checkout') || h.includes('out'));

  if (iNIK < 0 || iTgl < 0) { alert('Format CSV tidak dikenali. Pastikan ada kolom NIK dan Tanggal.'); return; }

  const jamMasukNormal  = document.getElementById('fp-jam-masuk')?.value  || '07:00';
  const jamKeluarNormal = document.getElementById('fp-jam-keluar')?.value || '16:00';
  const minSetengah     = parseFloat(document.getElementById('fp-min-setengah')?.value) || 4;

  const durasiJam = (masuk, keluar) => {
    if (!masuk || !keluar) return 0;
    const [hM,mM] = masuk.split(':').map(Number);
    const [hK,mK] = keluar.split(':').map(Number);
    return isNaN(hM)||isNaN(hK) ? 0 : Math.max(0, (hK*60+mK-hM*60-mM)/60);
  };

  const tapPerNIK = {};
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every(c=>!String(c).trim())) continue;
    const nik  = String(row[iNIK]||'').trim();
    const tgl  = String(row[iTgl]||'').trim();
    const masuk  = iMasuk  >= 0 ? String(row[iMasuk]||'').trim() : '';
    const keluar = iKeluar >= 0 ? String(row[iKeluar]||'').trim() : '';
    if (!nik || !tgl) continue;
    if (!tapPerNIK[nik]) tapPerNIK[nik] = {};
    if (!tapPerNIK[nik][tgl] || masuk) tapPerNIK[nik][tgl] = { masuk, keluar };
  }

  const hasil = [], nikTidakDikenal = [];
  Object.keys(tapPerNIK).forEach(nik => {
    const emp = employees.find(e => e.nik === nik);
    if (!emp) { nikTidakDikenal.push(nik); return; }
    const newDays = emp.days.slice();
    const tapNik  = tapPerNIK[nik];

    DAYS.forEach((tgl, idx) => {
      if (HOL_IDX.includes(idx)) return;
      const tglKey = Object.keys(tapNik).find(k => {
        const d = new Date(k);
        return !isNaN(d) && d.getDate() === tgl;
      });
      if (!tglKey) return;
      const { masuk, keluar } = tapNik[tglKey];
      const durasi = durasiJam(masuk || jamMasukNormal, keluar || jamKeluarNormal);
      let status;
      if (!masuk && !keluar) status = 'A';
      else if (durasi >= 8) status = 2;
      else if (durasi >= minSetengah) status = '√';
      else status = 'A';
      newDays[idx] = status;
    });
    hasil.push({ emp, newDays, nik });
  });

  if (!hasil.length && !nikTidakDikenal.length) { alert('Tidak ada data yang dapat diproses.'); return; }

  fpParsedData = hasil;
  const errors = nikTidakDikenal.length > 0 ? [`${nikTidakDikenal.length} NIK tidak ditemukan: ${nikTidakDikenal.slice(0,5).join(', ')}`] : [];

  const prevEl  = document.getElementById('fp-preview');
  const headEl  = document.getElementById('fp-preview-head');
  const bodyEl  = document.getElementById('fp-preview-body');
  const errEl   = document.getElementById('fp-errors');
  const titleEl = document.getElementById('fp-preview-title');
  if (titleEl) titleEl.textContent = `Hasil Konversi — ${hasil.length} karyawan`;

  headEl.innerHTML = `<tr><th style="padding:5px 8px;font-size:10px;">Nama</th><th style="padding:5px 8px;font-size:10px;">NIK</th><th style="padding:5px 8px;font-size:10px;">Hari Diperbarui</th></tr>`;
  bodyEl.innerHTML = hasil.slice(0,10).map(h =>
    `<tr><td style="padding:4px 8px;font-size:10.5px;">${h.emp.nama}</td><td style="padding:4px 8px;font-size:10.5px;font-family:monospace;">${h.nik}</td><td style="padding:4px 8px;font-size:10.5px;">${Object.keys(tapPerNIK[h.nik]||{}).length} hari</td></tr>`
  ).join('');

  if (errors.length && errEl) {
    errEl.style.display = 'block';
    errEl.innerHTML = `<div class="alert warning" style="margin-top:8px;"><span class="ico">⚠</span><span>${errors.join('<br>')}</span></div>`;
  }

  if (prevEl) prevEl.style.display = 'block';
  document.getElementById('btn-fp-apply').disabled = false;
}

export function terapkanImportFingerprint() {
  if (!fpParsedData || !fpParsedData.length) return;
  fpParsedData.forEach(({ emp, newDays }) => { emp.days = newDays; });
  saveToLS();
  closeImportFingerprint();
  renderTable();
  alert(`✓ Data fingerprint berhasil diterapkan ke ${fpParsedData.length} karyawan.`);
}
