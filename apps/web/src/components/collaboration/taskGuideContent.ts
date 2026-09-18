export type TaskGuideTopic = {
  id: string;
  label: string;
  title: string;
  introduction: string;
  steps: string[];
  reference?: { heading: string; rows: { name: string; explanation: string }[] };
  example?: string;
  reminder: string;
};

export const taskGuideTopics: TaskGuideTopic[] = [
  {
    id: 'start', label: 'Mulai di sini', title: '1. Kenali fungsi Tim & Tugas',
    introduction: 'Fitur ini adalah buku catatan pekerjaan bersama. Anda dapat melihat pekerjaan yang harus dilakukan, siapa yang mengerjakan, kapan batas waktunya, dan apakah hasilnya sudah diperiksa. Membaca panduan ini tidak membuat, mengubah, atau menghapus tugas.',
    steps: [
      'Masuk ke ERP menggunakan akun karyawan Anda. Akun member/pelanggan tidak menggunakan fitur ini.',
      'Di menu samping, cari Ekstra. Buka Tim & Tugas, lalu pilih Dashboard Monitoring. Di HP, buka menu samping terlebih dahulu jika menunya tersembunyi.',
      'Cari kotak Tim aktif. Klik atau ketuk tanda panah pada kotak itu, lalu pilih nama tim tempat Anda bekerja. Ini adalah pilihan tim, bukan tombol untuk memulai tugas.',
      'Lihat tulisan OWNER, LEADER, atau STAFF di samping nama tim. Itu adalah peran Anda di tim yang sedang dipilih, bukan jabatan akun ERP Anda.',
      'Jika Anda sudah masuk tim, gunakan tim itu. Tidak perlu membuat tim baru setiap hari.',
      'Jika belum ada tim dan Anda hanya akan mengerjakan tugas, minta pemilik tim menambahkan akun Anda. Jika Anda memang akan mengatur tim baru, baca bagian Buat tim & anggota.',
    ],
    reference: { heading: 'Tiga halaman yang dipakai', rows: [
      { name: 'Dashboard Monitoring', explanation: 'Melihat ringkasan jumlah pekerjaan, fokus tugas, dan aktivitas tim.' },
      { name: 'Tugas & Subtask', explanation: 'Mencari tugas, membuka detail, mengubah status, dan membaca atau menulis diskusi.' },
      { name: 'Tim Saya', explanation: 'Melihat anggota dan peran mereka. Owner mengatur tim dan anggota dari halaman ini.' },
    ] },
    example: 'Contoh: Siti diminta menyiapkan laporan stok. Leader membuat tugas dan memilih Siti sebagai Assignee. Siti membuka tugas, mulai bekerja, lalu mengirim hasil untuk diperiksa. Leader menyetujui hasilnya sehingga status menjadi Selesai.',
    reminder: 'Untuk pemula, cukup ingat: pilih tim → buka tugas → mulai kerjakan → kirim untuk review. Tugas belum berstatus Selesai sampai Owner/Leader menyetujuinya.',
  },
  {
    id: 'dashboard', label: 'Arti angka dashboard', title: '2. Baca dashboard tanpa salah mengartikan angka',
    introduction: 'Dashboard adalah ringkasan, bukan formulir laporan harian. Angkanya mengikuti tim aktif dan tugas yang boleh Anda lihat. Saat ini tidak ada filter khusus tanggal hari ini di dashboard ini.',
    steps: [
      'Pastikan nama pada Tim aktif sudah benar sebelum membaca angka.',
      'Lihat kartu Terlambat terlebih dahulu. Jika angkanya lebih dari nol, ada pekerjaan yang melewati batas waktu dan belum selesai atau dibatalkan.',
      'Lihat Menunggu review. Ini berarti pekerjaan sudah dikirim oleh pelaksana, tetapi masih menunggu pemeriksaan Owner/Leader.',
      'Pada Fokus terbaru, klik judul tugas untuk membuka detail. Bagian ini hanya menampilkan sebagian daftar; gunakan Tugas & Subtask untuk melihat daftar yang lebih lengkap.',
      'Pada Aktivitas tim, baca siapa yang melakukan perubahan terbaru. Ini adalah catatan aktivitas, bukan percakapan. Percakapan ada pada Diskusi di detail tugas.',
      'Jika rekan baru mengubah data tetapi tampilan Anda belum berubah, muat ulang halaman dengan tombol refresh browser. Jangan menganggap dashboard selalu memperbarui diri secara langsung.',
    ],
    reference: { heading: 'Arti lima kartu angka', rows: [
      { name: 'Total pekerjaan', explanation: 'Jumlah tugas utama dan subtask yang terlihat, termasuk yang selesai atau dibatalkan. Satu tugas utama dengan dua subtask dapat dihitung sebagai tiga pekerjaan.' },
      { name: 'Sedang dikerjakan', explanation: 'Pekerjaan berstatus Dikerjakan. Status Belum dimulai, Perlu revisi, dan Menunggu review tidak masuk angka ini.' },
      { name: 'Menunggu review', explanation: 'Pekerjaan yang sudah dikirim untuk diperiksa, tetapi belum disetujui selesai.' },
      { name: 'Selesai', explanation: 'Pekerjaan yang sudah disetujui dan berstatus Selesai, bukan sekadar sudah dikirim untuk review.' },
      { name: 'Terlambat', explanation: 'Pekerjaan yang tenggat tanggal DAN jamnya sudah lewat, selain yang Selesai atau Dibatalkan. Ini dapat mencakup tugas dari hari-hari sebelumnya.' },
    ] },
    example: 'Contoh: Terlambat = 2 berarti ada dua pekerjaan yang melewati tenggat. Dua pekerjaan itu juga bisa berstatus Dikerjakan atau Menunggu review. Jadi, jangan menjumlahkan kelima kartu untuk mencari total.',
    reminder: 'Angka ini BUKAN otomatis jumlah tugas hari ini atau jumlah tugas pribadi Anda. Kartu angka bukan tombol filter. Untuk mencari pekerjaan tertentu, buka Tugas & Subtask.',
  },
  {
    id: 'daily', label: 'Rutinitas anggota', title: '3. Langkah harian untuk orang yang mengerjakan tugas',
    introduction: 'Ikuti urutan ini jika Anda ditunjuk sebagai pelaksana tugas. Assignee berarti orang yang diberi tugas. Melihat tugas saja belum tentu berarti Anda boleh mengubah statusnya.',
    steps: [
      'Saat mulai kerja, buka Dashboard Monitoring dan pilih Tim aktif. Perhatikan pekerjaan terlambat dan pekerjaan yang menunggu pemeriksaan.',
      'Buka menu Tugas & Subtask. Klik kotak Cari tugas..., lalu ketik sebagian judul pekerjaan, misalnya laporan stok. Untuk melihat semua lagi, hapus tulisan pencariannya.',
      'Pada pilihan status, pilih Belum dimulai untuk mencari pekerjaan yang belum dikerjakan, atau Perlu revisi untuk pekerjaan yang harus diperbaiki. Kembalikan ke Semua status jika tugas tidak ditemukan.',
      'Klik judul atau bagian tengah kartu tugas. Panel detail terbuka. Baca Deskripsi, Tenggat, dan Assignee. Pastikan nama Anda tercantum sebagai pelaksana.',
      'Jika status Belum dimulai dan Anda benar-benar akan mulai bekerja, klik Mulai kerjakan. Setelah berhasil, status menjadi Dikerjakan. Membuka detail saja tidak mengubah status.',
      'Kerjakan pekerjaan yang diminta. Jika ada kendala, tulis penjelasan pada Diskusi dan klik ikon kirim. Komentar tidak otomatis mengubah status tugas.',
      'Setelah pekerjaan siap diperiksa, klik Kirim untuk review. Status menjadi Menunggu review. Ini belum berarti tugas sudah Selesai.',
      'Jika Leader meminta revisi, status menjadi Perlu revisi. Baca alasan revisi pada catatan aktivitas yang tersedia dan diskusi tugas; jika alasannya belum jelas, tanyakan kepada Leader. Perbaiki hasilnya, lalu klik Kirim untuk review lagi.',
      'Setelah Owner/Leader menyetujui, status menjadi Selesai. Di akhir hari, periksa lagi tugas Anda dan beri kabar kendala yang belum terselesaikan.',
    ],
    example: 'Contoh: tugas Laporan stok hari ini memiliki tenggat pukul 16.00. Anda klik Mulai kerjakan pukul 09.00, menulis ringkasan hasil pada Diskusi pukul 15.00, lalu klik Kirim untuk review. Setelah Leader menyetujui, barulah tugas Selesai.',
    reminder: 'Tenggat memuat jam, walaupun beberapa kartu hanya menampilkan tanggal. Jika tombol Mulai kerjakan atau Kirim untuk review tidak ada, periksa status dan apakah nama Anda ada di Assignee. Minta bantuan Leader; jangan membuat tugas duplikat.',
  },
  {
    id: 'team', label: 'Buat tim & anggota', title: '4. Menyiapkan tim — untuk pemilik tim',
    introduction: 'Tim adalah kelompok kerja. Buat tim sekali saat diperlukan, lalu gunakan untuk pekerjaan berikutnya. Orang yang membuat tim otomatis menjadi Owner dan Primary Leader awal.',
    steps: [
      'Klik Buat Tim. Isi Nama tim minimal tiga karakter, misalnya Operasional Jakarta. Isi Deskripsi jika perlu, misalnya Tim pemeriksaan stok dan laporan cabang.',
      'Pada Visibilitas tugas, pilih Semua anggota tim jika anggota perlu saling melihat pekerjaan. Pilih Hanya assignee dan leader jika akses tugas ingin dibatasi sesuai penugasan. Owner/Leader tetap dapat memantau sesuai aksesnya.',
      'Klik Buat Tim pada formulir. Tunggu pesan berhasil dan pastikan tim baru terpilih pada Tim aktif. Tombol Batal hanya menutup formulir, bukan menyimpan.',
      'Buka Tim Saya. Pastikan tim aktif benar, lalu klik Tambah Anggota. Hanya Owner tim yang melihat tombol pengelolaan anggota.',
      'Pilih akun orang yang akan bergabung. Pada Role dalam tim, pilih Staff untuk pelaksana atau Leader untuk pembagi dan pemeriksa tugas. Klik Tambahkan. Ulangi untuk anggota lainnya.',
      'Jika perlu, klik Jadikan Primary Leader pada anggota Owner/Leader. Primary Leader adalah pemimpin utama yang ditampilkan untuk tim; mengubahnya tidak otomatis mengubah peran anggota lain.',
      'Untuk memperbarui informasi tim, klik Edit Tim, ubah data, lalu klik Simpan Perubahan. Tidak perlu membuat tim baru untuk mengganti namanya.',
    ],
    reference: { heading: 'Peran di dalam tim', rows: [
      { name: 'Owner', explanation: 'Pemilik tim. Mengatur tim, anggota, peran, dan Primary Leader; juga membuat, mengedit, menghapus, dan memeriksa tugas.' },
      { name: 'Leader', explanation: 'Membuat dan membagikan tugas, mengedit atau menghapus tugas, serta memeriksa hasil. Tidak mengatur anggota seperti Owner.' },
      { name: 'Staff', explanation: 'Melihat pekerjaan sesuai akses, berdiskusi, dan menjalankan alur status pada pekerjaan yang ditugaskan kepadanya.' },
    ] },
    example: 'Contoh: Rina membuat tim dan menjadi Owner. Ia menambahkan Budi sebagai Leader dan Siti sebagai Staff. Budi membagikan tugas kepada Siti, lalu memeriksa hasilnya. Rina mengatur keanggotaan tim.',
    reminder: 'Peran tim berbeda dari jabatan akun ERP. Seorang admin ERP tidak otomatis menjadi Owner di semua tim. Jika nama seseorang tidak tersedia di pilihan akun, pastikan akunnya aktif, bukan akun member, dan belum menjadi anggota tim ini.',
  },
  {
    id: 'create', label: 'Buat tugas baru', title: '5. Membagikan tugas — untuk Owner atau Leader',
    introduction: 'Tuliskan pekerjaan dengan jelas agar pelaksana tahu apa yang harus dilakukan dan hasil apa yang Anda harapkan. Tombol Tugas Baru hanya tersedia untuk Owner/Leader pada tim aktif.',
    steps: [
      'Pilih Tim aktif yang benar. Klik Tugas Baru. Jangan hanya melihat nama tim lain di menu; pastikan pilihan timnya sudah berubah.',
      'Isi Judul minimal tiga karakter. Gunakan nama pekerjaan yang spesifik, misalnya Periksa stok Air Nano cabang Jakarta, bukan hanya Cek.',
      'Isi Deskripsi dengan cara kerja dan hasil yang diminta. Contoh: Hitung stok fisik, cocokkan dengan ERP, dan tulis ringkasan selisih di Diskusi. Deskripsi boleh kosong, tetapi sebaiknya diisi untuk menghindari salah paham.',
      'Pilih Prioritas: Rendah, Sedang, Tinggi, atau Mendesak. Prioritas menunjukkan tingkat perhatian; tidak otomatis memulai tugas atau mengubah tenggat.',
      'Isi Tenggat dengan tanggal DAN jam batas waktu. Periksa kembali keduanya sebelum menyimpan. Jika dikosongkan, tugas bertuliskan Tanpa tenggat dan tidak terhitung terlambat berdasarkan waktu.',
      'Pada Assignee, centang nama pelaksana. Boleh memilih lebih dari satu anggota aktif tim. Tugas tanpa pelaksana boleh dibuat, tetapi tidak ada orang yang bisa menjalankan tombol kerja sampai diberi assignment.',
      'Klik Buat Tugas. Tunggu pesan berhasil. Tugas baru dimulai dengan status Belum dimulai. Jika ada pesan error, baca pesannya dan perbaiki isian; jangan langsung menekan tombol berkali-kali.',
      'Buka Tugas & Subtask dan klik judul tugas untuk memastikan judul, pelaksana, dan tenggatnya sesuai. Jika salah, gunakan ikon pensil untuk mengedit.',
    ],
    example: 'Contoh isian: Judul = Laporan stok Air Nano; Deskripsi = Cocokkan stok fisik dengan ERP dan tulis selisih; Prioritas = Sedang; Tenggat = tanggal kerja ini pukul 16.00; Assignee = Siti.',
    reminder: 'Simpan tugas bukan berarti tugas selesai. Jangan memakai Hapus atau Batalkan untuk menandai keberhasilan pekerjaan. Alur normal tetap: Belum dimulai → Dikerjakan → Menunggu review → Selesai.',
  },
  {
    id: 'review', label: 'Periksa hasil tugas', title: '6. Memeriksa hasil — untuk Owner atau Leader',
    introduction: 'Review berarti pemeriksaan hasil kerja. Pelaksana mengirim tugas untuk review; pemimpin memutuskan apakah hasilnya diterima atau perlu diperbaiki.',
    steps: [
      'Pilih tim, lalu buka Tugas & Subtask. Pada filter status, pilih Menunggu review.',
      'Klik judul tugas. Baca deskripsi pekerjaan dan diskusi, lalu periksa hasil pekerjaan melalui proses kerja tim Anda. Status Menunggu review saja bukan bukti bahwa hasilnya sudah benar.',
      'Jika hasilnya benar dan semua subtask wajib sudah memenuhi syarat, klik Setujui & selesai. Setelah berhasil, status menjadi Selesai.',
      'Jika perlu perbaikan, klik Minta revisi. Form alasan muncul. Tulis apa yang harus diperbaiki secara spesifik, minimal tiga karakter, lalu klik Simpan status.',
      'Sampaikan alasan revisi juga lewat Diskusi agar pelaksana mudah membacanya. Contoh: Tolong lengkapi jumlah botol untuk rak B dan jelaskan selisih dengan ERP.',
      'Tunggu pelaksana memperbaiki hasil dan mengirim untuk review lagi. Jangan menganggap Perlu revisi sebagai Selesai.',
      'Jika pekerjaan tidak jadi dilakukan, gunakan Batalkan, tulis alasan, lalu klik Simpan status. Untuk tugas utama, pembatalan dapat ikut membatalkan subtask yang masih berjalan; periksa dampaknya sebelum melanjutkan.',
    ],
    example: 'Contoh: laporan Siti sudah lengkap, tetapi subtask wajib Hitung rak B belum selesai. Selesaikan atau tinjau subtask itu dahulu. Jangan menghapus subtask hanya agar tugas utama bisa lolos pemeriksaan.',
    reminder: 'Review tidak selalu berhenti menghitung keterlambatan: tugas Menunggu review tetap bisa Terlambat jika tenggat lewat sebelum disetujui. Setujui berdasarkan hasil, bukan hanya untuk menurunkan angka Terlambat.',
  },
  {
    id: 'subtask', label: 'Pakai subtask', title: '7. Memecah pekerjaan besar menjadi langkah kecil',
    introduction: 'Subtask adalah bagian kecil dari satu tugas utama (parent task). Gunakan jika pekerjaan memang terdiri dari beberapa bagian. Tugas sederhana tidak harus memiliki subtask.',
    steps: [
      'Buka Tugas & Subtask. Cari kartu tugas utama yang ingin dipecah. Owner/Leader klik ikon + pada kartu itu, bukan tombol Tugas Baru di atas halaman.',
      'Pada formulir Tambah subtask, isi judul, deskripsi, prioritas, tenggat, dan centang pelaksana subtask. Pelaksana subtask tidak harus sama dengan pelaksana tugas utama.',
      'Centang Subtask wajib diselesaikan sebelum parent task jika bagian itu menjadi syarat penyelesaian tugas utama. Hilangkan centang jika bagian itu tidak wajib.',
      'Klik Tambah Subtask. Pada daftar tugas, klik tanda panah di sebelah kiri kartu tugas utama untuk membuka daftar subtask. Klik panah lagi untuk menutup daftar, bukan menghapusnya.',
      'Klik judul subtask untuk membuka detailnya. Pelaksana menjalankan Mulai kerjakan dan Kirim untuk review. Owner/Leader memeriksa hasil seperti tugas biasa.',
      'Perhatikan angka progres subtask wajib. Angka 1/3 berarti satu dari tiga subtask wajib berstatus Selesai; ini bukan jumlah jam kerja.',
    ],
    example: 'Contoh: tugas utama Laporan stok memiliki tiga subtask wajib: Hitung rak A, Hitung rak B, dan Cocokkan dengan ERP. Jika dua sudah Selesai, progresnya 2/3.',
    reminder: 'Subtask hanya satu tingkat, maksimal 50 subtask aktif per tugas utama. Tenggat subtask tidak boleh melewati tenggat tugas utama yang ditentukan. Subtask wajib yang masih berjalan menghalangi penyelesaian tugas utama. Yang Dibatalkan tidak lagi menghalangi, tetapi bukan berarti sudah Selesai pada angka progres.',
  },
  {
    id: 'discussion', label: 'Tulis kabar & diskusi', title: '8. Memberi kabar lewat Diskusi',
    introduction: 'Diskusi adalah tempat menulis pertanyaan, kendala, dan ringkasan hasil kerja pada tugas yang terkait. Ini membantu tim mengerti perkembangan tanpa menebak-nebak dari status saja.',
    steps: [
      'Klik judul tugas atau subtask untuk membuka detail. Cari bagian Diskusi; gulir ke bawah jika belum terlihat.',
      'Klik kotak Tulis komentar atau update... dan ketik kabar yang jelas. Contoh: Rak A selesai dihitung, rak B belum karena ruangan masih digunakan.',
      'Klik ikon kirim di samping kotak tulisan. Mengetik saja belum menyimpan komentar. Pastikan komentar muncul pada daftar diskusi.',
      'Untuk memperbaiki komentar Anda, klik Edit di bawah komentar, ubah tulisan, lalu klik Simpan. Batal menutup pengeditan tanpa menyimpan.',
      'Untuk menghapus komentar, klik Hapus di bawah komentar dan baca konfirmasinya. Pemilik komentar atau Owner/Leader dapat mengelola komentar sesuai akses.',
    ],
    example: 'Contoh kabar yang membantu: Stok fisik rak A = 24 botol, ERP = 26 botol. Selisih 2 botol masih saya periksa. Contoh yang kurang membantu: Belum.',
    reminder: 'Komentar tidak mengganti tombol Mulai kerjakan atau Kirim untuk review. Saat ini fitur ini belum menyediakan unggah lampiran; jangan mencari tombol unggah file yang belum ada. Gunakan proses berbagi hasil yang disepakati tim.',
  },
  {
    id: 'edit', label: 'Edit & hapus dengan aman', title: '9. Memperbaiki data tanpa salah menghapus',
    introduction: 'Gunakan Edit jika isi data salah. Gunakan Batalkan jika pekerjaan tidak jadi dilakukan. Gunakan Hapus hanya jika memang ingin mengeluarkan data dari daftar aktif.',
    steps: [
      'Untuk mengubah tugas/subtask, buka detailnya. Owner/Leader klik ikon pensil di kanan atas, ubah isian, lalu klik Simpan Perubahan. Batal tidak menyimpan.',
      'Jika ingin mengganti pelaksana, lakukan dari form edit pada pilihan Assignee. Centang nama baru dan hilangkan centang nama yang tidak lagi ditugaskan.',
      'Untuk menghapus tugas/subtask, Owner/Leader klik ikon tempat sampah di kanan atas detail. Baca nama dan nomor tugas pada konfirmasi. Klik Kembali jika ragu, atau Konfirmasi jika yakin.',
      'Menghapus tugas utama menyembunyikan tugas utama dan subtask-nya dari daftar aktif. Jangan menghapus tugas utama jika hanya satu subtask yang keliru.',
      'Untuk memperbarui tim, Owner membuka Tim Saya lalu klik Edit Tim. Untuk mengarsipkan tim, klik Hapus Tim dan baca konfirmasi. Tim itu tidak lagi muncul pada daftar aktif.',
      'Untuk mengeluarkan anggota, Owner membuka Tim Saya, klik Keluarkan pada baris orang yang benar, lalu konfirmasi. Penugasan aktif orang itu dilepas, jadi periksa tugas yang perlu dibagikan lagi.',
    ],
    example: 'Contoh: judul tugas salah ketik → gunakan pensil. Pekerjaan tidak diperlukan lagi → Batalkan dengan alasan. Tugas dibuat dua kali → periksa dulu, lalu Hapus tugas yang duplikat.',
    reminder: 'Hapus bukan cara menandai tugas Selesai. Histori tetap disimpan; tidak ada tombol pemulihan otomatis dalam UI ini. Selalu periksa judul, nomor, dan tim sebelum mengonfirmasi penghapusan.',
  },
  {
    id: 'help', label: 'Kalau bingung / bermasalah', title: '10. Cek ini sebelum meminta bantuan',
    introduction: 'Tombol yang tidak terlihat atau daftar yang kosong tidak selalu berarti aplikasi rusak. Sering kali penyebabnya adalah tim, filter, peran, atau penugasan yang berbeda.',
    steps: [
      'Jika belum ada tim: minta Owner menambahkan akun Anda. Jangan membuat tim sendiri hanya agar tugas dari tim lain muncul.',
      'Jika tugas tidak terlihat: cek Tim aktif, hapus teks Cari tugas..., pilih Semua status, lalu muat ulang halaman. Jika tetap tidak ada, minta Leader memeriksa assignment dan visibilitas tugas.',
      'Jika Tugas Baru, pensil, atau tempat sampah tidak terlihat: cek peran Anda pada tim aktif. Tombol pengelolaan tugas hanya untuk Owner/Leader.',
      'Jika Tambah Anggota atau Edit Tim tidak terlihat: hanya Owner yang dapat mengatur anggota dan profil tim. Leader bukan Owner.',
      'Jika Mulai kerjakan atau Kirim untuk review tidak terlihat: buka detail tugas yang benar, lihat status, dan pastikan nama Anda tercantum pada Assignee. Tugas yang sudah dikirim, selesai, atau dibatalkan tidak menampilkan tombol mulai.',
      'Jika Setujui & selesai ditolak: periksa subtask wajib yang belum selesai. Jika data berubah bersamaan atau muncul pesan konflik versi, tutup detail dan buka lagi untuk mengambil data terbaru, lalu periksa sebelum mengulangi tindakan.',
      'Jika ada pesan gagal: baca pesannya. Jika soal isian, perbaiki data; jika soal akses, hubungi Owner/Leader; jika soal koneksi, cek internet dan coba muat ulang. Jangan langsung menganggap data tidak tersimpan—periksa daftar/detail dulu agar tidak membuat duplikat.',
      'Jika tetap bermasalah, catat nama tim, judul/nomor tugas, tindakan yang dilakukan, dan pesan error. Kirim screenshot yang seperlunya kepada admin, tanpa membagikan password atau data rahasia.',
    ],
    reference: { heading: 'Kamus singkat', rows: [
      { name: 'Task / Tugas', explanation: 'Pekerjaan yang perlu dilakukan.' },
      { name: 'Assignee', explanation: 'Orang yang ditunjuk untuk mengerjakan tugas.' },
      { name: 'Tenggat / Deadline', explanation: 'Tanggal dan jam batas penyelesaian.' },
      { name: 'Review', explanation: 'Pemeriksaan hasil kerja oleh Owner/Leader.' },
      { name: 'Revisi', explanation: 'Perbaikan hasil yang diminta pemeriksa.' },
      { name: 'Dropdown', explanation: 'Kotak pilihan dengan tanda panah; klik untuk memilih salah satu isi daftar.' },
    ] },
    example: 'Contoh laporan ke admin: Tim Operasional Jakarta, tugas #12 Laporan stok, saya klik Kirim untuk review, lalu muncul pesan konflik versi. Ini lebih mudah diperiksa daripada hanya mengatakan error.',
    reminder: 'Panduan ini mengikuti tombol yang tersedia sekarang. Tidak ada filter hari ini, pengulangan tugas otomatis, laporan periode, atau lampiran pada workspace ini. Untuk pemantauan harian, periksa tugas dan tenggatnya setiap hari.',
  },
];
