/* Pattern Explorer — repeating, growing, and rule-finding patterns. */
(function () {
  'use strict';

  const NS = window.MathLab;
  const { h, icon, pick, shuffle, randInt, clamp } = NS.util;
  const { feedback, hintPanel, roundBanner, segmented, shapeSvg } = NS.Components;
  const SKILL_REPEAT = 'patterns.repeat';
  const SKILL_GROW = 'patterns.grow';
  const TOTAL_ROUNDS = 5;

  const PALETTE = [
    { shape: 'circle', color: '#ff7a59', name: 'lingkaran jingga' },
    { shape: 'square', color: '#22b8a6', name: 'persegi hijau' },
    { shape: 'triangle', color: '#5b8def', name: 'segitiga biru' },
    { shape: 'star', color: '#f2b544', name: 'bintang kuning' },
    { shape: 'diamond', color: '#8b5cf6', name: 'belah ketupat ungu' },
    { shape: 'hexagon', color: '#ec6aa0', name: 'segi enam merah muda' },
    { shape: 'circle', color: '#5b8def', name: 'lingkaran biru' },
    { shape: 'square', color: '#ff7a59', name: 'persegi jingga' },
    { shape: 'triangle', color: '#22b8a6', name: 'segitiga hijau' }
  ];

  const SHAPE_LABELS = {
    circle: 'lingkaran', square: 'persegi', rectangle: 'persegi panjang',
    triangle: 'segitiga', star: 'bintang', diamond: 'belah ketupat', hexagon: 'segi enam'
  };

  function sig(token) {
    return token.number !== undefined ? `n${token.number}` : `${token.shape}|${token.color}`;
  }

  function uniqueTokens(tokens) {
    const seen = new Set();
    return tokens.filter((token) => {
      const key = sig(token);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function symbolTokenName(token) {
    return `${SHAPE_LABELS[token.shape] || 'bentuk'} ${token.colorName || ''}`.trim();
  }

  function makeRepeating(level) {
    const baseLength = level <= 1 ? 2 : level === 2 ? pick([2, 3]) : pick([2, 3, 4]);
    let candidates = shuffle(PALETTE);
    if (level === 1) {
      const shape = pick(['circle', 'square', 'triangle']);
      const colorA = PALETTE.filter((token) => token.shape === shape)[0] || PALETTE[0];
      let colorB = PALETTE.find((token) => token.shape === shape && token.color !== colorA.color);
      if (!colorB) colorB = PALETTE.find((token) => token.color !== colorA.color);
      candidates = [
        colorA,
        { ...colorB, shape: level === 1 ? shape : colorB.shape }
      ];
    }
    const base = [];
    for (let index = 0; index < baseLength; index += 1) {
      const token = candidates[index % candidates.length];
      base.push({ shape: token.shape, color: token.color, name: token.name });
    }
    const repeats = Math.ceil(9 / base.length);
    const full = [];
    for (let index = 0; index < 9; index += 1) full.push({ ...base[index % base.length] });
    const missingIndex = full.length - 1;
    const answer = full[missingIndex];
    const distractorPool = uniqueTokens(PALETTE.map((token) => ({ ...token }))).filter((token) => sig(token) !== sig(answer));
    const options = shuffle([{ ...answer }, ...shuffle(distractorPool).slice(0, 2)]);
    return {
      type: 'symbols',
      skill: SKILL_REPEAT,
      base,
      full,
      missingIndex,
      answer,
      options,
      show: full.slice(0, missingIndex),
      question: 'Kartu apa yang tepat untuk melanjutkan pola?',
      instruction: 'Perhatikan kelompok bentuk yang berulang. Kamu tidak perlu menghafal warna — cari aturan pengulangannya.',
      ruleText: `${base.map((token) => SHAPE_LABELS[token.shape] || 'bentuk').join('–')} berulang`
    };
  }

  function makeNumber(level, forceRule = false) {
    const askRule = forceRule || (level >= 4 && Math.random() < 0.35);
    const geometric = level >= 5 && Math.random() < 0.45;
    let numbers;
    let step = null;
    let ruleText;
    if (geometric) {
      const start = randInt(1, 3);
      numbers = [start, start * 2, start * 4, start * 8];
      if (level >= 5) numbers.push(start * 16);
      ruleText = '×2';
    } else {
      step = level <= 2 ? 1 : level === 3 ? pick([1, 2]) : pick([2, 3, 4, 5]);
      const start = randInt(1, 9);
      numbers = Array.from({ length: 5 }, (_, index) => start + index * step);
      ruleText = `+${step}`;
    }

    if (askRule) {
      const options = shuffle(uniqueStrings([
        ruleText,
        geometric ? '×3' : `+${Math.max(1, step + 1)}`,
        geometric ? '+2' : `−${Math.max(1, step)}`,
        geometric ? `×${Math.max(2, numbers[2] / Math.max(1, numbers[1]))}` : '×2'
      ])).slice(0, 4);
      if (!options.includes(ruleText)) options[0] = ruleText;
      return {
        type: 'rule',
        skill: SKILL_GROW,
        numbers,
        answer: ruleText,
        options: shuffle(options),
        question: 'Aturan pola bilangan ini apa?',
        instruction: 'Lihat perubahan dari satu bilangan ke bilangan berikutnya. Apakah bertambah, berkurang, atau berlipat?',
        ruleText
      };
    }

    const full = numbers.slice();
    const missingIndex = full.length - 1;
    const answer = full[missingIndex];
    const optionSet = new Set([answer]);
    const candidates = [answer + 1, answer - 1, answer + 2, answer - 2, answer + (step || 1), answer * 2];
    for (const value of candidates) {
      if (value > 0 && optionSet.size < 4) optionSet.add(value);
    }
    const options = shuffle(Array.from(optionSet));
    return {
      type: 'numbers',
      skill: SKILL_GROW,
      full,
      missingIndex,
      answer,
      options,
      show: full.slice(0, missingIndex),
      question: 'Bilangan apa yang berikutnya?',
      instruction: 'Cari selisih atau perubahan yang sama di setiap langkah.',
      ruleText
    };
  }

  function uniqueStrings(list) {
    return Array.from(new Set(list));
  }

  function makeChallenge(levelRepeat, levelGrow) {
    if (Math.random() < 0.52) return makeNumber(levelGrow);
    return makeRepeating(Math.min(levelRepeat, 4));
  }

  function tokenNode(token, options = {}) {
    if (token.number !== undefined) {
      return h('div', { class: `pattern-token pattern-token--number ${options.className || ''}`.trim() }, String(token.number));
    }
    return h('div', {
      class: `pattern-token ${options.className || ''}`.trim(),
      'aria-label': symbolTokenName(token)
    }, shapeSvg(token.shape, token.color, options.size || 46));
  }

  function render(root, ctx) {
    const state = {
      mode: 'challenge',
      levelRepeat: ctx.getLevel(SKILL_REPEAT),
      levelGrow: ctx.getLevel(SKILL_GROW),
      round: 1,
      challenge: null,
      locked: false,
      wrong: 0,
      hintLevel: 0,
      selected: null,
      composer: [],
      composerMessage: null,
      composerTone: 'info'
    };
    state.challenge = makeChallenge(state.levelRepeat, state.levelGrow);
    state.composer = [
      { shape: 'circle', color: '#ff7a59' },
      { shape: 'square', color: '#22b8a6' },
      { shape: 'circle', color: '#ff7a59' },
      { shape: 'square', color: '#22b8a6' }
    ];

    const clear = NS.util.clear;
    function rerender() {
      clear(root);
      root.appendChild(build());
    }

    function setMode(mode) {
      if (state.mode === mode) return;
      state.mode = mode;
      state.locked = false;
      state.wrong = 0;
      state.hintLevel = 0;
      state.selected = null;
      if (mode === 'challenge' && !state.challenge) state.challenge = makeChallenge(state.levelRepeat, state.levelGrow);
      rerender();
    }

    function choose(value) {
      if (state.locked) return;
      const c = state.challenge;
      const answerKey = c.type === 'symbols' ? sig(c.answer) : String(c.answer);
      const correct = String(value) === answerKey;
      state.selected = String(value);
      ctx.recordAttempt({ correct, skillId: c.skill });
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
      ctx.recordHint(state.challenge.skill);
      rerender();
    }

    function nextRound() {
      if (state.round >= TOTAL_ROUNDS) {
        ctx.finish({ completed: true });
        return;
      }
      state.round += 1;
      state.challenge = makeChallenge(state.levelRepeat, state.levelGrow);
      state.locked = false;
      state.wrong = 0;
      state.hintLevel = 0;
      state.selected = null;
      rerender();
    }

    function addComposer(token) {
      if (state.composer.length >= 12) return;
      state.composer.push({ ...token });
      state.composerMessage = null;
      rerender();
    }

    function removeComposer() {
      state.composer.pop();
      state.composerMessage = null;
      rerender();
    }

    function clearComposer() {
      state.composer = [];
      state.composerMessage = null;
      rerender();
    }

    function periodOf(tokens) {
      for (let period = 1; period <= Math.floor(tokens.length / 2); period += 1) {
        let works = true;
        for (let index = period; index < tokens.length; index += 1) {
          if (sig(tokens[index]) !== sig(tokens[index % period])) {
            works = false;
            break;
          }
        }
        if (works) return period;
      }
      return tokens.length;
    }

    function checkComposer() {
      if (state.composer.length < 4) {
        state.composerMessage = 'Tambahkan sedikitnya empat kartu agar polanya terlihat.';
        state.composerTone = 'try';
        rerender();
        return;
      }
      const period = periodOf(state.composer);
      if (period >= state.composer.length) {
        state.composerMessage = 'Belum terlihat pengulangan. Coba susun kelompok yang sama, lalu ulangi kelompok itu.';
        state.composerTone = 'try';
      } else {
        state.composerMessage = `Polamu berulang setiap ${period} kartu. Itu pola yang jelas!`;
        state.composerTone = 'good';
        ctx.sound('good');
      }
      rerender();
    }

    function displaySequence() {
      const c = state.challenge;
      const row = h('div', { class: 'pattern-sequence', role: 'list', 'aria-label': 'Urutan pola' });
      if (c.type === 'symbols') {
        c.show.forEach((token, index) => row.appendChild(h('div', { class: 'pattern-slot', role: 'listitem', 'aria-label': `Kartu ${index + 1}` }, tokenNode(token, { size: 52 }))));
        row.appendChild(h('div', { class: 'pattern-slot pattern-slot--missing', role: 'listitem', 'aria-label': 'Kartu yang hilang' }, '?'));
      } else if (c.type === 'numbers') {
        c.show.forEach((value, index) => row.appendChild(h('div', { class: 'pattern-slot pattern-slot--number', role: 'listitem', 'aria-label': `Bilangan ${value}` }, String(value))));
        row.appendChild(h('div', { class: 'pattern-slot pattern-slot--number pattern-slot--missing', role: 'listitem', 'aria-label': 'Bilangan yang hilang' }, '?'));
      } else {
        c.numbers.forEach((value, index) => row.appendChild(h('div', { class: 'pattern-slot pattern-slot--number', role: 'listitem', 'aria-label': `Bilangan ${value}` }, String(value))));
      }
      return row;
    }

    function optionNode(value, index) {
      const c = state.challenge;
      const valueKey = c.type === 'symbols' ? sig(value) : String(value);
      const answerKey = c.type === 'symbols' ? sig(c.answer) : String(c.answer);
      const isSelected = state.selected === valueKey;
      const isCorrect = valueKey === answerKey;
      const cls = `pattern-option ${state.selected !== null && isSelected ? (isCorrect ? 'is-correct' : 'is-wrong') : ''} ${state.locked && isCorrect ? 'is-correct' : ''}`.trim();
      if (c.type === 'symbols') {
        const token = value;
        return h('button', {
          type: 'button',
          class: `pattern-option pattern-option--shape ${cls}`.trim(),
          disabled: state.locked,
          'aria-label': symbolTokenName(token),
          onclick: () => choose(sig(token))
        }, shapeSvg(token.shape, token.color, 52));
      }
      if (c.type === 'numbers') {
        return h('button', {
          type: 'button',
          class: `${cls} pattern-option--number`,
          disabled: state.locked,
          onclick: () => choose(value)
        }, String(value));
      }
      return h('button', {
        type: 'button',
        class: `${cls} pattern-option--rule`,
        disabled: state.locked,
        onclick: () => choose(value)
      }, String(value));
    }

    function buildChallenge(fragment) {
      const c = state.challenge;
      const isRule = c.type === 'rule';
      fragment.appendChild(h('div', { class: 'activity-intro' },
        h('div', {},
          h('p', { class: 'activity-intro__eyebrow' }, 'Pattern Explorer'),
          h('p', { class: 'activity-intro__text' }, 'Pola adalah aturan yang berulang. Temukan aturannya sebelum menebak.')
        ),
        h('div', { class: 'level-chip' }, `Tingkat ${c.skill === SKILL_GROW ? state.levelGrow : state.levelRepeat}`)
      ));
      fragment.appendChild(h('div', { class: 'mode-row' },
        segmented({
          label: 'Mode Pattern Explorer',
          value: state.mode,
          options: [{ value: 'challenge', label: 'Tantangan' }, { value: 'build', label: 'Buat pola' }],
          onChange: setMode
        })
      ));
      fragment.appendChild(roundBanner({
        round: state.round,
        total: TOTAL_ROUNDS,
        tag: `Tantangan ${state.round} dari ${TOTAL_ROUNDS}`,
        title: c.question,
        instruction: c.instruction
      }));
      fragment.appendChild(h('div', { class: 'activity-toolbar activity-toolbar--center' },
        h('span', { class: 'chip chip--soft' }, c.type === 'symbols' ? 'Pola bentuk' : c.type === 'numbers' ? 'Pola bilangan' : 'Temukan aturan'),
        !state.locked ? h('button', { type: 'button', class: 'btn btn--soft btn--small', onclick: useHint }, icon('bulb', 17), 'Petunjuk') : null
      ));
      fragment.appendChild(h('section', { class: 'activity-card activity-card--pattern' },
        displaySequence(),
        isRule ? h('p', { class: 'pattern-question-hint' }, 'Perhatikan perubahan dari kiri ke kanan.') : h('p', { class: 'pattern-question-hint' }, 'Pilih kartu yang melanjutkan aturan.'),
        h('div', { class: `pattern-options ${c.type === 'rule' ? 'pattern-options--text' : ''}`.trim(), role: 'group', 'aria-label': 'Pilihan jawaban' },
          c.options.map((value, index) => optionNode(value, index))
        ),
        state.hintLevel > 0 && !state.locked ? hintPanel(
          state.hintLevel === 1
            ? c.type === 'symbols'
              ? 'Cari kelompok kartu yang berulang. Kelompok itu akan muncul lagi dari awal.'
              : c.type === 'numbers'
                ? 'Hitung selisih antara dua bilangan yang berdekatan. Apakah selisihnya tetap?'
                : 'Bandingkan dua bilangan berdekatan. Apakah bertambah dengan jumlah yang sama, atau berlipat?'
            : c.type === 'symbols'
              ? `Aturannya: ${c.ruleText}. Setelah kelompok itu selesai, pola dimulai lagi dari kartu pertama.`
              : `Perubahan pada pola ini adalah ${c.ruleText}. Gunakan aturan itu pada bilangan terakhir.`
        ) : null,
        state.locked ? feedback('good', 'Polanya kamu temukan!', isRule
          ? `Aturan pola ini adalah ${c.ruleText}.`
          : `Jawaban yang tepat adalah ${c.type === 'symbols' ? symbolTokenName(c.answer) : c.answer}. ${c.type === 'symbols' ? `Kelompok ${c.ruleText} terus berulang.` : `Setiap langkah memakai aturan ${c.ruleText}.`}`, {
          actions: h('button', { type: 'button', class: 'btn btn--primary', onclick: nextRound },
            state.round >= TOTAL_ROUNDS ? 'Lihat hasil' : 'Tantangan berikutnya', icon('arrow-right', 18))
        }) : null,
        state.wrong > 0 && !state.locked ? feedback('try', 'Belum tepat, tetapi kamu sedang mencari pola.', 'Coba lihat dua atau tiga kartu pertama. Apakah ada kelompok yang mulai berulang?') : null,
        h('p', { class: 'activity-footnote' }, 'Pola bisa berulang, bertambah, atau berlipat. Menemukan aturannya lebih penting daripada cepat menjawab.')
      ));
    }

    function buildExplore(fragment) {
      fragment.appendChild(h('div', { class: 'activity-intro' },
        h('div', {},
          h('p', { class: 'activity-intro__eyebrow' }, 'Pattern Explorer'),
          h('p', { class: 'activity-intro__text' }, 'Susun kartu-kartu menjadi pola yang bisa dijelaskan. Pola yang baik punya aturan.')
        ),
        h('div', { class: 'level-chip' }, 'Ruang eksplorasi')
      ));
      fragment.appendChild(h('div', { class: 'mode-row' },
        segmented({
          label: 'Mode Pattern Explorer',
          value: state.mode,
          options: [{ value: 'challenge', label: 'Tantangan' }, { value: 'build', label: 'Buat pola' }],
          onChange: setMode
        })
      ));
      const palette = h('div', { class: 'composer-palette', role: 'group', 'aria-label': 'Pilih kartu pola' });
      uniqueTokens(PALETTE.map((token) => ({ ...token }))).slice(0, 6).forEach((token) => {
        palette.appendChild(h('button', {
          type: 'button',
          class: 'composer-palette__btn',
          'aria-label': `Tambah ${symbolTokenName(token)}`,
          onclick: () => addComposer(token)
        }, shapeSvg(token.shape, token.color, 40)));
      });
      const row = h('div', { class: 'composer-row', 'aria-label': 'Pola buatanmu' });
      if (state.composer.length === 0) row.appendChild(h('span', { class: 'composer-empty' }, 'Ketuk kartu di bawah untuk mulai menyusun.'));
      state.composer.forEach((token, index) => {
        row.appendChild(h('div', { class: 'composer-token', 'aria-label': `Kartu ${index + 1}` }, shapeSvg(token.shape, token.color, 38)));
      });
      fragment.appendChild(h('section', { class: 'activity-card' },
        h('div', { class: 'card-heading' },
          h('div', {},
            h('h2', {}, 'Susun polamu sendiri'),
            h('p', {}, 'Coba buat pola berulang. Ketika sudah siap, periksa aturannya.')
          ),
          h('span', { class: 'chip chip--soft' }, `${state.composer.length}/12 kartu`)
        ),
        row,
        palette,
        h('div', { class: 'composer-actions' },
          h('button', { type: 'button', class: 'btn btn--soft btn--small', onclick: removeComposer, disabled: state.composer.length === 0 }, 'Hapus satu'),
          h('button', { type: 'button', class: 'btn btn--soft btn--small', onclick: clearComposer, disabled: state.composer.length === 0 }, 'Mulai ulang'),
          h('button', { type: 'button', class: 'btn btn--primary btn--small', onclick: checkComposer }, icon('check', 17), 'Periksa pola')
        ),
        state.composerMessage ? feedback(state.composerTone, state.composerTone === 'good' ? 'Pola yang jelas!' : 'Terus eksplorasi', state.composerMessage) : null,
        h('div', { class: 'pattern-tip-grid' },
          h('div', { class: 'pattern-tip' }, h('strong', {}, 'Pola berulang'), h('span', {}, '🔴 🔵 🔴 🔵')),
          h('div', { class: 'pattern-tip' }, h('strong', {}, 'Pola bertumbuh'), h('span', {}, '2, 4, 6, 8')),
          h('div', { class: 'pattern-tip' }, h('strong', {}, 'Pola berlipat'), h('span', {}, '1, 2, 4, 8'))
        )
      ));
    }

    function build() {
      const fragment = document.createDocumentFragment();
      if (state.mode === 'build') buildExplore(fragment);
      else buildChallenge(fragment);
      return fragment;
    }

    rerender();
  }

  NS.registerModule({
    id: 'patterns',
    order: 5,
    title: 'Pattern Explorer',
    subtitle: 'Pola & aturan',
    description: 'Temukan pola bentuk dan bilangan, lengkapi bagian yang hilang, lalu susun pola milikmu sendiri.',
    stage: 'A',
    icon: '🧩',
    accent: 'grape',
    minutes: 7,
    skills: [SKILL_REPEAT, SKILL_GROW],
    goal: 'Mengenali pola berulang dan bertumbuh, serta menjelaskan aturannya.',
    render
  });
})();
