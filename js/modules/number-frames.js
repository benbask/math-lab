/* Number Frames — build quantity sense with 5-, 10-, and 20-frames. */
(function () {
  'use strict';

  const NS = window.MathLab;
  const { h, s, randInt, pick, shuffle, icon, clear } = NS.util;
  const { feedback, hintPanel, roundBanner, segmented, stepper } = NS.Components;
  const SKILL = 'number.frames';
  const TOTAL_ROUNDS = 5;
  const NUMBER_WORDS = {
    0: 'nol', 1: 'satu', 2: 'dua', 3: 'tiga', 4: 'empat', 5: 'lima',
    6: 'enam', 7: 'tujuh', 8: 'delapan', 9: 'sembilan', 10: 'sepuluh',
    11: 'sebelas', 12: 'dua belas', 13: 'tiga belas', 14: 'empat belas',
    15: 'lima belas', 16: 'enam belas', 17: 'tujuh belas', 18: 'delapan belas',
    19: 'sembilan belas', 20: 'dua puluh'
  };

  function sizeForLevel(level) {
    if (level <= 1) return 5;
    if (level >= 4) return 20;
    return 10;
  }

  function makeChallenge(level, size) {
    const types = size === 5
      ? ['count', 'empty', 'make']
      : level >= 2
        ? ['count', 'empty', 'make']
        : ['count', 'empty'];
    const type = pick(types);
    const filled = type === 'make' ? randInt(0, size - 1) : randInt(1, size);
    const target = type === 'make' ? randInt(2, size) : null;
    return {
      type,
      size,
      filled: type === 'make' ? randInt(0, Math.min(size - 1, 3)) : filled,
      target,
      flash: false
    };
  }

  function frameArray(size, count, randomOrder = false) {
    const values = Array.from({ length: size }, (_, index) => index < count);
    return randomOrder ? shuffle(values) : values;
  }

  function tallySvg(count, max = 20) {
    const groups = Math.ceil(Math.max(1, count) / 5);
    const width = groups * 26 + 4;
    const node = s('svg', {
      viewBox: `0 0 ${width} 24`,
      width: Math.min(220, width * 2.2),
      height: 34,
      class: 'tally-svg',
      role: 'img',
      'aria-label': `${count} benda dalam tanda hitung`
    });
    for (let group = 0; group < groups; group += 1) {
      const start = group * 26 + 4;
      const inGroup = Math.min(5, count - group * 5);
      for (let line = 0; line < Math.min(4, inGroup); line += 1) {
        node.appendChild(s('line', {
          x1: start + line * 4.5, y1: 3, x2: start + line * 4.5, y2: 21,
          stroke: '#25324b', 'stroke-width': 2.2, 'stroke-linecap': 'round'
        }));
      }
      if (inGroup === 5) {
        node.appendChild(s('line', {
          x1: start - 1, y1: 19, x2: start + 17, y2: 5,
          stroke: '#ff7a59', 'stroke-width': 2.4, 'stroke-linecap': 'round'
        }));
      }
    }
    return node;
  }

  function render(root, ctx) {
    const state = {
      mode: 'challenge',
      size: 10,
      level: 1,
      exploreFilled: 4,
      round: 1,
      challenge: null,
      cells: [],
      locked: false,
      wrong: 0,
      hintLevel: 0,
      flash: false,
      flashPhase: 'done',
      flashTimer: null,
      flashScheduled: false
    };
    state.level = ctx.getLevel(SKILL);
    state.size = sizeForLevel(state.level);
    state.flash = state.level >= 2;

    function clearTimer() {
      if (state.flashTimer) {
        window.clearTimeout(state.flashTimer);
        state.flashTimer = null;
      }
    }
    ctx.addCleanup(clearTimer);

    function startChallenge() {
      clearTimer();
      state.challenge = makeChallenge(state.level, state.size);
      state.challenge.flash = state.flash && ['count', 'empty'].includes(state.challenge.type);
      state.cells = state.challenge.type === 'make'
        ? frameArray(state.size, state.challenge.filled)
        : frameArray(state.size, state.challenge.filled, false);
      state.locked = false;
      state.wrong = 0;
      state.hintLevel = 0;
      state.flashPhase = state.challenge.flash ? 'showing' : 'done';
      state.flashScheduled = false;
      scheduleFlash();
      rerender();
    }

    function scheduleFlash() {
      if (!state.challenge || !state.challenge.flash || state.flashPhase !== 'showing' || state.flashScheduled) return;
      state.flashScheduled = true;
      state.flashTimer = window.setTimeout(() => {
        if (!root.isConnected) return;
        state.flashPhase = 'hidden';
        state.flashScheduled = false;
        state.flashTimer = null;
        rerender();
      }, 1200);
    }

    function rerender() {
      clear(root);
      root.appendChild(build());
      if (state.challenge && state.challenge.flash && state.flashPhase === 'showing') scheduleFlash();
    }

    function setMode(mode) {
      if (mode === state.mode) return;
      clearTimer();
      state.mode = mode;
      if (mode === 'challenge') {
        state.round = 1;
        state.size = sizeForLevel(state.level);
        startChallenge();
      } else {
        rerender();
      }
    }

    function setSize(size) {
      clearTimer();
      state.size = size;
      if (state.mode === 'challenge') startChallenge();
      else {
        state.exploreFilled = Math.min(state.exploreFilled, size);
        rerender();
      }
    }

    function toggleExploreCell(index) {
      const count = state.cells.filter(Boolean).length;
      if (state.cells[index] && count <= 0) return;
      state.cells[index] = !state.cells[index];
      state.exploreFilled = state.cells.filter(Boolean).length;
      rerender();
    }

    function toggleChallengeCell(index) {
      if (state.locked || state.challenge.type !== 'make') return;
      state.cells[index] = !state.cells[index];
      rerender();
    }

    function filledCount() {
      return state.cells.filter(Boolean).length;
    }

    function answerGuess(value) {
      if (state.locked || !state.challenge || !['count', 'empty'].includes(state.challenge.type)) return;
      const expected = state.challenge.type === 'count' ? state.challenge.filled : state.size - state.challenge.filled;
      const correct = value === expected;
      ctx.recordAttempt({
        correct,
        skillId: SKILL,
        alsoSkillId: state.challenge.type === 'count' ? 'number.recognize' : undefined
      });
      if (correct) {
        state.locked = true;
        ctx.sound('good');
      } else {
        state.wrong += 1;
        ctx.sound('try');
      }
      rerender();
    }

    function checkMake() {
      if (state.locked || state.challenge.type !== 'make') return;
      const count = filledCount();
      const correct = count === state.challenge.target;
      ctx.recordAttempt({ correct, skillId: SKILL });
      if (correct) {
        state.locked = true;
        ctx.sound('good');
        rerender();
      } else {
        state.wrong += 1;
        ctx.sound('try');
        rerender();
      }
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
      startChallenge();
    }

    function toggleFlash(event) {
      state.flash = event.target.checked;
      if (state.mode === 'challenge') startChallenge();
      else rerender();
    }

    function buildRepresentations(count) {
      return h('div', { class: 'representation-grid' },
        h('div', { class: 'representation-card representation-card--number' },
          h('strong', {}, String(count)),
          h('span', {}, 'angka')
        ),
        h('div', { class: 'representation-card' },
          h('div', { class: 'tally-wrap' }, tallySvg(count)),
          h('span', {}, 'tanda hitung')
        ),
        h('div', { class: 'representation-card' },
          h('strong', {}, NUMBER_WORDS[count] || String(count)),
          h('span', {}, 'nama bilangan')
        ),
        h('div', { class: 'representation-card representation-card--equation' },
          h('strong', {}, `${count} + ${state.size - count} = ${state.size}`),
          h('span', {}, count === state.size ? 'frame penuh' : `${state.size - count} kotak kosong`)
        )
      );
    }

    function buildFrame({ interactive, reveal, hideFilled = false, target = null }) {
      const grid = h('div', {
        class: `number-frame number-frame--${state.size} ${hideFilled ? 'is-hidden' : ''}`.trim(),
        role: 'group',
        'aria-label': `Frame ${state.size} kotak`
      });
      state.cells.forEach((filled, index) => {
        const isFilled = filled && !hideFilled;
        const cell = h('button', {
          type: 'button',
          class: `frame-cell ${isFilled ? 'is-filled' : ''}`.trim(),
          'aria-pressed': filled ? 'true' : 'false',
          'aria-label': `Kotak ${index + 1}: ${filled ? 'terisi' : 'kosong'}`,
          disabled: !interactive || state.locked,
          onclick: () => interactive && state.mode === 'explore' ? toggleExploreCell(index) : toggleChallengeCell(index)
        });
        if (isFilled) cell.appendChild(h('span', { class: 'frame-dot', 'aria-hidden': 'true' }));
        grid.appendChild(cell);
      });
      if (hideFilled) {
        grid.appendChild(h('div', { class: 'frame-cover' },
          h('span', {}, '👀'),
          h('strong', {}, 'Ingat sebentar…')
        ));
      }
      return grid;
    }

    function buildExplore(fragment) {
      const count = filledCount();
      fragment.appendChild(roundBanner({
        round: 1,
        total: 1,
        tag: 'Eksplorasi bebas',
        title: `Isi dan kosongkan ${state.size}-frame`,
        instruction: 'Ketuk kotak untuk mengisi atau mengosongkan. Perhatikan bagaimana jumlah berubah.'
      }));
      fragment.appendChild(h('div', { class: 'activity-toolbar' },
        segmented({
          label: 'Ukuran frame',
          value: state.size,
          options: [{ value: 5, label: '5-frame' }, { value: 10, label: '10-frame' }, { value: 20, label: '20-frame' }],
          onChange: setSize
        }),
        h('div', { class: 'toolbar-actions' },
          h('button', {
            type: 'button', class: 'btn btn--soft btn--small',
            onclick: () => { state.cells = frameArray(state.size, randInt(0, state.size), true); state.exploreFilled = filledCount(); rerender(); }
          }, icon('shuffle', 17), 'Isi acak'),
          h('button', {
            type: 'button', class: 'btn btn--soft btn--small',
            onclick: () => { state.cells = frameArray(state.size, 0); state.exploreFilled = 0; rerender(); }
          }, icon('x', 17), 'Kosongkan')
        )
      ));
      fragment.appendChild(buildFrame({ interactive: true, reveal: true }));
      fragment.appendChild(h('div', { class: 'count-summary' },
        h('div', { class: 'count-summary__main' }, h('strong', {}, String(count)), h('span', {}, `benda dari ${state.size}`)),
        h('div', { class: 'count-summary__note' }, count === state.size ? 'Frame penuh!' : `${state.size - count} kotak lagi agar penuh.`),
        h('div', { class: 'count-summary__challenge' },
          h('button', { type: 'button', class: 'btn btn--primary btn--small', onclick: () => setMode('challenge') }, 'Coba tantangan', icon('arrow-right', 17))
        )
      ));
      fragment.appendChild(buildRepresentations(count));
      fragment.appendChild(h('p', { class: 'activity-footnote' }, 'Latihan kilas: nyalakan “Kilas cepat” di mode tantangan untuk melihat frame sebentar saja.'));
    }

    function buildChallenge(fragment) {
      const c = state.challenge;
      const count = c.type === 'make' ? filledCount() : c.filled;
      const heading = c.type === 'count'
        ? 'Berapa banyak benda di frame?'
        : c.type === 'empty'
          ? 'Berapa kotak yang masih kosong?'
          : `Isi frame sampai berisi ${c.target} benda`;
      const instruction = c.type === 'make'
        ? 'Ketuk kotak untuk menambah atau menghapus benda, lalu periksa hasilmu.'
        : c.flash
          ? 'Perhatikan sebentar, lalu tebak jumlahnya.'
          : 'Gunakan susunan lima-per-baris untuk membantu melihat jumlah.';

      fragment.appendChild(roundBanner({
        round: state.round,
        total: TOTAL_ROUNDS,
        tag: `Tantangan ${state.round} dari ${TOTAL_ROUNDS}`,
        title: heading,
        instruction
      }));
      fragment.appendChild(h('div', { class: 'activity-toolbar' },
        segmented({
          label: 'Ukuran frame',
          value: state.size,
          options: [{ value: 5, label: '5' }, { value: 10, label: '10' }, { value: 20, label: '20' }],
          onChange: setSize
        }),
        h('div', { class: 'toolbar-actions' },
          h('label', { class: 'switch switch--small' },
            h('input', { type: 'checkbox', checked: state.flash, onchange: toggleFlash }),
            h('span', { class: 'switch__track', 'aria-hidden': 'true' }),
            h('span', {}, 'Kilas cepat')
          ),
          !state.locked ? h('button', { type: 'button', class: 'btn btn--soft btn--small', onclick: useHint },
            icon('bulb', 17), 'Petunjuk') : null
        )
      ));

      const showingFlash = c.flash && state.flashPhase === 'showing';
      const frame = buildFrame({
        interactive: c.type === 'make' && !showingFlash,
        reveal: state.locked,
        hideFilled: c.flash && state.flashPhase === 'hidden' && !state.locked
      });
      fragment.appendChild(frame);

      if (c.type === 'make') {
        fragment.appendChild(h('div', { class: 'frame-progress' },
          h('span', {}, `Sekarang: ${filledCount()} benda`),
          h('span', {}, `Target: ${c.target} benda`),
          !state.locked ? h('button', { type: 'button', class: 'btn btn--primary', onclick: checkMake }, icon('check', 18), 'Periksa') : null
        ));
      } else if (!showingFlash) {
        const expectedMax = c.type === 'count' ? c.size : c.size;
        const chips = h('div', { class: 'answer-chips answer-chips--numbers', role: 'group', 'aria-label': 'Pilih jawaban' });
        for (let value = 0; value <= expectedMax; value += 1) {
          chips.appendChild(h('button', {
            type: 'button',
            class: 'answer-chip',
            disabled: state.locked,
            onclick: () => answerGuess(value)
          }, String(value)));
        }
        fragment.appendChild(chips);
      } else {
        fragment.appendChild(h('div', { class: 'flash-status', role: 'status' }, 'Frame akan disembunyikan sebentar lagi…'));
      }

      if (state.hintLevel > 0 && !state.locked) {
        const hints = {
          count: [
            'Coba lihat baris pertama. Ada berapa kotak yang terisi?',
            `Frame ini berisi ${c.filled} benda. Hitung dari lima, lalu tambahkan sisanya.`
          ],
          empty: [
            'Frame selalu punya kotak kosong dan kotak terisi. Jumlah keduanya sama dengan ukuran frame.',
            `Ada ${c.size - c.filled} kotak kosong. Berapa yang perlu ditambahkan agar menjadi ${c.size}?`
          ],
          make: [
            'Hitung kotak yang sudah terisi. Berapa lagi yang perlu diisi?',
            `Sekarang ada ${filledCount()} benda. Targetnya ${c.target}, jadi masih perlu ${Math.max(0, c.target - filledCount())} lagi.`
          ]
        };
        fragment.appendChild(hintPanel(hints[c.type][Math.min(1, state.hintLevel - 1)]));
      }

      if (state.locked) {
        const explanation = c.type === 'count'
          ? `Di frame ada ${c.filled} benda, jadi ${c.size - c.filled} kotak masih kosong.`
          : c.type === 'empty'
            ? `Frame berisi ${c.filled} benda. Dari ${c.size} kotak, tersisa ${c.size - c.filled} kotak kosong.`
            : `Hebat! Frame sekarang berisi ${filledCount()} benda, sesuai target ${c.target}.`;
        fragment.appendChild(feedback('good', 'Bagus sekali!', explanation, {
          children: h('div', { class: 'mini-frame-flow' },
            h('span', { class: 'mini-chip' }, `${c.type === 'make' ? c.target : c.filled} benda`),
            h('span', { class: 'mini-chip mini-chip--soft' }, `${c.size} kotak`)
          ),
          actions: h('button', { type: 'button', class: 'btn btn--primary', onclick: nextRound },
            state.round >= TOTAL_ROUNDS ? 'Lihat hasil' : 'Tantangan berikutnya', icon('arrow-right', 18))
        }));
        if (c.type !== 'make') fragment.appendChild(buildRepresentations(c.type === 'count' ? c.filled : c.size - c.filled));
      } else if (state.wrong > 0) {
        fragment.appendChild(feedback('try', 'Belum tepat — coba lagi.', c.type === 'make'
          ? `Sekarang ada ${filledCount()} benda. Bandingkan dengan target ${c.target}.`
          : 'Coba hitung perlahan atau buka Petunjuk untuk bantuan kecil.'));
      }
    }

    function build() {
      const fragment = document.createDocumentFragment();
      fragment.appendChild(h('div', { class: 'activity-intro' },
        h('div', {},
          h('p', { class: 'activity-intro__eyebrow' }, 'Number Frames'),
          h('p', { class: 'activity-intro__text' }, 'Susunan lima-per-baris membantu mata melihat jumlah tanpa selalu menghitung satu per satu.')
        ),
        h('div', { class: 'level-chip' }, `Tingkat ${ctx.getLevel(SKILL)}`)
      ));
      fragment.appendChild(h('div', { class: 'mode-row' },
        segmented({
          label: 'Mode Number Frames',
          value: state.mode,
          options: [{ value: 'explore', label: 'Eksplorasi' }, { value: 'challenge', label: 'Tantangan' }],
          onChange: setMode
        })
      ));
      if (state.mode === 'explore') {
        state.cells = state.cells.length === state.size ? state.cells : frameArray(state.size, Math.min(state.exploreFilled, state.size));
        state.exploreFilled = filledCount();
        buildExplore(fragment);
      } else {
        if (!state.challenge) {
          state.challenge = makeChallenge(state.level, state.size);
          state.cells = frameArray(state.size, state.challenge.filled);
        }
        buildChallenge(fragment);
      }
      return fragment;
    }

    state.cells = frameArray(state.size, state.exploreFilled, true);
    state.challenge = makeChallenge(state.level, state.size);
    state.cells = frameArray(state.size, state.challenge.filled);
    state.challenge.flash = state.flash && ['count', 'empty'].includes(state.challenge.type);
    state.flashPhase = state.challenge.flash ? 'showing' : 'done';
    rerender();
  }

  NS.registerModule({
    id: 'number-frames',
    order: 2,
    title: 'Number Frames',
    subtitle: 'Melihat jumlah',
    description: 'Isi 5-, 10-, dan 20-frame. Bangun jumlah, lengkapi frame, dan tebak jumlah dengan kilas cepat opsional.',
    stage: 'B',
    icon: '🔟',
    accent: 'teal',
    minutes: 8,
    skills: [SKILL, 'number.recognize'],
    goal: 'Menghubungkan susunan visual dengan jumlah dan pasangan menuju 5, 10, atau 20.',
    render
  });
})();
