/* Arithmetic Visualizer — see operations, compare strategies, and connect them to symbols. */
(function () {
  'use strict';

  const NS = window.MathLab;
  const { h, icon, randInt, pick, clamp } = NS.util;
  const { feedback, hintPanel, roundBanner, segmented, stepper, numberEntry } = NS.Components;
  const SKILL = 'arithmetic.addsub';
  const TOTAL_ROUNDS = 5;

  function makeProblem(level) {
    const op = Math.random() < 0.54 ? 'add' : 'subtract';
    let a;
    let b;
    if (level <= 1) {
      if (op === 'add') {
        a = randInt(0, 5);
        b = randInt(1, 9 - a);
      } else {
        a = randInt(2, 10);
        b = randInt(1, a);
      }
    } else if (level === 2) {
      if (op === 'add') {
        a = randInt(4, 9);
        b = randInt(10 - a, 9);
        if (a + b < 11) b = Math.min(9, 11 - a + randInt(0, 3));
      } else {
        a = randInt(11, 20);
        b = randInt(Math.max(2, a - 9), Math.min(9, a - 1));
      }
    } else if (level === 3) {
      if (op === 'add') {
        a = randInt(12, 79);
        b = randInt(2, 9);
      } else {
        a = randInt(21, 95);
        b = randInt(2, 9);
      }
    } else if (level === 4) {
      if (op === 'add') {
        a = randInt(13, 58);
        b = randInt(12, 41);
      } else {
        a = randInt(32, 96);
        b = randInt(12, Math.min(49, a - 1));
      }
    } else {
      if (op === 'add') {
        a = randInt(28, 86);
        b = randInt(17, 69);
      } else {
        a = randInt(55, 128);
        b = randInt(19, Math.min(78, a - 1));
      }
    }
    if (op === 'subtract' && b > a) [a, b] = [b, a];
    const answer = op === 'add' ? a + b : a - b;
    return { a, b, op, answer };
  }

  function addStrategies(p) {
    const { a, b, answer } = p;
    const ta = Math.floor(a / 10);
    const ua = a % 10;
    const tb = Math.floor(b / 10);
    const ub = b % 10;
    const strategies = [];

    strategies.push({
      title: 'Pecah nilai tempat',
      tag: 'puluhan + satuan',
      text: `${a} + ${b} = (${ta * 10} + ${tb * 10}) + (${ua} + ${ub}) = ${ta * 10 + tb * 10} + ${ua + ub} = ${answer}.`,
      note: 'Puluhan dijumlahkan dengan puluhan, satuan dengan satuan.'
    });

    let gapA = ua === 0 ? 0 : 10 - ua;
    let gapB = ub === 0 ? 0 : 10 - ub;
    if (gapA > 0 && b >= gapA) {
      strategies.push({
        title: `Buat ${a + gapA} lebih dulu`,
        tag: 'lengkapi ke puluhan',
        text: `${a} + ${gapA} = ${a + gapA}; ${b} − ${gapA} = ${b - gapA}; ${a + gapA} + ${b - gapA} = ${answer}.`,
        note: 'Ambil sedikit dari bilangan kedua untuk melengkapi bilangan pertama menjadi puluhan.'
      });
    } else if (gapB > 0 && a >= gapB) {
      strategies.push({
        title: `Buat ${b + gapB} lebih dulu`,
        tag: 'lengkapi ke puluhan',
        text: `${b} + ${gapB} = ${b + gapB}; ${a} − ${gapB} = ${a - gapB}; ${a - gapB} + ${b + gapB} = ${answer}.`,
        note: 'Bilangan yang lebih dekat ke puluhan bisa dilengkapi lebih dulu.'
      });
    }

    const tensB = Math.floor(b / 10) * 10;
    const onesB = b % 10;
    strategies.push({
      title: 'Lompat di garis bilangan',
      tag: 'hitung maju',
      text: `Mulai di ${a}. Lompat ${tensB} menjadi ${a + tensB}${onesB ? `, lalu ${onesB} menjadi ${answer}` : ''}.`,
      note: 'Pecah lompatan menjadi puluhan dan satuan agar mudah diikuti.'
    });
    return strategies;
  }

  function subtractStrategies(p) {
    const { a, b, answer } = p;
    const tensB = Math.floor(b / 10) * 10;
    const onesB = b % 10;
    const strategies = [
      {
        title: 'Pecah pengurang',
        tag: 'puluhan lalu satuan',
        text: `${a} − ${tensB} = ${a - tensB}${onesB ? `; ${a - tensB} − ${onesB} = ${answer}` : ''}.`,
        note: 'Mengurangi puluhan lebih dulu sering membuat hitungan lebih mudah.'
      }
    ];

    const next = Math.ceil(b / 10) * 10;
    const step1 = next - b;
    const step2 = a - next;
    if (step2 >= 0) {
      strategies.push({
        title: 'Hitung maju',
        tag: 'dari pengurang ke bilangan awal',
        text: `${b} + ${step1} = ${next}${step2 ? `; ${next} + ${step2} = ${a}` : ''}. Total lompatan ${step1}${step2 ? ` + ${step2}` : ''} = ${answer}.`,
        note: 'Selisih juga bisa dilihat sebagai jarak yang harus ditempuh.'
      });
    }

    const adjust = a % 10;
    if (adjust > 0 && b - adjust >= 0 && a - adjust >= b - adjust) {
      strategies.push({
        title: 'Kurangi ke puluhan',
        tag: 'selisih tetap',
        text: `${a} − ${adjust} = ${a - adjust}; ${b} − ${adjust} = ${b - adjust}; ${a - adjust} − ${b - adjust} = ${answer}.`,
        note: 'Mengurangi bilangan yang sama dari kedua pihak tidak mengubah selisih.'
      });
    }
    return strategies;
  }

  function strategiesFor(p) {
    return p.op === 'add' ? addStrategies(p) : subtractStrategies(p);
  }

  function blockGroup(value, color, label, faded = false) {
    const tens = Math.floor(value / 10);
    const ones = value % 10;
    const rods = h('div', { class: 'base-ten-rods' });
    for (let index = 0; index < tens; index += 1) {
      rods.appendChild(h('span', { class: 'base-ten-rod', 'aria-hidden': 'true' }));
    }
    const units = h('div', { class: 'base-ten-units' });
    for (let index = 0; index < ones; index += 1) {
      units.appendChild(h('span', { class: 'base-ten-unit', 'aria-hidden': 'true' }));
    }
    return h('div', {
      class: `base-ten-group ${faded ? 'is-faded' : ''}`.trim(),
      style: { '--block-color': color },
      'aria-label': `${label}: ${value}, yaitu ${tens} puluhan dan ${ones} satuan`
    },
    h('div', { class: 'base-ten-group__top' },
      h('strong', {}, label),
      h('span', { class: 'count-badge', style: { background: color } }, String(value))
    ),
    h('div', { class: 'base-ten-blocks' },
      h('div', { class: 'base-ten-side' }, h('span', { class: 'base-ten-side__label' }, 'puluhan'), rods),
      h('div', { class: 'base-ten-side' }, h('span', { class: 'base-ten-side__label' }, 'satuan'), units)
    ),
    h('span', { class: 'base-ten-caption' }, `${tens} puluhan + ${ones} satuan`));
  }

  function render(root, ctx) {
    const state = {
      mode: 'challenge',
      level: ctx.getLevel(SKILL),
      round: 1,
      problem: null,
      locked: false,
      wrong: 0,
      hintLevel: 0,
      exploreA: 27,
      exploreB: 18,
      exploreOp: 'add'
    };
    state.problem = makeProblem(state.level);

    const clear = NS.util.clear;
    function rerender() {
      clear(root);
      root.appendChild(build());
    }

    function setMode(mode) {
      if (mode === state.mode) return;
      state.mode = mode;
      state.locked = false;
      state.wrong = 0;
      state.hintLevel = 0;
      if (mode === 'challenge' && !state.problem) state.problem = makeProblem(state.level);
      rerender();
    }

    function submit(value) {
      if (state.locked || !state.problem) return;
      const correct = Number(value) === state.problem.answer;
      ctx.recordAttempt({ correct, skillId: SKILL });
      if (correct) {
        state.locked = true;
        state.hintLevel = 0;
        ctx.sound('good');
      } else {
        state.wrong += 1;
        ctx.sound('try');
      }
      rerender();
    }

    function useHint() {
      if (state.locked) return;
      if (state.hintLevel >= 2) return;
      state.hintLevel += 1;
      ctx.recordHint(SKILL);
      rerender();
    }

    function nextRound() {
      if (state.round >= TOTAL_ROUNDS) {
        ctx.finish({ completed: true });
        return;
      }
      state.round += 1;
      state.problem = makeProblem(state.level);
      state.locked = false;
      state.wrong = 0;
      state.hintLevel = 0;
      rerender();
    }

    function setExploreA(delta) {
      state.exploreA = clamp(state.exploreA + delta, 0, 99);
      if (state.exploreOp === 'subtract') state.exploreA = Math.max(state.exploreA, state.exploreB);
      rerender();
    }
    function setExploreB(delta) {
      state.exploreB = clamp(state.exploreB + delta, 0, 99);
      if (state.exploreOp === 'subtract') state.exploreB = Math.min(state.exploreB, state.exploreA);
      rerender();
    }
    function setExploreOp(op) {
      state.exploreOp = op;
      if (op === 'subtract') state.exploreB = Math.min(state.exploreA, state.exploreB);
      rerender();
    }

    function buildVisual(problem, reveal) {
      const { a, b, op, answer } = problem;
      const result = op === 'add' ? a + b : a - b;
      return h('section', { class: 'activity-card arithmetic-visual' },
        h('div', { class: 'equation-display', 'aria-label': `Persamaan ${a} ${op === 'add' ? 'tambah' : 'kurang'} ${b}` },
          h('span', { class: 'equation-number' }, String(a)),
          h('span', { class: 'equation-op' }, op === 'add' ? '+' : '−'),
          h('span', { class: 'equation-number' }, String(b)),
          h('span', { class: 'equation-op' }, '='),
          h('span', { class: `equation-answer ${reveal ? 'is-revealed' : ''}`.trim() }, reveal ? String(result) : '?')
        ),
        h('div', { class: 'base-ten-stack' },
          blockGroup(a, '#5b8def', op === 'add' ? 'Bilangan pertama' : 'Mulai dari'),
          h('div', { class: 'base-ten-operator', 'aria-hidden': 'true' }, op === 'add' ? '+' : '−'),
          blockGroup(b, op === 'add' ? '#ff7a59' : '#b9c3d9', op === 'add' ? 'Bilangan kedua' : 'Yang diambil', op === 'subtract'),
          reveal ? h('div', { class: 'base-ten-result' },
            h('span', {}, 'hasil'),
            h('strong', {}, String(answer)),
            h('span', { class: 'base-ten-result__note' }, `${Math.floor(answer / 10)} puluhan + ${answer % 10} satuan`)
          ) : null
        ),
        h('p', { class: 'activity-footnote' }, 'Puluhan digambar sebagai batang, satuan sebagai kotak kecil. Warna hanya membantu mata; nilainya tetap sama.')
      );
    }

    function strategyCards(problem) {
      const strategies = strategiesFor(problem);
      return h('div', { class: 'strategy-section' },
        h('div', { class: 'strategy-section__heading' },
          h('span', { class: 'eyebrow' }, 'Beberapa cara berpikir'),
          h('h3', {}, 'Semua strategi ini menuju jawaban yang sama')
        ),
        h('div', { class: 'strategy-grid' },
          strategies.map((strategy, index) => h('article', { class: 'strategy-card' },
            h('span', { class: 'strategy-card__index' }, String(index + 1)),
            h('div', {},
              h('span', { class: 'strategy-card__tag' }, strategy.tag),
              h('strong', {}, strategy.title),
              h('p', {}, strategy.text),
              h('small', {}, strategy.note)
            )
          ))
        )
      );
    }

    function buildChallenge(fragment) {
      const p = state.problem;
      const prompt = p.op === 'add' ? 'Berapa hasil penjumlahannya?' : 'Berapa hasil pengurangannya?';
      fragment.appendChild(h('div', { class: 'activity-intro' },
        h('div', {},
          h('p', { class: 'activity-intro__eyebrow' }, 'Arithmetic Visualizer'),
          h('p', { class: 'activity-intro__text' }, 'Lihat benda, pecah bilangan, lalu pilih strategi yang paling masuk akal bagimu.')
        ),
        h('div', { class: 'level-chip' }, `Tingkat ${state.level}`)
      ));
      fragment.appendChild(h('div', { class: 'mode-row' },
        segmented({
          label: 'Mode Arithmetic',
          value: state.mode,
          options: [{ value: 'challenge', label: 'Tantangan' }, { value: 'explore', label: 'Eksplorasi' }],
          onChange: setMode
        })
      ));
      fragment.appendChild(roundBanner({
        round: state.round,
        total: TOTAL_ROUNDS,
        tag: `Tantangan ${state.round} dari ${TOTAL_ROUNDS}`,
        title: prompt,
        instruction: 'Kamu boleh menghitung dengan cara apa pun. visual ini adalah alat bantu, bukan aturan.'
      }));
      fragment.appendChild(h('div', { class: 'activity-toolbar activity-toolbar--center' },
        h('span', { class: 'chip chip--soft' }, p.op === 'add' ? 'Penjumlahan' : 'Pengurangan'),
        h('span', { class: 'chip chip--soft' }, `Dalam ${p.op === 'add' ? 'penjumlahan' : 'pengurangan'} ini, nilai tempat membantu.`),
        !state.locked ? h('button', { type: 'button', class: 'btn btn--soft btn--small', onclick: useHint }, icon('bulb', 17), 'Petunjuk') : null
      ));
      fragment.appendChild(buildVisual(p, state.locked));

      if (!state.locked) {
        const entry = numberEntry({ onSubmit: submit, maxLength: 4, label: 'Hasilnya?', submitLabel: 'Cek hasil' });
        fragment.appendChild(entry.node);
        if (state.wrong > 0) {
          fragment.appendChild(feedback('try', 'Belum tepat — ayo coba lagi.', p.op === 'add'
            ? 'Pecah kedua bilangan menjadi puluhan dan satuan. Setelah itu jumlahkan bagian yang sejenis.'
            : 'Kurangi puluhan lebih dulu, lalu kurangi satuannya. Kamu juga boleh menghitung maju.'));
        }
        if (state.hintLevel > 0) {
          fragment.appendChild(hintPanel(p.op === 'add'
            ? state.hintLevel === 1
              ? `Coba buat ${p.a} menjadi puluhan terdekat dengan meminjam sedikit dari ${p.b}.`
              : `Puluhan: ${Math.floor(p.a / 10) * 10} + ${Math.floor(p.b / 10) * 10} = ${Math.floor(p.a / 10) * 10 + Math.floor(p.b / 10) * 10}. Satuan: ${p.a % 10} + ${p.b % 10} = ${(p.a % 10) + (p.b % 10)}.`
            : state.hintLevel === 1
              ? `Coba kurangi ${Math.floor(p.b / 10) * 10} lebih dulu, lalu sisa satuannya.`
              : `${p.a} − ${Math.floor(p.b / 10) * 10} = ${p.a - Math.floor(p.b / 10) * 10}. Sekarang kurangi ${p.b % 10} lagi.`));
        }
      } else {
        fragment.appendChild(feedback('good', 'Jawabanmu tepat!', `${p.a} ${p.op === 'add' ? '+' : '−'} ${p.b} = ${p.answer}. Ada lebih dari satu jalan untuk sampai ke jawaban ini.`, {
          actions: h('button', { type: 'button', class: 'btn btn--primary', onclick: nextRound },
            state.round >= TOTAL_ROUNDS ? 'Lihat hasil' : 'Tantangan berikutnya', icon('arrow-right', 18))
        }));
        fragment.appendChild(strategyCards(p));
      }
      fragment.appendChild(h('p', { class: 'activity-footnote' }, 'Tidak ada satu strategi yang wajib. Pilih cara yang membuatmu paling yakin, lalu periksa dengan cara lain.'));
    }

    function buildExplore(fragment) {
      const p = { a: state.exploreA, b: state.exploreB, op: state.exploreOp };
      p.answer = p.op === 'add' ? p.a + p.b : p.a - p.b;
      fragment.appendChild(h('div', { class: 'activity-intro' },
        h('div', {},
          h('p', { class: 'activity-intro__eyebrow' }, 'Arithmetic Visualizer'),
          h('p', { class: 'activity-intro__text' }, 'Atur dua bilangan dan operasinya. Lihat bagaimana benda, nilai tempat, dan strategi bekerja bersama.')
        ),
        h('div', { class: 'level-chip' }, 'Ruang eksplorasi')
      ));
      fragment.appendChild(h('div', { class: 'mode-row' },
        segmented({
          label: 'Mode Arithmetic',
          value: state.mode,
          options: [{ value: 'challenge', label: 'Tantangan' }, { value: 'explore', label: 'Eksplorasi' }],
          onChange: setMode
        })
      ));
      fragment.appendChild(h('section', { class: 'activity-card' },
        h('div', { class: 'explore-controls' },
          stepper({ label: 'Bilangan A', value: p.a, min: 0, max: 99, onMinus: () => setExploreA(-1), onPlus: () => setExploreA(1) }),
          segmented({ label: 'Operasi', value: p.op, options: [{ value: 'add', label: '+ tambah' }, { value: 'subtract', label: '− kurang' }], onChange: setExploreOp }),
          stepper({ label: 'Bilangan B', value: p.b, min: 0, max: 99, onMinus: () => setExploreB(-1), onPlus: () => setExploreB(1) })
        ),
        h('div', { class: 'explore-equation' },
          `${p.a} ${p.op === 'add' ? '+' : '−'} ${p.b} = ${p.answer}`
        ),
        buildVisual(p, true),
        h('p', { class: 'explore-note' }, 'Coba ubah satu bilangan dan perhatikan bagaimana jumlah puluhan dan satuannya berubah.'),
        strategyCards(p)
      ));
    }

    function build() {
      const fragment = document.createDocumentFragment();
      if (state.mode === 'explore') buildExplore(fragment);
      else buildChallenge(fragment);
      return fragment;
    }

    rerender();
  }

  NS.registerModule({
    id: 'arithmetic',
    order: 6,
    title: 'Arithmetic Visualizer',
    subtitle: 'Strategi berhitung',
    description: 'Lihat penjumlahan dan pengurangan sebagai kelompok puluhan–satuan, lalu bandingkan beberapa strategi yang sama-sama benar.',
    stage: 'C',
    icon: '🧮',
    accent: 'sun',
    minutes: 9,
    skills: [SKILL],
    goal: 'Menghubungkan visualisasi nilai tempat dengan strategi menghitung mental.',
    render
  });
})();
