# Template AI untuk Koreksi Therapy Plan dan Import Infus Aktual ke ERP RAHO

## 1. Tujuan

Dokumen ini adalah kontrak pertukaran data antara:

1. catatan sumber dari petugas/MSO;
2. AI yang membaca dan menormalkan catatan tersebut;
3. validator atau importer ERP RAHO; dan
4. petugas klinis yang menyetujui koreksi.

Template ini dipakai ketika dosis infus aktual saat sesi terapi berbeda dari therapy plan dan therapy plan sesi perlu dibetulkan agar sesuai dengan tindakan aktual.

Untuk pengisian harian oleh Nakes atau Admin Layanan, gunakan form operasional berikut terlebih dahulu:

```text
docs/FORM_UPLOAD_AI_PENCATATAN_SESI_TERAPI.md
```

Form operasional tersebut berisi daftar data yang perlu dicatat dan prompt agar AI memeriksa kelengkapan serta menginstruksikan tindakan berikutnya. Dokumen ini digunakan setelah form dinyatakan lengkap untuk membentuk payload import teknis.

Untuk pengguna yang belum terbiasa menggunakan AI atau ERP, mulai dari panduan berikut:

```text
docs/PANDUAN_MUDAH_AI_PENCATATAN_SESI_TERAPI.md
```

Panduan tersebut mewajibkan AI bertanya satu per satu dengan bahasa sederhana dan tidak menampilkan istilah teknis sebelum waktunya.

> **Penting:** file Markdown ini tidak langsung diproses oleh endpoint ERP yang tersedia saat ini. Importer harus mengambil JSON di dalam blok `RAHO_AI_IMPORT_PAYLOAD`, memvalidasinya, lalu memanggil endpoint ERP sesuai urutan pada bagian `erpRequests`.

## 2. Batasan Keselamatan

- AI hanya mengekstrak, membandingkan, dan menyusun usulan. AI tidak memberikan keputusan klinis baru.
- AI tidak boleh menebak dosis, identitas member, identitas sesi, alasan deviasi, atau persetujuan petugas.
- Koreksi hanya boleh diproses ketika sesi masih aktif dan belum selesai.
- Jika `isCompleted = true` atau `completionStatus = "COMPLETED"`, hasil wajib `importReady = false`.
- Nakes/Admin Layanan tidak perlu mengisi ID internal ERP. Jika `sessionCode` dan `memberNo` tidak diketahui, pengguna cukup mengisi nama lengkap member dan mengonfirmasi ejaannya.
- Importer mencari kandidat berdasarkan nama lengkap yang telah dikonfirmasi. Jika ditemukan lebih dari satu member atau sesi, importer wajib menampilkan pilihan berdasarkan cabang, tanggal terapi, dan infus ke. Import tidak boleh dilanjutkan sebelum pengguna memilih tepat satu kandidat.
- Dosis aktual tidak boleh diubah agar terlihat sama dengan plan. Therapy plan yang dikoreksi harus mengikuti tindakan aktual yang telah diverifikasi.
- Koreksi harus disetujui manusia dengan kewenangan klinis sebelum mode `COMMIT`.
- Role `MSO` belum menjadi role tersendiri di ERP. Akun pelaksana harus dipetakan ke role yang diizinkan backend: `SUPER_ADMIN`, `ADMIN_MANAGER`, `DOCTOR`, atau `NURSE`.
- Admin Manager dengan akses `MEMBER_VIEW_ONLY` tidak boleh melakukan import.
- Jangan melakukan import ke sesi yang sudah memiliki `InfusionExecution`. Endpoint pembuatan infus hanya menerima satu infus aktual per sesi.

## 3. Aturan Field Dosis

Gunakan nama field berikut secara persis.

| Field | Arti | Satuan ERP | Aturan |
|---|---|---:|---|
| `ifa250` | IFA 250 ml | botol | Bilangan bulat, tidak boleh bersamaan dengan `ifa500` |
| `ifa500` | IFA 500 ml | botol | Bilangan bulat, tidak boleh bersamaan dengan `ifa250` |
| `hho` | NB-HHO | ml | Angka >= 0 |
| `hhoKonsentrat` | HHO konsentrat | ml | Angka >= 0 |
| `h2` | H2 | ml | Angka >= 0 |
| `no` | NO | ml | Lihat aturan khusus NO di bawah |
| `gaso` | Gasotransmitter | ml | Angka >= 0 |
| `o2` | O2 | ml | Angka >= 0 |
| `o3` | O3/Ozone | ml | Angka >= 0 |
| `edta` | EDTA | ml | Angka >= 0 |
| `mb` | Methylene Blue | ml | Angka >= 0 |
| `h2s` | H2S | ml | Angka >= 0 |
| `kcl` | KCL | ml | Angka >= 0 |
| `jmlNb` | Jumlah NB | jumlah | Angka >= 0 |

Nilai kosong pada objek analisis ditulis `null`. Pada body API, field opsional yang tidak digunakan sebaiknya dihilangkan, bukan dikirim sebagai string kosong.

### 3.1 Aturan Khusus NO di IFA 250

Di ERP, nilai `therapyPlan.no` adalah total NO dalam rencana, termasuk NO yang sudah terkandung di IFA 250. Nilai `actualInfusion.no` adalah NO tambahan di luar IFA.

Rumus koreksi:

```text
correctedTherapyPlan.no = actualInfusion.no + (actualInfusion.ifa250 x noPerIfa250Bottle)
```

Nilai default `noPerIfa250Bottle` adalah `2.5 ml`, kecuali `ifaSubstances` sumber menyatakan nilai lain.

Contoh:

- Aktual IFA 250 = 1 botol dan tidak ada NO tambahan, maka plan `no = 2.5` dan aktual `no` boleh tidak dikirim.
- Aktual IFA 250 = 1 botol dan NO tambahan = 1 ml, maka plan `no = 3.5` dan aktual `no = 1`.
- Aktual menggunakan IFA 500, maka tidak ada pengurangan NO bawaan IFA 250.

## 4. Template Data Sumber untuk Diisi Petugas atau AI

Bagian ini diisi dari jawaban manual Nakes atau Admin Layanan dalam percakapan AI. `null` berarti data belum tersedia dan tidak boleh ditebak. AI tidak perlu meminta screenshot, foto, OCR, atau ID internal ERP.

```json
{
  "sourceDocument": {
    "sourceType": "MANUAL_ENTRY",
    "sourceReference": null,
    "sourceDate": null,
    "sourceText": null
  },
  "session": {
    "sessionCode": null,
    "memberNo": null,
    "memberName": null,
    "branchCode": null,
    "branchName": null,
    "treatmentDate": null,
    "infusKe": null,
    "isCompleted": null,
    "completionStatus": null,
    "hasExistingInfusion": null
  },
  "actor": {
    "msoName": null,
    "erpRole": null
  },
  "currentTherapyPlan": {
    "planNumber": null,
    "keterangan": null,
    "ifa250": null,
    "ifa500": null,
    "hho": null,
    "hhoKonsentrat": null,
    "h2": null,
    "no": null,
    "gaso": null,
    "o2": null,
    "o3": null,
    "edta": null,
    "mb": null,
    "h2s": null,
    "kcl": null,
    "jmlNb": null,
    "ifaSubstances": null
  },
  "observedActualInfusion": {
    "ifa250": null,
    "ifa500": null,
    "hho": null,
    "hhoKonsentrat": null,
    "h2": null,
    "no": null,
    "gaso": null,
    "o2": null,
    "o3": null,
    "edta": null,
    "mb": null,
    "h2s": null,
    "kcl": null,
    "jmlNb": null,
    "bottleType": null,
    "jenisCairan": null,
    "volumeCarrier": null,
    "jumlahJarum": null,
    "tanggalProduksi": null
  },
  "deviation": {
    "reason": null,
    "clinicalNote": null,
    "evidenceReference": null
  },
  "approval": {
    "approved": false,
    "approvedByName": null,
    "approvedAt": null,
    "approvalNote": null
  }
}
```

## 5. Kontrak Keluaran AI

AI harus menghasilkan satu objek JSON valid di bawah heading persis `RAHO_AI_IMPORT_PAYLOAD`. Jangan tambahkan komentar di dalam JSON.

`lookupKeysPresent` bernilai `true` jika minimal `memberName` sudah diisi dan `memberNameConfirmed = true`. Kode sesi, nomor member, cabang, tanggal terapi, dan infus ke bersifat opsional, tetapi membantu importer membedakan kandidat dengan nama yang sama.

Nilai `importMode` yang diperbolehkan:

- `VALIDATE_ONLY`: hanya validasi dan preview, tidak mengubah ERP;
- `COMMIT`: boleh diteruskan ke ERP setelah persetujuan manusia lengkap.

Nilai `decision` yang diperbolehkan:

- `READY_FOR_REVIEW`;
- `READY_FOR_IMPORT`;
- `NEEDS_DATA`;
- `REJECTED_COMPLETED_SESSION`;
- `REJECTED_EXISTING_INFUSION`;
- `REJECTED_UNAUTHORIZED_ROLE`;
- `REJECTED_CLINICAL_AMBIGUITY`.

### RAHO_AI_IMPORT_PAYLOAD

```json
{
  "schemaVersion": "1.0",
  "documentType": "RAHO_THERAPY_DEVIATION_CORRECTION",
  "requestId": "AI-TPC-YYYYMMDD-UNIQUE",
  "generatedAt": "YYYY-MM-DDTHH:mm:ss.sssZ",
  "outputFormat": "MARKDOWN",
  "importMode": "VALIDATE_ONLY",
  "importReady": false,
  "decision": "NEEDS_DATA",
  "lookupKeys": {
    "memberName": null,
    "memberNameConfirmed": false,
    "sessionCode": null,
    "memberNo": null,
    "branchCode": null,
    "treatmentDate": null,
    "infusKe": null
  },
  "sessionState": {
    "isCompleted": null,
    "completionStatus": null,
    "hasExistingInfusion": null
  },
  "actor": {
    "name": null,
    "erpRole": null
  },
  "deviation": {
    "detected": false,
    "reason": null,
    "clinicalNote": null,
    "evidenceReference": null,
    "differences": []
  },
  "normalizedData": {
    "sessionPlanNumber": null,
    "originalTherapyPlan": {},
    "actualInfusion": {},
    "correctedTherapyPlan": {}
  },
  "approval": {
    "approved": false,
    "approvedByName": null,
    "approvedAt": null,
    "approvalNote": null
  },
  "validation": {
    "errors": [],
    "warnings": [],
    "checks": {
      "memberNameConfirmed": false,
      "lookupKeysPresent": false,
      "referencesUniquelyResolved": false,
      "sessionActive": false,
      "infusionNotYetStored": false,
      "roleAuthorized": false,
      "oneIfaTypeOnly": false,
      "doseValuesNonNegative": false,
      "planMatchesActual": false,
      "noFormulaValid": false,
      "clinicalApprovalPresent": false
    }
  },
  "erpRequests": []
}
```

### 5.1 Format Item Perbedaan

Setiap field yang berbeda harus dicatat:

```json
{
  "field": "hho",
  "unit": "ml",
  "planned": 5,
  "actual": 7,
  "delta": 2
}
```

### 5.2 Format `erpRequests` ketika Siap Diimpor

Importer menjalankan permintaan secara berurutan. Jika langkah pertama gagal, langkah berikutnya tidak boleh dijalankan.

```json
[
  {
    "step": 1,
    "action": "CORRECT_SESSION_THERAPY_PLAN",
    "method": "PUT",
    "path": "/treatment-sessions/{{resolvedSessionId}}/therapy-plan-set",
    "body": {
      "plans": [
        {
          "planNumber": 1,
          "keterangan": "Koreksi sesuai infus aktual; alasan dan referensi sumber dicantumkan di catatan.",
          "ifa250": 1,
          "hho": 7,
          "no": 2.5,
          "ifaSubstances": [
            {
              "name": "NO",
              "amount": 2.5,
              "unit": "ml",
              "keterangan": "NO bawaan IFA 250",
              "isDefault": true
            }
          ],
          "ifaSubstanceTotalMl": 2.5
        }
      ]
    }
  },
  {
    "step": 2,
    "action": "CREATE_ACTUAL_INFUSION",
    "method": "POST",
    "path": "/treatment-sessions/{{resolvedSessionId}}/infusion",
    "body": {
      "ifa250": 1,
      "hho": 7,
      "bottleType": "IFA",
      "jenisCairan": "NaCl 0.9%",
      "volumeCarrier": 250,
      "jumlahJarum": 1,
      "tanggalProduksi": "2026-08-07T02:30:00.000Z"
    }
  }
]
```

`deviationNotes` boleh dikirim pada langkah kedua untuk menjaga catatan sumber, walaupun corrected plan sudah sama dengan aktual. Isi harus faktual dan tidak boleh dibuat oleh AI.

`{{resolvedSessionId}}` bukan isian pengguna atau AI. Importer menggantinya setelah menemukan satu sesi yang unik berdasarkan `lookupKeys`. `memberId`, `branchId`, `userId`, serta ID hasil pembuatan juga diambil atau dibuat otomatis oleh ERP.

## 6. Validasi Wajib Sebelum Import

Importer harus menolak data jika salah satu kondisi berikut terjadi:

1. `schemaVersion` tidak didukung.
2. `documentType` bukan `RAHO_THERAPY_DEVIATION_CORRECTION`.
3. Nama lengkap member kosong atau belum dikonfirmasi oleh pengguna.
4. Lookup nama tidak menemukan member/sesi atau menemukan lebih dari satu kandidat yang belum dipilih pengguna.
5. Member/sesi terpilih tidak cocok dengan nama yang telah dikonfirmasi atau informasi tambahan yang tersedia.
6. Sesi sudah selesai, completion sudah dibatalkan, atau stok/jurnal sudah diposting.
7. Infus aktual sudah ada pada sesi.
8. Role pelaksana tidak termasuk role yang diizinkan.
9. Admin Manager memiliki scope `MEMBER_VIEW_ONLY`.
10. `ifa250` dan `ifa500` sama-sama lebih besar dari nol atau keduanya kosong/nol.
11. Ada nilai dosis negatif, `NaN`, teks, atau satuan yang tidak dapat dipastikan.
12. `planNumber` bukan bilangan bulat positif atau tidak ada di therapy plan set sesi.
13. Corrected therapy plan belum cocok dengan actual infusion.
14. Rumus NO di IFA 250 tidak cocok.
15. Alasan deviasi atau bukti sumber belum tersedia.
16. Persetujuan manusia belum lengkap saat `importMode = "COMMIT"`.

Saat gagal validasi:

- set `importReady = false`;
- kosongkan `erpRequests`;
- masukkan semua masalah ke `validation.errors`;
- gunakan `decision` yang paling spesifik.

## 7. Contoh Keluaran AI yang Sudah Terisi

Contoh ini hanya data ilustrasi dan tidak boleh langsung diimpor.

### RAHO_AI_IMPORT_PAYLOAD_EXAMPLE

```json
{
  "schemaVersion": "1.0",
  "documentType": "RAHO_THERAPY_DEVIATION_CORRECTION",
  "requestId": "AI-TPC-20260807-DEMO001",
  "generatedAt": "2026-08-07T03:00:00.000Z",
  "outputFormat": "MARKDOWN",
  "importMode": "VALIDATE_ONLY",
  "importReady": false,
  "decision": "READY_FOR_REVIEW",
  "lookupKeys": {
    "memberName": "Jovan Prabowo Kuncoro",
    "memberNameConfirmed": true,
    "sessionCode": "TRX-DEMO-001",
    "memberNo": "RAHO-DEMO-001",
    "branchCode": "JKT",
    "treatmentDate": "2026-08-07",
    "infusKe": 3
  },
  "sessionState": {
    "isCompleted": false,
    "completionStatus": "PENDING",
    "hasExistingInfusion": false
  },
  "actor": {
    "name": "MSO Demo",
    "erpRole": "NURSE"
  },
  "deviation": {
    "detected": true,
    "reason": "Penyesuaian tindakan berdasarkan kondisi pasien saat sesi.",
    "clinicalNote": "HHO aktual 7 ml, sedangkan plan awal 5 ml.",
    "evidenceReference": "CATATAN-SESI-DEMO-001",
    "differences": [
      {
        "field": "hho",
        "unit": "ml",
        "planned": 5,
        "actual": 7,
        "delta": 2
      }
    ]
  },
  "normalizedData": {
    "sessionPlanNumber": 1,
    "originalTherapyPlan": {
      "ifa250": 1,
      "hho": 5,
      "no": 2.5
    },
    "actualInfusion": {
      "ifa250": 1,
      "hho": 7
    },
    "correctedTherapyPlan": {
      "ifa250": 1,
      "hho": 7,
      "no": 2.5
    }
  },
  "approval": {
    "approved": false,
    "approvedByName": null,
    "approvedAt": null,
    "approvalNote": null
  },
  "validation": {
    "errors": [],
    "warnings": [
      "Menunggu persetujuan petugas klinis sebelum COMMIT.",
      "ID internal akan di-resolve oleh importer berdasarkan lookupKeys."
    ],
    "checks": {
      "memberNameConfirmed": true,
      "lookupKeysPresent": true,
      "referencesUniquelyResolved": false,
      "sessionActive": true,
      "infusionNotYetStored": true,
      "roleAuthorized": true,
      "oneIfaTypeOnly": true,
      "doseValuesNonNegative": true,
      "planMatchesActual": true,
      "noFormulaValid": true,
      "clinicalApprovalPresent": false
    }
  },
  "erpRequests": []
}
```

## 8. Prompt Siap Pakai untuk AI

Salin prompt berikut, lalu tempel data sumber pada bagian `DATA SUMBER`.

```text
Anda adalah AI normalisasi data klinis untuk ERP RAHO. Tugas Anda adalah membaca data sumber mengenai deviasi antara therapy plan dan infus aktual, kemudian menghasilkan payload koreksi yang mengikuti kontrak RAHO_THERAPY_DEVIATION_CORRECTION schemaVersion 1.0.

ATURAN KERAS:
1. Jangan memberikan keputusan atau rekomendasi klinis baru.
2. Jangan menebak nilai yang tidak ada. Gunakan null pada objek analisis dan tandai sebagai validation.errors.
3. Jangan mengubah nilai infus aktual agar sama dengan plan. Susun correctedTherapyPlan berdasarkan infus aktual yang sudah diverifikasi.
4. Koreksi hanya boleh untuk sesi aktif, belum completed, dan belum memiliki infus aktual tersimpan.
5. Jangan meminta atau membuat sessionId, memberId, branchId, userId, atau ID internal lain. Tanyakan nama lengkap member, ulangi nama tersebut, dan minta pengguna memastikan ejaan, urutan nama, serta gelarnya benar. Jika sessionCode/memberNo tidak diketahui, gunakan nama yang sudah dikonfirmasi. Importer akan menampilkan kandidat jika nama tidak unik dan me-resolve seluruh ID secara otomatis setelah pengguna memilih data yang benar.
6. Role yang diizinkan untuk endpoint koreksi sesi hanya SUPER_ADMIN, ADMIN_MANAGER, DOCTOR, atau NURSE. ADMIN_MANAGER dengan MEMBER_VIEW_ONLY tidak diizinkan.
7. Hanya salah satu dari ifa250 atau ifa500 yang boleh lebih besar dari nol.
8. Semua dosis harus berupa angka >= 0. Jangan mengubah satuan tanpa bukti konversi yang eksplisit.
9. Untuk IFA 250, therapyPlan.no adalah total NO termasuk NO bawaan IFA, sedangkan actualInfusion.no adalah NO tambahan di luar IFA. Gunakan rumus:
   correctedTherapyPlan.no = actualInfusion.no + (actualInfusion.ifa250 x noPerIfa250Bottle).
   Gunakan noPerIfa250Bottle dari ifaSubstances. Jika tidak tersedia, gunakan default ERP 2.5 ml dan tulis warning.
10. Pertahankan semua field therapy plan yang tidak dikoreksi sesuai data plan asli. Jangan mengosongkan field lain secara tidak sengaja.
11. Jika sesi completed, infusion sudah tersimpan, referensi tidak cocok, role tidak berwenang, data klinis ambigu, atau approval belum lengkap untuk COMMIT: set importReady=false dan erpRequests=[].
12. Selalu mulai dengan importMode=VALIDATE_ONLY kecuali data sumber secara eksplisit meminta COMMIT dan menyertakan approval manusia lengkap.
13. Saat VALIDATE_ONLY dan seluruh data selain approval valid, gunakan decision=READY_FOR_REVIEW, importReady=false, dan erpRequests=[].
14. Saat COMMIT dan semua validasi serta approval terpenuhi, gunakan decision=READY_FOR_IMPORT, importReady=true, lalu buat dua erpRequests secara berurutan:
    a. PUT /treatment-sessions/{{resolvedSessionId}}/therapy-plan-set
    b. POST /treatment-sessions/{{resolvedSessionId}}/infusion
15. Pada body API, hilangkan field opsional yang tidak digunakan. Jangan kirim string kosong, NaN, undefined, atau placeholder selain {{resolvedSessionId}} yang khusus diganti importer.
16. Jika OUTPUT DIMINTA=MARKDOWN, hasilkan heading tepat "### RAHO_AI_IMPORT_PAYLOAD" dan tepat satu blok kode JSON valid. Jangan menulis penjelasan lain sebelum atau sesudah blok JSON.
17. Jika OUTPUT DIMINTA=EXCEL, hasilkan file .xlsx dengan sheet Ringkasan, Plan_vs_Aktual, Validasi, Catatan_Manual, dan Import_Payload. Sel Import_Payload!A1 harus berisi RAHO_AI_IMPORT_PAYLOAD_JSON dan A2 harus berisi JSON valid yang sama dengan kontrak Markdown. Jangan menambahkan ID internal sebagai kolom input.

Untuk setiap perbedaan, isi:
- field
- unit
- planned
- actual
- delta = actual - planned

Lakukan pemeriksaan berikut dan isi semuanya sebagai boolean:
- memberNameConfirmed
- lookupKeysPresent
- referencesUniquelyResolved
- sessionActive
- infusionNotYetStored
- roleAuthorized
- oneIfaTypeOnly
- doseValuesNonNegative
- planMatchesActual
- noFormulaValid
- clinicalApprovalPresent

DATA SUMBER:
<<<
TEMPEL DATA SUMBER DI SINI
>>>

OUTPUT DIMINTA:
MARKDOWN
```

## 9. Prompt Verifikasi Kedua

Gunakan prompt ini pada AI/verifikator terpisah sebelum import `COMMIT`.

```text
Audit payload RAHO_THERAPY_DEVIATION_CORRECTION berikut tanpa mengubah data sumber.

Periksa:
1. JSON valid dan mengikuti schemaVersion 1.0.
2. Nama lengkap member telah diulang dan dikonfirmasi benar oleh pengguna; tidak ada ID internal yang diminta.
3. Lookup ERP berdasarkan nama/informasi opsional menemukan tepat satu sesi, atau pengguna telah memilih satu kandidat yang benar.
4. Sesi aktif, belum completed, dan belum memiliki InfusionExecution.
5. Pelaksana memiliki role yang diizinkan dan bukan MEMBER_VIEW_ONLY.
6. Hanya satu tipe IFA digunakan.
7. Semua dosis non-negatif dan satuannya jelas.
8. Setiap difference dihitung benar.
9. Corrected therapy plan sama dengan actual infusion, termasuk rumus khusus NO dalam IFA 250.
10. Field plan yang tidak berubah tetap dipertahankan.
11. Approval manusia lengkap untuk mode COMMIT.
12. erpRequests berurutan: koreksi plan lebih dahulu, lalu pembuatan infus aktual.
13. Body API tidak mengandung null yang tidak diterima, placeholder selain {{resolvedSessionId}}, string kosong, NaN, atau undefined.

Jika ada satu saja kegagalan, hasilkan payload dengan importReady=false, erpRequests=[], dan jelaskan semua masalah di validation.errors. Jangan memperbaiki atau menebak data klinis sendiri.

PAYLOAD YANG DIAUDIT:
<<<
TEMPEL RAHO_AI_IMPORT_PAYLOAD DI SINI
>>>
```

## 10. Alur Import yang Direkomendasikan

```text
Catatan sumber
  -> AI normalisasi (VALIDATE_ONLY)
  -> AI memastikan nama lengkap member benar
  -> Importer mencari kandidat berdasarkan nama yang dikonfirmasi
  -> Jika kandidat lebih dari satu, pengguna memilih data yang benar
  -> Importer memastikan hasil akhir tepat satu sesi dan mengisi ID otomatis
  -> Validasi status langsung ke ERP
  -> Review serta approval petugas klinis
  -> AI/verifikator kedua
  -> Importer menjalankan PUT therapy plan
  -> Importer membaca ulang therapy plan terbaru
  -> Importer memastikan plan sesuai aktual
  -> Importer menjalankan POST infus aktual
  -> Simpan requestId, response ERP, user approval, dan audit trail
```

Karena dua endpoint dijalankan berurutan dan belum merupakan satu transaksi API gabungan, importer harus berhenti jika koreksi therapy plan gagal. Importer juga harus melakukan pembacaan ulang sebelum membuat infus aktual untuk mencegah perubahan data bersamaan oleh pengguna lain.

## 11. Pilihan Keluaran Excel

Pengguna dapat mengganti `OUTPUT DIMINTA` pada prompt menjadi `EXCEL`. AI kemudian menghasilkan file `.xlsx` dengan struktur berikut:

| Sheet | Isi wajib |
|---|---|
| `Ringkasan` | Lookup key, member, cabang, tanggal terapi, infus ke, status sesi, pelaksana, dan approval |
| `Plan_vs_Aktual` | Komponen, plan awal, aktual, plan koreksi, delta, satuan, status, dan catatan |
| `Validasi` | Nama pemeriksaan, hasil `PASS/FAIL/PENDING`, tingkat masalah, dan tindakan |
| `Catatan_Manual` | Sumber catatan, nomor referensi, pemberi informasi, waktu pencatatan, dan catatan |
| `Import_Payload` | A1=`RAHO_AI_IMPORT_PAYLOAD_JSON`; A2=JSON valid sesuai schema versi ini |

Aturan Excel:

- tidak ada kolom input untuk `sessionId`, `memberId`, `branchId`, `userId`, atau ID internal lain;
- lookup dapat menggunakan nama lengkap member yang sudah dikonfirmasi; `sessionCode`, `memberNo`, `branchCode`, `treatmentDate`, dan `infusKe` hanya informasi tambahan jika diketahui;
- jika nama menghasilkan beberapa kandidat, importer wajib meminta pengguna memilih satu berdasarkan cabang, tanggal terapi, dan infus ke;
- dosis disimpan sebagai angka dan satuan berada di kolom terpisah;
- tanggal berformat `YYYY-MM-DD` dan waktu `HH:mm`;
- `delta` menggunakan formula `Aktual - Plan Awal`;
- data sumber tidak boleh ditimpa oleh nilai koreksi;
- JSON pada `Import_Payload!A2` adalah sumber bagi importer dan harus sama dengan tampilan sheet lain;
- importer tetap harus memvalidasi dan me-resolve semua ID sebelum melakukan perubahan ERP.

Prompt ringkas untuk meminta hasil Excel:

```text
Gunakan kontrak RAHO_THERAPY_DEVIATION_CORRECTION dan buat hasil akhir input manual sebagai file Excel .xlsx. Gunakan lima sheet wajib: Ringkasan, Plan_vs_Aktual, Validasi, Catatan_Manual, dan Import_Payload. Jangan meminta screenshot, foto, lampiran, atau ID internal ERP. Sel Import_Payload!A2 harus berisi JSON valid untuk mode VALIDATE_ONLY.
```

## 12. Keluaran Audit Importer

Importer sebaiknya menyimpan hasil berikut untuk setiap permintaan:

```json
{
  "requestId": "AI-TPC-YYYYMMDD-UNIQUE",
  "startedAt": "YYYY-MM-DDTHH:mm:ss.sssZ",
  "finishedAt": "YYYY-MM-DDTHH:mm:ss.sssZ",
  "status": "VALIDATED_OR_IMPORTED_OR_FAILED",
  "sessionId": "SESSION_ID",
  "therapyPlanResponseId": null,
  "infusionExecutionId": null,
  "performedByUserId": "USER_ID",
  "approvedByUserId": "APPROVER_USER_ID",
  "errors": []
}
```

Audit tersebut tidak menggantikan audit log internal ERP, tetapi menjadi bukti bahwa data berasal dari proses AI yang telah ditinjau manusia.

Semua field ID dalam keluaran audit dibuat otomatis oleh ERP/importer setelah lookup atau transaksi berhasil. Field tersebut bukan bagian yang harus diisi Nakes, Admin Layanan, MSO, atau AI.
