# Log prediksi

Aturan: satu entri per masalah. Bagian **Sebelum perbaikan** harus di-commit *sebelum* commit
perbaikannya. Bagian **Sesudah perbaikan** diisi setelah pengukuran ulang. Jangan menyunting
bagian "sebelum" setelah hasilnya diketahui; bila prediksi meleset, jelaskan di bagian "sesudah".

## Dasar analisis dan batas bukti

- Sumber metrik performa: `laporan/trace_result/S0.json` sampai `S6.json`.
- Sumber bukti transaksi S3: `HASIL TRACE WEBSITE.docx`, dengan dukungan
  `laporan/trace_result/image6.png` sampai `image8.png`.
- S2 tidak menjadi entri prediksi. Source `public/js/keranjang.js` sudah mengubah tombol menjadi
  `Ditambahkan ✓` dan memanggil `tampilkanToast('Ditambahkan ke keranjang: ...')`; screenshot
  terbaru juga menunjukkan notifikasi tersebut.
- `RunTask`, `Layout`, dan `EventTiming` adalah event raw trace. Nilainya tidak otomatis sama
  dengan TBT, jumlah long task aplikasi, atau INP agregat. Metrik yang tidak tersedia pada JSON
  tidak direka ulang.
- Worktree saat dokumen ini ditulis masih memiliki perubahan source yang belum menjadi commit.
  Dokumen ini harus di-commit terlebih dahulu sesuai aturan tugas, sebelum commit perbaikan kode.

---

## P-01: Input pencarian "sepatu" tersendat dan lambat

**Tiket terkait:** TK-1041 (Skenario S1)  
**Source terkait:** `public/js/pencarian.js`, `public/js/katalog.js`, `public/css/toko.css`
**Tanggal dan hash commit entri ini:** 2026-10-02, diisi saat commit hipotesis

### Sebelum perbaikan

- **Yang teramati di trace (baseline):** `S1.json` merekam 116 event `EventTiming`; durasi
  keyboard tertinggi **1.833,61 ms**. Terdapat **47 `RunTask` >=50 ms**, task terlama
  **965,02 ms**, dan **11.720 event `Layout`**. Stack trace layout menyebut
  `samakanTinggiJudul` dan `renderProduk`; event trace juga memuat `terapkanSaringan`.
- **Dugaan mekanisme:** Listener `input` di `pasangPencarian()` langsung memanggil
  `terapkanSaringan()` untuk setiap karakter. Fungsi tersebut menormalisasi dan memfilter seluruh
  produk, lalu `renderProduk()` mengosongkan `#kisi` dan membuat ulang semua kartu. Setelah itu
  `samakanTinggiJudul()` membaca `offsetHeight` dan menulis `style.height` berulang kali. Urutan
  JavaScript -> Style/Layout terjadi dalam task input sebelum browser memperoleh *rendering
  opportunity*, sehingga penyelesaian keyboard tertunda.
- **Kualitas terdampak:** *Performance efficiency/time behaviour* karena pekerjaan input dan
  layout berlangsung terlalu lama; *interaction capability/operability* karena karakter tidak
  segera terasa responsif.
- **Rencana perubahan:** Tambahkan debounce 150--200 ms, hilangkan penyamaan tinggi berbasis
  pengukuran JavaScript dengan layout CSS, dan kurangi pembangunan ulang DOM yang tidak perlu.
- **Prediksi terukur:** Durasi `EventTiming` keyboard turun dari **1.833,61 ms** menjadi
  **<=200 ms**. Tidak ada task interaksi dengan durasi >=100 ms dan jumlah event `Layout` turun
  dari **11.720**. Efek samping yang diprediksi: hasil filter baru muncul 150--200 ms setelah
  pengguna berhenti mengetik.
- **Alternatif:** Web Worker tidak dipilih sebagai langkah pertama karena serialisasi data produk
  dan pembuatan DOM tetap terjadi di main thread; debounce dan penghapusan layout thrashing
  langsung menargetkan jalur yang terlihat pada trace.

### Sesudah perbaikan

- **Hash commit perbaikan:** ....
- **Hasil ukur (median 3 kali):** ....
- **Prediksi vs kenyataan:** ....
- **Efek samping yang muncul:** ....

---

## P-02: Panel keranjang menampilkan data lama sampai ditutup dan dibuka lagi

**Tiket terkait:** TK-1044 (Skenario S2)
**Source terkait:** `public/js/keranjang.js`
**Tanggal dan hash commit entri ini:** 2026-10-02, diisi saat commit hipotesis

### Sebelum perbaikan

- **Yang teramati di trace/bukti:** Notifikasi `Ditambahkan ke keranjang` dan perubahan lencana
  keranjang sudah tampil, tetapi panel yang sedang terbuka tidak langsung menampilkan item atau
  jumlah terbaru. Bukti visual menunjukkan hasil baru terlihat setelah panel ditutup lalu dibuka
  kembali.
- **Dugaan mekanisme:** `tambahKeKeranjang()` memperbarui `localStorage`, lencana, tombol, dan
  toast, tetapi tidak memanggil `gambarPanel()`. Fungsi `gambarPanel()` hanya dipanggil ketika
  `buka(true)` membuka panel. Akibatnya DOM `#daftar-keranjang` menjadi stale walaupun sumber
  data sudah berubah; pengguna harus memicu event buka ulang agar rendering panel terjadi.
- **Kualitas terdampak:** *Interaction capability/self-descriptiveness* karena isi panel tidak
  merepresentasikan state keranjang terkini; *operability* dan *user error protection* ikut
  terdampak karena pengguna dapat mengira penambahan gagal atau melakukan klik tambahan.
- **Rencana perubahan:** Jadikan pembaruan panel sebagai bagian dari jalur sukses tambah/hapus
  keranjang. Setelah `simpanKeranjang()` selesai, panggil fungsi render panel bila panel sedang
  terbuka, tanpa memaksa panel terbuka ketika pengguna sedang melihat katalog.
- **Prediksi terukur:** Setelah tambah produk saat panel terbuka, nama item, jumlah, dan total
  pada `#daftar-keranjang` berubah pada rendering opportunity yang sama setelah penyimpanan,
  tanpa perlu menutup dan membuka panel. Jumlah klik ulang yang diperlukan diprediksi menjadi
  **0**. Efek sampingnya: setiap penambahan saat panel terbuka menambah satu pekerjaan DOM kecil
  untuk menggambar ulang daftar keranjang.
- **Alternatif:** Memaksa panel ditutup dan dibuka ulang tidak dipilih karena mengganggu fokus
  pengguna. Polling `localStorage` juga tidak dipilih karena boros dan tidak memberi sinkronisasi
  deterministik seperti pembaruan langsung setelah mutasi.

### Sesudah perbaikan

- **Hash commit perbaikan:** ....
- **Hasil ukur (median 3 kali):** ....
- **Prediksi vs kenyataan:** ....
- **Efek samping yang muncul:** ....

---

## P-03: Klik "Beli sekarang" berkali-kali membuat pesanan duplikat

**Tiket terkait:** TK-1052 (Skenario S3)  
**Source terkait:** `public/js/keranjang.js`, `server.js` (endpoint hanya untuk observasi, bukan diubah)
**Tanggal dan hash commit entri ini:** 2026-10-02, diisi saat commit hipotesis

### Sebelum perbaikan

- **Yang teramati di trace (baseline):** `S3.json` merekam **19 `RunTask` >=50 ms**, task
  terlama **841,13 ms**, dan **2.624 event `Layout`**. Bukti transaksi pada
  `HASIL TRACE WEBSITE.docx` mencatat tiga pesanan terpisah setelah tiga klik cepat:
  `TK-00001`, `TK-00002`, dan `TK-00003`. `image6.png`/`image7.png` mendukung lencana
  tiga pesanan dan `image8.png` mendukung log terminal.
- **Dugaan mekanisme:** Listener tombol memanggil `beliSekarang()` tanpa lock. Fungsi itu
  membaca 9.000 riwayat, mengirim analitik, menyimpan riwayat, lalu melakukan `fetch POST`.
  Tombol tetap aktif selama Promise jaringan 350 ms belum selesai. Tiga input diterima sebagai
  task terpisah dan masing-masing membuat POST valid sebelum respons sebelumnya mengunci UI.
- **Kualitas terdampak:** *Performance efficiency/time behaviour* dan *capacity* karena
  transaksi duplikat membebani server; *interaction capability/user error protection* karena
  UI tidak mencegah double submission.
- **Rencana perubahan:** Tambahkan lock in-flight per produk, nonaktifkan tombol pada klik pertama,
  ubah teks menjadi `Memproses...`, dan pulihkan state pada respons atau kegagalan. Pekerjaan
  riwayat/analitik yang tidak kritis tidak boleh mendahului feedback UI.
- **Prediksi terukur:** Tiga klik cepat menghasilkan **tepat satu POST/pesanan** pada log server,
  bukan tiga. Tombol menunjukkan status proses pada klik pertama. Efek sampingnya: tombol tidak
  dapat dipakai lagi sampai request selesai atau timeout; kegagalan request harus dikembalikan ke
  state yang dapat dicoba ulang.
- **Alternatif:** Debounce berbasis waktu tidak dipilih karena request server dapat lebih lambat
  daripada jendela debounce. Lock yang mengikuti lifecycle Promise melindungi seluruh periode
  in-flight.

### Sesudah perbaikan

- **Hash commit perbaikan:** ....
- **Hasil ukur (median 3 kali):** ....
- **Prediksi vs kenyataan:** ....
- **Efek samping yang muncul:** ....

---

## P-04: Penerapan voucher membekukan halaman

**Tiket terkait:** TK-1057 (Skenario S4)  
**Source terkait:** `public/js/harga-promo.js`
**Tanggal dan hash commit entri ini:** 2026-10-02, diisi saat commit hipotesis

### Sebelum perbaikan

- **Yang teramati di trace (baseline):** `S4.json` merekam durasi keyboard tertinggi
  **2.653,13 ms**, **47 `RunTask` >=50 ms** dengan task terlama **1.555,63 ms**, dan
  **30.888 event `Layout`**. LCP kandidat soft-navigation terakhir sekitar **33.517,04 ms**;
  CLS maksimum **0,6116**. Trace juga memuat **10.287 `TimerInstall`**, **10.282
  `TimerRemove`**, dan sekitar **4.024 `AnimationFrame`**.
- **Dugaan mekanisme:** `hitungHargaPromo()` diberi `async`, tetapi tidak memiliki `await`;
  seluruh `simulasiCicilan()` tetap menghitung sinkron. Pada `terapkanVoucher()`, `await` terhadap
  Promise yang telah selesai hanya meneruskan loop melalui microtask. Browser menguras microtask
  sebelum rendering opportunity, sehingga pembaruan `isi.style.width` dapat tertunda sampai
  banyak iterasi selesai. Setelah loop, `perbaruiHargaVoucherDiKartu()` merender ulang kartu.
- **Kualitas terdampak:** *Performance efficiency/time behaviour/resource utilization* karena
  kalkulasi dan layout memonopoli main thread; *interaction capability/operability* karena input
  dan progres tidak terasa hidup.
- **Rencana perubahan:** Pecah perhitungan menjadi batch kecil, yield ke macrotask menggunakan
  `scheduler.yield()` atau fallback `setTimeout(0)`, dan pertahankan seluruh aturan voucher serta
  simulasi cicilan.
- **Prediksi terukur:** Durasi keyboard turun dari **2.653,13 ms** menjadi **<=200 ms**; tidak
  ada task >=100 ms selama perhitungan; progres mendapat rendering opportunity di antara batch.
  Jumlah `Layout` dan LCP soft-navigation diprediksi turun. Efek sampingnya: total waktu menuju
  100% dapat bertambah karena overhead yield.
- **Alternatif:** Web Worker tidak dipilih sebagai langkah pertama karena transfer data/progres
  menambah kompleksitas; task chunking cukup untuk mengembalikan kesempatan render tanpa mengubah
  model data.

### Sesudah perbaikan

- **Hash commit perbaikan:** ....
- **Hasil ukur (median 3 kali):** ....
- **Prediksi vs kenyataan:** ....
- **Efek samping yang muncul:** ....

---

## P-05: Gulir daftar produk tersendat

**Tiket terkait:** TK-1063 (Skenario S5)  
**Source terkait:** `public/js/gulir.js`, `public/js/katalog.js`
**Tanggal dan hash commit entri ini:** 2026-10-02, diisi saat commit hipotesis

### Sebelum perbaikan

- **Yang teramati di trace (baseline):** `S5.json` merekam **77 `RunTask` >=50 ms**, task
  terlama **901,58 ms**, **6.999 event `Layout`**, dan **22 `LayoutShift`** dengan CLS maksimum
  **0,8220**. Raw JSON tidak menyediakan hitungan frame >50 ms atau TBT agregat.
- **Dugaan mekanisme:** `periksaGulir()` dipanggil langsung dari `scroll`, `resize`, `touchmove`,
  dan `wheel`. Setiap pemanggilan melakukan `querySelectorAll('.kartu')`, membaca
  `getBoundingClientRect()` untuk semua kartu, lalu menulis `classList` dan `style.minHeight`.
  Listener `touchmove`/`wheel` juga non-passive. Akibatnya main thread melakukan JS dan
  forced layout berulang saat compositor seharusnya bisa menggulir.
- **Kualitas terdampak:** *Performance efficiency/time behaviour/resource utilization* karena
  layout dihitung berulang; *interaction capability/user engagement* karena scroll patah-patah.
- **Rencana perubahan:** Gunakan `IntersectionObserver` untuk kartu, jadikan listener yang tidak
  memerlukan `preventDefault` passive, dan jadwalkan pembaruan indikator scroll dengan satu
  `requestAnimationFrame`.
- **Prediksi terukur:** Jumlah `Layout` turun dari **6.999**, tidak ada task scroll >=100 ms,
  dan CLS turun dari **0,8220** menuju **<=0,1** bila layout shift memang berasal dari kartu.
  Efek sampingnya: callback observer dan animasi kartu dapat muncul sedikit setelah kartu masuk
  viewport.
- **Alternatif:** Debounce scroll saja tidak dipilih karena indikator dapat tertinggal dan tampak
  melompat; observer/passive/rAF menargetkan sumber blocking yang berbeda.

### Sesudah perbaikan

- **Hash commit perbaikan:** ....
- **Hasil ukur (median 3 kali):** ....
- **Prediksi vs kenyataan:** ....
- **Efek samping yang muncul:** ....

---

## P-06: Konsumsi resource tinggi saat halaman diam

**Tiket terkait:** TK-1070 (Skenario S6)  
**Source terkait:** `public/js/promo.js`, `public/css/toko.css`
**Tanggal dan hash commit entri ini:** 2026-10-02, diisi saat commit hipotesis

### Sebelum perbaikan

- **Yang teramati di trace (baseline):** `S6.json` merekam **27 `RunTask` >=50 ms**, task
  terlama **895,58 ms**, **10.029 event `Layout`**, dan **3 `LayoutShift`** dengan CLS maksimum
  **0,6117**. Terdapat **6.404 `EventDispatch`**, **2.737 `FunctionCall`**, dan **2.738
  `v8.callFunction`.** Raw JSON tidak menyediakan persentase CPU, TBT, hitungan frame jank,
  atau pengukuran baterai.
- **Dugaan mekanisme:** `pasangHitungMundur()` dan `pasangTeksBerjalan()` memasang dua
  `setInterval(..., 10)`. Callback menghitung DOM setiap 10 ms, membaca `offsetWidth`/`offsetWidth`
  teks, lalu menulis `style.width` dan `style.left`, yang dapat memicu Style/Layout/Paint walaupun
  tidak ada input pengguna. `pasangBannerPromo()` juga menunggu fetch promo 1,8 detik.
- **Kualitas terdampak:** *Performance efficiency/resource utilization* karena main thread tetap
  aktif saat idle; *interaction capability/inclusivity* karena panas dan konsumsi daya terutama
  merugikan perangkat mobile kelas bawah. JSON tidak membuktikan persentase CPU atau baterai,
  sehingga klaim tersebut tetap hipotesis yang harus diverifikasi.
- **Rencana perubahan:** Pindahkan teks berjalan ke CSS `transform`/`@keyframes`, turunkan timer
  hitung mundur menjadi sekitar 1 Hz, gunakan transisi compositor-friendly, dan hentikan timer
  ketika tab tersembunyi.
- **Prediksi terukur:** Jumlah `RunTask` >=50 ms turun dari **27**, jumlah `Layout` turun dari
  **10.029**, dan tidak ada task idle >=100 ms. Efek sampingnya: angka perseratus detik tidak
  diperbarui setiap 10 ms dan ketepatan visual timer berkurang.

### Sesudah perbaikan

- **Hash commit perbaikan:** ....
- **Hasil ukur (median 3 kali):** ....
- **Prediksi vs kenyataan:** ....
- **Efek samping yang muncul:** ....

---

## P-07: Tata letak meloncat saat banner promo muncul

**Tiket terkait:** TK-1078 (Skenario S0)  
**Source terkait:** `public/js/promo.js`, `public/index.html`, `public/css/toko.css`
**Tanggal dan hash commit entri ini:** 2026-10-02, diisi saat commit hipotesis

### Sebelum perbaikan

- **Yang teramati di trace (baseline):** `S0.json` mencatat **2 `LayoutShift`** dengan CLS
  maksimum **0,4749**, **18 `RunTask` >=50 ms** dengan task terlama **828,32 ms**, serta
  **2.514 event `Layout`**. LCP kandidat sekitar **204,24 ms** setelah `navigationStart`.
- **Dugaan mekanisme:** Pada baseline, banner promo diisi setelah `fetch('/api/promo')` dan
  penyisipan elemen baru di area utama mengubah geometri konten yang sudah terlihat. Browser
  menjalankan Style/Layout ulang dan mencatat shift tanpa input pengguna. Source saat ini sudah
  memiliki `#wadah-promo` dan penggantian node; perubahan tersebut harus diperlakukan sebagai
  calon perbaikan dan tidak boleh disebut hasil sesudah sebelum ada trace baru.
- **Kualitas terdampak:** *Performance efficiency/time behaviour/visual stability* dan
  *interaction capability/user error protection* karena posisi target klik dapat berubah.
- **Rencana perubahan:** Sediakan ruang banner sejak HTML awal dengan `min-height`/`aspect-ratio`,
  gunakan skeleton atau isi wadah yang sudah ada, dan hindari `prepend` yang mendorong katalog.
- **Prediksi terukur:** CLS turun dari **0,4749** menjadi **<=0,1**, idealnya mendekati nol, dan
  jumlah `LayoutShift` turun dari 2 menjadi 0. Efek sampingnya: ruang kosong sementara dapat
  terlihat selama respons promo 1,8 detik belum tiba.
- **Alternatif:** Fixed popup tidak dipilih karena dapat menutupi produk pada viewport mobile dan
  menambah risiko salah klik.

### Sesudah perbaikan

- **Hash commit perbaikan:** ....
- **Hasil ukur (median 3 kali):** ....
- **Prediksi vs kenyataan:** ....
- **Efek samping yang muncul:** ....

---

## P-08: Ribuan request gambar pada pemuatan awal

**Tiket terkait:** TK-1081 (Skenario S0)
**Source terkait:** `public/js/katalog.js`, `public/css/toko.css`
**Tanggal dan hash commit entri ini:** 2026-10-02, diisi saat commit hipotesis

### Sebelum perbaikan

- **Yang teramati di trace (baseline):** `S0.json` mencatat **1.517 `ResourceSendRequest`**,
  termasuk **1.500 URL SVG produk unik** `/img/p/1.svg` sampai `/img/p/1500.svg`. Source
  `buatKartu()` menetapkan `gambar.src = produk.gambar` untuk setiap produk saat render awal,
  sehingga gambar off-screen ikut diminta. LCP kandidat raw trace sekitar **204,24 ms**.
- **Dugaan mekanisme:** Browser mengantrekan resource gambar untuk seluruh katalog, sehingga
  bandwidth, decoder, dan memory digunakan sebelum pengguna melihat kartu-kartu tersebut.
  Ini adalah eager loading dari sisi client; endpoint gambar server memang memiliki latensi
  simulasi, tetapi `server.js` berada di luar ruang lingkup perubahan.
- **Kualitas terdampak:** *Performance efficiency/capacity/resource utilization* dan
  *interaction capability/inclusivity* karena perangkat atau kuota terbatas menerima resource
  yang belum dibutuhkan.
- **Rencana perubahan:** Tambahkan `loading="lazy"` dan `decoding="async"`, pertahankan dimensi
  gambar melalui `aspect-ratio`, dan pastikan kartu tetap dapat ditemukan ketika pengguna scroll.
- **Prediksi terukur:** Jumlah URL SVG produk unik pada initial trace turun dari **1.500** menjadi
  sebanding dengan kartu yang dekat viewport, bukan seluruh katalog. LCP kandidat diprediksi
  tetap **<=2,5 detik** atau membaik. Efek sampingnya: saat scroll cepat, gambar baru dapat
  tampil sebagai placeholder singkat sebelum request selesai.
- **Alternatif:** Pagination tidak dipilih karena TUGAS.md mewajibkan seluruh produk tetap
  tersedia dalam satu katalog yang dapat digulir. Lazy loading memenuhi aturan tersebut tanpa
  menghapus produk.

### Sesudah perbaikan

- **Hash commit perbaikan:** ....
- **Hasil ukur (median 3 kali):** ....
- **Prediksi vs kenyataan:** ....
- **Efek samping yang muncul:** ....
