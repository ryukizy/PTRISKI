// ════════════════════════════════════════════════════════════════
// calc.js — Kalkulasi absensi & payroll (murni, tanpa sentuh DOM)
// ════════════════════════════════════════════════════════════════

import { cfg, HOL_IDX } from './state.js';

export function parseDay(v) {
  // Sel kosong (""), null, undefined, atau 0 → Hadir Penuh tanpa lembur
  if (v === 0 || v === undefined || v === null || v === '' || v === '0') {
    return {score: 2, type: 'hadir', ot: 0};
  }
  
  // Angka positif (1, 2, 3, dst.) → Hadir Penuh + jam lembur sesuai angka
  if (typeof v === 'number' && v > 0) {
    return {score: 2, type: 'hadir', ot: v};
  }
  
  // String angka → Hadir Penuh + jam lembur
  const numVal = parseFloat(v);
  if (!isNaN(numVal) && numVal > 0) {
    return {score: 2, type: 'hadir', ot: numVal};
  }
  
  // Huruf status absensi
  if (v === 'A') return {score: 0, type: 'alfa',  ot: 0};
  if (v === 'I') return {score: 0, type: 'izin',  ot: 0};
  if (v === 'S') return {score: 0, type: 'sakit', ot: 0};
  if (v === 'L') return {score: 0, type: 'libur', ot: 0};
  if (v === 'C') return {score: 2, type: 'cuti',  ot: 0};
  if (v === '√') return {score: 2, type: 'hadir', ot: 0};
  
  // Default: Hadir Penuh tanpa lembur untuk nilai tak terduga
  return {score: 2, type: 'hadir', ot: 0};
}

export function calcEmployee(emp) {
  let totalScore=0, alfa=0, izin=0, sakit=0, libur=0, cuti=0, otTotal=0;
  const types = [];
  emp.days.forEach((v,i) => {
    if (HOL_IDX.includes(i)) { types.push('minggu'); return; }
    const d = parseDay(v);
    types.push(d.type);
    totalScore += d.score;
    otTotal    += d.ot;
    if (d.type==='alfa')  alfa++;
    else if (d.type==='izin')  izin++;
    else if (d.type==='sakit') sakit++;
    else if (d.type==='libur') libur++;
    else if (d.type==='cuti')  cuti++;
  });

  const manualOT  = emp.ot  || 0;
  const totalOT   = otTotal + manualOT;
  const potJam    = emp.pot || 0;
  const totalHari = Math.round(totalScore / 2 * 10) / 10;
  const totalTM   = alfa + izin + sakit;
  const totalHadir = totalHari;

  const gajiPokok  = Math.round(totalHadir * cfg.gajiHarian);
  const uTransport = Math.round(totalHadir * cfg.transport);
  const uMakan     = Math.round(totalHadir * cfg.makan);
  const uLembur    = Math.round(totalOT    * cfg.rateLembur);
  const uPotongan  = Math.round(potJam     * cfg.ratePotongan);

  const premiOk = alfa <= cfg.maxAlfa && izin <= cfg.maxIzin && sakit <= cfg.maxSakit;
  const premiVal = premiOk ? cfg.premiVal : 0;

  const bpjsKesehatan       = Math.round(gajiPokok * cfg.rateBPJSKesehatan);
  const bpjsKetenagakerjaan = Math.round(gajiPokok * cfg.rateBPJSKetenagakerjaan);
  const potBPJS = bpjsKesehatan + bpjsKetenagakerjaan;

  const totalGaji = gajiPokok + uTransport + uMakan + uLembur - uPotongan - potBPJS + premiVal;
  const bonus     = emp.bonus || 0;
  const totalGajiFinal = totalGaji + bonus;

  return {
    totalHari, alfa, izin, sakit, libur, cuti,
    totalTM, totalHadir,
    gajiPokok, uTransport, uMakan, uLembur, uPotongan,
    ot: totalOT, pot: potJam,
    bpjs: potBPJS, bpjsKesehatan, bpjsKetenagakerjaan,
    premi: premiVal, bonus,
    premiOk, totalGaji: totalGajiFinal, types,
  };
}

export function calcEmployeeWithCfg(emp, cfgX) {
  const savedCfg = {};
  if (cfgX) {
    Object.keys(cfgX).forEach(k => { savedCfg[k] = cfg[k]; cfg[k] = cfgX[k]; });
  }
  const result = calcEmployee(emp);
  if (cfgX) {
    Object.keys(savedCfg).forEach(k => { cfg[k] = savedCfg[k]; });
  }
  return result;
}

export function hitungPPh21(pkp) {
  if (pkp <= 0) return 0;
  let pph = 0;
  const lapisan = [
    { batas: 60000000,   tarif: 0.05 },
    { batas: 190000000,  tarif: 0.15 },
    { batas: 250000000,  tarif: 0.25 },
    { batas: 5000000000, tarif: 0.30 },
  ];
  let sisa = pkp, lower = 0;
  for (const l of lapisan) {
    const kena = Math.min(sisa, l.batas - lower);
    if (kena <= 0) break;
    pph  += kena * l.tarif;
    sisa -= kena;
    lower = l.batas;
    if (sisa <= 0) break;
  }
  return Math.round(pph);
}

export function hitungMasaKerja(tglMasukStr, refDate) {
  if (!tglMasukStr) return { bulan: 0, label: 'Tidak diketahui' };
  let masuk;
  if (/^\d{4}-\d{2}-\d{2}$/.test(tglMasukStr)) {
    masuk = new Date(tglMasukStr);
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(tglMasukStr)) {
    const [d,m,y] = tglMasukStr.split('/');
    masuk = new Date(`${y}-${m}-${d}`);
  } else {
    masuk = new Date(tglMasukStr);
  }
  if (isNaN(masuk)) return { bulan: 0, label: '?' };
  const ref = refDate ? new Date(refDate) : new Date();
  const totalBulan = (ref.getFullYear() - masuk.getFullYear()) * 12 + (ref.getMonth() - masuk.getMonth());
  const tahun = Math.floor(totalBulan / 12);
  const bulanSisa = totalBulan % 12;
  const label = tahun > 0 ? `${tahun} th ${bulanSisa > 0 ? bulanSisa + ' bln' : ''}`.trim() : `${bulanSisa} bulan`;
  return { bulan: totalBulan, label };
}
