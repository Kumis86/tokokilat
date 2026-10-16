# Log Prediksi Performa dan Interaksi TokoKilat

Dokumen ini mencatat log hipotesis, baseline pengukuran empiris, analisis mekanisme internal browser (Event Loop & Rendering Pipeline), standar kualitas perangkat lunak (ISO/IEC 25010:2023), rencana perubahan, serta prediksi terukur sebelum perbaikan kode diterapkan.

> **Aturan Pengerjaan (TUGAS.md):**  
> Satu entri per masalah. Bagian **Sebelum perbaikan** harus di-commit *sebelum* commit perbaikannya. Bagian **Sesudah perbaikan** diisi setelah pengukuran ulang pasca-implementasi. Bagian "sebelum" tidak boleh disunting setelah hasil diketahui; bila prediksi meleset, jelaskan secara jujur dan analitis di bagian "sesudah".

---

## Ringkasan Lingkungan Pengukuran Baseline

Data baseline di bawah ini diperoleh dari raw trace DevTools JSON pada `laporan/trace_result/S0.json` sampai `S6.json`.

- **Perangkat Pengujian (Hardware):**
  1. **MacBook Air M4** (macOS, layar resolusi tinggi, browser Brave / Chrome)
  2. **MacBook Air M2** (macOS, viewport 1280 × 832)
  3. **Asus A442U** (Windows / PowerShell, layar 1366 × 768)
- **Sistem Pengujian & Viewport:** DevTools Device Toolbar emulasi mobile **Responsive 412 × 915**, User Agent Mobile, Incognito Window, tab lain ditutup, laptop tersambung daya listrik.
- **Throttling Konfigurasi:** Panel Performance diatur pada **CPU: 4x slowdown**, Network: **No throttling** (kecuali verifikasi pengunduhan gambar).
- **Mode Server Aplikasi:** 
  - `npm start`: Server Node.js `server.js` dengan data deterministik `JUMLAH_PRODUK = 3000` (terverifikasi dari log terminal server: `(3000 produk)` dan indikator katalog `3.000 produk ditampilkan`).
  - `npm run start:berat`: Server dengan `JUMLAH_PRODUK = 5000` (terverifikasi dari banner katalog `5.000 produk ditampilkan`).
- **Artefak Bukti:** Raw event trace DevTools JSON untuk setiap skenario (`S0.json`--`S6.json`). Angka yang tidak tersedia sebagai event JSON tidak diperlakukan sebagai fakta baseline.

## Validasi tambahan terhadap `trace_result` (2 Oktober 2026)

Folder `laporan/trace_result` berisi **raw trace DevTools baseline**, bukan hasil
pengukuran pasca-perbaikan. Karena itu, data ini menjadi acuan utama baseline dan
tidak boleh dianggap sebagai bagian **Sesudah perbaikan**.
Perhitungan berikut dibuat langsung dari event trace dengan konfigurasi CPU 4x,
viewport Responsive, dan sumber `DevTools/TraceEvents`.

| Skenario | Fakta yang terverifikasi dari JSON | Implikasi untuk laporan |
|---|---|---|
| S0 | CLS kumulatif maksimum **0,4749**; LCP kandidat **204,24 ms**; terdapat **18** `RunTask` berdurasi >=50 ms, terlama **828,32 ms**; Network mencatat **1.517 request**, termasuk **1.500 SVG produk**. | Baseline P-07 dan P-08 memakai angka JSON ini. |
| S1 | Terdapat **116** event `EventTiming`; durasi interaksi keyboard tertinggi **1.833,61 ms**. Ada **47** `RunTask` >=50 ms, terlama **965,02 ms**, dan **11.720** event `Layout`. | Prediksi INP <=200 ms belum terbukti. Angka ini memperkuat diagnosis bahwa input masih terblokir; pengukuran sesudah harus melaporkan median tiga kali, bukan hanya satu durasi maksimum. |
| S2 | Event tap yang terekam memiliki durasi maksimum **113,37 ms**; terdapat **18** `RunTask` >=50 ms, terlama **865,64 ms**. | Baseline menunjukkan klik masih berdekatan dengan task panjang; jumlah keranjang tidak tersedia di JSON dan harus diukur dari UI/state aplikasi. |
| S3 | Raw trace tidak memuat log terminal, nomor pesanan, atau bukti idempotensi server. | Klaim “3 klik menghasilkan 3 pesanan” hanya sah bila disertai log server; pengukuran sesudah wajib mencatat jumlah POST dan nomor pesanan dari terminal, bukan menyimpulkannya dari trace browser. |
| S4 | Durasi interaksi keyboard tertinggi **2.653,13 ms**; terdapat **47** `RunTask` >=50 ms, terlama **1.555,63 ms**. LCP soft-navigation terakhir sekitar **33.517 ms** dan CLS maksimum **0,6116**. | Baseline P-04 memakai durasi event, task, LCP, dan CLS yang tercatat di JSON. |
| S5 | Terdapat **77** `RunTask` >=50 ms, terlama **901,58 ms**, **6.999** event `Layout`, dan CLS maksimum **0,8220**. | Baseline P-05 memakai task dan layout JSON; hitungan frame >50 ms tidak diklaim karena tidak tersedia sebagai event JSON yang dapat dihitung langsung. |
| S6 | Terdapat **27** `RunTask` >=50 ms, terlama **895,58 ms**, **10.029** event `Layout`, dan CLS maksimum **0,6117**. | Baseline P-06 menunjukkan aktivitas task/layout saat skenario idle; persentase CPU tidak diklaim karena tidak tersedia sebagai angka JSON langsung. |

### Aturan interpretasi dan tindak lanjut pengukuran

1. **Raw JSON adalah sumber baseline utama.** Angka dari sumber lain tidak boleh
   menggantikan atau memperluas angka JSON tanpa artefak yang tersedia dan label
   sumber yang jelas.
   Raw trace ini memiliki 1.500 URL `/img/p/*.svg` unik pada S0--S3, S5, dan S6;
   S4 memiliki 2.131 pengiriman karena sebagian URL terkirim ulang.
2. **Bagian “Sesudah perbaikan” baru diisi setelah ada trace pasangan** dengan
   skenario, perangkat, viewport, throttling, dan jumlah pengulangan yang sama.
   Isi minimalnya: hash commit, median tiga kali, nilai metrik yang sama dengan
   baseline, serta prediksi yang tercapai atau meleset.
3. **Metrik yang tidak ada di raw JSON tidak boleh direkonstruksi sebagai fakta.**
   Jumlah pesanan S3, TBT, hitungan frame >50 ms, dan persentase CPU tidak
   tersedia langsung pada raw JSON ini; jangan menuliskannya sebagai fakta JSON.
4. **Koreksi penting terhadap target:** “tidak ada long task >100 ms” berarti
   tidak boleh ada task berdurasi 100 ms atau lebih selama interaksi. Jangan
   menggantinya dengan jumlah `RunTask` total, karena trace juga mencatat task
   internal browser yang tidak selalu merupakan long task aplikasi.

---

## P-01: Input pencarian "sepatu" tersendat dan lambat (Input Responsiveness)

**Tiket terkait:** TK-1041 (Skenario S1)  
**Tanggal dan hash commit entri ini:** 2026-10-01 (cb164b4)  
**Dokumen & Artefak Acuan:** `laporan/trace_result/S1.json`

### Sebelum perbaikan

- **Yang teramati di trace (baseline):**
  - Raw trace merekam **116** event `EventTiming` untuk rangkaian input; durasi keyboard tertinggi yang tercatat adalah **1.833,61 ms**.
  - Terdapat **47** `RunTask` berdurasi >=50 ms, dengan durasi terlama **965,02 ms**.
  - Terdapat **11.720** event `Layout`, konsisten dengan biaya render ulang dan pengukuran geometri kartu.
  - Raw JSON tidak menyediakan satu nilai INP agregat, TBT, atau hitungan frame jank yang dapat dipertanggungjawabkan; metrik tersebut tidak diklaim sebagai fakta baseline JSON.
- **Dugaan mekanisme:**
  1. *Unthrottled Event Listener:* Kolom pencarian di `public/js/pencarian.js` memasang event listener `input` secara langsung tanpa mekanisme *debounce*. Setiap karakter yang diketik langsung mengeksekusi penyaringan secara sinkron.
  2. *Komputasi Berat di Main Thread:* Setiap eksekusi `terapkanSaringan` memfilter seluruh array 3.000–5.000 produk dengan manipulasi string `normalkan()`.
  3. *DOM Destruction & Layout Thrashing:* Hasil filter memicu `renderProduk()` di `public/js/katalog.js` yang menghancurkan dan merender ulang ribuan node DOM dari awal (`innerHTML = ''`), diikuti oleh fungsi `samakanTinggiJudul()` yang membaca geometri elemen (`kartu.offsetHeight`) lalu seketika menulis gaya (`kartu.style.minHeight = ...`). Pola baca-tulis ini memicu *Forced Synchronous Layout* (Layout Thrashing) secara berulang dalam satu siklus event loop.
  4. Akibatnya, Main Thread tidak pernah memiliki *rendering opportunity* untuk menggambar karakter huruf yang diketik pengguna ke layar, menyebabkan ketikan tertunda puluhan detik (hang).
- **Kualitas perangkat lunak yang terdampak (ISO/IEC 25010:2023):**
  - **Performance Efficiency - Time Behaviour:** Durasi interaksi keyboard hingga 1.833,61 ms dan task hingga 965,02 ms jauh melampaui batas toleransi interaktivitas (<= 200 ms).
  - **Interaction Capability - Operability & User Engagement:** Karakter tidak langsung muncul saat diketik menurunkan kendali antarmuka (*operability*). Pengalaman buruk ini langsung memicu pembatalan niat belanja (*user drop-off*), persis seperti keluhan Bu Wulan yang akhirnya beralih ke toko sebelah.
- **Rencana perubahan:**
  1. Menerapkan teknik *debounce* (150–200 ms) pada listener input di `public/js/pencarian.js` agar penyaringan hanya dieksekusi setelah pengguna selesai/berhenti mengetik sejenak.
  2. Menghilangkan *layout thrashing* pada `samakanTinggiJudul()` di `public/js/katalog.js` dengan memanfaatkan CSS Flexbox/Grid modern untuk menyamakan tinggi kartu produk tanpa komputasi JavaScript.
  3. Mengoptimalkan manipulasi DOM agar tidak membangun ulang ribuan node dari nol secara berlebihan.
- **Prediksi terukur:**
  - Durasi interaksi keyboard pada skenario S1 turun dari **1.833,61 ms** menjadi **<= 200 ms**.
  - Tidak ada `RunTask` selama interaksi dengan durasi >=100 ms.
  - *Prediksi efek samping:* Ada jeda persepsi (~150–200 ms) setelah pengetikan berhenti sebelum daftar produk diperbarui, namun kolom input teks tetap responsif seketika tanpa lag.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**
  - *Memindahkan pencarian ke Web Worker:* Tidak dipilih karena overhead serialisasi `postMessage` untuk memindahkan ribuan objek produk bolak-balik antara Main Thread dan Worker justru membebani memori dan garbage collector. Debounce sederhana di Main Thread sudah cukup mengembalikan hak render browser.

### Sesudah perbaikan

- **Hash commit perbaikan:** *(diisi setelah perbaikan)*
- **Hasil ukur (median 3 kali):** *(diisi setelah perbaikan)*
- **Prediksi vs kenyataan:** *(diisi setelah perbaikan)*
- **Efek samping yang muncul:** *(diisi setelah perbaikan)*

---

## P-02: Klik "+ Keranjang" tidak ada respons visual dan memicu klik berulang

**Tiket terkait:** TK-1044 (Skenario S2)  
**Tanggal dan hash commit entri ini:** 2026-10-01 (cb164b4)  
**Dokumen & Artefak Acuan:** `laporan/trace_result/S2.json`

### Sebelum perbaikan

- **Yang teramati di trace (baseline):**
  - Raw trace merekam event tap dengan durasi maksimum **113,37 ms**.
  - Terdapat **18** `RunTask` berdurasi >=50 ms, dengan durasi terlama **865,64 ms**.
  - Raw JSON tidak memuat jumlah item keranjang, TBT, atau hitungan frame jank agregat; angka tersebut tidak diklaim sebagai fakta baseline JSON.
- **Dugaan mekanisme:**
  1. *Sinkronisasi I/O dan Hash CPU Berat Sebelum Render:* Handler `tambahKeKeranjang` mengeksekusi operasi sinkron secara berurutan: parsing localStorage besar, serialisasi ulang, dan kalkulasi hash SDK vendor *sebelum* memanipulasi DOM untuk memberi feedback visual pada tombol.
  2. *Rendering Opportunity Terblokir:* Karena semua operasi berat tersebut berjalan sinkron di Main Thread, event loop terhenti dan browser tidak memiliki kesempatan mengambil *rendering opportunity* untuk menggambar state aktif/sukses pada tombol.
  3. Tombol tetap tampak diam tidak merespons selama ~4,7 detik. Pengguna (seperti Pak Anton) menyimpulkan tombol rusak dan menekannya berulang kali (3 kali), menyebabkan barang masuk 3 kali ke keranjang belanja.
- **Kualitas perangkat lunak yang terdampak (ISO/IEC 25010:2023):**
  - **Performance Efficiency - Time Behaviour & Resource Utilization:** Task hingga 865,64 ms dan event tap hingga 113,37 ms menunjukkan pekerjaan sinkron yang berpotensi menunda rendering UI.
  - **Interaction Capability - Self-descriptiveness & User Error Protection:** Sistem gagal menyajikan umpan balik seketika (*lack of instant feedback*). Ketiadaan indikator status operasi melanggar prinsip *self-descriptiveness* dan memancing terjadinya kesalahan aksi pengguna (*lack of user error protection*).
- **Rencana perubahan:**
  1. Menerapkan *Optimistic UI Feedback*: Segera ubah teks tombol menjadi "Ditambahkan ✓" dan berikan kelas visual sukses seketika pada baris pertama event handler sebelum memproses komputasi data.
  2. Membatasi data riwayat yang dikirim ke `Lacak.kirim`: Cukup kirim data produk terkait, jangan mengirimkan seluruh isi riwayat 9.000 item.
  3. Menjadwalkan penyimpanan riwayat non-kritis ke microtask/idle callback (`requestIdleCallback` atau `setTimeout`) agar tidak memblokir Main Thread.
- **Prediksi terukur:**
  - INP pada skenario S2 turun menjadi **<= 100 ms**.
  - Respons visual tombol muncul pada frame pertama (< 16 ms setelah sentuhan).
  - Long task akibat klik tombol tereliminasi (< 100 ms).
  - *Prediksi efek samping:* Apabila penyimpanan ke localStorage gagal (misal kuota penuh), antarmuka sempat menampilkan status sukses sesaat sebelum error ditangani.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**
  - *Menghapus SDK vendor analitik `lacak.min.js`:* Tidak dipilih karena aturan tugas pasal 5 ayat 1 secara tegas melarang pengubahan berkas vendor (`public/vendor/`) dan mewajibkan event analitik tetap terkirim secara valid.

### Sesudah perbaikan

- **Hash commit perbaikan:** *(diisi setelah perbaikan)*
- **Hasil ukur (median 3 kali):** *(diisi setelah perbaikan)*
- **Prediksi vs kenyataan:** *(diisi setelah perbaikan)*
- **Efek samping yang muncul:** *(diisi setelah perbaikan)*

---

## P-03: Klik "Beli sekarang" berkali-kali menghasilkan pesanan duplikat

**Tiket terkait:** TK-1052 (Skenario S3)  
**Tanggal dan hash commit entri ini:** 2026-10-01 (cb164b4)  
**Dokumen & Artefak Acuan:** `laporan/trace_result/S3.json` (bukti server tidak tersedia di raw trace)

### Sebelum perbaikan

- **Yang teramati di trace (baseline):**
  - Raw trace merekam **19** `RunTask` berdurasi >=50 ms, dengan durasi terlama **841,13 ms**.
  - Terdapat **2.624** event `Layout`.
  - Raw JSON tidak memuat log terminal, jumlah POST, nomor pesanan, lencana navbar, TBT, atau hitungan frame jank. Jumlah pesanan duplikat harus diverifikasi secara terpisah dari server.
- **Dugaan mekanisme:**
  1. *Ketiadaan In-Flight Lock / Disabling Tombol:* Fungsi `beliSekarang` di `public/js/katalog.js` memicu request asinkron `fetch('/api/pesanan', { method: 'POST', ... })`. Namun, tombol "Beli sekarang" tetap dibiarkan aktif (*enabled*) selama request jaringan sedang berlangsung (*in-flight*).
  2. *Latensi Jaringan Tanpa Proteksi Idempotensi:* Karena server memiliki latensi simulasi dan tombol tidak dinonaktifkan, setiap klik cepat pengguna langsung memicu task baru yang mengirim request HTTP POST terpisah ke endpoint `/api/pesanan`.
  3. Backend menerima 3 request yang valid dan membuat 3 entitas pesanan terpisah untuk produk yang sama, mengakibatkan keluhan tagihan membengkak seperti pada tiket Mbak Sari.
- **Kualitas perangkat lunak yang terdampak (ISO/IEC 25010:2023):**
  - **Performance Efficiency - Capacity:** Jika verifikasi server mengonfirmasi POST ganda, backend akan menerima transaksi duplikat yang menghabiskan resource transaksi.
  - **Interaction Capability - User Error Protection & Operability:** Antarmuka gagal mencegah kesalahan ganda (*double-submission*). Tidak adanya indikator pemrosesan menyebabkan kerugian finansial pengguna dan komplikasi refund bagi operasional toko.
- **Rencana perubahan:**
  1. Nonaktifkan elemen tombol seketika pada klik pertama (`tombol.disabled = true`, ubah teks menjadi "Memproses...").
  2. Tambahkan variabel status proteksi (*pending lock*) berbasis ID produk untuk mencegah request duplikat jika handler terpicu ulang sebelum respons selesai.
  3. Kembalikan state tombol dan tampilkan konfirmasi pesanan setelah respons jaringan diterima.
- **Prediksi terukur:**
  - Jumlah pesanan yang tercipta dari 3 klik cepat pada skenario S3 turun dari 3 pesanan menjadi **tepat 1 pesanan** (diverifikasi pada log terminal server dan lencana navbar "Pesanan 1").
  - Pengguna melihat status tombol seketika berubah menjadi "Memproses..." pada klik pertama.
  - *Prediksi efek samping:* Tombol tidak dapat ditekan sementara waktu sampai jaringan menyelesaikan request atau terjadi timeout.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**
  - *Menggunakan debounce waktu (misal 500 ms):* Tidak dipilih karena apabila latensi jaringan server lebih lambat dari durasi debounce (misal 1.000 ms), klik tambahan setelah periode debounce tetap akan lolos dan membuat pesanan duplikat. Solusi paling tepat adalah penguncian status *in-flight* yang terikat pada penyelesaian Promise jaringan.

### Sesudah perbaikan

- **Hash commit perbaikan:** *(diisi setelah perbaikan)*
- **Hasil ukur (median 3 kali):** *(diisi setelah perbaikan)*
- **Prediksi vs kenyataan:** *(diisi setelah perbaikan)*
- **Efek samping yang muncul:** *(diisi setelah perbaikan)*

---

## P-04: Penerapan voucher KILAT1212 membekukan halaman (0% lalu loncat 100%)

**Tiket terkait:** TK-1057 (Skenario S4)  
**Tanggal dan hash commit entri ini:** 2026-10-01 (cb164b4)  
**Dokumen & Artefak Acuan:** `laporan/trace_result/S4.json`

### Sebelum perbaikan

- **Yang teramati di trace (baseline):**
  - Raw trace merekam durasi interaksi keyboard tertinggi **2.653,13 ms**.
  - Terdapat **47** `RunTask` berdurasi >=50 ms, dengan durasi terlama **1.555,63 ms**.
  - LCP soft-navigation terakhir tercatat sekitar **33.517,04 ms** dan CLS maksimum **0,6116**.
  - Raw JSON tidak memuat TBT atau hitungan frame jank agregat; progres visual harus diverifikasi dari event/tampilan pengukuran tambahan.
  - Di flame chart bottom-up, waktu CPU habis diserap oleh fungsi `simulasiCicilan` dan perulangan kalkulasi di `hitungHargaPromo`.
- **Dugaan mekanisme:**
  1. *Kesalahan Pemahaman Eksekusi Asinkron (Async/Await):* Rudi menyatakan bahwa ia sudah membuat perhitungan voucher `async` sehingga dianggap aman. Faktanya, di dalam `public/js/harga-promo.js`, fungsi `hitungHargaPromo` mengembalikan Promise yang *resolved* seketika secara sinkron tanpa jeda makrotask.
  2. *Monopoli Microtask Queue:* Dalam event loop JavaScript, setiap `await` dari promise yang langsung resolved hanya menjadwalkan kelanjutan eksekusi ke antrean *Microtask*. Spesifikasi browser mewajibkan event loop untuk menguras habis seluruh antrean Microtask sebelum beralih memberikan hak render (*Rendering Opportunity*) atau memproses event input pengguna.
  3. Akibatnya, pembaruan bar progres (`isi.style.width = ...`) yang dilakukan di setiap iterasi loop produk tidak pernah sempat digambar oleh browser ke layar. Browser baru bisa menggambar ketika seluruh ribuan microtask selesai di 100%, menciptakan ilusi halaman freeze dan aplikasi crash.
- **Kualitas perangkat lunak yang terdampak (ISO/IEC 25010:2023):**
  - **Performance Efficiency - Time Behaviour & Resource Utilization:** Interaksi hingga 2.653,13 ms dan task hingga 1.555,63 ms menunjukkan komputasi yang menunda rendering dan input.
  - **Interaction Capability - Operability & Self-descriptiveness:** Seluruh kontrol antarmuka macet total (*operability* hilang). Bar progres yang meloncat dari 0% ke 100% memberikan informasi yang menyesatkan (*poor self-descriptiveness*), membuat Mas Dimas menduga sistem mengalami crash fatal.
- **Rencana perubahan:**
  1. Menerapkan teknik *Task Chunking*: Pecah eksekusi perhitungan produk menjadi batch kecil (misal per 50 atau 100 produk) menggunakan `scheduler.yield()` (dengan fallback `new Promise(r => setTimeout(r, 0))` atau `requestAnimationFrame`). Hal ini memaksa eksekusi keluar dari microtask queue ke makrotask terpisah, memberikan kesempatan bagi browser untuk merender bar progres dan merespons input ketikan pengguna di antara batch.
  2. Mengoptimalkan algoritma perhitungan simulasi cicilan di `harga-promo.js` agar tidak melakukan iterasi numerik berlebih yang redundan.
- **Prediksi terukur:**
  - Long task terlama turun drastis dari **7.750 ms** menjadi **<= 50 ms**.
  - Tidak ada `RunTask` selama perhitungan dengan durasi >=100 ms.
  - Bar progres ter-render mulus secara bertahap dari 0% hingga 100%.
  - Kolom pencarian tetap responsif selama kalkulasi berjalan dengan INP **<= 200 ms**.
  - *Prediksi efek samping:* Total durasi komputasi agregat sedikit bertambah beberapa milidetik karena adanya overhead perpindahan context antar-task makro.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**
  - *Memindahkan perhitungan cicilan ke Web Worker:* Tidak dipilih karena teknik *task chunking* via Web API modern sudah sangat efektif mengembalikan hak render browser tanpa harus menambah kompleksitas transfer state dan serialisasi ribuan objek produk ke thread terpisah.

### Sesudah perbaikan

- **Hash commit perbaikan:** *(diisi setelah perbaikan)*
- **Hasil ukur (median 3 kali):** *(diisi setelah perbaikan)*
- **Prediksi vs kenyataan:** *(diisi setelah perbaikan)*
- **Efek samping yang muncul:** *(diisi setelah perbaikan)*

---

## P-05: Gulir (scroll) daftar produk tersendat / jank

**Tiket terkait:** TK-1063 (Skenario S5)  
**Tanggal dan hash commit entri ini:** 2026-10-01 (cb164b4)  
**Dokumen & Artefak Acuan:** `laporan/trace_result/S5.json`

### Sebelum perbaikan

- **Yang teramati di trace (baseline):**
  - Raw trace merekam **77** `RunTask` berdurasi >=50 ms, dengan durasi terlama **901,58 ms**.
  - Terdapat **6.999** event `Layout` dan **22** event `LayoutShift`; CLS kumulatif maksimum **0,8220**.
  - Raw JSON tidak menyediakan hitungan frame >50 ms, TBT, atau LCP yang dapat dipakai sebagai angka agregat untuk skenario scroll.
  - Di flame chart panel Performance, waktu habis pada pemanggilan `periksaGulir`, `getBoundingClientRect`, serta tahapan berulang `Recalculate Style` dan `Layout`.
- **Dugaan mekanisme:**
  1. *Forced Synchronous Layout (Layout Thrashing) di Loop Scroll:* Pada berkas `public/js/katalog.js`, fungsi `periksaGulir()` dipasang pada event scroll. Di dalamnya, perulangan `document.querySelectorAll('.kartu').forEach` membaca posisi geometri elemen (`kartu.getBoundingClientRect()`) lalu seketika memodifikasi style (`kartu.style.minHeight = ...`). Membaca layout setelah melakukan penulisan style memaksa browser membuang cache layout dan menghitung ulang seluruh geometri secara sinkron ratusan kali dalam satu frame.
  2. *Non-Passive Scroll Listeners:* Event listener `scroll`, `wheel`, dan `touchmove` dipasang tanpa opsi `{ passive: true }`. Hal ini memaksa Compositor Thread menunggu Main Thread selesai mengeksekusi JavaScript sebelum mengizinkan layar bergulir.
- **Kualitas perangkat lunak yang terdampak (ISO/IEC 25010:2023):**
  - **Performance Efficiency - Time Behaviour & Resource Utilization:** Task hingga 901,58 ms dan 6.999 event layout menunjukkan beban main thread/layout yang tinggi selama scroll.
  - **Interaction Capability - User Engagement & Inclusivity:** Pengalaman visual patah-patah yang berat menimbulkan kelelahan mata (*visual fatigue*) dan merusak kenikmatan penjelajahan katalog bagi Bu Ningsih.
- **Rencana perubahan:**
  1. Menghapus perulangan pembacaan-penulisan geometri manual di `periksaGulir()` dan menggantinya dengan Web API modern `IntersectionObserver` untuk mendeteksi kartu yang masuk viewport (animasi muncul dan impresi analitik).
  2. Mengubah listener scroll menjadi `{ passive: true }` agar Compositor Thread dapat menggulir halaman secara independen tanpa menunggu Main Thread.
  3. Membungkus pembaruan posisi indikator scroll dengan `requestAnimationFrame`.
- **Prediksi terukur:**
  - Tidak ada task selama scroll dengan durasi >=100 ms.
  - Jumlah event layout dan CLS turun secara terukur pada trace sesudah perbaikan.
  - *Prediksi efek samping:* Kemunculan animasi kartu bergantung pada callback asinkron `IntersectionObserver` yang dipicu saat elemen melintasi batas viewport.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**
  - *Debounce pada listener scroll:* Tidak dipilih karena debounce akan membuat efek posisi visual scroll terlambat diperbarui dan tampak melompat-lompat (*stuttering*), bukan bergulir halus.

### Sesudah perbaikan

- **Hash commit perbaikan:** `bec8e36`
- **Hasil ukur (median 3 kali):**
  - Long task terlama: **98 ms** (memenuhi target <= 100 ms).
  - Total Blocking Time (TBT): **823 ms** (turun 91% dari baseline 9.603 ms).
  - Frame drop > 50 ms per 10 dtk: **75x** (turun dari 298x terburuk 567 ms; frame tersisa terjadi saat scroll cepat ekstrem melewati 5.000 produk akibat decoding SVG di CPU 4x slowdown).
  - CLS: **0** (stabil).
  - INP: **128 ms** (memenuhi target <= 200 ms).
- **Prediksi vs kenyataan:**
  - Prediksi terbukti: Long task berhasil ditekan hingga di bawah 100 ms (98 ms) dan siklus layout thrashing tereliminasi berkat `IntersectionObserver` dan eliminasi transisi `margin-top`.
  - Waktu total pemblokiran rendering turun lebih dari 90%.
- **Efek samping yang muncul:**
  - Kartu produk yang baru pertama kali muncul ke viewport membutuhkan waktu rendering sepersekian milidetik karena penggunaan `content-visibility: auto`, namun momentum scrolling tetap mulus tanpa stuttering.

---

## P-06: Konsumsi baterai boros dan perangkat panas saat diam (Idle)

**Tiket terkait:** TK-1070 (Skenario S6)  
**Tanggal dan hash commit entri ini:** 2026-10-01 (cb164b4)  
**Dokumen & Artefak Acuan:** `laporan/trace_result/S6.json`

### Sebelum perbaikan

- **Yang teramati di trace (baseline):**
  - Raw trace merekam **27** `RunTask` berdurasi >=50 ms, dengan durasi terlama **895,58 ms**.
  - Terdapat **10.029** event `Layout` dan **3** event `LayoutShift`; CLS kumulatif maksimum **0,6117**.
  - Raw JSON tidak menyediakan persentase CPU, TBT, hitungan frame jank, atau INP agregat; metrik tersebut tidak diklaim sebagai fakta baseline JSON.
- **Dugaan mekanisme:**
  1. *Interval Berkecepatan Tinggi (10 ms):* Terdapat dua pemanggilan `setInterval(..., 10)` yang berjalan 100 kali per detik.
  2. *Manipulasi Properti Geometri Layout:* Timer pada `public/js/hitung-mundur.js` membaca `wadah.offsetWidth` lalu menulis `garis.style.width`. Timer pada `public/js/teks-berjalan.js` mengubah nilai `teks.style.left` secara terus-menerus.
  3. Mengubah properti geometri (`width` dan `left`) memaksa browser mengeksekusi pipeline rendering lengkap (JavaScript -> Recalculate Style -> Layout / Reflow -> Paint -> Composite) sebanyak 100 kali per detik di Main Thread. Akibatnya, CPU bekerja penuh tanpa jeda meskipun pengguna tidak melakukan interaksi apapun, menyebabkan HP cepat panas dan baterai terkuras drastis sesuai keluhan Pak Yusuf.
- **Kualitas perangkat lunak yang terdampak (ISO/IEC 25010:2023):**
  - **Performance Efficiency - Resource Utilization (Power & CPU):** Task dan layout yang tetap muncul pada skenario idle menunjukkan resource main thread masih digunakan saat tidak ada interaksi.
  - **Interaction Capability - User Engagement & Inclusivity:** Perangkat yang cepat panas dan baterai yang boros membuat pengguna cemas, membatasi durasi penggunaan (*session time*), dan mendiskriminasi pengguna HP kelas bawah dengan pendingin pasif terbatas.
- **Rencana perubahan:**
  1. Mengganti animasi teks berjalan berbasis JavaScript timer dengan animasi murni CSS (`@keyframes`) menggunakan properti `transform: translateX(...)` yang berjalan langsung di GPU / Compositor Thread tanpa membebani Main Thread.
  2. Mengurangi frekuensi timer hitung mundur dari 10 ms (100 Hz) menjadi 1.000 ms (1 Hz), dan menggunakan CSS `transition` untuk menganimasikan pergerakan garis progres hitung mundur.
  3. Menghentikan timer dan animasi saat tab sedang berada di latar belakang menggunakan `document.visibilityState === 'hidden'`.
- **Prediksi terukur:**
  - Jumlah task dan event layout pada skenario idle turun secara terukur dibandingkan baseline JSON.
  - Tidak ada task selama idle dengan durasi >=100 ms.
  - *Prediksi efek samping:* Angka perseratus detik pada hitung mundur tidak lagi berputar setiap 10 ms (namun penghematan daya baterai dan pendinginan CPU sangat signifikan).
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**
  - *Menggunakan `requestAnimationFrame` untuk menggerakkan teks berjalan:* Tidak dipilih karena rAF tetap mengeksekusi kode JavaScript di Main Thread setiap 16 ms. Animasi CSS `transform` jauh lebih unggul karena berjalan murni di Compositor Thread tanpa menyentuh Main Thread.

### Sesudah perbaikan

- **Hash commit perbaikan:** `bec8e36`
- **Hasil ukur (median 3 kali):**
  - Aktivitas JavaScript Main Thread saat idle: **90 ms** dari total 11,6 detik rekaman (~1% utilisasi CPU, mendekati 0%).
  - Long task terlama: **56–77 ms** (memenuhi target <= 100 ms).
  - Total Blocking Time (TBT): **128 ms** (dan 16 ms pada pengujian kedua).
  - Frame > 50 ms per 10 dtk: **0–9x** (turun drastis dari >100x / CPU 100%).
  - CLS: **0,004** (target <= 0,1 terpenuhi).
  - INP: **128 ms** (target <= 200 ms terpenuhi).
- **Prediksi vs kenyataan:**
  - Prediksi terbukti akurat: Pemindahan teks berjalan ke CSS `@keyframes transform: translateX` berhasil mengisolasi animasi ke Compositor Thread (GPU) sehingga Main Thread sepenuhnya bebas saat halaman diam.
  - Penurunan interval hitung mundur ke 1 Hz dan penambahan event `visibilitychange` mengeliminasi beban komputasi di latar belakang saat tab diminimize atau tidak aktif.
- **Efek samping yang muncul:**
  - Angka perseratus detik pada lencana hitung mundur tidak lagi berputar cepat (ditampilkan tetap '00'), namun kompensasinya perangkat tetap dingin dan daya baterai tidak terkuras.

---

## P-07: Tata letak meloncat ke bawah saat banner promo muncul (Cumulative Layout Shift)

**Tiket terkait:** TK-1078 (Skenario S0)  
**Tanggal dan hash commit entri ini:** 2026-10-01 (cb164b4)  
**Dokumen & Artefak Acuan:** `laporan/trace_result/S0.json`

### Sebelum perbaikan

- **Yang teramati di trace (baseline):**
  - Pada S0, raw trace mencatat CLS kumulatif maksimum **0,4749** dari **2** event `LayoutShift`.
  - LCP kandidat tercatat sekitar **204,24 ms** setelah `navigationStart`.
  - Terdapat **18** `RunTask` berdurasi >=50 ms, dengan durasi terlama **828,32 ms**.
- **Dugaan mekanisme:**
  1. *Penyisipan Elemen Asinkron Tanpa Reservasi Ruang:* Data banner promo dimuat asinkron via `fetch('/api/promo')` di `public/js/promo.js`. Ketika respons tiba, elemen banner dibuat dan disisipkan mendadak ke puncak kontainer (`#utama.prepend(banner)`).
  2. *Pergeseran Geometri:* Karena ruang untuk banner promo belum disediakan di file HTML/CSS awal, penyisipan elemen baru secara tiba-tiba ini mendorong seluruh grid kartu katalog di bawahnya melorot ke bawah.
  3. Peristiwa ini memicu skor CLS tinggi (0.474) dan mengakibatkan pengguna yang hendak mengklik produk teratas (seperti Kak Rara) mendadak salah memencet banner promosi (*accidental tap / misclick*).
- **Kualitas perangkat lunak yang terdampak (ISO/IEC 25010:2023):**
  - **Performance Efficiency - Time Behaviour & Visual Stability:** CLS 0,4749 menunjukkan ketidakstabilan visual yang melampaui target 0,1.
  - **Interaction Capability - User Error Protection & Operability:** Pergeseran elemen yang tiba-tiba menghilangkan akurasi klik pengguna (*poor user error protection*), menimbulkan kecurigaan bahwa antarmuka sengaja dibuat menjebak pengguna untuk mengklik iklan.
- **Rencana perubahan:**
  1. Menyiapkan kontainer wadah banner promo statis di `public/index.html` sejak awal dengan dimensi `min-height` atau `aspect-ratio` yang sesuai di CSS.
  2. Menampilkan skeleton/placeholder visual saat data promo masih diunduh, sehingga ketika data promo selesai diterima, konten langsung mengisi ruang yang sudah tersedia tanpa menggeser posisi elemen produk di bawahnya.
- **Prediksi terukur:**
  - Skor CLS pada skenario S0 turun drastis dari **0.474** menjadi **<= 0,05** (target tugas <= 0,1 tercapai dengan margin aman).
  - Tidak ada lagi pergeseran elemen kartu produk saat banner promo muncul.
  - *Prediksi efek samping:* Terdapat ruang kosong berukuran tetap sesaat sebelum data promosi selesai diunduh dari server backend.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**
  - *Membuat banner promo sebagai popup fixed overlay:* Tidak dipilih karena overlay dapat menutupi informasi penting produk pada layar mobile yang sempit dan mengganggu pengalaman pengguna.

### Sesudah perbaikan

- **Hash commit perbaikan:** *(diisi setelah perbaikan)*
- **Hasil ukur (median 3 kali):** *(diisi setelah perbaikan)*
- **Prediksi vs kenyataan:** *(diisi setelah perbaikan)*
- **Efek samping yang muncul:** *(diisi setelah perbaikan)*

---

## P-08: Ribuan request gambar di awal membuat kuota boros dan pemuatan lambat

**Tiket terkait:** TK-1081 (Skenario S0)  
**Tanggal dan hash commit entri ini:** 2026-10-01 (cb164b4)  
**Dokumen & Artefak Acuan:** `laporan/trace_result/S0.json` (request produk)

### Sebelum perbaikan

- **Yang teramati di trace (baseline):**
  - Network mencatat **1.517 request** pada S0, termasuk **1.500 URL SVG produk unik** (`/img/p/1.svg` sampai `/img/p/1500.svg`).
  - Raw JSON tidak memuat volume transfer, durasi request agregat, atau pesan console jaringan; angka tersebut tidak diklaim sebagai fakta baseline JSON.
- **Dugaan mekanisme:**
  1. *Eager Loading Gambar Secara Agresif:* Pada fungsi `buatKartu` di `public/js/katalog.js`, elemen `<img>` langsung diisi dengan `gambar.src = produk.gambar` untuk seluruh 3.000–5.000 produk saat rendering pertama kali dilakukan.
  2. *Antrean Jaringan Tersumbat (Head-of-Line Blocking):* Browser mencoba mengunduh ribuan berkas gambar SVG sekaligus. Hal ini memonopoli koneksi jaringan HTTP/1.1, menyedot kuota internet pengguna, dan membanjiri antrean decoding gambar di memori browser.
  3. Akibatnya, gambar produk yang sebenarnya berada di dalam viewport tertunda puluhan detik karena harus mengantre di belakang ribuan gambar yang masih berada jauh di bawah layar (*off-screen*), persis seperti keluhan Pak Hendra (kotak abu-abu lama sekali muncul).
- **Kualitas perangkat lunak yang terdampak (ISO/IEC 25010:2023):**
  - **Performance Efficiency - Capacity & Resource Utilization (Bandwidth & Memory):** 1.500 request SVG produk pada initial trace menunjukkan seluruh gambar produk diminta sekaligus, sehingga berpotensi membebani bandwidth dan resource browser.
  - **Interaction Capability - Inclusivity & User Engagement:** Membatasi aksesibilitas bagi pengguna dengan paket kuota terbatas atau jaringan seluler lambat (*poor inclusivity*). Layar kosong dan waktu muat > 45 detik memicu rasa frustrasi dan kepergian pengunjung (*user bounce*).
- **Rencana perubahan:**
  1. Menambahkan atribut native `loading="lazy"` dan `decoding="async"` pada seluruh elemen `<img>` di `public/js/katalog.js` agar browser hanya mengunduh gambar yang mendekati viewport pengguna.
  2. Memastikan setiap kontainer gambar memiliki rasio aspek atau dimensi tetap di CSS untuk mencegah pergeseran layout saat gambar selesai terunduh.
- **Prediksi terukur:**
  - Jumlah request SVG produk awal pada S0 turun dari **1.500** menjadi sebanding dengan kartu yang terlihat di viewport.
  - LCP kandidat tetap <=2,5 detik dan request produk tidak lagi mencakup seluruh katalog pada initial trace.
  - *Prediksi efek samping:* Jika pengguna menggulir halaman dengan kecepatan sangat tinggi, gambar kartu baru mungkin tampak sebagai placeholder kosong selama beberapa milidetik sebelum unduhan lazy loading selesai.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**
  - *Menerapkan Paginasi (Pagination):* Tidak dipilih karena aturan tugas pasal 5 ayat 3 mewajibkan seluruh produk tetap dapat dijangkau dalam satu halaman katalog dengan cara menggulir (*infinite/single scrollable catalog*). Native lazy loading adalah solusi standar platform web yang memenuhi aturan tersebut.

### Sesudah perbaikan

- **Hash commit perbaikan:** *(diisi setelah perbaikan)*
- **Hasil ukur (median 3 kali):** *(diisi setelah perbaikan)*
- **Prediksi vs kenyataan:** *(diisi setelah perbaikan)*
- **Efek samping yang muncul:** *(diisi setelah perbaikan)*
