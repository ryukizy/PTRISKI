### **RH Absensi Dashboard — Struktur & Format Data (v2026)**

**Tujuan Proyek**  
Aplikasi web single-page (SPA) untuk manajemen absensi, payroll, cuti, resign, dan analitik karyawan PT. Riski Hariyanto. Dibangun dengan **Clean Architecture** (ES Modules) dan menggunakan `localStorage` sebagai database.

---

### **1. Struktur Folder (Clean Architecture)**

```
APPTRH-main/
├── index.html
├── styles.css
├── dok.md
├── data_dummy_50_karyawan_30hari.xlsx
└── src/
    ├── main.js
    ├── core/
    │   ├── state.js
    │   ├── storage.js
    │   ├── utils.js
    │   ├── calc.js
    │   └── periode.js
    ├── features/
    │   ├── cuti.js
    │   ├── io.js
    │   ├── resign.js
    │   ├── rbac.js
    │   └── notifikasi.js
    └── ui/
        ├── tabel.js
        ├── payroll.js
        ├── analitik.js
        ├── settings.js
        ├── forms.js
        ├── col-vis.js
        └── payroll-extra.js
```

---

### **2. State Global Utama (src/core/state.js)**

#### **employees** (Array of Object)
Ini adalah **data utama** karyawan.

```js
[
  {
    no: 1,
    nama: "Nama Karyawan",
    nik: "1234567",
    ktp: "3201xxxxxxxxxxxx",
    npwp: "",
    tglLahir: "1990-05-15",
    usia: "35 tahun",
    statusNikah: "Menikah",
    jmlAnak: 2,
    alamat: "...",
    hp: "081234567890",
    email: "",
    div: "S. JARUM 2",           // WS | S. TEMPEL | S. JARUM 2 | S. JARUM 1,2
    jabatan: "Operator",
    kontrak: "PKWTT",            // PKWTT | PKWT
    tglKontrak: "2025-12-31",    // hanya jika PKWT
    tgl: "30-Apr-24",            // Tanggal masuk (format bebas)
    rek: "8767940000",
    statusKaryawan: "aktif",     // aktif | resign | nonaktif
    tglKeluar: "",
    noBPJSKes: "",
    noBPJSKtk: "",
    
    // === DATA ABSENSI (PALING PENTING) ===
    days: [2, "√", 0, "A", "I", 3, ...],   // Panjang = DAYS.length
    
    ot: 0,           // Lembur manual (jam)
    pot: 0,          // Potongan jam manual
    bonus: 0,
    bonusKet: "",
    
    // Tambahan untuk resign
    alasanResign: "",
    saldoCutiTahunan: 12,     // (opsional, legacy)
    cutiCarryOver: 0
  }
]
```

#### **Format `days` (Array Absensi)**

| Nilai       | Arti                                      | Kategori     |
|-------------|-------------------------------------------|--------------|
| `0` atau `""` | Hadir penuh (tanpa lembur)                | Hadir        |
| `√`         | Hadir penuh                               | Hadir        |
| `1`, `2`, `3`, ... | Hadir penuh + **jam lembur** sebanyak angka tersebut | Hadir + OT |
| `A`         | Alfa (tanpa keterangan)                   | Tidak Hadir  |
| `I`         | Izin                                      | Tidak Hadir  |
| `S`         | Sakit                                     | Tidak Hadir  |
| `L`         | Libur (nasional / pabrik)                 | Libur        |
| `C`         | Cuti Tahunan                              | Cuti         |

**Panjang array `days`** = `DAYS.length` (dihasilkan dari `generatePeriodDays()`).

---

### **3. Config Global (`cfg`)**

```js
{
  gajiHarian: 75000,
  transport: 15000,
  makan: 20000,
  rateLembur: 12500,
  ratePotongan: 10000,
  rateBPJSKesehatan: 0.01,
  rateBPJSKetenagakerjaan: 0.03,
  maxAlfa: 0,
  maxIzin: 0,
  maxSakit: 1,
  premiVal: 100000,
  workdays: 30,                              // Default 30 hari kerja
  period: "1 – 30 April 2026",
  tglMulai: "2026-04-01",
  tglSelesai: "2026-04-30",
  allowSundayWork: true,                    // Minggu bisa diedit & dihitung sebagai hari kerja

  columnVisibility: {
    rek: true,
    tgl: true,
    div: true,
    kalkulasi: true,
    p_transport: true,
    p_makan: true,
    p_lembur: true,
    p_potongan: true,
    p_bpjs: true,
    dailyAttendance: true
  }
}
```

---

### **4. Data Lainnya**

| Variabel          | Tipe          | Keterangan |
|-------------------|---------------|----------|
| `cutiData`        | Array         | Riwayat pengajuan cuti |
| `DAYS`            | Array<number> | Daftar tanggal dalam periode aktif (default 1–30) |
| `HOL_IDX`         | Array<number> | Indeks hari Minggu (jika `allowSundayWork = false`) |
| `rbac`            | Object        | `{ role, nama, divisi, nik, empData }` |

**Fitur Baru:**
- **allowSundayWork**: Jika `true`, hari Minggu dianggap hari kerja dan bisa diedit.
- **Riwayat Resign**: Menampilkan karyawan yang sudah resign/nonaktif beserta alasan dan status (Bermasalah/Normal) di Dashboard Analitik.
- **Period Change Modal**: Saat ganti periode, muncul modal dengan opsi **Download Backup** sebelum reset data.

**Role RBAC:**
- `admin` → Akses penuh
- `supervisor` → Hanya divisi tertentu + tidak bisa lihat Payroll/Analitik
- `karyawan` → Hanya data diri sendiri (self-service)

---

### **5. LocalStorage Keys**

```js
employees_v13
cutiData_v13
cfg_v13
payrollHistory_v13
notifState_v15
rbacSession_v14
```

---

### **6. Cara Kerja Utama**

1. **Absensi** → Diinput via tabel → disimpan di `emp.days[index]`
2. **Kalkulasi Gaji & Premi** → `calcEmployee(emp)` di `core/calc.js`
3. **Premi Hadir** → Hanya didapat jika `alfa <= 0 && izin <= 0 && sakit <= 1` (sesuai kebijakan perusahaan)
4. **Cuti** → Dikelola di `features/cuti.js`
5. **Resign** → Ubah `statusKaryawan = "resign"` + simpan `tglKeluar` dan `alasanResign`
6. **Ganti Periode** → Muncul modal khusus dengan opsi **Download Backup & Reset**
7. **Riwayat Resign** → Ditampilkan di Dashboard Analitik dengan deteksi kata kunci sensitif

---

### **Alur Ganti Periode + Backup Data**

Berikut adalah alur lengkap ketika pengguna mengubah periode di **⚙ Pengaturan**:

1. **User mengubah tanggal** di form "Tanggal Mulai Periode" dan "Tanggal Selesai Periode".
2. User klik tombol **Simpan & Hitung Ulang**.
3. Sistem mendeteksi bahwa `tglMulai` atau `tglSelesai` berubah (`periodeBerubah = true`).
4. Sistem **menampilkan modal khusus** (`modal-period-change`) dengan:
   - Peringatan bahwa data absensi lama akan dihapus.
   - Tombol **📥 Download Backup & Reset Data**
   - Tombol **Batal**
5. **Jika user klik "Download Backup & Reset Data":**
   - Sistem membuat file Excel backup yang berisi:
     - Data master karyawan saat ini
     - Data absensi lengkap periode lama (sheet terpisah)
   - Nama file otomatis: `Backup_Absensi_{Periode}_{Tanggal}.xlsx`
   - Setelah download selesai, sistem **otomatis mereset** `emp.days` menjadi array baru dengan panjang sesuai periode baru (semua bernilai `0`).
6. **Jika user klik "Batal"**: Tidak terjadi perubahan apapun.
7. Setelah proses selesai, sistem melakukan:
   - `generatePeriodDays()`
   - `renderTableHeader()`
   - `renderTable()`
   - `renderPayroll()` dan `renderAnalitik()` (via dynamic import)

**Catatan Penting:**
- Fitur backup ini dibuat untuk **mencegah kehilangan data historis** saat ganti bulan.
- Disarankan selalu melakukan backup sebelum mereset data absensi.

---

### **7. Petunjuk Penting**

- **Semua perubahan data** harus diikuti dengan `saveToLS()` dan render ulang yang sesuai.
- **Ganti Periode**: Selalu tawarkan backup terlebih dahulu sebelum reset data absensi.
- **allowSundayWork**: Jika aktif, hari Minggu dihitung sebagai hari kerja dan bisa diedit.
- **Riwayat Resign**: Ditampilkan di Analytics dengan deteksi kata kunci sensitif (Bermasalah).
- **Import/Export** menggunakan SheetJS (`XLSX`).
- **Dynamic Import**: Beberapa modul di-load secara lazy (`import()`).

---

**Catatan Pengembangan**
Dokumentasi ini mencerminkan kondisi aplikasi per Mei 2026, termasuk fitur 30 hari default, `allowSundayWork`, modal backup saat ganti periode, dan Riwayat Resign.

---

A