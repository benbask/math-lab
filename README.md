# MathLab — Laboratorium Matematika Anak

MathLab adalah aplikasi belajar matematika interaktif untuk anak dari prasekolah sampai SMP. Aplikasi berjalan sepenuhnya di browser dengan **HTML5, CSS3, dan JavaScript murni** — tanpa framework, server aplikasi, database, proses build, atau ketergantungan internet.

Semua data belajar disimpan di `localStorage` perangkat dan tidak dikirim ke mana pun.

## Cara menjalankan

### Pilihan yang disarankan: server statis lokal

Jalankan dari folder `math-lab`:

```bash
node serve.js
```

Lalu buka `http://localhost:8000` di browser. Server ini hanya memakai modul bawaan Node.js, tanpa paket tambahan.

Jika Python tersedia, alternatifnya:

```bash
python -m http.server 8000
```

Untuk membuka dari ponsel atau perangkat lain di Wi-Fi yang sama, jalankan `node serve.js`, lalu buka alamat LAN yang ditampilkan di terminal (contoh: `http://192.168.1.10:8000/`). Jika Windows Firewall meminta izin, pilih izinkan akses untuk jaringan privat. Port dapat diganti, misalnya `node serve.js 8080`.

Alternatif lain: buka langsung `math-lab/index.html` (klik dua kali). Aplikasi tidak membutuhkan build step.

### Pasang sebagai aplikasi (PWA)

Versi online tersedia di **https://benbask.github.io/math-lab/**.

- **Android/desktop Chrome atau Edge:** buka tautan di atas, lalu klik tombol **Pasang** pada banner atau di **Pengaturan → Aplikasi**.
- **iPhone/iPad:** buka di Safari, ketuk **Bagikan**, lalu pilih **Tambah ke Layar Utama**.
- Setelah dipasang, MathLab tampil tanpa alamat browser dan bisa dibuka offline setelah pemuatan pertama.
- Pemasangan memerlukan HTTPS. Alamat LAN `http://...:8000` tetap bisa dipakai untuk belajar, tetapi browser biasanya tidak menawarkan pemasangan dari HTTP biasa.

Service worker menyimpan seluruh berkas aplikasi di cache. Saat mengubah berkas yang tercantum di `sw.js`, naikkan `CACHE_VERSION` agar pengguna menerima versi baru pada pembukaan berikutnya.

**Catatan `file://`:** MathLab tidak mengambil file eksternal, sehingga umumnya tetap berjalan saat dibuka langsung dari `index.html`. Namun perilaku `localStorage` pada protokol `file://` berbeda antar-browser dan bisa dianggap sebagai origin terpisah atau dibatasi. Untuk penyimpanan profil, ekspor/impor, dan pengujian yang paling dapat diandalkan, gunakan server statis lokal seperti contoh di atas.

Chrome/Edge modern adalah target utama. Aplikasi juga memakai layout responsif untuk ponsel Android, tablet, dan laptop.

## Fitur utama

- **10 aktivitas visual** untuk kuantitas, bilangan, pola, operasi hitung, perkalian, pecahan, geometri, dan aljabar awal.
- **Profil terpisah** untuk beberapa anak dalam satu perangkat. Setiap profil memiliki nama, avatar, tingkat belajar, progres, dan riwayat sesi sendiri.
- **Tingkat adaptif** berdasarkan jawaban dalam sesi, bukan satu jawaban saja.
- **Status kemampuan bertingkat:** belum dicoba, sedang dipelajari, mulai dikuasai, dan perlu penguatan.
- **Petunjuk bertahap** yang membuka bantuan lebih spesifik pada langkah berikutnya.
- **Penyimpanan lokal otomatis** setelah setiap jawaban dan setiap akhir sesi.
- **Ekspor/impor cadangan JSON** dengan validasi versi dan skema data.
- **Mode ramah akses:** navigasi keyboard, label ARIA, opsi suara, dan pengurangan gerakan.
- **Tanpa internet setelah aplikasi dimuat** dan tanpa iklan atau pelacakan.

## Cakupan aktivitas

| Aktivitas | Tahap | Mode / isi | Kemampuan yang dicatat |
|---|---|---|---|
| Quantity Explorer | A — Prasekolah | Membandingkan dua kelompok benda, termasuk susunan acak dan jumlah sama | `quantity.compare` |
| Pattern Explorer | A — Prasekolah | Pola berulang, pola bertumbuh, dan mode membuat pola | `patterns.repeat`, `patterns.grow` |
| Number Frames | B — Number sense | 5-, 10-, dan 20-frame; eksplorasi serta tantangan 5 putaran; kilas cepat opsional | `number.frames`, `number.recognize` |
| Number Bonds | B — Number sense | Menjelajah bagian–keseluruhan dan mencari semua pasangan bilangan | `bonds.parts` |
| Number Line | B — Number sense | Garis 0–10, 0–20, dan −10–10; jelajah serta tantangan | `line.number` |
| Arithmetic Visualizer | C — Struktur bilangan | Nilai tempat, membuat 10, garis bilangan, dan strategi mental; eksplorasi serta tantangan | `arithmetic.addsub` |
| Multiplication Array | C — Struktur bilangan | Susunan baris–kolom, luas, dan faktor; eksplorasi serta tantangan | `multiplication.array` |
| Fraction Lab | D — Pecahan | Laboratorium batang/lingkaran, membandingkan, dan tantangan pecahan senilai, desimal, persen, serta garis bilangan | `fractions.parts`, `fractions.equivalent` |
| Shape & Geometry Lab | D/F — Geometri & koordinat | Mengenali bentuk yang diputar, puzzle tangram 4 potongan, dan persegi panjang pada kisi koordinat | `geometry.shapes`, `geometry.tangram`, `geometry.coordinates` |
| Algebra Balance | E — Aljabar awal | Timbangan dua sisi, operasi setara, kotak variabel, dan persamaan linear sederhana | `algebra.balance` |

Sesi tantangan umumnya terdiri dari **5 putaran**. Beberapa modul juga memiliki mode eksplorasi, laboratorium, atau puzzle yang dapat diselesaikan secara mandiri.

## Progres, penguasaan, dan tingkat adaptif

MathLab membedakan **aktivitas selesai** dari **kemampuan mulai dikuasai**:

- **Aktivitas selesai** berarti anak sudah melewati seluruh rangkaian sesi aktivitas tersebut. Ini bukan bukti penguasaan.
- **Mulai dikuasai** memerlukan minimal **8 jawaban**, **2 sesi**, ketepatan keseluruhan minimal **75%**, dan ketepatan delapan jawaban terakhir minimal **70%**.
- **Perlu penguatan** muncul setelah minimal **6 jawaban** jika ketepatan rendah atau delapan jawaban terakhir menunjukkan banyak kesalahan.
- **Tingkat naik** setelah minimal **4 jawaban dalam satu sesi** dengan ketepatan minimal **80%**, tingkat petunjuk rendah, dan **2 sesi berturut-turut** yang konsisten.
- **Tingkat turun** setelah dua sesi berturut-turut yang menunjukkan kesulitan, agar latihan tidak terasa terlalu berat.

Karena itu, satu jawaban benar tidak langsung membuat kemampuan dianggap dikuasai.

## Data dan cadangan

- Kunci penyimpanan utama: `mathlab.v1`
- Skema data: versi `1`
- Data mencakup profil, pengaturan, progres per kemampuan, aktivitas selesai, dan maksimal 100 riwayat sesi per profil.
- **Ekspor JSON** mengunduh seluruh data sebagai berkas cadangan.
- **Impor** memvalidasi JSON, versi skema, ID profil, dan struktur progres sebelum menggabungkan data.
- Profil dengan ID yang sama akan **diganti** oleh isi cadangan; profil lain tidak dihapus.
- Jika data lama rusak, MathLab menyimpan salinan mentah di kunci `mathlab.corrupt.<timestamp>` dan menampilkan peringatan, bukan menghapus data secara diam-diam.
- **Hapus semua data** menghapus profil dan progres dari `localStorage` setelah konfirmasi.

Karena data hanya ada di browser perangkat ini:

- Membersihkan data situs, memakai mode privat, atau berganti browser dapat menghilangkan progres.
- Ekspor cadangan secara berkala.
- Data tidak tersinkronisasi antarperangkat dan tidak ada akun pengguna.

## Yang belum tersedia

Topik berikut **direncanakan** dan ditandai di peta kemampuan, tetapi belum menjadi aktivitas fungsional pada versi ini:

- Statistika: membaca dan menyajikan data
- Peluang sederhana dan percobaan
- Sistem persamaan linear
- Transformasi dan kesebangunan
- Teorema Pythagoras

Tahap **F — Matematika SMP** saat ini berisi aktivitas geometri dan aljabar awal yang juga relevan untuk SMP, bukan seluruh kurikulum SMP.

## Batasan lain yang diketahui

- Ringkasan hasil sesi hanya disimpan di memori selama tab terbuka. Jika halaman dimuat ulang pada rute hasil, MathLab menampilkan pesan bahwa ringkasan tidak tersedia; progres jawaban tetap tersimpan.
- Ekspor menggunakan unduhan browser. Impor dibatasi maksimal **5 MB** dan maksimal **30 profil** per berkas.
- Setiap profil menyimpan maksimal **100 sesi** dan **40 jawaban terakhir per kemampuan** untuk perhitungan adaptasi.
- Suara adalah efek pendek berbasis Web Audio, bukan narasi. Preferensi suara dan pengurangan gerakan berlaku per perangkat.
- Antarmuka menggunakan bahasa Indonesia.
- Aplikasi tidak memiliki backend, akun, sinkronisasi cloud, atau fitur multiperangkat.
- Puzzle tangram dapat dimainkan dengan pointer atau keyboard (panah untuk memindahkan, `R` untuk memutar). Mode koordinat menyediakan input angka selain ketukan pada kisi.

## Struktur berkas

```text
math-lab/
  index.html
  manifest.webmanifest  # metadata PWA
  sw.js                 # cache offline dan pembaruan service worker
  serve.js              # server statis lokal tanpa dependensi
  css/
    style.css
  icons/                # ikon PWA dan Apple Touch Icon
  js/
    utils.js            # helper DOM, matematika, aksesibilitas
    curriculum.js       # tahap, kemampuan, registri modul
    storage.js          # localStorage, validasi, ekspor/impor
    profiles.js         # pembungkus profil
    progress.js         # progres, penguasaan, adaptasi
    components.js       # komponen UI bersama
    modules/            # 10 modul aktivitas
    pwa.js              # instalasi PWA dan registrasi service worker
    app.js              # routing, sesi, halaman, dialog, pengaturan
```

## Pengujian yang sudah dilakukan

- Semua 10 modul dijalankan di browser hingga sesi/aktivitas selesai.
- Alur jawaban benar, jawaban salah, petunjuk bertahap, dan hasil sesi diperiksa.
- Profil kedua, isolasi progres, pergantian profil, penghapusan dengan konfirmasi, dan persistensi setelah reload diuji.
- Ekspor JSON, impor valid, penggantian profil dengan ID sama, JSON tidak valid, versi skema tidak didukung, data `localStorage` rusak, dan reset total diuji.
- Layout diperiksa pada lebar 320, 390, 820, dan 1024 piksel tanpa overflow horizontal.
- PWA diverifikasi dengan manifest tanpa error, ikon 192/512 dan maskable, service worker aktif, dan reload offline berhasil.
- Semua berkas JavaScript lolos pemeriksaan sintaks; tidak ada `eval`, `innerHTML` untuk data pengguna, atau permintaan jaringan eksternal.
