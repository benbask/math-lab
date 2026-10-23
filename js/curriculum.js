/* MathLab — curriculum map, skills, and the module registry. */
(function () {
  'use strict';

  const NS = (window.MathLab = window.MathLab || {});
  const registry = [];

  NS.registerModule = function registerModule(module) {
    if (!module || !module.id || typeof module.render !== 'function') {
      console.warn('MathLab: modul tidak valid diabaikan.', module);
      return;
    }
    const existing = registry.findIndex((item) => item.id === module.id);
    if (existing >= 0) registry[existing] = module;
    else registry.push(module);
    registry.sort((a, b) => (a.order || 0) - (b.order || 0));
  };

  NS.getModule = function getModule(id) {
    return registry.find((module) => module.id === id) || null;
  };

  NS.getModules = function getModules() {
    return registry.slice();
  };

  NS.modulesForStage = function modulesForStage(stageId) {
    return registry.filter((module) => module.stage === stageId || (module.alsoStages || []).includes(stageId));
  };

  NS.STAGES = [
    {
      id: 'A',
      title: 'Fondasi Prasekolah',
      age: 'sekitar 3–5 tahun',
      short: 'Fondasi',
      color: 'coral',
      tagline: 'Melihat, membandingkan, dan menemukan pola.',
      description: 'Anak membangun gagasan tentang banyak–sedikit, sama–beda, bentuk, posisi, dan urutan sebelum berfokus pada simbol angka.',
      focus: ['Banyak dan sedikit', 'Mencocokkan benda', 'Mengelompokkan', 'Bentuk dan ukuran', 'Pola sederhana', 'Angka 0–10']
    },
    {
      id: 'B',
      title: 'Number Sense Dasar',
      age: 'sekitar 5–7 tahun',
      short: 'Number sense',
      color: 'teal',
      tagline: 'Angka punya makna, bukan hanya nama.',
      description: 'Anak menghubungkan jumlah, simbol angka, frame, pasangan bilangan, dan posisi pada garis bilangan.',
      focus: ['Angka 0–20', '5-frame & 10-frame', 'Pasangan bilangan', 'Garis bilangan', 'Penjumlahan visual', 'Puluhan & satuan']
    },
    {
      id: 'C',
      title: 'Struktur Bilangan',
      age: 'sekitar 7–9 tahun',
      short: 'Struktur',
      color: 'sun',
      tagline: 'Membongkar bilangan menjadi bagian yang mudah.',
      description: 'Anak memakai nilai tempat, strategi mental, susunan perkalian, dan pembagian untuk menyelesaikan masalah.',
      focus: ['Nilai tempat', 'Strategi mental', 'Penjumlahan & pengurangan', 'Perkalian sebagai susunan', 'Pembagian', 'Faktor & kelipatan']
    },
    {
      id: 'D',
      title: 'Pecahan & Pengukuran',
      age: 'sekitar 9–11 tahun',
      short: 'Pecahan',
      color: 'blue',
      tagline: 'Bagian, keseluruhan, dan ruang di sekitar kita.',
      description: 'Anak membayangkan pecahan, membandingkan bagian, lalu menghubungkannya dengan desimal, persen, luas, dan koordinat.',
      focus: ['Pecahan senilai', 'Membandingkan pecahan', 'Desimal & persen', 'Luas & keliling', 'Volume', 'Koordinat dasar']
    },
    {
      id: 'E',
      title: 'Menuju Aljabar',
      age: 'sekitar 11–13 tahun',
      short: 'Aljabar awal',
      color: 'grape',
      tagline: 'Mencari yang belum diketahui dengan seimbang.',
      description: 'Anak memperluas bilangan, melihat pola, memahami variabel, dan menjaga kesetaraan pada timbangan maupun persamaan.',
      focus: ['Bilangan bulat', 'Rasio & persen', 'Pola bilangan', 'Variabel & ekspresi', 'Persamaan', 'Grafik dasar']
    },
    {
      id: 'F',
      title: 'Matematika SMP',
      age: 'sekitar 13–15 tahun',
      short: 'SMP',
      color: 'pink',
      tagline: 'Menghubungkan aljabar, bentuk, data, dan peluang.',
      description: 'Tahap ini memperdalam aljabar, geometri, transformasi, Pythagoras, statistika, dan peluang. Beberapa topik data masih direncanakan untuk versi berikutnya.',
      focus: ['Persamaan linear', 'Fungsi & gradien', 'Geometri bidang', 'Transformasi', 'Pythagoras', 'Statistika & peluang*']
    }
  ];

  NS.getStage = function getStage(id) {
    return NS.STAGES.find((stage) => stage.id === id) || null;
  };

  NS.SKILLS = {
    'quantity.compare': {
      id: 'quantity.compare',
      label: 'Membandingkan kuantitas',
      stage: 'A',
      moduleId: 'quantity',
      description: 'Melihat dua kelompok benda dan menentukan mana yang lebih banyak, lebih sedikit, atau sama.'
    },
    'patterns.repeat': {
      id: 'patterns.repeat',
      label: 'Pola berulang',
      stage: 'A',
      moduleId: 'patterns',
      description: 'Mengenali bagian yang berulang dan meneruskan pola bentuk atau warna.'
    },
    'patterns.grow': {
      id: 'patterns.grow',
      label: 'Pola bertumbuh',
      stage: 'A',
      moduleId: 'patterns',
      description: 'Menemukan aturan perubahan pada pola bilangan, lalu meneruskannya.'
    },
    'number.frames': {
      id: 'number.frames',
      label: 'Jumlah dalam frame',
      stage: 'B',
      moduleId: 'number-frames',
      description: 'Membaca jumlah tanpa selalu menghitung satu per satu dan melengkapi frame.'
    },
    'number.recognize': {
      id: 'number.recognize',
      label: 'Mengenali angka 0–20',
      stage: 'B',
      moduleId: 'number-frames',
      description: 'Menghubungkan lambang angka dengan banyak benda.'
    },
    'bonds.parts': {
      id: 'bonds.parts',
      label: 'Pasangan bilangan',
      stage: 'B',
      moduleId: 'number-bonds',
      description: 'Menguraikan bilangan menjadi dua bagian dan menemukan semua pasangannya.'
    },
    'line.number': {
      id: 'line.number',
      label: 'Garis bilangan',
      stage: 'B',
      moduleId: 'number-line',
      description: 'Memperkirakan posisi, melompat maju, dan melompat mundur pada garis bilangan.'
    },
    'arithmetic.addsub': {
      id: 'arithmetic.addsub',
      label: 'Strategi hitung',
      stage: 'C',
      moduleId: 'arithmetic',
      description: 'Menggunakan nilai tempat, membuat 10, dan memecah bilangan untuk menghitung.'
    },
    'multiplication.array': {
      id: 'multiplication.array',
      label: 'Perkalian sebagai susunan',
      stage: 'C',
      moduleId: 'multiplication',
      description: 'Melihat perkalian sebagai baris dan kolom, luas, serta faktor.'
    },
    'fractions.parts': {
      id: 'fractions.parts',
      label: 'Pecahan sebagai bagian',
      stage: 'D',
      moduleId: 'fractions',
      description: 'Membagi keseluruhan dan membaca berapa bagian yang diambil.'
    },
    'fractions.equivalent': {
      id: 'fractions.equivalent',
      label: 'Pecahan senilai & membandingkan',
      stage: 'D',
      moduleId: 'fractions',
      description: 'Mengenali pecahan yang bernilai sama dan membandingkan ukuran pecahan.'
    },
    'geometry.shapes': {
      id: 'geometry.shapes',
      label: 'Mengenali bentuk',
      stage: 'D',
      moduleId: 'geometry',
      description: 'Mengenali bangun datar dan sifat sisinya, termasuk saat diputar.'
    },
    'geometry.tangram': {
      id: 'geometry.tangram',
      label: 'Menyusun bentuk',
      stage: 'D',
      moduleId: 'geometry',
      description: 'Memindahkan, memutar, dan menyusun potongan bentuk menjadi satu bangun.'
    },
    'geometry.coordinates': {
      id: 'geometry.coordinates',
      label: 'Koordinat, keliling & luas',
      stage: 'E',
      moduleId: 'geometry',
      description: 'Menghubungkan titik pada kisi, lalu menghitung keliling dan luas poligon.'
    },
    'algebra.balance': {
      id: 'algebra.balance',
      label: 'Kesetaraan & variabel',
      stage: 'E',
      moduleId: 'algebra',
      description: 'Menjaga kedua sisi timbangan seimbang untuk menemukan nilai kotak misteri.'
    }
  };

  NS.getSkill = function getSkill(id) {
    return NS.SKILLS[id] || null;
  };

  NS.skillsForStage = function skillsForStage(stageId) {
    return Object.values(NS.SKILLS).filter((skill) => skill.stage === stageId);
  };

  NS.STATUS = {
    not_tried: { id: 'not_tried', label: 'Belum dicoba', short: 'Baru', tone: 'neutral', symbol: '○' },
    learning: { id: 'learning', label: 'Sedang dipelajari', short: 'Belajar', tone: 'learning', symbol: '◔' },
    mastered: { id: 'mastered', label: 'Mulai dikuasai', short: 'Dikuasai', tone: 'good', symbol: '✓' },
    needs_practice: { id: 'needs_practice', label: 'Perlu penguatan', short: 'Latih lagi', tone: 'practice', symbol: '↻' }
  };

  NS.LEARNING_LEVELS = [
    {
      id: 'preschool',
      label: 'Prasekolah',
      age: '3–5 tahun',
      hint: 'Belum atau baru mengenal angka',
      emoji: '🌱'
    },
    {
      id: 'early-primary',
      label: 'SD awal',
      age: '6–8 tahun',
      hint: 'Mengenal angka dan berhitung dasar',
      emoji: '🌼'
    },
    {
      id: 'upper-primary',
      label: 'SD atas',
      age: '9–11 tahun',
      hint: 'Operasi bilangan dan pecahan',
      emoji: '🚀'
    },
    {
      id: 'middle',
      label: 'SMP',
      age: '12–15 tahun',
      hint: 'Aljabar, geometri, dan penalaran',
      emoji: '🧭'
    }
  ];

  NS.AVATARS = ['🦊', '🐼', '🐸', '🐯', '🦉', '🐙', '🐳', '🦄', '🐝', '🦖', '🐨', '🐰'];

  NS.PLANNED_TOPICS = [
    'Statistika: membaca dan menyajikan data',
    'Peluang sederhana dan percobaan',
    'Sistem persamaan linear',
    'Transformasi dan kesebangunan',
    'Teorema Pythagoras'
  ];
})();
