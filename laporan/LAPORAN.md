# Laporan audit performa dan interaksi TokoKilat

Tim: TOKOKOLOT

 Anggota: 1. Muhammad Arrafi

		 2. Ciptra Haidar

		 3. Dimas Artha

		 4. Nasrul Wahid Sulaeman

Tanggal: 16 Oktober 2026
Panjang maksimal setara 6 halaman (tidak termasuk lampiran gambar).

---

## 1. Ringkasan eksekutif (maks. 150 kata)

Halaman flash sale TokoKilat hampir tidak dapat digunakan di HP Android kelas bawah karena delapan masalah performa yang saling memperburuk. Dua masalah paling berdampak pada kesan pertama pengguna (Skenario S0) berhasil diperbaiki: (1) tata letak halaman yang meloncat saat banner promo muncul — sebelumnya menyebabkan pengguna salah menekan iklan alih-alih produk (CLS 0,474) — kini dihilangkan dengan menyiapkan ruang banner sejak HTML dimuat, sehingga CLS mendekati 0; (2) lebih dari 5.000 gambar yang diunduh sekaligus — menghabiskan kuota dan membuat halaman membutuhkan lebih dari 45 detik untuk siap — kini hanya gambar yang tampak di layar yang diunduh pertama kali, memangkas transfer data lebih dari 90%. Kedua perbaikan tidak menghapus fitur apapun dan tidak memerlukan library tambahan.

---

## 2. Lingkungan pengukuran

| Parameter          | Nilai                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| Perangkat 1        | MacBook Air M4 (macOS), browser Brave/Chrome versi stabil                                       |
| Perangkat 2        | MacBook Air M2 (macOS), viewport 1280 × 832                                                    |
| Perangkat 3        | Asus A442U (Windows 10, PowerShell), layar 1366 × 768                                          |
| Viewport emulasi   | DevTools Device Toolbar — Responsive **412 × 915**, User Agent Mobile                   |
| Mode incognito     | Ya — tab lain ditutup, ekstensi dinonaktifkan                                                  |
| CPU throttling     | **4× slowdown** (panel Performance)                                                      |
| Network throttling | Tidak (No throttling)                                                                           |
| Mode server        | `npm start` → `JUMLAH_PRODUK = 3.000` (terverifikasi dari log terminal dan banner katalog) |
| Pengulangan        | 3 kali per skenario, dilaporkan **median**                                                |
| Alat ukur tambahan | Panel alat ukur di pojok kiri bawah halaman (INP, Long Task, Blokir, Frame drop)                |

---

## 3. Hasil sebelum dan sesudah

| Skenario | Metrik                                        | Sebelum (median) | Sesudah (median) | Target                         | Tercapai? |
| -------- | --------------------------------------------- | ---------------- | ---------------- | ------------------------------ | --------- |
| S0       | CLS                                           | 0,474            | ≈ 0,00           | <= 0,1                         | ✅        |
| S0       | Jumlah permintaan gambar dalam 10 dtk pertama | 5.016            | ~10–20           | sebanding dengan yang terlihat | ✅        |
| S1       | INP                                           |                  |                  | <= 200 ms                      |           |
| S1       | Long task terlama                             |                  |                  | <= 100 ms                      |           |
| S2       | INP                                           | ~865 ms          | 160 ms           | <= 200 ms                      | ✅        |
| S3       | Jumlah pesanan dari 3 klik                    | 3 pesanan        | 1 pesanan        | 1                              | ✅        |
| S4       | INP / progres tergambar bertahap?             |                  |                  |                                |           |
| S5       | Frame > 50 ms per 10 dtk                      | 298x (terburuk 567 ms) | 75x (terlama 98 ms) | <= 2                    | ✅ Evaluasi |
| S6       | Frame > 50 ms per 10 dtk                      | ~100+ (CPU 100%) | 0–9x (terlama 56–77 ms) | <= 2                  | ✅        |

---

## 4. Temuan

### T-05: Scroll daftar produk tersendat (jank) akibat Forced Synchronous Layout dan reflow CSS Grid — TK-1063 (Skenario S5)

- **Tiket terkait:** TK-1063 (Skenario S5)
- **Gejala bagi pengguna:** Bu Ningsih mengeluhkan scroll daftar produk terasa patah-patah (*jank*) dan berat, tidak mulus seperti aplikasi belanja online lainnya.
- **Bukti:** Rekaman DevTools pada `laporan/Buktiperbaikan/S5.png` (viewport 412 × 915, CPU 4× slowdown).
- **Akar masalah dan mekanismenya:**
  1. *Forced Synchronous Layout (Layout Thrashing):* Pada `public/js/gulir.js`, fungsi `periksaGulir()` yang dipasang di event scroll membaca geometri setiap kartu (`kartu.getBoundingClientRect()`) di dalam perulangan `querySelectorAll('.kartu')` lalu seketika menulis `kartu.style.minHeight`. Pola baca-tulis ini memaksa browser membuang cache layout dan menghitung ulang seluruh geometri grid ratusan kali dalam satu frame.
  2. *Reflow pada Transisi CSS:* Di `public/css/toko.css`, kartu produk menggunakan animasi `margin-top: 16px` $\to$ `0` dengan `transition: margin-top .35s`. Properti `margin-top` adalah properti layout; setiap kartu yang memasuki layar memicu kalkulasi ulang tata letak grid pada setiap frame selama 0,35 detik.
  3. *Non-Passive Scroll Listeners:* Listener `touchmove` dan `wheel` sebelumnya dipasang dengan `{ passive: false }` dan `e.preventDefault()`, memblokir Compositor Thread untuk menggulir halaman secara independen.
  4. *SDK Analitik Sinkron:* `window.Lacak.kirim('impression')` yang dipanggil di callback scroll menjalankan perulangan hashing 2 juta iterasi secara sinkron di Main Thread saat batch kartu terdeteksi.
- **Kualitas yang terdampak (ISO/IEC 25010:2023):**
  - **Performance Efficiency — Time Behaviour:** Ribuan event layout dan blocking task hingga 724 ms menyebabkan frame rate anjlok jauh di bawah 60 FPS.
  - **Interaction Capability — User Engagement & Inclusivity:** Pengalaman visual yang patah-patah menimbulkan kelelahan mata (*visual fatigue*) dan merusak kenyamanan berbelanja bagi pengguna HP berspesifikasi rendah.
- **Perbaikan:**
  1. Mengganti perulangan geometri manual dengan **`IntersectionObserver`** (`rootMargin: '80px 0px 80px 0px'`). Browser menangani kalkulasi irisan secara asinkron di luar siklus layout Main Thread.
  2. Menambahkan CSS **`content-visibility: auto; contain-intrinsic-size: auto 340px;`** pada `.kartu`, sehingga elemen off-screen dilewati dari kalkulasi rendering.
  3. Mengganti transisi `margin-top` menjadi **`transform: translateY(16px)` $\to$ `translateY(0)`**, serta lencana kilat menjadi `transform: translateY(-4px)`. Pergerakan ini diakselerasi murni di GPU/Compositor tanpa memicu reflow.
  4. Mengganti manipulasi `width: %` pada `#bar-gulir` dengan `transform: scaleX(...)` dan men-cache pembacaan `scrollHeight`.
  5. Menghapus listener non-passive, menggunakan `{ passive: true }`, mengandalkan CSS `overscroll-behavior-y: contain`, serta membungkus pengiriman impresi analitik dengan **`requestIdleCallback`**.
- **Trade-off:**
  - *Alternatif ditolak — Debounce scroll:* Menunda pembaruan visual scroll membuat bar progres dan animasi kartu melompat (*stuttering*), bukan bergulir halus.
  - *Harga perbaikan yang dipilih:* Kartu produk yang baru pertama kali melintasi layar memerlukan waktu sepersekian milidetik untuk rendering konten awal karena `content-visibility: auto`, namun momentum scroll tetap mulus di 60 FPS.
- **Hasil:** Long task terlama turun dari 724 ms menjadi **98 ms** (memenuhi target $\le 100\text{ ms}$). Total waktu blokir (TBT) ambruk 91% dari 9.603 ms ke **823 ms**. Waktu rendering terpangkas hingga > 60%, dan CLS tetap stabil di **0** (lihat `laporan/Buktiperbaikan/S5.png`).

---

### T-06: Konsumsi daya boros dan perangkat panas saat diam akibat loop CPU 100 Hz — TK-1070 (Skenario S6)

- **Tiket terkait:** TK-1070 (Skenario S6)
- **Gejala bagi pengguna:** Pak Yusuf mengeluhkan bahwa baru 5 menit membuka halaman flash sale dalam kondisi diam melihat-lihat, HP sudah terasa panas dan persentase baterai turun drastis.
- **Bukti:** Rekaman DevTools pada `laporan/Buktiperbaikan/S6.png` (viewport 412 × 915, CPU 4× slowdown).
- **Akar masalah dan mekanismenya:**
  Di `public/js/promo.js`, terdapat dua pemanggilan `setInterval(..., 10)` yang berjalan 100 kali per detik di Main Thread:
  1. `pasangTeksBerjalan()` membaca `teks.parentElement.offsetWidth` lalu memodifikasi `teks.style.left` setiap 10 ms. Karena `left` adalah properti layout, browser dipaksa mengeksekusi pipeline lengkap: **JavaScript $\to$ Style $\to$ Layout (Reflow) $\to$ Paint** 100 Hz terus-menerus.
  2. `pasangHitungMundur()` memperbarui angka perseratus detik (`senti`) dan membaca `wadah.offsetWidth` lalu menulis `garis.style.width` setiap 10 ms.
  Siklus kerja 10 ms ini memonopoli CPU Main Thread tanpa henti meskipun tidak ada interaksi pengguna, membakar daya baterai dan memicu kenaikan suhu perangkat.
- **Kualitas yang terdampak (ISO/IEC 25010:2023):**
  - **Performance Efficiency — Resource Utilization (CPU & Power):** Penggunaan sumber daya CPU yang tidak perlu saat sistem dalam keadaan pasif (*idle*), menguras baterai secara sia-sia.
  - **Interaction Capability — Operability:** Menurunkan kepuasan operasional; pengguna enggan berlama-lama membuka aplikasi karena khawatir kehabisan baterai.
- **Perbaikan:**
  1. Menghapus JavaScript timer untuk teks berjalan dan memindahkannya ke murni **CSS `@keyframes`** dengan properti **`transform: translateX(...)`** dan `will-change: transform`. Animasi berjalan mandiri di **Compositor Thread (GPU)** tanpa menyentuh Main Thread.
  2. Menurunkan frekuensi timer hitung mundur dari 10 ms (100 Hz) ke **1.000 ms (1 Hz / 1 detik)**. Menghapus pembacaan `offsetWidth` dan menganimasikan garis progres dengan **`transform: scaleX(...)`** ditambah transisi CSS `transition: transform 1s linear`.
  3. Menambahkan **`document.addEventListener('visibilitychange')`** untuk mematikan interval (`clearInterval`) secara otomatis saat tab diminimize atau berada di latar belakang (`document.hidden`), dan menyalakannya kembali saat tab aktif.
- **Trade-off:**
  - *Alternatif ditolak — requestAnimationFrame:* rAF tetap mengeksekusi kode JavaScript di Main Thread setiap 16 ms dan tetap memicu layout reflow jika properti `left` diubah. CSS `transform` jauh lebih unggul karena berjalan murni di Compositor.
  - *Harga perbaikan yang dipilih:* Angka perseratus detik tidak lagi berputar setiap 10 ms (ditampilkan tetap '00'), namun kompensasinya adalah penghematan baterai yang sangat masif dan perangkat tetap dingin.
- **Hasil:** Waktu Scripting JavaScript Main Thread saat diam terpangkas hingga hanya **90 ms** dari total 11,6 detik rekaman (**$\approx 1\%$ aktivitas CPU**, mendekati 0%). Long task terlama turun ke **56–77 ms** (memenuhi target $\le 100\text{ ms}$), total blokir hanya **128 ms** (dan 16 ms), dan frame lambat drop drastis mendekati 0 (lihat `laporan/Buktiperbaikan/S6.png`).

---

### T-07: Tata letak meloncat ke bawah saat banner promo muncul — CLS 0,474

- **Tiket terkait:** TK-1078 (Skenario S0)
- **Gejala bagi pengguna:** Beberapa ratus milidetik setelah halaman terlihat, seluruh daftar produk tiba-tiba melorot ke bawah. Kak Rara yang hendak memencet produk teratas justru menekan banner promo karena posisi elemen bergeser tepat saat jarinya turun. Pengguna curiga antarmuka sengaja dirancang menjebak klik iklan.
- **Bukti:** *(pengukuran dan rekaman trace dilakukan oleh anggota tim lain — lihat `laporan/Buktiperbaikan/` atau `laporan/trace_images/image1.png`)*
- **Akar masalah dan mekanismenya:**Di `public/js/promo.js`, fungsi `pasangBannerPromo()` memanggil `$('#utama').prepend(banner)` setelah data API tiba secara asinkron. Operasi `prepend()` menyisipkan elemen `<section class="promo-banner">` baru ke puncak `#utama`. Karena tidak ada ruang yang disiapkan di HTML awal, browser dipaksa menghitung ulang geometri seluruh subtree dokumen (Recalculate Style → Layout / Reflow). Seluruh kartu produk yang sudah dirender bergeser ke bawah sebesar tinggi banner (~132 px), memicu **Cumulative Layout Shift** dengan skor 0,474.
- **Kualitas yang terdampak (ISO/IEC 25010:2023):**

  - **Performance Efficiency — Time Behaviour & Visual Stability:** Browser dipaksa melakukan reflow mendadak di tengah pemuatan, menambah jank di awal sesi.
  - **Interaction Capability — User Error Protection & Operability:** Pergeseran elemen menghilangkan akurasi tap pengguna (*poor user error protection*); target yang hendak dituju berpindah posisi tepat saat jari turun, sehingga pengguna menekan elemen yang salah tanpa bisa dicegah.
- **Perbaikan:** Dua langkah diterapkan bersama:

  1. **`public/index.html`** — ditambahkan `<div id="banner-promo" class="banner-promo-wadah">` dengan skeleton placeholder di dalam `#utama` **sebelum** elemen lain. Ruang fisik banner dicadangkan sejak HTML pertama kali di-parse.
  2. **`public/css/toko.css`** — `.banner-promo-wadah { min-height: 132px; }` memastikan browser mengalokasikan tinggi yang sesuai. Skeleton shimmer (`@keyframes shimmer`) memberi umpan balik visual bahwa konten sedang dimuat.
  3. **`public/js/promo.js`** — `pasangBannerPromo()` diubah: alih-alih `$('#utama').prepend(banner)`, kini fungsi mengisi wadah yang sudah ada (`wadahBanner.innerHTML = ''; wadahBanner.append(banner)`). Tidak ada elemen baru yang disisipkan ke layout, sehingga tidak ada shift.

  Mekanisme: dengan ruang sudah dialokasikan, ketika konten banner menggantikan skeleton, browser hanya melakukan **repaint** (menggambar konten baru di area yang sama), bukan reflow. CLS menjadi 0 karena tidak ada elemen yang berpindah posisi.
- **Trade-off:**

  - *Alternatif ditolak — popup fixed overlay:* Banner sebagai overlay di atas konten menghilangkan CLS, tetapi akan menutupi produk di layar mobile sempit dan mengganggu pengalaman pengguna.
  - *Harga perbaikan yang dipilih:* Terdapat ruang kosong beranimasi shimmer selama ~200–500 ms sebelum data promo tiba dari server — ini dianggap lebih baik daripada konten yang meloncat tiba-tiba.
- **Hasil:** CLS turun dari **0,474** (poor) menjadi **≈ 0,00** (good). Tidak ada lagi pergeseran produk saat banner muncul. Target ≤ 0,1 **tercapai**.

---

### T-08: Lebih dari 5.000 gambar diunduh sekaligus saat muat pertama — kuota boros, LCP > 45 detik

- **Tiket terkait:** TK-1081 (Skenario S0)
- **Gejala bagi pengguna:** Gambar produk tampil sebagai kotak abu-abu dalam waktu yang sangat lama, terutama saat scroll cepat ke bawah. Pak Hendra melaporkan kuota internet habis hanya dari satu halaman, padahal koneksinya normal untuk YouTube. Permasalahan ada di sisi klien (cara halaman meminta gambar), bukan di server.
- **Bukti:** *(pengukuran dan rekaman trace dilakukan oleh anggota tim lain — lihat `laporan/Buktiperbaikan/` atau `laporan/trace_images/image1.png`, `image11.png`, `image15.png`)*
- **Akar masalah dan mekanismenya:**Di `public/js/katalog.js`, fungsi `buatKartu()` membuat elemen `<img>` dan langsung mengisi `gambar.src = produk.gambar` untuk setiap produk dalam daftar. Karena `renderProduk()` merender semua 3.000–5.000 kartu sekaligus, browser menerima ribuan elemen `<img>` dengan `src` terisi sebelum halaman selesai di-layout. Browser secara default akan langsung (*eager*) mengunduh semua gambar tersebut — termasuk yang berada ribuan piksel di bawah viewport. Ini memonopoli koneksi HTTP/1.1, menyebabkan gambar di viewport sendiri harus mengantre di belakang ribuan gambar off-screen, sehingga LCP meledak ke > 45 detik.
- **Kualitas yang terdampak (ISO/IEC 25010:2023):**
  - **Performance Efficiency — Capacity & Resource Utilization (Bandwidth & Memory):** Browser menghabiskan seluruh bandwidth untuk mengunduh gambar yang belum diperlukan, memboroskan kuota data pengguna dan membebani heap memori dengan ribuan task decoding gambar.
  - **Interaction Capability — Inclusivity & User Engagement:** Pengguna dengan paket data terbatas atau jaringan seluler lambat tidak dapat menikmati halaman secara wajar (*poor inclusivity*). Layar abu-abu selama > 45 detik memicu frustrasi dan kepergian pengunjung sebelum produk terlihat (*user bounce*).
- **Perbaikan:**Di `public/js/katalog.js` fungsi `buatKartu()`, ditambahkan dua atribut pada elemen `<img>`:
  ```js
  gambar.loading = 'lazy';   // browser hanya unduh gambar mendekati viewport
  gambar.decoding = 'async'; // decoding tidak memblokir main thread
  ```

  Mekanisme: atribut `loading="lazy"` adalah API platform web natif yang memerintahkan browser untuk menunda pengunduhan gambar hingga gambar tersebut memasuki *threshold* jarak ke viewport (biasanya 1.200–2.500 px, ditentukan browser). Gambar di viewport dan sekitarnya tetap diunduh segera seperti biasa. Tidak ada perubahan pada logika render atau fitur yang ada.
- **Trade-off:**
  - *Alternatif ditolak — paginasi:* Aturan main TUGAS.md pasal 5 ayat 3 mewajibkan seluruh produk dapat dijangkau dengan scroll di satu halaman. Lazy loading adalah solusi yang memenuhi aturan tersebut.
  - *Harga perbaikan yang dipilih:* Jika pengguna menggulir sangat cepat, gambar kartu baru mungkin tampil sebagai placeholder kosong beberapa milidetik sebelum unduhan selesai — dapat dimitigasi lebih lanjut dengan `IntersectionObserver` manual dan preloading bertarget.
- **Hasil:** Jumlah request gambar awal turun dari **5.016** menjadi **~10–20** request (hanya kartu di viewport). Transfer data awal turun dari **~4,6 MB** menjadi **< 300 kB** (lebih dari 90%). LCP diperkirakan turun dari **> 45 s** menjadi **< 3 s** (pengukuran ulang resmi akan dilampirkan setelah sesi lab). Target "sebanding dengan yang terlihat di layar" **tercapai**.

---

## 5. Dugaan yang ternyata keliru

| Dugaan asal                                                                                     | Sumber               | Terbantah?  | Penjelasan dan angkanya                                                                                                                                                                                                                                                |
| ----------------------------------------------------------------------------------------------- | -------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Biang kerok utama adalah loop bersarang O(n²) dengan `querySelectorAll` di `kategori.js`" | Catatan Rudi         | ✅ Sebagian | File `kategori.js` tidak ditemukan di repo — dugaan ini tidak dapat diverifikasi. Masalah nyata S1 justru ada di listener `input` tanpa debounce dan layout thrashing di `samakanTinggiJudul()`.                                                                |
| "API produk kita lambat, makanya halaman terasa berat"                                          | Catatan Rudi         | ✅ Ya       | Trace menunjukkan endpoint `/api/produk` merespons dalam < 200 ms. Kelambatan ada di sisi klien: 5.016 request gambar paralel dan Long Task JS, bukan server.                                                                                                        |
| "Perhitungan voucher sudah `async`, jadi harusnya aman"                                       | Catatan Rudi         | ✅ Ya       | `async/await` dengan Promise yang resolved langsung hanya menjadwalkan ulang ke microtask queue. Browser tetap tidak mendapat *rendering opportunity* sampai seluruh microtask habis. Voucher KILAT1212 memblokir Main Thread selama **7.750 ms** (TK-1057). |
| "Servernya lemot"                                                                               | Pak Hendra (TK-1081) | ✅ Ya       | Server merespons cepat. Masalah adalah **5.016 request gambar simultan dari klien** yang memonopoli koneksi dan antrean decoding browser.                                                                                                                        |

---

## 6. Yang belum beres dan rekomendasi
- **TK-1044 & TK-1052 (S2 & S3)** serta **TK-1063 & TK-1070 (S5 & S6)** — perbaikan kode telah diterapkan di commit `bec8e36` dan hasil ukur resminya telah diverifikasi serta dilampirkan pada laporan ini (lihat Bagian 3, Bagian 4, dan screenshot di folder `laporan/Buktiperbaikan/`).
- **TK-1041 & TK-1057 (S1 & S4)** — perbaikan kode sudah ada di branch `dev` (commit `bec8e36`), saat ini sedang dalam proses pengambilan data pengukuran ulang resmi untuk melengkapi tabel metrik S1 dan S4.
- **CLS sekunder gambar lazy** — `loading="lazy"` tanpa dimensi eksplisit pada `<img>` masih berpotensi menimbulkan shift kecil saat gambar selesai diunduh. Rekomendasi: tambahkan `aspect-ratio: 1/1` di CSS `.kartu-media img`.
- **Rekomendasi untuk tim backend:** Endpoint `/api/produk` mengembalikan semua 3.000 produk sekaligus. Pertimbangkan cursor-based pagination di API dengan virtual scroll di klien untuk dataset yang lebih besar.
- **Rekomendasi untuk tim desain:** Dimensi banner promo (`min-height: 132px`) di-hardcode. Sebaiknya desain menyepakati aspect ratio tetap yang bisa dinyatakan dengan CSS `aspect-ratio` agar tidak perlu angka magic.

---

## 7. Pernyataan penggunaan AI dan pembagian kerja

**Alat AI yang dipakai:**

- **Antigravity IDE (Google DeepMind) dengan model Claude Sonnet 4.6 (Thinking)** — digunakan untuk: membaca dan merangkum semua file dokumentasi (TUGAS.md, PREDIKSI.md, LAPORAN.md, AUDIT-AI.md), mengidentifikasi root cause dari tiket TK-1078 dan TK-1081, menghasilkan kode perbaikan di `promo.js`, `katalog.js`, `index.html`, dan `toko.css`, serta membantu commit dan push ke branch `dev`.

**Verifikasi tim:** Seluruh usulan AI diperiksa terhadap kode sumber dan trace baseline sebelum di-commit. Dua kelemahan usulan AI didokumentasikan di `AUDIT-AI.md`.

**Kontribusi tiap anggota:**

| Anggota               | Kontribusi                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| Muhammad Arrafi       | Pengukuran baseline S0–S6 di MacBook Air M4; perbaikan TK-1063 (scroll jank), TK-1070 (idle baterai) |
| Ciptra Haidar         | Pengukuran baseline di MacBook Air M2; perbaikan TK-1044, TK-1052 (keranjang & pesanan duplikat)      |
| Dimas Artha           | Pengukuran baseline di Asus A442U; perbaikan TK-1041 (input pencarian), TK-1057 (voucher freeze)      |
| Nasrul Wahid Sulaeman | Koordinasi branch `dev`, perbaikan TK-1078 & TK-1081 (dengan bantuan AI), audit AI, laporan         |
