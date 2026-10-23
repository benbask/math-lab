/* Algebra Balance — keep equality balanced while isolating the mystery box. */
(function () {
  'use strict';

  const NS = window.MathLab;
  const { h, s, icon, randInt, pick, clamp, gcd } = NS.util;
  const { feedback, hintPanel, roundBanner, numberEntry } = NS.Components;
  const SKILL = 'algebra.balance';
  const TOTAL_ROUNDS = 5;

  function makeEquation(level) {
    let a;
    let b;
    let c;
    let solution;
    if (level <= 1) {
      a = 1;
      b = randInt(1, 5);
      c = 0;
      solution = randInt(2, 7);
    } else if (level === 2) {
      a = pick([1, 2]);
      b = randInt(0, 5);
      c = 0;
      solution = randInt(2, 7);
    } else if (level === 3) {
      a = pick([2, 3]);
      b = randInt(0, 3);
      c = 0;
      solution = randInt(2, 6);
    } else if (level === 4) {
      a = pick([2, 3]);
      b = randInt(0, 4);
      c = 1;
      solution = randInt(2, 6);
    } else {
      a = pick([2, 3]);
      b = randInt(0, 3);
      c = 1;
      solution = randInt(2, 7);
    }
    if (a <= c) a = c + 1;
    const d = a * solution + b - c * solution;
    return {
      a, b, c, d, solution,
      original: { a, b, c, d, solution }
    };
  }

  function sideText(coefficient, units) {
    const parts = [];
    if (coefficient > 0) parts.push(coefficient === 1 ? 'x' : `${coefficient}x`);
    if (units > 0) parts.push(String(units));
    return parts.length ? parts.join(' + ') : '0';
  }

  function equationText(model) {
    return `${sideText(model.a, model.b)} = ${sideText(model.c, model.d)}`;
  }

  function commonDivisor(model) {
    const values = [model.a, model.b, model.c, model.d].filter((value) => value > 0);
    if (!values.length) return 1;
    let divisor = values[0];
    for (let index = 1; index < values.length; index += 1) divisor = gcd(divisor, values[index]);
    return divisor;
  }

  function balanceSvg(model, isChanging) {
    const width = 760;
    const height = 340;
    const node = s('svg', {
      viewBox: `0 0 ${width} ${height}`,
      class: `balance-visual ${isChanging ? 'is-changing' : ''}`.trim(),
      role: 'img',
      'aria-label': `Timbangan seimbang. Kiri ${sideText(model.a, model.b)}, kanan ${sideText(model.c, model.d)}`
    });
    node.appendChild(s('rect', { x: 0, y: 0, width, height, class: 'balance-bg' }));
    node.appendChild(s('line', { x1: 380, y1: 130, x2: 380, y2: 292, class: 'balance-pillar' }));
    node.appendChild(s('path', { d: 'M 330 292 L 430 292 L 405 318 L 355 318 Z', class: 'balance-base' }));
    node.appendChild(s('line', { x1: 150, y1: 125, x2: 610, y2: 125, class: 'balance-beam-line' }));
    node.appendChild(s('circle', { cx: 380, cy: 125, r: 10, class: 'balance-pivot' }));
    node.appendChild(s('line', { x1: 150, y1: 125, x2: 80, y2: 218, class: 'balance-rope' }));
    node.appendChild(s('line', { x1: 150, y1: 125, x2: 220, y2: 218, class: 'balance-rope' }));
    node.appendChild(s('line', { x1: 610, y1: 125, x2: 540, y2: 218, class: 'balance-rope' }));
    node.appendChild(s('line', { x1: 610, y1: 125, x2: 680, y2: 218, class: 'balance-rope' }));
    node.appendChild(s('rect', { x: 55, y: 216, width: 190, height: 15, rx: 7, class: 'balance-tray' }));
    node.appendChild(s('rect', { x: 515, y: 216, width: 190, height: 15, rx: 7, class: 'balance-tray' }));

    function panItems(cx, coefficient, units) {
      const group = s('g', { class: 'balance-items' });
      const boxSize = 29;
      const boxGap = 8;
      const boxesWidth = coefficient * boxSize + Math.max(0, coefficient - 1) * boxGap;
      for (let index = 0; index < coefficient; index += 1) {
        const x = cx - boxesWidth / 2 + index * (boxSize + boxGap);
        group.appendChild(s('rect', { x, y: 154, width: boxSize, height: boxSize, rx: 6, class: 'balance-box' }));
        group.appendChild(s('text', { x: x + boxSize / 2, y: 174, 'text-anchor': 'middle', class: 'balance-box-text' }, 'x'));
      }
      const perRow = 9;
      const rows = Math.ceil(units / perRow);
      for (let index = 0; index < units; index += 1) {
        const row = Math.floor(index / perRow);
        const inRow = Math.min(perRow, units - row * perRow);
        const rowIndex = index % perRow;
        const spacingStack = Math.ceil(rowIndex / 12);
        const x = cx - (inRow - 1) * 8.5 + rowIndex * 17;
        const y = 127 + (rows - 1 - row) * 12 + 8 + spacingStack * 0;
        group.appendChild(s('circle', { cx: x, cy: 201 - (rows - 1 - row) * 13, r: 6.2, class: 'balance-unit' }));
        void y;
      }
      if (coefficient === 0 && units === 0) {
        group.appendChild(s('text', { x: cx, y: 184, 'text-anchor': 'middle', class: 'balance-empty' }, '0'));
      }
      return group;
    }

    node.appendChild(panItems(150, model.a, model.b));
    node.appendChild(panItems(610, model.c, model.d));
    node.appendChild(s('text', { x: 150, y: 260, 'text-anchor': 'middle', class: 'balance-pan-label' }, 'sisi kiri'));
    node.appendChild(s('text', { x: 610, y: 260, 'text-anchor': 'middle', class: 'balance-pan-label' }, 'sisi kanan'));
    node.appendChild(s('text', { x: 380, y: 110, 'text-anchor': 'middle', class: 'balance-status' }, 'seimbang'));
    return node;
  }

  function render(root, ctx) {
    const level = ctx.getLevel(SKILL);
    const state = {
      level,
      round: 1,
      equation: makeEquation(level),
      locked: false,
      wrong: 0,
      hintLevel: 0,
      lastAction: null,
      history: []
    };

    const clear = NS.util.clear;
    function rerender() {
      clear(root);
      root.appendChild(build());
    }

    function applyAction(action) {
      if (state.locked) return;
      const model = state.equation;
      if (action === 'sub-unit') {
        if (model.b < 1 || model.d < 1) return;
        model.b -= 1;
        model.d -= 1;
        state.lastAction = 'Mengambil 1 satuan dari kedua sisi.';
        state.history.push(state.lastAction);
      } else if (action === 'add-unit') {
        model.b += 1;
        model.d += 1;
        state.lastAction = 'Menambahkan 1 satuan ke kedua sisi.';
        state.history.push(state.lastAction);
      } else if (action === 'sub-box') {
        if (model.a < 1 || model.c < 1) return;
        model.a -= 1;
        model.c -= 1;
        state.lastAction = 'Mengambil 1 kotak x dari kedua sisi.';
        state.history.push(state.lastAction);
      } else if (action === 'divide') {
        const divisor = commonDivisor(model);
        if (divisor < 2) return;
        model.a /= divisor;
        model.b /= divisor;
        model.c /= divisor;
        model.d /= divisor;
        state.lastAction = `Membagi kedua sisi dengan ${divisor}.`;
        state.history.push(state.lastAction);
      } else if (action === 'reset') {
        state.equation = JSON.parse(JSON.stringify(state.equation.original));
        state.history = [];
        state.lastAction = null;
        ctx.sound('click');
        rerender();
        return;
      }
      state.history = state.history.slice(-5);
      ctx.sound('click');
      rerender();
    }

    function submit(value) {
      if (state.locked) return;
      const correct = Number(value) === state.equation.solution;
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
      if (state.locked || state.hintLevel >= 2) return;
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
      state.equation = makeEquation(level);
      state.locked = false;
      state.wrong = 0;
      state.hintLevel = 0;
      state.lastAction = null;
      state.history = [];
      rerender();
    }

    function hintText() {
      const model = state.equation;
      const first = model.b > 0
        ? `Kurangi ${model.b} satuan dari kedua sisi agar tidak ada satuan yang tersisa.`
        : model.c > 0
          ? `Kurangi ${model.c} kotak x dari kedua sisi agar kotak x berkumpul di satu sisi.`
          : model.a > 1
            ? `Sekarang kedua sisi dapat dibagi dengan ${model.a}.`
            : 'Kotak x sudah sendirian. Nilai x terlihat dari sisi lainnya.';
      if (state.hintLevel === 1) return first;
      return `Nilai x yang membuat kedua sisi seimbang adalah ${model.solution}. Coba periksa dengan memasukkan nilai itu.`;
    }

    function build() {
      const model = state.equation;
      const divisor = commonDivisor(model);
      const fragment = document.createDocumentFragment();
      fragment.appendChild(h('div', { class: 'activity-intro' },
        h('div', {},
          h('p', { class: 'activity-intro__eyebrow' }, 'Algebra Balance'),
          h('p', { class: 'activity-intro__text' }, 'Kotak misteri adalah variabel x. Apa pun yang kamu lakukan pada satu sisi harus dilakukan pada sisi lain agar tetap seimbang.')
        ),
        h('div', { class: 'level-chip' }, `Tingkat ${level}`)
      ));
      fragment.appendChild(roundBanner({
        round: state.round,
        total: TOTAL_ROUNDS,
        tag: `Tantangan ${state.round} dari ${TOTAL_ROUNDS}`,
        title: 'Temukan nilai x',
        instruction: 'Gunakan tombol operasi pada kedua sisi, lalu masukkan nilai x. Kamu juga boleh langsung menebak jika sudah yakin.'
      }));
      fragment.appendChild(h('div', { class: 'activity-toolbar activity-toolbar--center' },
        h('span', { class: 'chip chip--soft' }, 'Timbangan seimbang'),
        h('span', { class: 'chip chip--soft' }, 'Kotak = x'),
        !state.locked ? h('button', { type: 'button', class: 'btn btn--soft btn--small', onclick: useHint }, icon('bulb', 17), 'Petunjuk') : null
      ));
      fragment.appendChild(h('section', { class: 'activity-card algebra-card' },
        h('div', { class: 'equation-board' },
          h('span', { class: 'equation-board__label' }, 'Persamaan'),
          h('strong', { class: 'equation-board__value' }, equationText(model))
        ),
        balanceSvg(model, Boolean(state.lastAction)),
        h('div', { class: 'balance-equation-small' }, equationText(model)),
        h('div', { class: 'balance-actions' },
          h('button', { type: 'button', class: 'btn btn--soft', disabled: state.locked || model.b < 1 || model.d < 1, onclick: () => applyAction('sub-unit') },
            '−1 satuan kedua sisi'),
          h('button', { type: 'button', class: 'btn btn--soft', disabled: state.locked, onclick: () => applyAction('add-unit') },
            '+1 satuan kedua sisi'),
          h('button', { type: 'button', class: 'btn btn--soft', disabled: state.locked || model.a < 1 || model.c < 1, onclick: () => applyAction('sub-box') },
            '−1 kotak x'),
          h('button', { type: 'button', class: 'btn btn--soft', disabled: state.locked || divisor < 2, onclick: () => applyAction('divide') },
            `Bagi ${divisor > 1 ? `dengan ${divisor}` : 'kedua sisi'}`),
          h('button', { type: 'button', class: 'btn btn--ghost btn--small', disabled: state.locked, onclick: () => applyAction('reset') },
            icon('refresh', 16), 'Ulangi')
        ),
        state.history.length ? h('div', { class: 'balance-history' },
          h('span', { class: 'small-label' }, 'Langkahmu'),
          state.history.map((item) => h('span', { class: 'balance-history__item' }, item))
        ) : null,
        state.lastAction ? h('p', { class: 'inline-message inline-message--info', role: 'status' }, state.lastAction) : null,
        !state.locked ? numberEntry({ onSubmit: submit, maxLength: 2, label: 'Nilai x = ?', submitLabel: 'Cek nilai x' }).node : null,
        state.hintLevel > 0 && !state.locked ? hintPanel(hintText()) : null,
        state.locked ? feedback('good', 'Timbangan tetap seimbang!', `Nilai x adalah ${model.solution}. Jika x = ${model.solution}, sisi kiri dan kanan menghasilkan nilai yang sama.`, {
          children: h('div', { class: 'algebra-check' },
            h('span', {}, `Kiri: ${model.a}(${model.solution}) + ${model.b} = ${model.a * model.solution + model.b}`),
            h('span', {}, `Kanan: ${model.c}(${model.solution}) + ${model.d} = ${model.c * model.solution + model.d}`)
          ),
          actions: h('button', { type: 'button', class: 'btn btn--primary', onclick: nextRound },
            state.round >= TOTAL_ROUNDS ? 'Lihat hasil' : 'Tantangan berikutnya', icon('arrow-right', 18))
        }) : null,
        state.wrong > 0 && !state.locked ? feedback('try', 'Belum tepat — timbangan bisa membantumu.', 'Gunakan operasi pada kedua sisi untuk membuat kotak x sendirian. Setiap langkah harus menjaga keseimbangan.') : null,
        h('p', { class: 'activity-footnote' }, 'Kesetaraan berarti kedua sisi bernilai sama. Operasi yang sama pada kedua sisi menjaga kesetaraan.')
      ));
      return fragment;
    }

    rerender();
  }

  NS.registerModule({
    id: 'algebra',
    order: 10,
    title: 'Algebra Balance',
    subtitle: 'Kesetaraan & variabel',
    description: 'Gunakan timbangan dua sisi dan kotak misteri untuk memahami variabel, kesetaraan, dan langkah menyelesaikan persamaan linear.',
    stage: 'E',
    alsoStages: ['F'],
    icon: '⚖️',
    accent: 'grape',
    minutes: 12,
    skills: [SKILL],
    goal: 'Memahami bahwa operasi yang sama pada kedua sisi menjaga kesetaraan persamaan.',
    render
  });
})();
