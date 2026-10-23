/* Multiplication Array — rows, columns, area, and factors. */
(function () {
  'use strict';

  const NS = window.MathLab;
  const { h, icon, randInt, pick, shuffle, clamp } = NS.util;
  const { feedback, hintPanel, roundBanner, segmented, stepper } = NS.Components;
  const SKILL = 'multiplication.array';
  const TOTAL_ROUNDS = 5;
  const MAX_BY_LEVEL = [5, 6, 8, 10, 12];

  function maxFor(level) {
    return MAX_BY_LEVEL[clamp(level, 1, 5) - 1];
  }

  function makeTask(level) {
    const max = maxFor(level);
    const rows = randInt(2, max);
    const cols = randInt(2, max);
    const product = rows * cols;
    const type = level >= 3 && Math.random() < 0.38
      ? 'factor'
      : level >= 2 && Math.random() < 0.28
        ? 'missing'
        : 'product';

    if (type === 'factor') {
      const correct = { a: rows, b: cols };
      const optionMap = new Map([[`${rows}x${cols}`, correct]]);
      let guard = 0;
      while (optionMap.size < 4 && guard < 100) {
        guard += 1;
        const a = randInt(2, max);
        const b = randInt(2, max);
        if (a * b === product) continue;
        const key = `${a}x${b}`;
        if (!optionMap.has(key)) optionMap.set(key, { a, b });
      }
      return {
        type,
        rows,
        cols,
        product,
        question: `Manakah pasangan faktor dari ${product}?`,
        instruction: 'Pasangan faktor adalah dua bilangan yang jika dikalikan menghasilkan bilangan tersebut.',
        answer: `${rows}x${cols}`,
        options: shuffle(Array.from(optionMap.values()))
      };
    }

    if (type === 'missing') {
      return {
        type,
        rows,
        cols,
        product,
        question: `Susunan ini punya ${product} titik dan ${cols} kolom. Berapa barisnya?`,
        instruction: 'Jumlah titik dibagi rata ke setiap kolom akan memberi banyak baris.',
        answer: rows,
        options: numberOptions(rows, Math.max(5, max))
      };
    }

    return {
      type,
      rows,
      cols,
      product,
      question: 'Berapa banyak titik dalam susunan ini?',
      instruction: 'Hitung jumlah baris dan jumlah titik di setiap baris. Kalikan keduanya.',
      answer: product,
      options: numberOptions(product, max)
    };
  }

  function numberOptions(answer, max) {
    const options = new Set([answer]);
    const candidates = shuffle([
      answer + 1, answer - 1, answer + 2, answer - 2,
      answer + 3, answer + 4, answer - 3, answer + max, answer - max
    ]);
    for (const value of candidates) {
      if (options.size >= 4) break;
      if (value > 0) options.add(value);
    }
    return shuffle(Array.from(options));
  }

  function arrayVisual(rows, cols, options = {}) {
    const reveal = options.reveal !== false;
    const node = h('div', {
      class: `array-model ${rows * cols > 64 ? 'array-model--dense' : ''}`.trim(),
      'aria-label': reveal ? `Susunan ${rows} baris dan ${cols} kolom, total ${rows * cols} titik` : 'Susunan titik yang belum diberi label'
    });
    const top = h('div', { class: 'array-model__dimension array-model__dimension--cols' },
      h('span', { class: 'dimension-line' }),
      h('strong', {}, reveal ? `${cols} kolom` : '? kolom'),
      h('span', { class: 'dimension-line' })
    );
    const body = h('div', { class: 'array-model__body' },
      h('div', { class: 'array-model__dimension array-model__dimension--rows' },
        h('span', {}, reveal ? `${rows} baris` : '? baris')
      ),
      h('div', {
        class: 'array-dots',
        style: { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` },
        role: 'img',
        'aria-label': reveal ? `${rows} baris kali ${cols} kolom` : 'Susunan titik'
      })
    );
    const dots = body.querySelector('.array-dots');
    for (let index = 0; index < rows * cols; index += 1) {
      dots.appendChild(h('span', {
        class: 'array-dot',
        style: { animationDelay: `${Math.min(index * 4, 400)}ms` }
      }));
    }
    node.appendChild(top);
    node.appendChild(body);
    node.appendChild(h('div', { class: 'array-model__caption' },
      reveal
        ? h('span', {}, `${rows} × ${cols} = ${rows * cols}`, h('small', {}, 'luas = jumlah titik'))
        : h('span', {}, 'Berapa titik seluruhnya?')
    ));
    return node;
  }

  function render(root, ctx) {
    const level = ctx.getLevel(SKILL);
    const state = {
      mode: 'challenge',
      exploreRows: 4,
      exploreCols: 6,
      round: 1,
      level,
      task: null,
      locked: false,
      wrong: 0,
      hintLevel: 0,
      selected: null
    };
    state.task = makeTask(level);

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
      state.selected = null;
      if (mode === 'challenge' && !state.task) state.task = makeTask(state.level);
      rerender();
    }

    function choose(value) {
      if (state.locked) return;
      const task = state.task;
      const correct = String(value) === String(task.answer);
      state.selected = String(value);
      ctx.recordAttempt({ correct, skillId: SKILL });
      if (correct) {
        state.locked = true;
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
      state.task = makeTask(state.level);
      state.locked = false;
      state.wrong = 0;
      state.hintLevel = 0;
      state.selected = null;
      rerender();
    }

    function updateExplore(which, delta) {
      if (which === 'rows') state.exploreRows = clamp(state.exploreRows + delta, 1, 12);
      else state.exploreCols = clamp(state.exploreCols + delta, 1, 12);
      rerender();
    }

    function rotateExplore() {
      [state.exploreRows, state.exploreCols] = [state.exploreCols, state.exploreRows];
      rerender();
    }

    function factorList(product) {
      const factors = [];
      for (let value = 1; value <= product; value += 1) {
        if (product % value === 0) factors.push(value);
      }
      return factors;
    }

    function buildChallenge(fragment) {
      const task = state.task;
      fragment.appendChild(h('div', { class: 'activity-intro' },
        h('div', {},
          h('p', { class: 'activity-intro__eyebrow' }, 'Multiplication Array'),
          h('p', { class: 'activity-intro__text' }, 'Satu titik mewakili satu satuan. Baris dan kolom menunjukkan dua faktor.')
        ),
        h('div', { class: 'level-chip' }, `Tingkat ${level}`)
      ));
      fragment.appendChild(h('div', { class: 'mode-row' },
        segmented({
          label: 'Mode Multiplication',
          value: state.mode,
          options: [{ value: 'challenge', label: 'Tantangan' }, { value: 'explore', label: 'Eksplorasi' }],
          onChange: setMode
        })
      ));
      fragment.appendChild(roundBanner({
        round: state.round,
        total: TOTAL_ROUNDS,
        tag: `Tantangan ${state.round} dari ${TOTAL_ROUNDS}`,
        title: task.question,
        instruction: task.instruction
      }));
      fragment.appendChild(h('div', { class: 'activity-toolbar activity-toolbar--center' },
        h('span', { class: 'chip chip--soft' }, task.type === 'factor' ? 'Pasangan faktor' : task.type === 'missing' ? 'Mencari baris' : 'Menghitung titik'),
        !state.locked ? h('button', { type: 'button', class: 'btn btn--soft btn--small', onclick: useHint }, icon('bulb', 17), 'Petunjuk') : null
      ));

      const visualSection = h('section', { class: 'activity-card' });
      if (task.type === 'factor' && !state.locked) {
        visualSection.appendChild(h('div', { class: 'factor-mystery' },
          h('span', { class: 'factor-mystery__big' }, String(task.product)),
          h('p', {}, 'titik yang dapat disusun menjadi persegi panjang'),
          h('div', { class: 'factor-mystery__box', 'aria-hidden': 'true' },
            h('span', {}, '?'), h('span', {}, '×'), h('span', {}, '?'), h('span', {}, '='), h('strong', {}, String(task.product))
          )
        ));
      } else {
        visualSection.appendChild(arrayVisual(task.rows, task.cols, { reveal: state.locked || task.type === 'product' || task.type === 'missing' ? state.locked : true }));
        if (state.locked) {
          visualSection.appendChild(h('div', { class: 'array-properties' },
            h('span', {}, `${task.rows} baris × ${task.cols} kolom`),
            h('span', {}, `${task.product} titik`),
            h('span', {}, `Dibalik: ${task.cols} × ${task.rows} = ${task.product}`)
          ));
        }
      }
      fragment.appendChild(visualSection);

      if (task.type === 'factor') {
        fragment.appendChild(h('div', { class: 'factor-choice-grid', role: 'group', 'aria-label': 'Pilihan pasangan faktor' },
          task.options.map((option) => {
            const key = `${option.a}x${option.b}`;
            const correct = key === task.answer;
            const selected = state.selected === key;
            return h('button', {
              type: 'button',
              class: `factor-choice ${selected ? (correct ? 'is-correct' : 'is-wrong') : ''} ${state.locked && correct ? 'is-correct' : ''}`.trim(),
              disabled: state.locked,
              onclick: () => choose(key)
            }, `${option.a} × ${option.b}`);
          })
        ));
      } else {
        const options = h('div', { class: 'answer-chips answer-chips--four', role: 'group', 'aria-label': 'Pilihan jawaban' },
          task.options.map((value) => h('button', {
            type: 'button',
            class: `answer-chip ${state.selected === String(value) ? (value === task.answer ? 'is-correct' : 'is-wrong') : ''} ${state.locked && value === task.answer ? 'is-correct' : ''}`.trim(),
            disabled: state.locked,
            onclick: () => choose(value)
          }, String(value)))
        );
        fragment.appendChild(options);
      }

      if (state.hintLevel > 0 && !state.locked) {
        fragment.appendChild(hintPanel(
          state.hintLevel === 1
            ? task.type === 'factor'
              ? `Cari dua bilangan yang hasil kalinya ${task.product}. Kamu bisa mencoba 2, 3, 4, dan seterusnya.`
              : task.type === 'missing'
                ? `Bagi ${task.product} titik menjadi ${task.cols} kolom yang sama banyak.`
                : 'Hitung jumlah baris, lalu hitung titik dalam satu baris. Kalikan keduanya.'
            : task.type === 'factor'
              ? `Salah satu pasangannya adalah ${task.rows} × ${task.cols}.`
              : task.type === 'missing'
                ? `Setiap kolom berisi ${task.rows} titik, jadi ada ${task.rows} baris.`
                : `${task.rows} baris dengan ${task.cols} titik per baris menghasilkan ${task.product} titik.`
        ));
      }

      if (state.locked) {
        const factors = factorList(task.product).filter((value) => value > 1 && value < task.product);
        fragment.appendChild(feedback('good', 'Susunan berhasil dibaca!', `${task.product} titik dapat disusun sebagai ${task.rows} × ${task.cols} atau ${task.cols} × ${task.rows}. Urutan faktor boleh bertukar tanpa mengubah hasil.`, {
          children: factors.length ? h('p', { class: 'feedback__extra' }, `Faktor lain dari ${task.product}: ${factors.join(', ')}`) : null,
          actions: h('button', { type: 'button', class: 'btn btn--primary', onclick: nextRound },
            state.round >= TOTAL_ROUNDS ? 'Lihat hasil' : 'Tantangan berikutnya', icon('arrow-right', 18))
        }));
        fragment.appendChild(h('div', { class: 'area-connection' },
          h('span', { class: 'area-connection__shape', 'aria-hidden': 'true' }),
          h('div', {},
            h('strong', {}, 'Hubungan dengan luas'),
            h('p', {}, `Persegi panjang ${task.rows} × ${task.cols} memiliki luas ${task.product} satuan luas.`)
          )
        ));
      } else if (state.wrong > 0) {
        fragment.appendChild(feedback('try', 'Belum tepat — susunan bisa membantu.', task.type === 'missing'
          ? 'Coba hitung berapa kelompok kolom yang muat dalam jumlah titik itu.'
          : 'Lihat lagi jumlah baris dan jumlah titik di setiap baris.'));
      }
      fragment.appendChild(h('p', { class: 'activity-footnote' }, 'Perkalian dapat dibaca sebagai “banyak baris × banyak kolom”.'));
    }

    function buildExplore(fragment) {
      const rows = state.exploreRows;
      const cols = state.exploreCols;
      const product = rows * cols;
      fragment.appendChild(h('div', { class: 'activity-intro' },
        h('div', {},
          h('p', { class: 'activity-intro__eyebrow' }, 'Multiplication Array'),
          h('p', { class: 'activity-intro__text' }, 'Ubah susunan dan lihat bagaimana bentuk persegi panjang berubah bersama hasil kalinya.')
        ),
        h('div', { class: 'level-chip' }, 'Ruang eksplorasi')
      ));
      fragment.appendChild(h('div', { class: 'mode-row' },
        segmented({
          label: 'Mode Multiplication',
          value: state.mode,
          options: [{ value: 'challenge', label: 'Tantangan' }, { value: 'explore', label: 'Eksplorasi' }],
          onChange: setMode
        })
      ));
      fragment.appendChild(h('section', { class: 'activity-card' },
        h('div', { class: 'explore-controls explore-controls--three' },
          stepper({ label: 'Baris', value: rows, min: 1, max: 12, onMinus: () => updateExplore('rows', -1), onPlus: () => updateExplore('rows', 1) }),
          h('button', { type: 'button', class: 'btn btn--soft rotate-button', onclick: rotateExplore }, icon('rotate', 18), 'Putar'),
          stepper({ label: 'Kolom', value: cols, min: 1, max: 12, onMinus: () => updateExplore('cols', -1), onPlus: () => updateExplore('cols', 1) })
        ),
        h('div', { class: 'multiplication-equation' },
          h('span', {}, String(rows)),
          h('span', { class: 'operator' }, '×'),
          h('span', {}, String(cols)),
          h('span', { class: 'operator' }, '='),
          h('strong', {}, String(product))
        ),
        arrayVisual(rows, cols, { reveal: true }),
        h('div', { class: 'array-insight-grid' },
          h('div', {}, h('span', {}, 'Baris'), h('strong', {}, String(rows))),
          h('div', {}, h('span', {}, 'Kolom'), h('strong', {}, String(cols))),
          h('div', {}, h('span', {}, 'Luas'), h('strong', {}, `${product} satuan`))
        ),
        h('div', { class: 'repeated-addition' },
          h('span', { class: 'repeated-addition__label' }, 'Sebagai penjumlahan berulang'),
          h('span', {}, Array.from({ length: Math.min(cols, 12) }, () => rows).join(' + '))
        ),
        h('div', { class: 'commutative-note' },
          h('strong', {}, `${rows} × ${cols} = ${cols} × ${rows} = ${product}`),
          h('p', {}, 'Memutar susunan tidak mengubah jumlah titik. Itulah sifat pertukaran pada perkalian.')
        ),
        h('p', { class: 'activity-footnote' }, `Faktor dari ${product}: ${factorList(product).join(', ')}.`)
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
    id: 'multiplication',
    order: 7,
    title: 'Multiplication Array',
    subtitle: 'Baris, kolom, luas',
    description: 'Susun titik dalam baris dan kolom, putar susunannya, dan temukan hubungan perkalian dengan luas dan faktor.',
    stage: 'C',
    icon: '🔢',
    accent: 'teal',
    minutes: 8,
    skills: [SKILL],
    goal: 'Melihat perkalian sebagai susunan persegi panjang dan menjelajahi faktor.',
    render
  });
})();
