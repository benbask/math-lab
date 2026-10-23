/* Number Line — drag, estimate, jump forward and backward. */
(function () {
  'use strict';

  const NS = window.MathLab;
  const { h, s, icon, clamp, randInt, pick } = NS.util;
  const { feedback, hintPanel, roundBanner, segmented } = NS.Components;
  const SKILL = 'line.number';
  const TOTAL_ROUNDS = 5;
  const WIDTH = 760;
  const HEIGHT = 190;
  const PADDING = 44;

  function rangeForLevel(level) {
    if (level >= 5) return { min: -10, max: 10 };
    if (level >= 2) return { min: 0, max: 20 };
    return { min: 0, max: 10 };
  }

  function toleranceForLevel(level) {
    return [1.4, 1.2, 1, 0.8, 0.7][clamp(level, 1, 5) - 1];
  }

  function makeChallenge(level, round) {
    const range = rangeForLevel(level);
    const tolerance = toleranceForLevel(level);
    const canSubtract = maxSafe(range);
    let type;
    if (level === 1) type = round % 2 === 0 ? 'jump' : 'estimate';
    else type = Math.random() < 0.45 ? 'estimate' : 'jump';

    if (type === 'estimate') {
      const target = randInt(range.min + 1, range.max - 1);
      return { type, range, tolerance, target, marker: range.min, start: null, delta: null, op: null };
    }

    const span = range.max - range.min;
    const deltaMax = Math.min(level <= 1 ? 3 : level <= 2 ? 5 : level <= 3 ? 8 : 6, Math.max(2, Math.floor(span / 2)));
    const op = Math.random() < 0.55 || range.min < 0 ? 'add' : 'subtract';
    let delta = randInt(2, deltaMax);
    let start;
    let result;
    if (op === 'add') {
      start = randInt(range.min, range.max - delta);
      result = start + delta;
    } else {
      start = randInt(range.min + delta, range.max);
      result = start - delta;
    }
    return {
      type: 'jump',
      range,
      tolerance,
      target: result,
      marker: start,
      start,
      delta,
      op
    };
  }

  function maxSafe(range) {
    return range.max - range.min;
  }

  function render(root, ctx) {
    let lineRefs = null;
    const state = {
      mode: 'explore',
      range: { min: 0, max: 10 },
      marker: 4,
      lastJump: null,
      round: 1,
      level: ctx.getLevel(SKILL),
      challenge: null,
      locked: false,
      wrong: 0,
      hintLevel: 0,
      readout: null
    };

    function rerender() {
      clear(root);
      root.appendChild(build());
    }
    const clear = NS.util.clear;

    function startChallenge() {
      state.mode = 'challenge';
      state.challenge = makeChallenge(state.level, state.round);
      state.range = state.challenge.range;
      state.marker = state.challenge.marker;
      state.lastJump = null;
      state.locked = false;
      state.wrong = 0;
      state.hintLevel = 0;
      rerender();
    }

    function setMode(mode) {
      if (mode === state.mode) return;
      state.mode = mode;
      state.locked = false;
      state.wrong = 0;
      state.hintLevel = 0;
      if (mode === 'challenge') {
        state.round = 1;
        startChallenge();
      } else {
        state.range = { min: 0, max: 10 };
        state.marker = 4;
        state.lastJump = null;
        rerender();
      }
    }

    function setRange(range) {
      state.range = range;
      state.marker = clamp(state.marker, range.min, range.max);
      state.lastJump = null;
      rerender();
    }

    function xFor(value, range = state.range) {
      const span = range.max - range.min || 1;
      return PADDING + ((value - range.min) / span) * (WIDTH - PADDING * 2);
    }

    function valueAt(clientX, svgNode) {
      const rect = svgNode.getBoundingClientRect();
      const ratio = (clientX - rect.left) / Math.max(1, rect.width);
      const plotStart = PADDING / WIDTH;
      const plotEnd = (WIDTH - PADDING) / WIDTH;
      const normalized = clamp((ratio - plotStart) / (plotEnd - plotStart), 0, 1);
      return Math.round(state.range.min + normalized * (state.range.max - state.range.min));
    }

    function markerLabel() {
      if (state.mode === 'challenge' && state.challenge.type === 'estimate' && !state.locked) return '?';
      return String(state.marker);
    }

    function updateLineVisual() {
      if (!lineRefs || !lineRefs.markerGroup) return;
      const x = xFor(state.marker);
      lineRefs.markerGroup.setAttribute('transform', `translate(${x} 0)`);
      lineRefs.markerGroup.setAttribute('aria-valuenow', String(state.marker));
      lineRefs.markerText.textContent = markerLabel();
      if (state.lastJump) {
        const fromX = xFor(state.lastJump.from);
        const toX = xFor(state.lastJump.to);
        const midX = (fromX + toX) / 2;
        const lift = Math.min(46, 18 + Math.abs(toX - fromX) * 0.14);
        lineRefs.arc.setAttribute('d', `M ${fromX} 92 Q ${midX} ${92 - lift} ${toX} 92`);
        lineRefs.arc.style.opacity = '1';
        lineRefs.arcEnd.setAttribute('cx', String(toX));
        lineRefs.arcEnd.setAttribute('cy', '92');
        lineRefs.arcEnd.style.opacity = '1';
      } else {
        lineRefs.arc.style.opacity = '0';
        lineRefs.arcEnd.style.opacity = '0';
      }
      if (state.readout) state.readout.textContent = state.mode === 'challenge' && state.challenge.type === 'estimate' && !state.locked ? '?' : String(state.marker);
      if (lineRefs.screenReader) lineRefs.screenReader.textContent = `Penanda pada ${state.marker}`;
    }

    function setMarker(value, jump = false) {
      if (state.locked && state.challenge && state.challenge.type === 'jump') return;
      const old = state.marker;
      const next = clamp(Math.round(value), state.range.min, state.range.max);
      if (jump && next !== old) state.lastJump = { from: old, to: next };
      else if (!jump) state.lastJump = null;
      state.marker = next;
      updateLineVisual();
    }

    function attachLineEvents(svgNode) {
      const group = svgNode.querySelector('[data-marker]');
      const pointerDown = (event) => {
        if (state.mode === 'challenge' && state.locked) return;
        event.preventDefault();
        const start = state.marker;
        setMarker(valueAt(event.clientX, svgNode), false);
        NS.util.onPointerMove(window, (moveEvent) => {
          moveEvent.preventDefault();
          setMarker(valueAt(moveEvent.clientX, svgNode), false);
        }, () => {
          if (state.mode === 'explore' || (state.challenge && state.challenge.type === 'jump')) {
            if (start !== state.marker) state.lastJump = { from: start, to: state.marker };
            updateLineVisual();
          }
        });
      };
      svgNode.addEventListener('pointerdown', pointerDown);
      group.addEventListener('keydown', (event) => {
        let delta = 0;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') delta = -1;
        else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') delta = 1;
        else if (event.key === 'Home') delta = state.range.min - state.marker;
        else if (event.key === 'End') delta = state.range.max - state.marker;
        else return;
        event.preventDefault();
        setMarker(state.marker + delta * (event.shiftKey ? 5 : 1), true);
      });
    }

    function numberLineSvg(interactive = true) {
      const range = state.range;
      const node = s('svg', {
        viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
        class: 'number-line-svg',
        role: 'group',
        'aria-label': `Garis bilangan dari ${range.min} sampai ${range.max}`
      });
      const grid = s('g', { class: 'line-grid' });
      const labelStep = range.max - range.min <= 20 ? 1 : 2;
      for (let value = range.min; value <= range.max; value += 1) {
        const x = xFor(value, range);
        const major = value % 5 === 0;
        grid.appendChild(s('line', {
          x1: x, y1: major ? 88 : 93, x2: x, y2: 106,
          class: major ? 'line-tick line-tick--major' : 'line-tick'
        }));
        if ((value - range.min) % labelStep === 0 || value === range.max) {
          const text = s('text', {
            x, y: 130,
            class: `line-label ${major ? 'line-label--major' : ''}`.trim(),
            'text-anchor': 'middle'
          }, String(value));
          grid.appendChild(text);
        }
        if (major && value !== range.min && value !== range.max) {
          grid.appendChild(s('text', { x, y: 153, class: 'line-notice', 'text-anchor': 'middle' }, value === 0 ? 'nol' : ''));
        }
      }
      node.appendChild(grid);
      node.appendChild(s('line', { x1: PADDING, y1: 98, x2: WIDTH - PADDING, y2: 98, class: 'line-axis' }));
      node.appendChild(s('path', { class: 'line-jump-arc', d: '', opacity: '0' }));
      const arcEnd = s('circle', { cx: 0, cy: 92, r: 4, class: 'line-jump-end', opacity: '0' });
      node.appendChild(arcEnd);

      const markerGroup = s('g', {
        class: 'line-marker',
        'data-marker': 'true',
        tabindex: '0',
        role: 'slider',
        'aria-label': 'Penanda garis bilangan',
        'aria-valuemin': String(range.min),
        'aria-valuemax': String(range.max),
        'aria-valuenow': String(state.marker),
        transform: `translate(${xFor(state.marker, range)} 0)`
      });
      markerGroup.appendChild(s('line', { x1: 0, y1: 62, x2: 0, y2: 98, class: 'line-marker-stem' }));
      markerGroup.appendChild(s('circle', { cx: 0, cy: 54, r: 21, class: 'line-marker-bubble' }));
      const markerText = s('text', { x: 0, y: 55, class: 'line-marker-number', 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, markerLabel());
      markerGroup.appendChild(markerText);
      node.appendChild(markerGroup);
      node.appendChild(s('title', {}, 'Geser penanda dengan jari, atau gunakan tombol panah kiri dan kanan.'));

      lineRefs = { svg: node, markerGroup, markerText, arc: node.querySelector('.line-jump-arc'), arcEnd, screenReader: null };
      if (interactive) attachLineEvents(node);
      return node;
    }

    function jumpControls(disabled = false) {
      return h('div', { class: 'line-jump-controls' },
        h('button', { type: 'button', class: 'btn btn--soft', disabled, onclick: () => setMarker(state.marker - 1, true) },
          icon('arrow-left', 17), 'Mundur 1'),
        h('button', { type: 'button', class: 'btn btn--soft', disabled, onclick: () => setMarker(state.marker + 1, true) },
          'Maju 1', icon('arrow-right', 17))
      );
    }

    function checkAnswer() {
      if (!state.challenge || state.locked) return;
      const c = state.challenge;
      let correct;
      if (c.type === 'estimate') {
        correct = Math.abs(state.marker - c.target) <= c.tolerance;
      } else {
        correct = state.marker === c.target;
      }
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
      if (!state.challenge || state.locked) return;
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
      state.challenge = makeChallenge(state.level, state.round);
      state.range = state.challenge.range;
      state.marker = state.challenge.marker;
      state.locked = false;
      state.wrong = 0;
      state.hintLevel = 0;
      state.lastJump = null;
      rerender();
    }

    function buildExplore(fragment) {
      fragment.appendChild(h('div', { class: 'activity-intro' },
        h('div', {},
          h('p', { class: 'activity-intro__eyebrow' }, 'Number Line'),
          h('p', { class: 'activity-intro__text' }, 'Garis bilangan adalah jalan bilangan. Geser penanda, lalu coba melompat maju atau mundur.')
        ),
        h('div', { class: 'level-chip' }, `Tingkat ${state.level}`)
      ));
      fragment.appendChild(h('div', { class: 'mode-row' },
        segmented({
          label: 'Mode garis bilangan',
          value: state.mode,
          options: [{ value: 'explore', label: 'Jelajahi' }, { value: 'challenge', label: 'Tantangan' }],
          onChange: setMode
        })
      ));
      fragment.appendChild(h('section', { class: 'activity-card' },
        h('div', { class: 'card-heading' },
          h('div', {},
            h('h2', {}, 'Berjalan di garis bilangan'),
            h('p', {}, 'Ketuk garis atau geser penanda. Gunakan tombol panah untuk presisi.')
          ),
          segmented({
            label: 'Rentang bilangan',
            value: `${state.range.min}:${state.range.max}`,
            options: [
              { value: '0:10', label: '0–10' },
              { value: '0:20', label: '0–20' },
              { value: '-10:10', label: '−10–10' }
            ],
            onChange: (value) => {
              const [min, max] = value.split(':').map(Number);
              setRange({ min, max });
            }
          })
        ),
        h('div', { class: 'line-readout' },
          h('span', { class: 'line-readout__label' }, 'Penanda sekarang'),
          state.readout = h('strong', { class: 'line-readout__value' }, String(state.marker))
        ),
        numberLineSvg(true),
        jumpControls(),
        h('div', { class: 'mini-legend' },
          h('span', {}, '← mundur (kurang)'),
          h('span', {}, 'maju (tambah) →')
        ),
        h('p', { class: 'activity-footnote' }, 'Coba letakkan penanda di 0, lalu lompat 5 ke kanan. Di angka berapa kamu berhenti?')
      ));
      const sr = h('p', { class: 'sr-only', 'aria-live': 'polite' }, `Penanda pada ${state.marker}`);
      fragment.appendChild(sr);
      queueMicrotask(() => {
        if (lineRefs) lineRefs.screenReader = sr;
      });
    }

    function buildChallenge(fragment) {
      const c = state.challenge;
      const rangeText = `${c.range.min} sampai ${c.range.max}`;
      const heading = c.type === 'estimate'
        ? `Letakkan penanda pada bilangan ${c.target}`
        : `${c.start} ${c.op === 'add' ? '+' : '−'} ${c.delta} = ?`;
      const instruction = c.type === 'estimate'
        ? 'Perkiraan posisi juga penting. Kamu tidak harus tepat sekali, tetapi coba sedekat mungkin.'
        : `Mulai dari ${c.start}. ${c.op === 'add' ? `Lompat ${c.delta} langkah ke kanan` : `Lompat ${c.delta} langkah ke kiri`}, lalu periksa posisimu.`;

      fragment.appendChild(h('div', { class: 'activity-intro' },
        h('div', {},
          h('p', { class: 'activity-intro__eyebrow' }, 'Number Line'),
          h('p', { class: 'activity-intro__text' }, 'Gunakan garis sebagai alat berpikir, bukan hanya untuk menulis jawaban.')
        ),
        h('div', { class: 'level-chip' }, `Tingkat ${state.level}`)
      ));
      fragment.appendChild(h('div', { class: 'mode-row' },
        segmented({
          label: 'Mode garis bilangan',
          value: state.mode,
          options: [{ value: 'explore', label: 'Jelajahi' }, { value: 'challenge', label: 'Tantangan' }],
          onChange: setMode
        })
      ));
      fragment.appendChild(roundBanner({
        round: state.round,
        total: TOTAL_ROUNDS,
        tag: `Tantangan ${state.round} dari ${TOTAL_ROUNDS}`,
        title: heading,
        instruction
      }));
      fragment.appendChild(h('div', { class: 'activity-toolbar activity-toolbar--center' },
        h('span', { class: 'chip chip--soft' }, `Rentang ${rangeText}`),
        h('span', { class: 'chip chip--soft' }, c.type === 'estimate' ? 'Perkirakan posisi' : 'Lompat di garis'),
        !state.locked ? h('button', { type: 'button', class: 'btn btn--soft btn--small', onclick: useHint }, icon('bulb', 17), 'Petunjuk') : null
      ));
      fragment.appendChild(h('section', { class: 'activity-card' },
        h('div', { class: 'line-readout' },
          h('span', { class: 'line-readout__label' }, c.type === 'estimate' ? 'Posisi penanda' : 'Penanda sekarang'),
          state.readout = h('strong', { class: 'line-readout__value' }, markerLabel())
        ),
        numberLineSvg(!state.locked),
        !state.locked ? h('div', { class: 'line-challenge-controls' },
          jumpControls(false),
          h('button', { type: 'button', class: 'btn btn--primary', onclick: checkAnswer }, icon('check', 18), 'Periksa posisi')
        ) : null,
        state.locked ? feedback('good', 'Posismu tepat!', c.type === 'estimate'
          ? `Targetnya ${c.target}, dan penandamu berada di ${state.marker}. Selisih ${Math.abs(state.marker - c.target)} langkah masih masuk perkiraan.`
          : `Penanda berpindah dari ${c.start} ke ${state.marker}. Jadi ${c.start} ${c.op === 'add' ? '+' : '−'} ${c.delta} = ${c.target}.`, {
          actions: h('button', { type: 'button', class: 'btn btn--primary', onclick: nextRound },
            state.round >= TOTAL_ROUNDS ? 'Lihat hasil' : 'Tantangan berikutnya', icon('arrow-right', 18))
        }) : null,
        state.wrong > 0 && !state.locked ? feedback('try', 'Belum tepat — coba geser lagi.', c.type === 'estimate'
          ? 'Lihat angka di kiri dan kanan penanda. Apakah posisimu sudah dekat dengan target?'
          : `Kamu mulai di ${c.start}. Setiap tombol maju menambah satu langkah.`) : null,
        state.hintLevel > 0 && !state.locked ? hintPanel(c.type === 'estimate'
          ? state.hintLevel === 1
            ? 'Cari setengah jalan terlebih dahulu, lalu bagi lagi jaraknya menjadi bagian yang lebih kecil.'
            : `Target ${c.target} berada ${c.target - c.range.min} langkah dari ujung kiri.`
          : state.hintLevel === 1
            ? 'Setiap lompatan satu langkah mengubah posisi satu angka. Coba hitung sambil melompat.'
            : `Hasilnya adalah ${c.target}. Coba arahkan penanda tepat ke angka itu.`) : null,
        h('p', { class: 'activity-footnote' }, 'Perkiraan yang dekat juga bernilai. Ketepatan bisa dilatih sedikit demi sedikit.')
      ));
    }

    function build() {
      const fragment = document.createDocumentFragment();
      if (state.mode === 'explore') buildExplore(fragment);
      else buildChallenge(fragment);
      return fragment;
    }

    state.challenge = null;
    rerender();
  }

  NS.registerModule({
    id: 'number-line',
    order: 4,
    title: 'Number Line',
    subtitle: 'Garis bilangan',
    description: 'Geser penanda, lompat maju dan mundur, lalu perkirakan posisi bilangan pada garis yang dapat diperluas.',
    stage: 'B',
    icon: '📏',
    accent: 'blue',
    minutes: 7,
    skills: [SKILL],
    goal: 'Membayangkan posisi, urutan, penjumlahan, dan pengurangan pada garis bilangan.',
    render
  });
})();
