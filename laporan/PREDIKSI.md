# Log Prediksi Performa dan Interaksi TokoKilat

Dokumen ini mencatat log hipotesis, baseline pengukuran empiris, analisis mekanisme internal browser (Event Loop & Rendering Pipeline), standar kualitas perangkat lunak (ISO/IEC 25010:2023), rencana perubahan, serta prediksi terukur sebelum perbaikan kode diterapkan.

> **Aturan Pengerjaan (TUGAS.md):**  
> Satu entri per masalah. Bagian **Sebelum perbaikan** harus di-commit *sebelum* commit perbaikannya. Bagian **Sesudah perbaikan** diisi setelah pengukuran ulang pasca-implementasi. Bagian "sebelum" tidak boleh disunting setelah hasil diketahui; bila prediksi meleset, jelaskan secara jujur dan analitis di bagian "sesudah".

---

## Ringkasan Lingkungan Pengukuran Baseline

Data baseline di bawah ini diperoleh secara empiris dari pengujian tim yang didokumentasikan dalam `HASIL TRACE WEBSITE.docx`:

- **Perangkat Pengujian (Hardware):**
  1. **MacBook Air M4** (macOS, layar resolusi tinggi, browser Brave / Chrome)
  2. **MacBook Air M2** (macOS, viewport 1280 × 832)
  3. **Asus A442U** (Windows / PowerShell, layar 1366 × 768)
- **Sistem Pengujian & Viewport:** DevTools Device Toolbar emulasi mobile **Responsive 412 × 915**, User Agent Mobile, Incognito Window, tab lain ditutup, laptop tersambung daya listrik.
- **Throttling Konfigurasi:** Panel Performance diatur pada **CPU: 4x slowdown**, Network: **No throttling** (kecuali verifikasi pengunduhan gambar).
- **Mode Server Aplikasi:** 
  - `npm start`: Server Node.js `server.js` dengan data deterministik `JUMLAH_PRODUK = 3000` (terverifikasi dari log terminal server: `(3000 produk)` dan indikator katalog `3.000 produk ditampilkan`).
  - `npm run start:berat`: Server dengan `JUMLAH_PRODUK = 5000` (terverifikasi dari banner katalog `5.000 produk ditampilkan`).
- **Artefak Bukti:** 16 tangkapan layar rekaman trace DevTools (Performance panel, Network panel, Console, dan Alat Ukur TokoKilat) yang tersimpan pada tabel `HASIL TRACE WEBSITE.docx` (Row 1 s.d. Row 7).

---

## P-01: Input pencarian "sepatu" tersendat dan lambat (Input Responsiveness)

**Tiket terkait:** TK-1041 (Skenario S1)  
**Tanggal dan hash commit entri ini:** 2026-10-01 (cb164b4)  
**Dokumen & Artefak Acuan:** `HASIL TRACE WEBSITE.docx` (Row 2, `media/image2.png` & `media/image3.png`)

### Sebelum perbaikan

- **Yang teramati di trace (baseline):**
  - Pada pengujian di MacBook Air (Image 3), pengetikan "sepatu" huruf demi huruf menghasilkan **Interaction to Next Paint (INP) sebesar 624 ms** (kategori *poor*, dengan interaksi keyboard/pointer).
  - Terjadi **2.798 kali Long Task**, dengan durasi Long Task terlama mencapai **4.188 ms** (4,18 detik).
  - Total Blocking Time (Blokir pada Alat Ukur) menembus angka masif **77.818 ms total** (~77,8 detik Main Thread terkunci).
  - Terjadi frame drop jank (> 50 ms) sebanyak **3.093 kali**, dengan frame terburuk mencapai **3.501 ms**.
  - Pada pengujian di Asus A442U (Image 2), frame drop terjadi sebanyak **394 kali** dengan frame terburuk mencapai **19.188 ms** (~19,2 detik layar freeze total).
  - Di flame chart DevTools (bottom-up), waktu CPU habis diserap oleh pemanggilan fungsi `terapkanSaringan`, normalisasi string `normalkan`, pemanggilan masif `renderProduk`, serta perhitungan layout `samakanTinggiJudul`.
- **Dugaan mekanisme:**
  1. *Unthrottled Event Listener:* Kolom pencarian di `public/js/pencarian.js` memasang event listener `input` secara langsung tanpa mekanisme *debounce*. Setiap karakter yang diketik langsung mengeksekusi penyaringan secara sinkron.
  2. *Komputasi Berat di Main Thread:* Setiap eksekusi `terapkanSaringan` memfilter seluruh array 3.000–5.000 produk dengan manipulasi string `normalkan()`.
  3. *DOM Destruction & Layout Thrashing:* Hasil filter memicu `renderProduk()` di `public/js/katalog.js` yang menghancurkan dan merender ulang ribuan node DOM dari awal (`innerHTML = ''`), diikuti oleh fungsi `samakanTinggiJudul()` yang membaca geometri elemen (`kartu.offsetHeight`) lalu seketika menulis gaya (`kartu.style.minHeight = ...`). Pola baca-tulis ini memicu *Forced Synchronous Layout* (Layout Thrashing) secara berulang dalam satu siklus event loop.
  4. Akibatnya, Main Thread tidak pernah memiliki *rendering opportunity* untuk menggambar karakter huruf yang diketik pengguna ke layar, menyebabkan ketikan tertunda puluhan detik (hang).
- **Kualitas perangkat lunak yang terdampak (ISO/IEC 25010:2023):**
  - **Performance Efficiency - Time Behaviour:** Latensi respons input (INP 624 ms, Long Task hingga 4.188 ms) jauh melampaui batas toleransi interaktivitas (<= 200 ms). Total blocking time 77,8 detik melumpuhkan responsivitas runtime.
  - **Interaction Capability - Operability & User Engagement:** Karakter tidak langsung muncul saat diketik menurunkan kendali antarmuka (*operability*). Pengalaman buruk ini langsung memicu pembatalan niat belanja (*user drop-off*), persis seperti keluhan Bu Wulan yang akhirnya beralih ke toko sebelah.
- **Rencana perubahan:**
  1. Menerapkan teknik *debounce* (150–200 ms) pada listener input di `public/js/pencarian.js` agar penyaringan hanya dieksekusi setelah pengguna selesai/berhenti mengetik sejenak.
  2. Menghilangkan *layout thrashing* pada `samakanTinggiJudul()` di `public/js/katalog.js` dengan memanfaatkan CSS Flexbox/Grid modern untuk menyamakan tinggi kartu produk tanpa komputasi JavaScript.
  3. Mengoptimalkan manipulasi DOM agar tidak membangun ulang ribuan node dari nol secara berlebihan.
- **Prediksi terukur:**
  - INP pada skenario S1 turun drastis dari **624 ms** menjadi **<= 200 ms** (bahkan target <= 100 ms).
  - Long task selama pengetikan cepat tereliminasi (< 100 ms).
  - Total Blocking Time (TBT) selama pengetikan turun dari 77.818 ms menjadi < 200 ms.
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
**Dokumen & Artefak Acuan:** `HASIL TRACE WEBSITE.docx` (Row 3, `media/image4.png` & `media/image5.png`)

### Sebelum perbaikan

- **Yang teramati di trace (baseline):**
  - Pada pengujian di Asus A442U (Image 4 & 5), satu kali penekanan tombol "+ Keranjang" memicu beban komputasi masif di Main Thread.
  - Terjadi **724 kali Long Task**, dengan Long Task terlama mencapai **4.754,9 ms** (~4,75 detik).
  - Frame jank (> 50 ms) terjadi sebanyak **591 kali**, dengan frame terburuk mencapai **19.188 ms** (~19,2 detik freeze!).
  - Di flame chart panel Performance, waktu CPU habis diserap oleh pemanggilan fungsi `bacaRiwayat` (`JSON.parse` pada ribuan entri riwayat), duplikasi data `salinDalam`, `simpanRiwayat` (`JSON.stringify` kembali ke `localStorage`), serta pemanggilan fungsi analitik vendor `window.Lacak.kirim('add_to_cart', ...)` yang memicu fungsi hash CPU-intensive `f()` di `public/vendor/lacak.min.js` dengan iterasi loop 2.000.000 kali.
- **Dugaan mekanisme:**
  1. *Sinkronisasi I/O dan Hash CPU Berat Sebelum Render:* Handler `tambahKeKeranjang` mengeksekusi operasi sinkron secara berurutan: parsing localStorage besar, serialisasi ulang, dan kalkulasi hash SDK vendor *sebelum* memanipulasi DOM untuk memberi feedback visual pada tombol.
  2. *Rendering Opportunity Terblokir:* Karena semua operasi berat tersebut berjalan sinkron di Main Thread, event loop terhenti dan browser tidak memiliki kesempatan mengambil *rendering opportunity* untuk menggambar state aktif/sukses pada tombol.
  3. Tombol tetap tampak diam tidak merespons selama ~4,7 detik. Pengguna (seperti Pak Anton) menyimpulkan tombol rusak dan menekannya berulang kali (3 kali), menyebabkan barang masuk 3 kali ke keranjang belanja.
- **Kualitas perangkat lunak yang terdampak (ISO/IEC 25010:2023):**
  - **Performance Efficiency - Time Behaviour & Resource Utilization:** Siklus CPU terkunci 100% selama 4,75 detik untuk komputasi analitik dan I/O riwayat sinkron yang sebenarnya tidak mendesak bagi rendering UI.
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
**Dokumen & Artefak Acuan:** `HASIL TRACE WEBSITE.docx` (Row 4, `media/image6.png`, `media/image7.png`, `media/image8.png`)

### Sebelum perbaikan

- **Yang teramati di trace (baseline):**
  - **Bukti Nyata Server Log (Image 8):** Pada tangkapan layar terminal PowerShell Windows:
    ```text
    PS D:\KULIAH\Semester5\WebDev\P3\tokokilat> npm start
    > tokokilat@1.12.0 start
    > node server.js
    TokoKilat berjalan di http://localhost:3000
    Mode ukur: http://localhost:3000/?ukur=1 (3000 produk)
    [pesanan] TK-00001 produk #2 (1 total)
    [pesanan] TK-00002 produk #2 (2 total)
    [pesanan] TK-00003 produk #2 (3 total)
    ```
    Tercatat secara deterministik bahwa 3 kali klik cepat pada produk #2 menghasilkan **3 pesanan baru terpisah (`TK-00001`, `TK-00002`, `TK-00003`)** di server.
  - **Bukti Antarmuka & Trace (Image 6 & 7):** Lencana pesanan pada navbar langsung melonjak menjadi **"Pesanan 3"**.
  - Alat Ukur TokoKilat mencatat **INP 624 ms** (22 interaksi), **4.955 kali Long Task** dengan Long Task terlama **4.361 ms**, Total Blocking Time sebesar **81.824 ms**, serta **5.708 kali frame > 50 ms** dengan frame terburuk **3.700 ms** (pada Asus A442U di Image 7 frame terburuk mencapai **19.538 ms**).
- **Dugaan mekanisme:**
  1. *Ketiadaan In-Flight Lock / Disabling Tombol:* Fungsi `beliSekarang` di `public/js/katalog.js` memicu request asinkron `fetch('/api/pesanan', { method: 'POST', ... })`. Namun, tombol "Beli sekarang" tetap dibiarkan aktif (*enabled*) selama request jaringan sedang berlangsung (*in-flight*).
  2. *Latensi Jaringan Tanpa Proteksi Idempotensi:* Karena server memiliki latensi simulasi dan tombol tidak dinonaktifkan, setiap klik cepat pengguna langsung memicu task baru yang mengirim request HTTP POST terpisah ke endpoint `/api/pesanan`.
  3. Backend menerima 3 request yang valid dan membuat 3 entitas pesanan terpisah untuk produk yang sama, mengakibatkan keluhan tagihan membengkak seperti pada tiket Mbak Sari.
- **Kualitas perangkat lunak yang terdampak (ISO/IEC 25010:2023):**
  - **Performance Efficiency - Capacity:** Server backend dibebani permintaan duplikat yang menghabiskan alokasi resource transaksi basis data secara cuma-cuma.
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
**Dokumen & Artefak Acuan:** `HASIL TRACE WEBSITE.docx` (Row 5, `media/image9.png`)

### Sebelum perbaikan

- **Yang teramati di trace (baseline):**
  - Pada pengujian S4 (Image 9) di MacBook Air saat voucher `KILAT1212` diterapkan dan pengguna mencoba mengetik di kolom pencarian:
  - **INP meledak mencapai 7.616 ms** (7,616 detik terdeteksi pada interaksi keyboard di DevTools, status *poor*).
  - Terjadi **1.204 kali Long Task**, dengan Long Task tunggal terlama mencapai **7.750 ms** (7,75 detik).
  - Total Blocking Time (Blokir pada Alat Ukur) menembus rekor **100.184 ms total** (> 100 detik Main Thread terblokir!).
  - Frame drop (> 50 ms) terjadi sebanyak **2.064 kali**, dengan frame terburuk mencapai **7.583 ms**.
  - Bar progres pada banner voucher diam membeku di 0% selama bermenit-menit, lalu seketika melompat langsung ke 100%. Kolom pencarian macet total tidak dapat menerima ketikan karakter.
  - Di flame chart bottom-up, waktu CPU habis diserap oleh fungsi `simulasiCicilan` dan perulangan kalkulasi di `hitungHargaPromo`.
- **Dugaan mekanisme:**
  1. *Kesalahan Pemahaman Eksekusi Asinkron (Async/Await):* Rudi menyatakan bahwa ia sudah membuat perhitungan voucher `async` sehingga dianggap aman. Faktanya, di dalam `public/js/harga-promo.js`, fungsi `hitungHargaPromo` mengembalikan Promise yang *resolved* seketika secara sinkron tanpa jeda makrotask.
  2. *Monopoli Microtask Queue:* Dalam event loop JavaScript, setiap `await` dari promise yang langsung resolved hanya menjadwalkan kelanjutan eksekusi ke antrean *Microtask*. Spesifikasi browser mewajibkan event loop untuk menguras habis seluruh antrean Microtask sebelum beralih memberikan hak render (*Rendering Opportunity*) atau memproses event input pengguna.
  3. Akibatnya, pembaruan bar progres (`isi.style.width = ...`) yang dilakukan di setiap iterasi loop produk tidak pernah sempat digambar oleh browser ke layar. Browser baru bisa menggambar ketika seluruh ribuan microtask selesai di 100%, menciptakan ilusi halaman freeze dan aplikasi crash.
- **Kualitas perangkat lunak yang terdampak (ISO/IEC 25010:2023):**
  - **Performance Efficiency - Time Behaviour & Resource Utilization:** Thread utama dikuasai 100% oleh microtask loop komputasi matematika cicilan, memblokir rendering pipeline selama lebih dari 100 detik.
  - **Interaction Capability - Operability & Self-descriptiveness:** Seluruh kontrol antarmuka macet total (*operability* hilang). Bar progres yang meloncat dari 0% ke 100% memberikan informasi yang menyesatkan (*poor self-descriptiveness*), membuat Mas Dimas menduga sistem mengalami crash fatal.
- **Rencana perubahan:**
  1. Menerapkan teknik *Task Chunking*: Pecah eksekusi perhitungan produk menjadi batch kecil (misal per 50 atau 100 produk) menggunakan `scheduler.yield()` (dengan fallback `new Promise(r => setTimeout(r, 0))` atau `requestAnimationFrame`). Hal ini memaksa eksekusi keluar dari microtask queue ke makrotask terpisah, memberikan kesempatan bagi browser untuk merender bar progres dan merespons input ketikan pengguna di antara batch.
  2. Mengoptimalkan algoritma perhitungan simulasi cicilan di `harga-promo.js` agar tidak melakukan iterasi numerik berlebih yang redundan.
- **Prediksi terukur:**
  - Long task terlama turun drastis dari **7.750 ms** menjadi **<= 50 ms**.
  - Total Blocking Time turun dari 100.184 ms menjadi < 500 ms.
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
**Dokumen & Artefak Acuan:** `HASIL TRACE WEBSITE.docx` (Row 6, `media/image10.png` s.d. `image13.png`)

### Sebelum perbaikan

- **Yang teramati di trace (baseline):**
  - Pada pengujian S5 di MacBook Air (Image 12), pengguliran terus-menerus selama 10 detik menghasilkan jank rendering luar biasa:
  - Terjadi **11.551 kali frame jank (> 50 ms)** dengan frame terburuk mencapai **1.750 ms**.
  - Terjadi **3.638 kali Long Task**, dengan Long Task terlama **1.642 ms**.
  - Total Blocking Time (Blokir pada Alat Ukur) mencapai rekor tertinggi aplikasi: **162.058 ms total** (> 162 detik terblokir!).
  - INP interaksi pointer saat scroll terukur **1.032 ms** (status *poor*).
  - Largest Contentful Paint (LCP) membengkak hingga **44.57 s**.
  - Konsol browser dipenuhi pesan kesalahan jaringan: `net::ERR_NETWORK_IO_SUSPENDED` (Image 12) karena antrean I/O dan thread browser lumpuh akibat scroll thrashing.
  - Pada trace Image 11, pengunduhan 5.016 gambar SVG terus berlangsung simultan dengan Long Task terlama **13.136 ms** dan frame terburuk **12.983 ms**.
  - Di flame chart panel Performance, waktu habis pada pemanggilan `periksaGulir`, `getBoundingClientRect`, serta tahapan berulang `Recalculate Style` dan `Layout`.
- **Dugaan mekanisme:**
  1. *Forced Synchronous Layout (Layout Thrashing) di Loop Scroll:* Pada berkas `public/js/katalog.js`, fungsi `periksaGulir()` dipasang pada event scroll. Di dalamnya, perulangan `document.querySelectorAll('.kartu').forEach` membaca posisi geometri elemen (`kartu.getBoundingClientRect()`) lalu seketika memodifikasi style (`kartu.style.minHeight = ...`). Membaca layout setelah melakukan penulisan style memaksa browser membuang cache layout dan menghitung ulang seluruh geometri secara sinkron ratusan kali dalam satu frame.
  2. *Non-Passive Scroll Listeners:* Event listener `scroll`, `wheel`, dan `touchmove` dipasang tanpa opsi `{ passive: true }`. Hal ini memaksa Compositor Thread menunggu Main Thread selesai mengeksekusi JavaScript sebelum mengizinkan layar bergulir.
- **Kualitas perangkat lunak yang terdampak (ISO/IEC 25010:2023):**
  - **Performance Efficiency - Time Behaviour & Resource Utilization:** Terjadi frame drop masif (11.551 kali > 50 ms) yang melumpuhkan frame rate hingga < 5 fps dan membebani GPU/CPU secara ekstrem.
  - **Interaction Capability - User Engagement & Inclusivity:** Pengalaman visual patah-patah yang berat menimbulkan kelelahan mata (*visual fatigue*) dan merusak kenikmatan penjelajahan katalog bagi Bu Ningsih.
- **Rencana perubahan:**
  1. Menghapus perulangan pembacaan-penulisan geometri manual di `periksaGulir()` dan menggantinya dengan Web API modern `IntersectionObserver` untuk mendeteksi kartu yang masuk viewport (animasi muncul dan impresi analitik).
  2. Mengubah listener scroll menjadi `{ passive: true }` agar Compositor Thread dapat menggulir halaman secara independen tanpa menunggu Main Thread.
  3. Membungkus pembaruan posisi indikator scroll dengan `requestAnimationFrame`.
- **Prediksi terukur:**
  - Jumlah frame > 50 ms pada skenario S5 turun dari **11.551 kali** menjadi **paling banyak 2 per 10 detik** (target tercapai, 60 fps mulus).
  - Total Blocking Time selama scroll turun drastis dari 162.058 ms menjadi < 100 ms.
  - INP interaksi scroll/pointer turun menjadi **<= 200 ms**.
  - *Prediksi efek samping:* Kemunculan animasi kartu bergantung pada callback asinkron `IntersectionObserver` yang dipicu saat elemen melintasi batas viewport.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**
  - *Debounce pada listener scroll:* Tidak dipilih karena debounce akan membuat efek posisi visual scroll terlambat diperbarui dan tampak melompat-lompat (*stuttering*), bukan bergulir halus.

### Sesudah perbaikan

- **Hash commit perbaikan:** *(diisi setelah perbaikan)*
- **Hasil ukur (median 3 kali):** *(diisi setelah perbaikan)*
- **Prediksi vs kenyataan:** *(diisi setelah perbaikan)*
- **Efek samping yang muncul:** *(diisi setelah perbaikan)*

---

## P-06: Konsumsi baterai boros dan perangkat panas saat diam (Idle)

**Tiket terkait:** TK-1070 (Skenario S6)  
**Tanggal dan hash commit entri ini:** 2026-10-01 (cb164b4)  
**Dokumen & Artefak Acuan:** `HASIL TRACE WEBSITE.docx` (Row 7, `media/image14.png`, `media/image15.png`, `media/image16.png`)

### Sebelum perbaikan

- **Yang teramati di trace (baseline):**
  - Pada pengujian S6 saat halaman dibiarkan diam 10 detik tanpa interaksi pengguna sama sekali (Image 14 & 15 pada mode 5.000 produk):
  - Terjadi **173 kali Long Task**, dengan Long Task terlama mencapai **13.243 ms** (13,24 detik!).
  - Total Blocking Time (Blokir pada Alat Ukur) mencapai **30.745 ms total** (~30,7 detik).
  - Frame drop (> 50 ms) terjadi sebanyak **98 kali**, dengan frame terburuk mencapai **13.049 ms**.
  - INP terukur **2.216 ms** (status *poor*).
  - Pada variasi pengukuran S6 lainnya (Image 16), tercatat **719 kali Long Task** (terlama 3.885 ms), Blokir **40.007 ms**, dan **1.411 kali frame > 50 ms** (terburuk 8.983 ms) dengan LCP membengkak hingga **53.12 s**.
  - Di flame chart DevTools, Main Thread aktif terus-menerus 100% tanpa pernah beristirahat (*no idle period*). Waktu habis pada eksekusi interval `pasangHitungMundur` dan `pasangTeksBerjalan` yang berulang memicu pipeline rendering: `Layout`, `Paint`, dan `Recalculate Style`.
- **Dugaan mekanisme:**
  1. *Interval Berkecepatan Tinggi (10 ms):* Terdapat dua pemanggilan `setInterval(..., 10)` yang berjalan 100 kali per detik.
  2. *Manipulasi Properti Geometri Layout:* Timer pada `public/js/hitung-mundur.js` membaca `wadah.offsetWidth` lalu menulis `garis.style.width`. Timer pada `public/js/teks-berjalan.js` mengubah nilai `teks.style.left` secara terus-menerus.
  3. Mengubah properti geometri (`width` dan `left`) memaksa browser mengeksekusi pipeline rendering lengkap (JavaScript -> Recalculate Style -> Layout / Reflow -> Paint -> Composite) sebanyak 100 kali per detik di Main Thread. Akibatnya, CPU bekerja penuh tanpa jeda meskipun pengguna tidak melakukan interaksi apapun, menyebabkan HP cepat panas dan baterai terkuras drastis sesuai keluhan Pak Yusuf.
- **Kualitas perangkat lunak yang terdampak (ISO/IEC 25010:2023):**
  - **Performance Efficiency - Resource Utilization (Power & CPU):** Utilisasi CPU pada kondisi idle mendekati 100% (seharusnya mendekati 0%), menguras daya baterai secara masif dan menghasilkan panas berlebih pada prosesor mobile.
  - **Interaction Capability - User Engagement & Inclusivity:** Perangkat yang cepat panas dan baterai yang boros membuat pengguna cemas, membatasi durasi penggunaan (*session time*), dan mendiskriminasi pengguna HP kelas bawah dengan pendingin pasif terbatas.
- **Rencana perubahan:**
  1. Mengganti animasi teks berjalan berbasis JavaScript timer dengan animasi murni CSS (`@keyframes`) menggunakan properti `transform: translateX(...)` yang berjalan langsung di GPU / Compositor Thread tanpa membebani Main Thread.
  2. Mengurangi frekuensi timer hitung mundur dari 10 ms (100 Hz) menjadi 1.000 ms (1 Hz), dan menggunakan CSS `transition` untuk menganimasikan pergerakan garis progres hitung mundur.
  3. Menghentikan timer dan animasi saat tab sedang berada di latar belakang menggunakan `document.visibilityState === 'hidden'`.
- **Prediksi terukur:**
  - Aktivitas Main Thread saat diam (S6) turun dari hampir 100% menjadi **mendekati 0%**.
  - Jumlah frame > 50 ms saat diam turun menjadi **0 per 10 detik** (target <= 2).
  - Long task saat diam tereliminasi total (0 ms).
  - *Prediksi efek samping:* Angka perseratus detik pada hitung mundur tidak lagi berputar setiap 10 ms (namun penghematan daya baterai dan pendinginan CPU sangat signifikan).
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**
  - *Menggunakan `requestAnimationFrame` untuk menggerakkan teks berjalan:* Tidak dipilih karena rAF tetap mengeksekusi kode JavaScript di Main Thread setiap 16 ms. Animasi CSS `transform` jauh lebih unggul karena berjalan murni di Compositor Thread tanpa menyentuh Main Thread.

### Sesudah perbaikan

- **Hash commit perbaikan:** *(diisi setelah perbaikan)*
- **Hasil ukur (median 3 kali):** *(diisi setelah perbaikan)*
- **Prediksi vs kenyataan:** *(diisi setelah perbaikan)*
- **Efek samping yang muncul:** *(diisi setelah perbaikan)*

---

## P-07: Tata letak meloncat ke bawah saat banner promo muncul (Cumulative Layout Shift)

**Tiket terkait:** TK-1078 (Skenario S0)  
**Tanggal dan hash commit entri ini:** 2026-10-01 (cb164b4)  
**Dokumen & Artefak Acuan:** `HASIL TRACE WEBSITE.docx` (Row 1, `media/image1.png`, serta konsistensi CLS di `image3.png`, `image6.png`, `image9.png`, `image13.png`, `image16.png`)

### Sebelum perbaikan

- **Yang teramati di trace (baseline):**
  - Pada Skenario S0 (Image 1), Cumulative Layout Shift (CLS) terukur sangat buruk di angka **0.474** pada Alat Ukur TokoKilat, dan tercatat **0.47** pada panel Performance DevTools (kategori *poor*, dengan peringatan *Worst cluster 1 shift*).
  - Layout shift terjadi beberapa ratus milidetik setelah halaman pertama kali terlihat, tepat ketika data promosi selesai diunduh dari `/api/promo`.
  - Terjadi Long Task awal 2x (terlama 2.735 ms) dan frame jank 2x (terburuk 3.167 ms).
- **Dugaan mekanisme:**
  1. *Penyisipan Elemen Asinkron Tanpa Reservasi Ruang:* Data banner promo dimuat asinkron via `fetch('/api/promo')` di `public/js/promo.js`. Ketika respons tiba, elemen banner dibuat dan disisipkan mendadak ke puncak kontainer (`#utama.prepend(banner)`).
  2. *Pergeseran Geometri:* Karena ruang untuk banner promo belum disediakan di file HTML/CSS awal, penyisipan elemen baru secara tiba-tiba ini mendorong seluruh grid kartu katalog di bawahnya melorot ke bawah.
  3. Peristiwa ini memicu skor CLS tinggi (0.474) dan mengakibatkan pengguna yang hendak mengklik produk teratas (seperti Kak Rara) mendadak salah memencet banner promosi (*accidental tap / misclick*).
- **Kualitas perangkat lunak yang terdampak (ISO/IEC 25010:2023):**
  - **Performance Efficiency - Time Behaviour & Visual Stability:** Ketidakstabilan visual layout memaksa browser melakukan recalculate style dan reflow mendadak pada seluruh subtree dokumen di tengah pemuatan.
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
**Dokumen & Artefak Acuan:** `HASIL TRACE WEBSITE.docx` (Row 1, `media/image1.png`, serta didukung oleh `image11.png` & `image15.png`)

### Sebelum perbaikan

- **Yang teramati di trace (baseline):**
  - **Ledakan Permintaan HTTP (Image 1, 11, 15):** Panel Network mencatat total **5.016 requests** diunduh serentak pada pemuatan awal halaman!
  - **Volume Transfer Data:** Mentransfer data sebesar **3,6 MB – 4,59 MB** (`2.095 kB / 4.596 kB transferred` pada Image 1, dan `3.8 MB transferred` pada Image 15).
  - **Durasi Selesai Sangat Lambat:** Pemuatan seluruh permintaan gambar SVG membutuhkan waktu hingga **1,2 menit (72 detik)**, dengan durasi per gambar SVG mencapai **15,6 s – 16,0 s**.
  - **Largest Contentful Paint (LCP) Ekstrem:** Waktu LCP membengkak hebat hingga **44.57 s – 53.12 s** (Image 12 & 16: LCP 44.57 s dan 53.12 s, status *poor*).
  - Terjadi kegagalan jaringan di konsol: `net::ERR_NETWORK_IO_SUSPENDED` (Image 12) akibat browser kehabisan soket dan antrean jaringan tersumbat total.
- **Dugaan mekanisme:**
  1. *Eager Loading Gambar Secara Agresif:* Pada fungsi `buatKartu` di `public/js/katalog.js`, elemen `<img>` langsung diisi dengan `gambar.src = produk.gambar` untuk seluruh 3.000–5.000 produk saat rendering pertama kali dilakukan.
  2. *Antrean Jaringan Tersumbat (Head-of-Line Blocking):* Browser mencoba mengunduh ribuan berkas gambar SVG sekaligus. Hal ini memonopoli koneksi jaringan HTTP/1.1, menyedot kuota internet pengguna, dan membanjiri antrean decoding gambar di memori browser.
  3. Akibatnya, gambar produk yang sebenarnya berada di dalam viewport tertunda puluhan detik karena harus mengantre di belakang ribuan gambar yang masih berada jauh di bawah layar (*off-screen*), persis seperti keluhan Pak Hendra (kotak abu-abu lama sekali muncul).
- **Kualitas perangkat lunak yang terdampak (ISO/IEC 25010:2023):**
  - **Performance Efficiency - Capacity & Resource Utilization (Bandwidth & Memory):** Menghabiskan alokasi bandwidth jaringan pengguna dan membebani memori heap browser dengan ribuan resource bitmap/vektor yang belum diperlukan.
  - **Interaction Capability - Inclusivity & User Engagement:** Membatasi aksesibilitas bagi pengguna dengan paket kuota terbatas atau jaringan seluler lambat (*poor inclusivity*). Layar kosong dan waktu muat > 45 detik memicu rasa frustrasi dan kepergian pengunjung (*user bounce*).
- **Rencana perubahan:**
  1. Menambahkan atribut native `loading="lazy"` dan `decoding="async"` pada seluruh elemen `<img>` di `public/js/katalog.js` agar browser hanya mengunduh gambar yang mendekati viewport pengguna.
  2. Memastikan setiap kontainer gambar memiliki rasio aspek atau dimensi tetap di CSS untuk mencegah pergeseran layout saat gambar selesai terunduh.
- **Prediksi terukur:**
  - Jumlah permintaan gambar HTTP di awal pemuatan (S0) turun drastis dari **5.016 requests** menjadi hanya **sekitar 10–20 requests** (hanya kartu yang berada di viewport awal).
  - Waktu selesai transfer data awal berkurang lebih dari 90% (dari 4,6 MB menjadi < 300 kB).
  - Waktu Largest Contentful Paint (LCP) turun dari **> 45 detik** menjadi **<= 2.5 detik**.
  - Error konsol `ERR_NETWORK_IO_SUSPENDED` tereliminasi total.
  - *Prediksi efek samping:* Jika pengguna menggulir halaman dengan kecepatan sangat tinggi, gambar kartu baru mungkin tampak sebagai placeholder kosong selama beberapa milidetik sebelum unduhan lazy loading selesai.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**
  - *Menerapkan Paginasi (Pagination):* Tidak dipilih karena aturan tugas pasal 5 ayat 3 mewajibkan seluruh produk tetap dapat dijangkau dalam satu halaman katalog dengan cara menggulir (*infinite/single scrollable catalog*). Native lazy loading adalah solusi standar platform web yang memenuhi aturan tersebut.

### Sesudah perbaikan

- **Hash commit perbaikan:** *(diisi setelah perbaikan)*
- **Hasil ukur (median 3 kali):** *(diisi setelah perbaikan)*
- **Prediksi vs kenyataan:** *(diisi setelah perbaikan)*
- **Efek samping yang muncul:** *(diisi setelah perbaikan)*
