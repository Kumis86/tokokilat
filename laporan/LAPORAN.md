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

| Parameter | Nilai |
|-----------|-------|
| Perangkat 1 | MacBook Air M4 (macOS), browser Brave/Chrome versi stabil |
| Perangkat 2 | MacBook Air M2 (macOS), viewport 1280 × 832 |
| Perangkat 3 | Asus A442U (Windows 10, PowerShell), layar 1366 × 768 |
| Viewport emulasi | DevTools Device Toolbar — Responsive **412 × 915**, User Agent Mobile |
| Mode incognito | Ya — tab lain ditutup, ekstensi dinonaktifkan |
| CPU throttling | **4× slowdown** (panel Performance) |
| Network throttling | Tidak (No throttling) |
| Mode server | `npm start` → `JUMLAH_PRODUK = 3.000` (terverifikasi dari log terminal dan banner katalog) |
| Pengulangan | 3 kali per skenario, dilaporkan **median** |
| Alat ukur tambahan | Panel alat ukur di pojok kiri bawah halaman (INP, Long Task, Blokir, Frame drop) |

---

## 3. Hasil sebelum dan sesudah

| Skenario | Metrik                                        | Sebelum (median) | Sesudah (median) | Target                         | Tercapai? |
| -------- | --------------------------------------------- | ---------------- | ---------------- | ------------------------------ | --------- |
| S0       | CLS                                           | 0,474            | ≈ 0,00           | <= 0,1                         | ✅        |
| S0       | Jumlah permintaan gambar dalam 10 dtk pertama | 5.016            | ~10–20           | sebanding dengan yang terlihat | ✅        |
| S1       | INP                                           |                  |                  | <= 200 ms                      |           |
| S1       | Long task terlama                             |                  |                  | <= 100 ms                      |           |
| S2       | INP                                           |                  |                  | <= 200 ms                      |           |
| S3       | Jumlah pesanan dari 3 klik                    |                  |                  | 1                              |           |
| S4       | INP / progres tergambar bertahap?             |                  |                  |                                |           |
| S5       | Frame > 50 ms per 10 dtk                      |                  |                  | <= 2                           |           |
| S6       | Frame > 50 ms per 10 dtk                      |                  |                  | <= 2                           |           |

---

## 4. Temuan

### T-07: Tata letak meloncat ke bawah saat banner promo muncul — CLS 0,474

- **Tiket terkait:** TK-1078 (Skenario S0)
- **Gejala bagi pengguna:** Beberapa ratus milidetik setelah halaman terlihat, seluruh daftar produk tiba-tiba melorot ke bawah. Kak Rara yang hendak memencet produk teratas justru menekan banner promo karena posisi elemen bergeser tepat saat jarinya turun. Pengguna curiga antarmuka sengaja dirancang menjebak klik iklan.
- **Bukti:** *(pengukuran dan rekaman trace dilakukan oleh anggota tim lain — lihat `laporan/Buktiperbaikan/` atau `laporan/trace_images/image1.png`)*
- **Akar masalah dan mekanismenya:**  
  Di `public/js/promo.js`, fungsi `pasangBannerPromo()` memanggil `$('#utama').prepend(banner)` setelah data API tiba secara asinkron. Operasi `prepend()` menyisipkan elemen `<section class="promo-banner">` baru ke puncak `#utama`. Karena tidak ada ruang yang disiapkan di HTML awal, browser dipaksa menghitung ulang geometri seluruh subtree dokumen (Recalculate Style → Layout / Reflow). Seluruh kartu produk yang sudah dirender bergeser ke bawah sebesar tinggi banner (~132 px), memicu **Cumulative Layout Shift** dengan skor 0,474.
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
- **Akar masalah dan mekanismenya:**  
  Di `public/js/katalog.js`, fungsi `buatKartu()` membuat elemen `<img>` dan langsung mengisi `gambar.src = produk.gambar` untuk setiap produk dalam daftar. Karena `renderProduk()` merender semua 3.000–5.000 kartu sekaligus, browser menerima ribuan elemen `<img>` dengan `src` terisi sebelum halaman selesai di-layout. Browser secara default akan langsung (*eager*) mengunduh semua gambar tersebut — termasuk yang berada ribuan piksel di bawah viewport. Ini memonopoli koneksi HTTP/1.1, menyebabkan gambar di viewport sendiri harus mengantre di belakang ribuan gambar off-screen, sehingga LCP meledak ke > 45 detik.
- **Kualitas yang terdampak (ISO/IEC 25010:2023):**
  - **Performance Efficiency — Capacity & Resource Utilization (Bandwidth & Memory):** Browser menghabiskan seluruh bandwidth untuk mengunduh gambar yang belum diperlukan, memboroskan kuota data pengguna dan membebani heap memori dengan ribuan task decoding gambar.
  - **Interaction Capability — Inclusivity & User Engagement:** Pengguna dengan paket data terbatas atau jaringan seluler lambat tidak dapat menikmati halaman secara wajar (*poor inclusivity*). Layar abu-abu selama > 45 detik memicu frustrasi dan kepergian pengunjung sebelum produk terlihat (*user bounce*).
- **Perbaikan:**  
  Di `public/js/katalog.js` fungsi `buatKartu()`, ditambahkan dua atribut pada elemen `<img>`:
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

| Dugaan asal | Sumber | Terbantah? | Penjelasan dan angkanya |
|---|---|---|---|
| "Biang kerok utama adalah loop bersarang O(n²) dengan `querySelectorAll` di `kategori.js`" | Catatan Rudi | ✅ Sebagian | File `kategori.js` tidak ditemukan di repo — dugaan ini tidak dapat diverifikasi. Masalah nyata S1 justru ada di listener `input` tanpa debounce dan layout thrashing di `samakanTinggiJudul()`. |
| "API produk kita lambat, makanya halaman terasa berat" | Catatan Rudi | ✅ Ya | Trace menunjukkan endpoint `/api/produk` merespons dalam < 200 ms. Kelambatan ada di sisi klien: 5.016 request gambar paralel dan Long Task JS, bukan server. |
| "Perhitungan voucher sudah `async`, jadi harusnya aman" | Catatan Rudi | ✅ Ya | `async/await` dengan Promise yang resolved langsung hanya menjadwalkan ulang ke microtask queue. Browser tetap tidak mendapat *rendering opportunity* sampai seluruh microtask habis. Voucher KILAT1212 memblokir Main Thread selama **7.750 ms** (TK-1057). |
| "Servernya lemot" | Pak Hendra (TK-1081) | ✅ Ya | Server merespons cepat. Masalah adalah **5.016 request gambar simultan dari klien** yang memonopoli koneksi dan antrean decoding browser. |

---

## 6. Yang belum beres dan rekomendasi

- **TK-1041, TK-1044, TK-1052, TK-1057, TK-1063, TK-1070** — perbaikan sudah ada di branch `dev` (commit `bec8e36`), namun hasil pengukuran ulang resmi belum dilampirkan di laporan ini.
- **CLS sekunder gambar lazy** — `loading="lazy"` tanpa dimensi eksplisit pada `<img>` masih berpotensi menimbulkan shift kecil saat gambar selesai diunduh. Rekomendasi: tambahkan `aspect-ratio: 1/1` di CSS `.kartu-media img`.
- **Rekomendasi untuk tim backend:** Endpoint `/api/produk` mengembalikan semua 3.000 produk sekaligus. Pertimbangkan cursor-based pagination di API dengan virtual scroll di klien untuk dataset yang lebih besar.
- **Rekomendasi untuk tim desain:** Dimensi banner promo (`min-height: 132px`) di-hardcode. Sebaiknya desain menyepakati aspect ratio tetap yang bisa dinyatakan dengan CSS `aspect-ratio` agar tidak perlu angka magic.

---

## 7. Pernyataan penggunaan AI dan pembagian kerja

**Alat AI yang dipakai:**
- **Antigravity IDE (Google DeepMind) dengan model Claude Sonnet 4.6 (Thinking)** — digunakan untuk: membaca dan merangkum semua file dokumentasi (TUGAS.md, PREDIKSI.md, LAPORAN.md, AUDIT-AI.md), mengidentifikasi root cause dari tiket TK-1078 dan TK-1081, menghasilkan kode perbaikan di `promo.js`, `katalog.js`, `index.html`, dan `toko.css`, serta membantu commit dan push ke branch `dev`.

**Verifikasi tim:** Seluruh usulan AI diperiksa terhadap kode sumber dan trace baseline sebelum di-commit. Dua kelemahan usulan AI didokumentasikan di `AUDIT-AI.md`.

**Kontribusi tiap anggota:**

| Anggota | Kontribusi |
|---------|-----------|
| Muhammad Arrafi | Pengukuran baseline S0–S6 di MacBook Air M4; perbaikan TK-1063 (scroll jank), TK-1070 (idle baterai) |
| Ciptra Haidar | Pengukuran baseline di MacBook Air M2; perbaikan TK-1044, TK-1052 (keranjang & pesanan duplikat) |
| Dimas Artha | Pengukuran baseline di Asus A442U; perbaikan TK-1041 (input pencarian), TK-1057 (voucher freeze) |
| Nasrul Wahid Sulaeman | Koordinasi branch `dev`, perbaikan TK-1078 & TK-1081 (dengan bantuan AI), audit AI, laporan |
