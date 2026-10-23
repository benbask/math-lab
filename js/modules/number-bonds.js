/* Number Bonds — split a whole into two parts and find every pair. */
(function () {
  'use strict';

  const NS = window.MathLab;
  const { h, s, icon, clamp } = NS.util;
  const { feedback, hintPanel, segmented, stepper, progressBar } = NS.Components;
  const SKILL = 'bonds.parts';

  function targetForLevel(level) {
    return [5, 6, 7, 8, 10][clamp(level, 1, 5) - 1];
  }

  function allPairs(target) {
    const pairs = [];
    for (let part = 1; part <= Math.floor(target / 2); part += 1) {
      pairs.push({ a: part, b: target - part });
    }
    return pairs;
  }

  function pairKey(a, b) {
    return `${Math.min(a, b)}+${Math.max(a, b)}`;
  }

  function bondDiagram(target, left, right, animate = false) {
    const node = s('svg', {
      viewBox: '0 0 360 180',
      class: `bond-diagram ${animate ? 'is-animating' : ''}`.trim(),
      role: 'img',
      'aria-label': `Bilangan ${target} terdiri dari ${left} dan ${right}`
    });
    node.appendChild(s('line', { x1: 180, y1: 70, x2: 82, y2: 128, class: 'bond-line' }));
    node.appendChild(s('line', { x1: 180, y1: 70, x2: 278, y2: 128, class: 'bond-line' }));
    node.appendChild(s('circle', { cx: 180, cy: 48, r: 42, class: 'bond-whole' }));
    node.appendChild(s('text', { x: 180, y: 49, class: 'bond-number bond-number--whole' }, String(target)));
    node.appendChild(s('text', { x: 180, y: 18, class: 'bond-caption' }, 'keseluruhan'));

    node.appendChild(s('circle', { cx: 76, cy: 145, r: 29, class: 'bond-part bond-part--one' }));
    node.appendChild(s('text', { x: 76, y: 146, class: 'bond-number' }, String(left)));
    node.appendChild(s('text', { x: 76, y: 178, class: 'bond-caption' }, 'bagian'));
    node.appendChild(s('circle', { cx: 284, cy: 145, r: 29, class: 'bond-part bond-part--two' }));
    node.appendChild(s('text', { x: 284, y: 146, class: 'bond-number' }, String(right)));
    node.appendChild(s('text', { x: 284, y: 178, class: 'bond-caption' }, 'bagian'));
    node.appendChild(s('text', { x: 180, y: 116, class: 'bond-plus' }, '+'));
    node.appendChild(s('text', { x: 180, y: 100, class: 'bond-equals' }, '='));
    return node;
  }

  function render(root, ctx) {
    const level = ctx.getLevel(SKILL);
    const state = {
      mode: 'explore',
      target: targetForLevel(level),
      left: targetForLevel(level),
      exploreShowAll: false,
      challengeTarget: targetForLevel(level),
      found: new Set(),
      lastPair: null,
      message: null,
      messageKind: 'info',
      hintLevel: 0,
      allDone: false,
      attemptCount: 0
    };

    function setMode(mode) {
      if (mode === state.mode) return;
      state.mode = mode;
      state.hintLevel = 0;
      state.message = null;
      if (mode === 'challenge') {
        state.challengeTarget = targetForLevel(ctx.getLevel(SKILL));
        state.target = state.challengeTarget;
        state.left = state.target;
        state.found = new Set();
        state.lastPair = null;
        state.allDone = false;
        state.attemptCount = 0;
      }
      rerender();
    }

    function setExploreTarget(target) {
      state.target = target;
      state.left = target;
      state.latestPair = null;
      state.exploreShowAll = false;
      state.message = null;
      rerender();
    }

    function move(count, direction) {
      if (state.mode === 'challenge' && state.allDone) return;
      state.left = clamp(state.left + direction * count, 0, state.target);
      state.message = null;
      rerender();
    }

    function submitPair() {
      if (state.mode !== 'challenge' || state.allDone) return;
      const left = state.left;
      const right = state.target - left;
      if (left === 0 || right === 0) {
        state.message = 'Coba buat dua bagian yang sama-sama berisi benda.';
        state.messageKind = 'try';
        rerender();
        return;
      }
      const key = pairKey(left, right);
      if (state.found.has(key)) {
        state.message = `Pasangan ${Math.min(left, right)} + ${Math.max(left, right)} sudah ada. Coba susunan lain, ya.`;
        state.messageKind = 'info';
        rerender();
        return;
      }
      state.found.add(key);
      state.attemptCount += 1;
      state.lastPair = { a: left, b: right };
      state.message = `Pasangan baru: ${left} + ${right} = ${state.target}.`;
      state.messageKind = 'good';
      ctx.recordAttempt({ correct: true, skillId: SKILL });
      ctx.sound('good');
      if (state.found.size === allPairs(state.target).length) {
        state.allDone = true;
      }
      rerender();
    }

    function useHint() {
      if (state.allDone) return;
      if (state.hintLevel < 2) {
        state.hintLevel += 1;
        ctx.recordHint(SKILL);
      }
      rerender();
    }

    const clear = NS.util.clear;

    function rerender() {
      clear(root);
      root.appendChild(build());
    }

    function pairTrack() {
      const pairs = allPairs(state.target);
      const track = h('div', { class: 'pair-track', 'aria-label': `${state.found.size} dari ${pairs.length} pasangan ditemukan` });
      for (const pair of pairs) {
        const key = pairKey(pair.a, pair.b);
        const found = state.found.has(key);
        track.appendChild(h('div', {
          class: `pair-chip ${found ? 'is-found' : ''} ${state.lastPair && pairKey(state.lastPair.a, state.lastPair.b) === key ? 'is-new' : ''}`.trim()
        }, found ? `${Math.min(pair.a, pair.b)} + ${Math.max(pair.a, pair.b)}` : '? + ?'));
      }
      return track;
    }

    function tray(side, count, target) {
      const trayItems = h('div', { class: 'bond-tray__items' });
      for (let index = 0; index < count; index += 1) {
        trayItems.appendChild(h('button', {
          type: 'button',
          class: 'bond-item',
          'aria-label': `Pindahkan satu benda dari ${side === 'left' ? 'kiri ke kanan' : 'kanan ke kiri'}`,
          disabled: state.mode === 'challenge' && state.allDone,
          onclick: () => move(1, side === 'left' ? -1 : 1)
        }, '🍪'));
      }
      if (count === 0) {
        trayItems.appendChild(h('span', { class: 'bond-tray__empty' }, 'kosong'));
      }
      return h('div', { class: `bond-tray bond-tray--${side}` },
        h('div', { class: 'bond-tray__top' },
          h('strong', {}, side === 'left' ? 'Bagian kiri' : 'Bagian kanan'),
          h('span', { class: 'count-badge' }, String(count))
        ),
        trayItems,
        h('div', { class: 'bond-tray__actions' },
          h('button', {
            type: 'button', class: 'btn btn--soft btn--tiny',
            disabled: count === 0 || (state.mode === 'challenge' && state.allDone),
            onclick: () => move(1, side === 'left' ? -1 : 1)
          }, side === 'left' ? 'Ke kanan' : 'Ke kiri', icon('arrow-right', 15)),
          side === 'left'
            ? h('button', {
              type: 'button', class: 'btn btn--soft btn--tiny', disabled: state.left === 0,
              onclick: () => { state.left = 0; state.message = null; rerender(); }
            }, 'Semua ke kanan')
            : h('button', {
              type: 'button', class: 'btn btn--soft btn--tiny', disabled: state.left === target,
              onclick: () => { state.left = target; state.message = null; rerender(); }
            }, 'Semua ke kiri')
        )
      );
    }

    function buildExplore(fragment) {
      fragment.appendChild(h('div', { class: 'activity-intro' },
        h('div', {},
          h('p', { class: 'activity-intro__eyebrow' }, 'Number Bonds'),
          h('p', { class: 'activity-intro__text' }, 'Satu bilangan dapat dipecah menjadi dua bagian. Geser benda dan lihat hubungannya.')
        ),
        h('div', { class: 'level-chip' }, `Tingkat ${ctx.getLevel(SKILL)}`)
      ));
      fragment.appendChild(h('div', { class: 'mode-row' },
        segmented({
          label: 'Mode Number Bonds',
          value: state.mode,
          options: [{ value: 'explore', label: 'Jelajahi' }, { value: 'challenge', label: 'Cari semua pasangan' }],
          onChange: setMode
        })
      ));
      fragment.appendChild(h('section', { class: 'activity-card activity-card--bond' },
        h('div', { class: 'card-heading' },
          h('div', {},
            h('h2', {}, `Bilangan ${state.target}`),
            h('p', {}, 'Keseluruhan = bagian + bagian')
          ),
          stepper({
            label: 'Target',
            value: state.target,
            min: 4,
            max: 10,
            onMinus: () => setExploreTarget(state.target - 1),
            onPlus: () => setExploreTarget(state.target + 1)
          })
        ),
        bondDiagram(state.target, state.left, state.target - state.left, true),
        h('p', { class: 'bond-equation', 'aria-live': 'polite' },
          h('span', {}, String(state.left)),
          h('span', { class: 'operator' }, '+'),
          h('span', {}, String(state.target - state.left)),
          h('span', { class: 'operator' }, '='),
          h('strong', {}, String(state.target))
        ),
        h('div', { class: 'bond-trays' },
          tray('left', state.left, state.target),
          tray('right', state.target - state.left, state.target)
        ),
        h('div', { class: 'activity-toolbar activity-toolbar--center' },
          h('button', {
            type: 'button', class: 'btn btn--soft btn--small',
            onclick: () => { state.exploreShowAll = !state.exploreShowAll; rerender(); }
          }, state.exploreShowAll ? 'Sembunyikan semua pasangan' : 'Lihat semua pasangan', icon('eye', 17))
        ),
        state.exploreShowAll ? h('div', { class: 'all-pairs-grid' },
          allPairs(state.target).map((pair) => h('span', {
            class: `pair-pill ${pairKey(pair.a, pair.b) === pairKey(state.left, state.target - state.left) ? 'is-active' : ''}`
          }, `${pair.a} + ${pair.b}`))
        ) : null,
        h('p', { class: 'activity-footnote' }, 'Pasangan 1 + 4 dan 4 + 1 menggunakan bagian yang sama. Urutannya boleh bertukar.')
      ));
    }

    function buildChallenge(fragment) {
      const target = state.challengeTarget;
      const totalPairs = allPairs(target).length;
      fragment.appendChild(h('div', { class: 'activity-intro' },
        h('div', {},
          h('p', { class: 'activity-intro__eyebrow' }, 'Number Bonds'),
          h('p', { class: 'activity-intro__text' }, 'Temukan semua cara memecah bilangan menjadi dua bagian yang sama-sama berisi.')
        ),
        h('div', { class: 'level-chip' }, `Tingkat ${ctx.getLevel(SKILL)}`)
      ));
      fragment.appendChild(h('div', { class: 'mode-row' },
        segmented({
          label: 'Mode Number Bonds',
          value: state.mode,
          options: [{ value: 'explore', label: 'Jelajahi' }, { value: 'challenge', label: 'Cari semua pasangan' }],
          onChange: setMode
        })
      ));
      fragment.appendChild(h('section', { class: 'activity-card activity-card--bond' },
        h('div', { class: 'card-heading' },
          h('div', {},
            h('h2', {}, `Semua pasangan untuk ${target}`),
            h('p', {}, 'Pindahkan benda, lalu simpan setiap susunan baru.')
          ),
          h('div', { class: 'found-counter' },
            h('strong', {}, `${state.found.size}/${totalPairs}`),
            h('span', {}, 'pasangan')
          )
        ),
        progressBar(totalPairs ? state.found.size / totalPairs : 0, { label: 'Pasangan ditemukan', className: 'bond-progress' }),
        bondDiagram(target, state.left, target - state.left, true),
        h('p', { class: 'bond-equation' },
          h('span', {}, String(state.left)),
          h('span', { class: 'operator' }, '+'),
          h('span', {}, String(target - state.left)),
          h('span', { class: 'operator' }, '='),
          h('strong', {}, String(target))
        ),
        state.allDone ? null : h('div', { class: 'bond-trays' },
          tray('left', state.left, target),
          tray('right', target - state.left, target)
        ),
        state.allDone
          ? feedback('good', 'Semua pasangan ditemukan!', `Kamu menemukan ${totalPairs} pasangan untuk bilangan ${target}. Coba perhatikan pola: ketika satu bagian bertambah satu, bagian lain berkurang satu.`, {
            actions: h('button', { type: 'button', class: 'btn btn--primary', onclick: () => ctx.finish({ completed: true }) }, 'Lihat hasil', icon('arrow-right', 18))
          })
          : h('div', { class: 'bond-submit-row' },
            h('button', { type: 'button', class: 'btn btn--primary', onclick: submitPair }, icon('plus', 18), 'Simpan pasangan ini'),
            h('button', { type: 'button', class: 'btn btn--soft', onclick: useHint }, icon('bulb', 18), 'Petunjuk')
          ),
        state.message && !state.allDone ? feedback(state.messageKind, state.messageKind === 'good' ? 'Pasangan baru tersimpan' : state.messageKind === 'try' ? 'Coba susunan lain' : 'Sudah ada', state.message) : null,
        !state.allDone && state.hintLevel > 0 ? hintPanel(
          state.hintLevel === 1
            ? 'Coba pindahkan satu benda. Jumlah di kedua bagian tetap membentuk bilangan yang sama.'
            : (() => {
              const missing = allPairs(target).find((pair) => !state.found.has(pairKey(pair.a, pair.b)));
              return missing ? `Salah satu susunan yang belum dicoba: ${missing.a} + ${missing.b}.` : 'Coba periksa susunan yang belum tersimpan.';
            })()
        ) : null,
        pairTrack()
      ));
      if (!state.allDone) {
        fragment.appendChild(h('p', { class: 'activity-footnote' }, 'Tidak masalah jika perlu mencoba beberapa susunan. Setiap bagian boleh berisi berapa saja, asalkan jumlahnya tetap.'));
      }
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
    id: 'number-bonds',
    order: 3,
    title: 'Number Bonds',
    subtitle: 'Pasangan bilangan',
    description: 'Pindahkan benda antara dua bagian, lihat hubungan bagian–keseluruhan, lalu temukan semua pasangan bilangan.',
    stage: 'B',
    icon: '🍪',
    accent: 'sun',
    minutes: 8,
    skills: [SKILL],
    goal: 'Menguraikan bilangan dan menemukan semua pasangan yang membentuknya.',
    render
  });
})();
