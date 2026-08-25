# UAT Beban Pengisian Sesi Terapi

## Tujuan

Memastikan Dokter, Nakes, dan Admin Layanan dapat menjalankan tanggung jawabnya
tanpa kebingungan, kehilangan draft, atau bantuan operator lain. Audit dilakukan
pada tenant demo/staging menggunakan data dummy atau data yang sudah disamarkan.

## Target awal

- minimal 5–10 sesi nyata per peran dan jenis perangkat;
- pengisian setelah tindakan selesai maksimal 2–3 menit;
- pengguna dapat menemukan langkah berikutnya tanpa arahan fasilitator;
- tidak ada kehilangan isian setelah refresh atau koneksi singkat terputus;
- completion tidak menghasilkan posting stok/finance ganda;
- error validasi dan retry completion ditinjau, bukan sekadar dihitung.

## Pembagian tanggung jawab

| Peran | Tanggung jawab utama | Batasan |
|---|---|---|
| Admin Layanan | Membuat/menjadwalkan sesi, memastikan member, paket, cabang, dan tim benar | Isian klinis ditampilkan read-only |
| Dokter | Diagnosis, review/penetapan therapy plan, dan evaluasi SOAP | Tidak mencatat realisasi material rutin |
| Nakes | Vital sebelum/sesudah, infus aktual, material, foto, keluhan operasional | Tidak mengubah evaluasi SOAP dokter |
| Manager | Pengawasan, koreksi resmi, dan penanganan exception | Perubahan sesi posted tetap melalui reversal dan alasan |

## Skenario UAT

1. Admin Layanan membuat sesi dengan member, paket, cabang, Dokter, dan Nakes
   yang benar, lalu membuka detail sesi.
2. Verifikasi Admin Layanan melihat pemilik setiap langkah dan tidak dapat
   mengubah isian klinis.
3. Dokter mengisi diagnosis dan meninjau therapy plan.
4. Nakes membuka sesi di ponsel/tablet dan mengisi vital sebelum.
5. Buka langkah infus aktual. Pastikan nilai awal berasal dari therapy plan,
   lalu verifikasi atau sesuaikan sesuai realisasi.
6. Catat material rekomendasi BOM. Jika berbeda, pilih alasan deviasi dan isi
   catatan ketika alasan **Lainnya** dipilih.
7. Saat mengetik, tunggu indikator **Draft tersimpan**. Refresh halaman dan
   pastikan isian yang belum disubmit kembali muncul.
8. Buka sesi yang sama pada perangkat kedua. Ubah draft dari perangkat pertama,
   lalu pastikan perangkat kedua menerima pesan konflik dan diwajibkan memuat
   ulang.
9. Nakes mengisi vital sesudah dan keluhan operasional. Dokter mengisi evaluasi
   SOAP.
10. Pilih sumber stok, tekan **Selesaikan Sesi**, periksa ringkasan, lalu
    konfirmasi.
11. Simulasikan satu kegagalan completion di staging. Pastikan status sesi tetap
    belum selesai, pesan kegagalan jelas, dan tombol retry tersedia.
12. Setelah berhasil, verifikasi status sesi, mutation stok, HPP, revenue,
    journal, serta audit trail hanya terbentuk sekali.

## Pencatatan observasi manual

Untuk setiap sampel, catat:

| Data | Nilai |
|---|---|
| Peran dan perangkat | Dokter/Nakes/Admin Layanan; ponsel/tablet/desktop |
| Dapat mulai tanpa bantuan | Ya/Tidak |
| Langkah yang membingungkan | Nomor dan nama langkah |
| Bantuan fasilitator | Jumlah dan penyebab |
| Data yang harus diketik ulang | Field dan penyebab |
| Keluhan pengguna | Kutipan singkat tanpa data pasien |
| Hasil | Lulus/Perlu perbaikan |

## Dashboard audit

Super Admin dan Admin Manager membuka:

```text
/sessions/workflow-audit
```

Dashboard menampilkan:

- jumlah sampel pengguna/sesi dan sesi unik;
- rata-rata waktu aktif per peran;
- rata-rata waktu per langkah;
- jumlah error validasi;
- retry completion;
- persentase sampel yang selesai dalam tiga menit.

Waktu tab tersembunyi tidak dihitung. Satu sampel memakai snapshot terbaru per
kombinasi sesi dan pengguna, sehingga autosave berulang tidak menggandakan
angka. Audit tidak menyimpan isi diagnosis, SOAP, atau catatan klinis ke metrik;
isi draft tetap berada pada record sesi dan dihapus setelah completion berhasil.

## Keputusan setelah UAT

- Perbaiki terlebih dahulu tiga langkah dengan waktu tertinggi.
- Jika error validasi yang sama muncul lebih dari dua kali, sederhanakan label,
  batas nilai, atau pesan error pada field tersebut.
- Jika pengguna meminta bantuan pada lebih dari 20% sampel, flow belum layak
  dianggap mandiri.
- Jika target tiga menit belum tercapai, kurangi input manual atau tambah
  pilihan cepat/prefill—jangan hanya menaikkan target waktu.
- Release production hanya setelah regression test, migration rehearsal,
  smoke test image Docker, dan verifikasi atomic completion lulus.
