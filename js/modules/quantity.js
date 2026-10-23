/* Quantity Explorer — compare groups of objects before relying on number symbols. */
(function () {
  'use strict';

  const NS = window.MathLab;
  const { h, s, randInt, pick, shuffle, icon } = NS.util;
  const { feedback, hintPanel, roundBanner, stepper } = NS.Components;
  const SKILL = 'quantity.compare';
  const TOTAL_ROUNDS = 5;
  const ITEM_SETS = [
    ['🍎', '🍊', '🍓', '🍇', '🍋', '🍐'],
    ['⭐', '🌟', '✨', '💫'],
    ['🔴', '🔵', '🟡', '🟢', '🟣'],
    ['🐟', '🐠', '🐡', '🦀', '🐙'],
    ['⚽', '🏀', '🎾', '🏐', '🏈']
  ];

  function positionsFor(count) {
    const cols = Math.max(1, Math.ceil(Math.sqrt(count * 1.25)));
    const rows = Math.max(1, Math.ceil(count / cols));
    const cells = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) cells.push({ row, col });
    }
    const selected = shuffle(cells).slice(0, count);
    return selected.map(({ row, col }) => ({
      x: 28 + (col + 0.5) * (184 / cols) + randInt(-6, 6),
      y: 27 + (row + 0.5) * (128 / rows) + randInt(-6, 6),
      rotate: randInt(-12, 12)
    }));
  }

  function makeGroup(count, emoji, label) {
    return { count, emoji, label, positions: positionsFor(count) };
  }

  function makeChallenge(level) {
    let a;
    let b;
    const wantSame = Math.random() < 0.2;
    if (wantSame) {
      a = randInt(2, level <= 2 ? 5 : 9);
      b = a;
    } else {
      const max = [5, 8, 12, 16, 22][Math.min(4, Math.max(0, level - 1))];
      do {
        a = randInt(1, max);
        b = randInt(1, max);
      } while (a === b);
      if (level === 1) {
        while (Math.abs(a - b) < 2) {
          b = randInt(1, max);
        }
      }
    }
    const type = a === b ? 'same' : (Math.random() < 0.5 ? 'more' : 'less');
    const set = pick(ITEM_SETS);
    return {
      type,
      a: makeGroup(a, set[0], 'A'),
      b: makeGroup(b, set[1], 'B'),
      positionsKey: `${a}-${b}-${Math.random()}`
    };
  }

  function scatterSvg(group, revealCount, highlight) {
    const node = s('svg', {
      viewBox: '0 0 240 180',
      class: `quantity-field ${highlight ? 'quantity-field--highlight' : ''}`.trim(),
      role: 'img',
      'aria-label': `Kelompok ${group.label}${revealCount ? `, berisi ${group.count} benda` : ''}`
    });
    group.positions.forEach((position, index) => {
      node.appendChild(s('text', {
        x: position.x,
        y: position.y,
        'font-size': group.count > 16 ? '21' : '26',
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
        transform: `rotate(${position.rotate} ${position.x} ${position.y})`,
        class: 'quantity-object',
        style: `animation-delay:${index * 18}ms`
      }, group.emoji));
    });
    if (revealCount) {
      const badge = s('g', { transform: 'translate(188 148)' });
      badge.appendChild(s('circle', { cx: 0, cy: 0, r: 20, class: 'quantity-count-circle' }));
      badge.appendChild(s('text', {
        x: 0,
        y: 1,
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
        class: 'quantity-count-text'
      }, String(group.count)));
      node.appendChild(badge);
    }
    return node;
  }

  function render(root, ctx) {
    const state = {
      round: 1,
      level: 1,
      challenge: null,
      locked: false,
      answered: false,
      showCounts: false,
      wrongThisRound: 0,
      hintLevel: 0,
      feedbackNode: null,
      hintNode: null
    };

    state.level = ctx.getLevel(SKILL);
    state.challenge = makeChallenge(state.level);

    function rerender() {
      NS.util.clear(root);
      root.appendChild(build());
    }

    function onChoose(choice) {
      if (state.locked) return;
      const challenge = state.challenge;
      const a = challenge.a.count;
      const b = challenge.b.count;
      let correct = false;
      if (challenge.type === 'same') correct = choice === 'same';
      else if (challenge.type === 'more') correct = choice === (a > b ? 'a' : 'b');
      else correct = choice === (a < b ? 'a' : 'b');

      ctx.recordAttempt({ correct, skillId: SKILL });
      if (correct) {
        state.locked = true;
        state.answered = true;
        state.showCounts = true;
        ctx.sound('good');
        rerender();
      } else {
        state.wrongThisRound += 1;
        ctx.sound('try');
        if (state.wrongThisRound === 1) {
          state.hintLevel = Math.max(state.hintLevel, 1);
        }
        rerender();
        const heading = root.querySelector('.feedback');
        if (heading) heading.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    function useHint() {
      if (state.locked) return;
      if (state.hintLevel < 2) {
        state.hintLevel += 1;
        ctx.recordHint(SKILL);
        if (state.hintLevel >= 2) state.showCounts = true;
      }
      rerender();
    }

    function shufflePositions() {
      state.challenge.a.positions = positionsFor(state.challenge.a.count);
      state.challenge.b.positions = positionsFor(state.challenge.b.count);
      rerender();
    }

    function changeCount(groupKey, delta) {
      if (state.locked) return;
      const group = state.challenge[groupKey];
      const next = Math.max(1, Math.min(24, group.count + delta));
      if (next === group.count) return;
      group.count = next;
      group.positions = positionsFor(next);
      state.showCounts = false;
      state.feedbackNode = null;
      state.hintNode = null;
      state.wrongThisRound = 0;
      state.hintLevel = 0;
      // The comparison type stays stable; the new counts decide the correct answer.
      state.challenge.type = state.challenge.a.count === state.challenge.b.count
        ? 'same'
        : (state.challenge.type === 'same' ? 'more' : state.challenge.type);
      rerender();
    }

    function nextRound() {
      if (state.round >= TOTAL_ROUNDS) {
        ctx.finish({ completed: true });
        return;
      }
      state.round += 1;
      state.level = ctx.getLevel(SKILL);
      state.challenge = makeChallenge(state.level);
      state.locked = false;
      state.answered = false;
      state.showCounts = false;
      state.wrongThisRound = 0;
      state.hintLevel = 0;
      rerender();
    }

    function build() {
      const challenge = state.challenge;
      const a = challenge.a;
      const b = challenge.b;
      const prompt = challenge.type === 'more'
        ? 'Kelompok mana yang lebih banyak?'
        : challenge.type === 'less'
          ? 'Kelompok mana yang lebih sedikit?'
          : 'Apakah jumlahnya sama banyak, atau ada yang lebih banyak?';
      const instruction = challenge.type === 'same'
        ? 'Pilih “Sama banyak” jika kedua kelompok memiliki jumlah yang sama.'
        : 'Lihat kedua kelompok. Kamu boleh mengetuk benda secara mental satu per satu.';

      const fragment = document.createDocumentFragment();
      fragment.appendChild(roundBanner({
        round: state.round,
        total: TOTAL_ROUNDS,
        tag: `Tantangan ${state.round} dari ${TOTAL_ROUNDS}`,
        title: prompt,
        instruction
      }));

      const controls = h('div', { class: 'activity-toolbar' },
        h('button', { type: 'button', class: 'btn btn--soft btn--small', onclick: shufflePositions, disabled: state.locked },
          icon('shuffle', 17), 'Acak posisi'),
        !state.locked ? h('button', { type: 'button', class: 'btn btn--soft btn--small', onclick: useHint },
          icon('bulb', 17), 'Petunjuk') : null
      );
      fragment.appendChild(controls);

      const groups = h('div', { class: 'quantity-groups' });
      for (const group of [a, b]) {
        const isWinningGroup = challenge.type !== 'same' &&
          ((challenge.type === 'more' && group.count === Math.max(a.count, b.count)) ||
           (challenge.type === 'less' && group.count === Math.min(a.count, b.count)));
        const groupCard = h('div', {
          class: `quantity-group ${state.answered && isWinningGroup ? 'is-highlighted' : ''}`.trim()
        },
          h('div', { class: 'quantity-group__header' },
            h('span', { class: 'quantity-group__label' }, `Kelompok ${group.label}`),
            state.showCounts ? h('span', { class: 'count-badge' }, String(group.count)) : h('span', { class: 'count-badge count-badge--muted' }, '?')
          ),
          h('button', {
            type: 'button',
            class: 'quantity-select',
            'aria-label': `Pilih kelompok ${group.label}`,
            disabled: state.locked,
            onclick: () => onChoose(group === a ? 'a' : 'b')
          },
            scatterSvg(group, state.showCounts, false),
            h('span', { class: 'btn btn--primary quantity-select__cta' }, `Pilih ${group.label}`)
          ),
          h('div', { class: 'quantity-group__controls' },
            h('button', {
              type: 'button',
              class: 'mini-round-btn',
              'aria-label': `Kurangi satu benda dari kelompok ${group.label}`,
              disabled: state.locked || group.count <= 1,
              onclick: () => changeCount(group === a ? 'a' : 'b', -1)
            }, icon('minus', 17)),
            h('span', { class: 'tiny-label' }, 'ubah'),
            h('button', {
              type: 'button',
              class: 'mini-round-btn',
              'aria-label': `Tambah satu benda ke kelompok ${group.label}`,
              disabled: state.locked || group.count >= 24,
              onclick: () => changeCount(group === a ? 'a' : 'b', 1)
            }, icon('plus', 17))
          )
        );
        groups.appendChild(groupCard);
      }
      fragment.appendChild(groups);

      if (!state.locked) {
        fragment.appendChild(h('div', { class: 'same-choice' },
          h('button', {
            type: 'button',
            class: 'btn btn--secondary same-choice__btn',
            onclick: () => onChoose('same')
          }, 'Sama banyak')
        ));
      }

      if (state.hintNode) fragment.appendChild(state.hintNode);
      if (state.hintLevel > 0 && !state.locked) {
        const hint = state.hintLevel === 1
          ? hintPanel('Coba pasangkan satu benda dari A dengan satu benda dari B. Kelompok yang masih punya sisa lebih banyak.')
          : hintPanel(`Kelompok A punya ${a.count} benda dan kelompok B punya ${b.count} benda. Bandingkan kedua jumlah itu.`, { title: 'Lihat jumlahnya' });
        fragment.appendChild(hint);
      }

      if (state.answered) {
        const c = challenge.a.count;
        const d = challenge.b.count;
        const explanation = c === d
          ? `Kedua kelompok sama-sama berisi ${c} benda, jadi jumlahnya sama banyak.`
          : `${c > d ? 'A' : 'B'} berisi ${Math.max(c, d)} benda, ${c > d ? 'B' : 'A'} berisi ${Math.min(c, d)} benda. Jadi ${Math.max(c, d)} lebih banyak daripada ${Math.min(c, d)}.`;
        fragment.appendChild(feedback('good', 'Tepat sekali!', explanation, {
          actions: h('button', { type: 'button', class: 'btn btn--primary', onclick: nextRound },
            state.round >= TOTAL_ROUNDS ? 'Lihat hasil' : 'Tantangan berikutnya', icon('arrow-right', 18))
        }));
      } else if (state.wrongThisRound > 0) {
        fragment.appendChild(feedback('try', 'Belum tepat — tidak apa-apa.', 'Coba lihat lagi kelompok yang masih memiliki lebih banyak benda. Kamu bisa menekan Petunjuk untuk bantuan.'));
      }

      fragment.appendChild(h('p', { class: 'activity-footnote' }, 'Kamu boleh mencoba lagi. Kesalahan adalah bagian dari belajar.'));
      return fragment;
    }

    rerender();
  }

  NS.registerModule({
    id: 'quantity',
    order: 1,
    title: 'Quantity Explorer',
    subtitle: 'Banyak & sedikit',
    description: 'Bandingkan dua kelompok benda, acak susunannya, dan bangun rasa jumlah sebelum memakai angka.',
    stage: 'A',
    icon: '🍎',
    accent: 'coral',
    minutes: 6,
    skills: [SKILL],
    goal: 'Membandingkan kuantitas tanpa menghitung dengan simbol.',
    render
  });
})();
