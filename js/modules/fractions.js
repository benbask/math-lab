/* Fraction Lab — parts, equivalents, comparisons, decimals, percentages, and the number line. */
(function () {
  'use strict';

  const NS = window.MathLab;
  const { h, s, icon, randInt, pick, shuffle, clamp, gcd } = NS.util;
  const { feedback, hintPanel, roundBanner, segmented, stepper, fractionBadge, progressBar } = NS.Components;
  const SKILL_PARTS = 'fractions.parts';
  const SKILL_EQUIV = 'fractions.equivalent';
  const TOTAL_ROUNDS = 5;

  function isTerminating(denominator) {
    let value = denominator;
    while (value % 2 === 0) value /= 2;
    while (value % 5 === 0) value /= 5;
    return value === 1;
  }

  function decimalString(numerator, denominator) {
    const value = numerator / denominator;
    const formatted = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3, minimumFractionDigits: 0 }).format(value);
    return isTerminating(denominator) ? formatted : `${formatted}…`;
  }

  function percentString(numerator, denominator) {
    const value = (numerator / denominator) * 100;
    const rounded = Math.round(value * 10) / 10;
    return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(rounded)}%${isTerminating(denominator) ? '' : ' (kira-kira)'}`;
  }

  function fractionValue(n, d) {
    return n / d;
  }

  function visualBar(numerator, denominator, options = {}) {
    const width = options.width || 560;
    const height = options.height || 88;
    const pad = 3;
    const node = s('svg', {
      viewBox: `0 0 ${width} ${height}`,
      class: `fraction-bar ${options.className || ''}`.trim(),
      role: 'img',
      'aria-label': `${numerator} dari ${denominator} bagian diwarnai`
    });
    node.appendChild(s('rect', { x: 0, y: 0, width, height, rx: 14, class: 'fraction-bar-bg' }));
    const innerW = width - pad * 2;
    const segmentW = innerW / denominator;
    for (let index = 0; index < denominator; index += 1) {
      const filled = index < numerator;
      node.appendChild(s('rect', {
        x: pad + index * segmentW,
        y: pad,
        width: Math.max(0.5, segmentW),
        height: height - pad * 2,
        class: `fraction-segment ${filled ? 'is-filled' : ''}`.trim(),
        style: filled ? `--fraction-color:${options.color || '#ff7a59'}` : ''
      }));
    }
    return node;
  }

  function visualCircle(numerator, denominator, options = {}) {
    const size = options.size || 190;
    const center = size / 2;
    const radius = size / 2 - 8;
    const node = s('svg', {
      viewBox: `0 0 ${size} ${size}`,
      width: size,
      height: size,
      class: 'fraction-circle',
      role: 'img',
      'aria-label': `${numerator} dari ${denominator} bagian diwarnai`
    });
    node.appendChild(s('circle', { cx: center, cy: center, r: radius, class: 'fraction-circle-bg' }));
    const angle = (Math.PI * 2) / denominator;
    for (let index = 0; index < denominator; index += 1) {
      const start = -Math.PI / 2 + index * angle;
      const end = start + angle;
      const x1 = center + radius * Math.cos(start);
      const y1 = center + radius * Math.sin(start);
      const x2 = center + radius * Math.cos(end);
      const y2 = center + radius * Math.sin(end);
      const large = angle > Math.PI ? 1 : 0;
      const filled = index < numerator;
      node.appendChild(s('path', {
        d: `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`,
        class: `fraction-slice ${filled ? 'is-filled' : ''}`.trim(),
        style: filled ? `--fraction-color:${options.color || '#ff7a59'}` : ''
      }));
    }
    node.appendChild(s('circle', { cx: center, cy: center, r: radius, class: 'fraction-circle-outline' }));
    return node;
  }

  function numberLine(numerator, denominator, options = {}) {
    const width = 560;
    const height = 126;
    const pad = 30;
    const y = 74;
    const node = s('svg', {
      viewBox: `0 0 ${width} ${height}`,
      class: 'fraction-numberline',
      role: 'img',
      'aria-label': `Pecahan ${numerator} per ${denominator} pada garis bilangan`
    });
    node.appendChild(s('line', { x1: pad, y1: y, x2: width - pad, y2: y, class: 'fraction-line-axis' }));
    for (let index = 0; index <= denominator; index += 1) {
      const x = pad + (index / denominator) * (width - pad * 2);
      node.appendChild(s('line', { x1: x, y1: y - 7, x2: x, y2: y + 7, class: 'fraction-line-tick' }));
      const showAll = denominator <= 8;
      const isHalf = denominator % 2 === 0 && index === denominator / 2;
      if (index === 0 || index === denominator || showAll || isHalf) {
        let label;
        if (index === 0) label = '0';
        else if (index === denominator) label = '1';
        else if (isHalf) label = '1/2';
        else label = `${index}/${denominator}`;
        node.appendChild(s('text', {
          x,
          y: y + 26,
          'text-anchor': 'middle',
          class: 'fraction-line-label'
        }, label));
      }
    }
    const markerX = pad + (numerator / denominator) * (width - pad * 2);
    node.appendChild(s('line', { x1: markerX, y1: y - 44, x2: markerX, y2: y + 2, class: 'fraction-line-marker-stem' }));
    node.appendChild(s('circle', { cx: markerX, cy: y - 48, r: 17, class: 'fraction-line-marker' }));
    node.appendChild(s('text', { x: markerX, y: y - 47, 'text-anchor': 'middle', 'dominant-baseline': 'middle', class: 'fraction-line-marker-text' }, `${numerator}/${denominator}`));
    return node;
  }

  function makePartsChallenge(level) {
    const maxDen = Math.min(12, [4, 6, 8, 10, 12][clamp(level, 1, 5) - 1]);
    const denominator = randInt(level <= 1 ? 2 : 3, maxDen);
    const numerator = randInt(1, Math.max(1, denominator - 1));
    const shape = Math.random() < 0.5 ? 'bar' : 'circle';
    return {
      type: 'identify',
      skill: SKILL_PARTS,
      numerator,
      denominator,
      shape,
      question: 'Pecahan mana yang ditunjukkan oleh bagian berwarna?',
      instruction: 'Hitung semua bagian yang sama besar, lalu hitung bagian yang diwarnai.',
      answer: `${numerator}/${denominator}`,
      options: fractionOptions(numerator, denominator, maxDen)
    };
  }

  function fractionOptions(numerator, denominator, maxDen) {
    const correctValue = numerator / denominator;
    const values = [];
    const seen = new Set();
    const add = (n, d) => {
      if (n < 1 || d < 2 || n >= d) return;
      const key = `${n}/${d}`;
      if (seen.has(key)) return;
      if (Math.abs(n / d - correctValue) < 0.000001) return;
      seen.add(key);
      values.push({ n, d });
    };
    add(numerator, Math.max(2, denominator - 1));
    add(numerator + 1, denominator);
    add(Math.max(1, numerator - 1), denominator);
    add(numerator, Math.min(12, denominator + 1));
    add(randInt(1, Math.max(1, maxDen - 1)), maxDen);
    add(randInt(1, Math.max(1, maxDen - 1)), Math.max(2, maxDen - 1));
    const options = [{ n: numerator, d: denominator }, ...shuffle(values).slice(0, 3)];
    return shuffle(options);
  }

  function makeCompareChallenge(level) {
    const maxDen = Math.min(12, [4, 5, 6, 10, 12][clamp(level, 1, 5) - 1]);
    let a;
    let b;
    let guard = 0;
    do {
      a = { n: randInt(1, maxDen - 1), d: randInt(2, maxDen) };
      b = { n: randInt(1, maxDen - 1), d: randInt(2, maxDen) };
      a.n = Math.min(a.n, a.d - 1);
      b.n = Math.min(b.n, b.d - 1);
      guard += 1;
    } while (guard < 30 && (a.n >= a.d || b.n >= b.d || Math.abs(fractionValue(a.n, a.d) - fractionValue(b.n, b.d)) < 0.00001));
    if (a.n >= a.d) a.n = 1;
    if (b.n >= b.d) b.n = 1;
    if (Math.abs(fractionValue(a.n, a.d) - fractionValue(b.n, b.d)) < 0.00001) b = { n: 1, d: Math.max(2, b.d) };
    if (Math.abs(fractionValue(a.n, a.d) - fractionValue(b.n, b.d)) < 0.00001) a = { n: 2, d: 3 };
    const answer = fractionValue(a.n, a.d) > fractionValue(b.n, b.d) ? 'a' : 'b';
    const smaller = answer === 'a' ? 'b' : 'a';
    return {
      type: 'compare',
      skill: SKILL_EQUIV,
      a,
      b,
      answer,
      smaller,
      question: 'Pecahan mana yang lebih besar?',
      instruction: 'Kedua batang memiliki ukuran keseluruhan yang sama. Bandingkan bagian berwarnanya.',
      options: [
        { key: 'a', label: `${a.n}/${a.d}`, value: a },
        { key: 'b', label: `${b.n}/${b.d}`, value: b }
      ]
    };
  }

  function makeEquivalentChallenge(level) {
    const maxDen = Math.min(12, [6, 8, 9, 10, 12][clamp(level, 1, 5) - 1]);
    let denominator = randInt(2, Math.max(3, maxDen - 2));
    let numerator = randInt(1, denominator - 1);
    const multiplier = pick([2, 3, 4].filter((value) => denominator * value <= 24));
    let equivalent = { n: numerator * multiplier, d: denominator * multiplier };
    if (equator(equivalent.n, equivalent.d) > 24) equivalent = { n: numerator * 2, d: denominator * 2 };
    const target = { n: numerator, d: denominator };
    const options = [{ ...equivalent }];
    const seen = new Set([`${target.n}/${target.d}`, `${equivalent.n}/${equivalent.d}`]);
    let guard = 0;
    while (options.length < 4 && guard < 100) {
      guard += 1;
      const d = randInt(2, Math.max(4, maxDen));
      const n = randInt(1, d - 1);
      if (seen.has(`${n}/${d}`)) continue;
      if (Math.abs(n / d - target.n / target.d) < 0.000001) continue;
      seen.add(`${n}/${d}`);
      options.push({ n, d });
    }
    return {
      type: 'equivalent',
      skill: SKILL_EQUIV,
      target,
      answer: `${equivalent.n}/${equivalent.d}`,
      options: shuffle(options),
      question: `Manakah pecahan yang senilai dengan ${numerator}/${denominator}?`,
      instruction: 'Pecahan senilai memiliki ukuran yang sama meskipun bagiannya dipotong berbeda.',
      visual: { n: numerator, d: denominator }
    };
  }

  function equator(n, d) {
    return d;
  }

  function makeDecimalChallenge(level) {
    const baseList = level >= 5
      ? [{ n: 1, d: 8 }, { n: 3, d: 8 }, { n: 5, d: 8 }, { n: 7, d: 8 }, { n: 1, d: 2 }, { n: 3, d: 4 }, { n: 2, d: 5 }, { n: 1, d: 5 }, { n: 7, d: 10 }]
      : [{ n: 1, d: 2 }, { n: 1, d: 4 }, { n: 3, d: 4 }, { n: 1, d: 5 }, { n: 2, d: 5 }, { n: 3, d: 5 }, { n: 1, d: 10 }, { n: 3, d: 10 }];
    const fraction = pick(baseList);
    const askPercent = Math.random() < 0.5;
    const correct = askPercent ? percentString(fraction.n, fraction.d).replace(' (kira-kira)', '') : decimalString(fraction.n, fraction.d);
    const values = new Set([correct]);
    const decimals = [0.1, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.75, 0.8, 1.25, 1.5];
    if (!askPercent) {
      for (const value of shuffle(decimals)) {
        if (values.size >= 4) break;
        const text = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value);
        if (text !== correct) values.add(text);
      }
    } else {
      const percentages = [10, 20, 25, 30, 40, 50, 60, 75, 80, 100, 125, 150];
      for (const value of shuffle(percentages)) {
        if (values.size >= 4) break;
        const text = `${value}%`;
        if (text !== correct) values.add(text);
      }
    }
    return {
      type: askPercent ? 'percent' : 'decimal',
      skill: SKILL_EQUIV,
      fraction,
      answer: correct,
      options: shuffle(Array.from(values)),
      question: askPercent ? `Berapa persen dari ${fraction.n}/${fraction.d}?` : `Berapa bentuk desimal dari ${fraction.n}/${fraction.d}?`,
      instruction: askPercent ? 'Persen berarti “per seratus”. Ubah pecahan menjadi per seratus.' : 'Bagi pembilang dengan penyebut untuk menemukan desimalnya.'
    };
  }

  function makeChallenge(partsLevel, equivLevel) {
    const roll = Math.random();
    if (roll < 0.34) return makePartsChallenge(partsLevel);
    if (roll < 0.58) return makeCompareChallenge(equivLevel);
    if (roll < 0.8 || equivLevel < 4) return makeEquivalentChallenge(equivLevel);
    return makeDecimalChallenge(equivLevel);
  }

  function fractionText(fraction) {
    return `${fraction.n}/${fraction.d}`;
  }

  function render(root, ctx) {
    const state = {
      mode: 'lab',
      labShape: 'bar',
      labN: 3,
      labD: 4,
      compareA: { n: 1, d: 2 },
      compareB: { n: 2, d: 3 },
      round: 1,
      partsLevel: ctx.getLevel(SKILL_PARTS),
      equivLevel: ctx.getLevel(SKILL_EQUIV),
      challenge: null,
      locked: false,
      wrong: 0,
      hintLevel: 0,
      selected: null
    };
    state.challenge = makeChallenge(state.partsLevel, state.equivLevel);

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
      if (mode === 'challenge' && !state.challenge) state.challenge = makeChallenge(state.partsLevel, state.equivLevel);
      rerender();
    }

    function updateLab(n, d) {
      state.labN = clamp(n, 0, state.labD);
      state.labD = d;
      state.labN = clamp(state.labN, 0, state.labD);
      rerender();
    }

    function choose(value) {
      if (state.locked) return;
      const c = state.challenge;
      const correct = String(value) === String(c.answer);
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
      state.challenge = makeChallenge(state.partsLevel, state.equivLevel);
      state.locked = false;
      state.wrong = 0;
      state.hintLevel = 0;
      state.selected = null;
      rerender();
    }

    function equivalentFractions(n, d) {
      const list = [];
      for (const multiplier of [2, 3, 4]) {
        if (d * multiplier <= 24) list.push({ n: n * multiplier, d: d * multiplier });
      }
      return list;
    }

    function labBuild(fragment) {
      const n = state.labN;
      const d = state.labD;
      const equivalents = equivalentFractions(n, d);
      fragment.appendChild(h('div', { class: 'activity-intro' },
        h('div', {},
          h('p', { class: 'activity-intro__eyebrow' }, 'Fraction Lab'),
          h('p', { class: 'activity-intro__text' }, 'Pecahan adalah bagian dari keseluruhan yang sama besar. Ubah potongannya dan lihat nilainya tetap bisa dibandingkan.')
        ),
        h('div', { class: 'level-chip' }, `Tingkat ${ctx.getLevel(SKILL_PARTS)}`)
      ));
      fragment.appendChild(h('div', { class: 'mode-row' },
        segmented({
          label: 'Mode Fraction Lab',
          value: state.mode,
          options: [
            { value: 'lab', label: 'Laboratorium' },
            { value: 'compare', label: 'Bandingkan' },
            { value: 'challenge', label: 'Tantangan' }
          ],
          onChange: setMode
        })
      ));
      fragment.appendChild(h('section', { class: 'activity-card' },
        h('div', { class: 'fraction-lab-head' },
          h('div', {},
            h('h2', {}, 'Potong dan warnai'),
            h('p', {}, 'Setiap potongan harus sama besar. Pecahan menunjukkan bagian yang diwarnai.')
          ),
          segmented({
            label: 'Bentuk pecahan',
            value: state.labShape,
            options: [{ value: 'bar', label: 'Batang' }, { value: 'circle', label: 'Lingkaran' }],
            onChange: (shape) => { state.labShape = shape; rerender(); }
          })
        ),
        h('div', { class: 'fraction-lab-grid' },
          h('div', { class: 'fraction-editor' },
            stepper({ label: 'Pembilang', value: n, min: 0, max: d, onMinus: () => updateLab(n - 1, d), onPlus: () => updateLab(n + 1, d) }),
            stepper({ label: 'Penyebut', value: d, min: 2, max: 12, onMinus: () => updateLab(n, d - 1), onPlus: () => updateLab(n, d + 1) })
          ),
          h('div', { class: 'fraction-stage' },
            state.labShape === 'circle' ? visualCircle(n, d) : visualBar(n, d),
            h('div', { class: 'fraction-readout' },
              fractionBadge(n, d),
              h('div', {},
                h('strong', {}, `${n} dari ${d} bagian sama besar`),
                h('span', {}, `Desimal: ${decimalString(n, d)} · Persen: ${percentString(n, d)}`)
              )
            )
          )
        ),
        numberLine(n, d),
        h('div', { class: 'equivalent-section' },
          h('div', { class: 'section-heading' },
            h('div', {},
              h('h3', {}, 'Pecahan senilai'),
              h('p', {}, 'Kalikan pembilang dan penyebut dengan bilangan yang sama.')
            )
          ),
          h('div', { class: 'equivalent-grid' },
            [{ n, d }, ...equivalents].map((fraction) => h('div', { class: 'equivalent-card' },
              visualBar(fraction.n, fraction.d, { width: 300, height: 54, color: '#8b5cf6' }),
              h('div', { class: 'equivalent-card__label' }, fractionBadge(fraction.n, fraction.d), h('span', {}, decimalString(fraction.n, fraction.d)))
            ))
          )
        ),
        h('p', { class: 'activity-footnote' }, n === d ? 'Ketika pembilang sama dengan penyebut, pecahan bernilai 1.' : n === 0 ? 'Pembilang nol berarti tidak ada bagian yang diwarnai.' : `Bagian yang belum diwarnai: ${d - n}/${d}.`)
      ));
    }

    function relation(a, b) {
      const left = a.n * b.d;
      const right = b.n * a.d;
      if (left === right) return { symbol: '=', label: 'sama besar', tone: 'equal' };
      if (left > right) return { symbol: '>', label: 'lebih besar', tone: 'a' };
      return { symbol: '<', label: 'lebih besar', tone: 'b' };
    }

    function compareBuild(fragment) {
      const a = state.compareA;
      const b = state.compareB;
      const rel = relation(a, b);
      const larger = rel.tone === 'a' ? a : b;
      const smaller = rel.tone === 'a' ? b : a;
      fragment.appendChild(h('div', { class: 'activity-intro' },
        h('div', {},
          h('p', { class: 'activity-intro__eyebrow' }, 'Fraction Lab'),
          h('p', { class: 'activity-intro__text' }, 'Bandingkan pecahan dengan ukuran keseluruhan yang sama. Potongan yang berbeda belum tentu nilainya berbeda.')
        ),
        h('div', { class: 'level-chip' }, `Tingkat ${ctx.getLevel(SKILL_EQUIV)}`)
      ));
      fragment.appendChild(h('div', { class: 'mode-row' },
        segmented({
          label: 'Mode Fraction Lab',
          value: state.mode,
          options: [
            { value: 'lab', label: 'Laboratorium' },
            { value: 'compare', label: 'Bandingkan' },
            { value: 'challenge', label: 'Tantangan' }
          ],
          onChange: setMode
        })
      ));
      fragment.appendChild(h('section', { class: 'activity-card' },
        h('div', { class: 'card-heading' },
          h('div', {},
            h('h2', {}, 'Mana yang lebih besar?'),
            h('p', {}, 'Ubah kedua pecahan dan bandingkan bagian berwarnanya.')
          ),
          h('div', { class: `relation-badge relation-badge--${rel.tone}` },
            h('strong', {}, rel.symbol),
            h('span', {}, rel.tone === 'equal' ? 'sama besar' : `${fractionText(larger)} lebih besar`)
          )
        ),
        h('div', { class: 'fraction-compare-grid' },
          [['a', a], ['b', b]].map(([key, value]) => h('div', { class: 'fraction-compare-card' },
            h('div', { class: 'fraction-compare-card__head' },
              h('strong', {}, `Pecahan ${key.toUpperCase()}`),
              fractionBadge(value.n, value.d)
            ),
            visualBar(value.n, value.d, { color: key === 'a' ? '#ff7a59' : '#5b8def', width: 360, height: 76 }),
            h('div', { class: 'fraction-editor fraction-editor--inline' },
              stepper({ label: 'Pembilang', value: value.n, min: 0, max: value.d, onMinus: () => { value.n = clamp(value.n - 1, 0, value.d); rerender(); }, onPlus: () => { value.n = clamp(value.n + 1, 0, value.d); rerender(); } }),
              stepper({ label: 'Penyebut', value: value.d, min: 2, max: 12, onMinus: () => { value.d = Math.max(2, value.d - 1); value.n = Math.min(value.n, value.d); rerender(); }, onPlus: () => { value.d = Math.min(12, value.d + 1); rerender(); } })
            )
          ))
        ),
        h('div', { class: 'compare-explanation' },
          h('strong', {}, rel.tone === 'equal' ? 'Kedua pecahan menutupi bagian yang sama.' : `${fractionText(larger)} menutupi bagian yang lebih besar.`),
          h('p', {}, rel.tone === 'equal'
            ? `${fractionText(a)} dan ${fractionText(b)} adalah pecahan senilai.`
            : `Bandingkan dengan setengah: ${fractionText(larger)} ${fractionValue(larger.n, larger.d) > 0.5 ? 'lebih dari setengah' : 'kurang dari setengah'}, sedangkan ${fractionText(smaller)} ${fractionValue(smaller.n, smaller.d) > 0.5 ? 'lebih dari setengah' : 'kurang dari setengah'}.`)
        ),
        h('p', { class: 'activity-footnote' }, 'Penyebut berbeda tidak otomatis berarti nilainya berbeda. Selalu bandingkan ukuran bagiannya.')
      ));
    }

    function challengeVisual(c) {
      if (c.type === 'identify') {
        return h('div', { class: 'challenge-fraction-visual' },
          c.shape === 'circle' ? visualCircle(c.numerator, c.denominator, { size: 220 }) : visualBar(c.numerator, c.denominator, { width: 540, height: 100 }),
          h('p', {}, 'Bagian berwarna menunjukkan pecahan.')
        );
      }
      if (c.type === 'compare') {
        return h('div', { class: 'fraction-compare-visual' },
          h('div', {}, h('span', { class: 'small-label' }, 'A'), visualBar(c.a.n, c.a.d, { width: 360, height: 70, color: '#ff7a59' })),
          h('div', {}, h('span', { class: 'small-label' }, 'B'), visualBar(c.b.n, c.b.d, { width: 360, height: 70, color: '#5b8def' }))
        );
      }
      if (c.type === 'equivalent') {
        return h('div', { class: 'challenge-fraction-visual' },
          visualBar(c.visual.n, c.visual.d, { width: 520, height: 92, color: '#8b5cf6' }),
          h('p', {}, `Bagian berwarna = ${fractionText(c.visual)}`)
        );
      }
      return h('div', { class: 'challenge-fraction-visual' },
        h('div', { class: 'fraction-inline-big' }, fractionBadge(c.fraction.n, c.fraction.d)),
        visualBar(c.fraction.n, c.fraction.d, { width: 520, height: 92, color: '#22b8a6' }),
        h('p', {}, `Pecahan ${fractionText(c.fraction)}`)
      );
    }

    function optionButton(value) {
      const c = state.challenge;
      let key;
      let label;
      let content;
      if (c.type === 'identify' || c.type === 'equivalent') {
        key = `${value.n}/${value.d}`;
        label = `Pecahan ${value.n} per ${value.d}`;
        content = fractionBadge(value.n, value.d);
      } else if (c.type === 'compare') {
        key = value.key;
        label = `Pecahan ${value.label}`;
        content = fractionBadge(value.value.n, value.value.d);
      } else {
        key = value;
        label = String(value);
        content = h('strong', { class: 'decimal-option' }, String(value));
      }
      const correct = key === c.answer;
      const selected = state.selected === key;
      return h('button', {
        type: 'button',
        class: `fraction-choice ${selected ? (correct ? 'is-correct' : 'is-wrong') : ''} ${state.locked && correct ? 'is-correct' : ''}`.trim(),
        disabled: state.locked,
        'aria-label': label,
        onclick: () => choose(key)
      }, content);
    }

    function challengeBuild(fragment) {
      const c = state.challenge;
      fragment.appendChild(h('div', { class: 'activity-intro' },
        h('div', {},
          h('p', { class: 'activity-intro__eyebrow' }, 'Fraction Lab'),
          h('p', { class: 'activity-intro__text' }, 'Hubungkan gambar, simbol, desimal, dan persen. Semuanya menggambarkan bagian dari keseluruhan.')
        ),
        h('div', { class: 'level-chip' }, `Tingkat ${c.skill === SKILL_PARTS ? state.partsLevel : state.equivLevel}`)
      ));
      fragment.appendChild(h('div', { class: 'mode-row' },
        segmented({
          label: 'Mode Fraction Lab',
          value: state.mode,
          options: [
            { value: 'lab', label: 'Laboratorium' },
            { value: 'compare', label: 'Bandingkan' },
            { value: 'challenge', label: 'Tantangan' }
          ],
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
        h('span', { class: 'chip chip--soft' }, c.type === 'identify' ? 'Membaca gambar' : c.type === 'compare' ? 'Membandingkan' : c.type === 'equivalent' ? 'Pecahan senilai' : 'Desimal & persen'),
        !state.locked ? h('button', { type: 'button', class: 'btn btn--soft btn--small', onclick: useHint }, icon('bulb', 17), 'Petunjuk') : null
      ));
      fragment.appendChild(h('section', { class: 'activity-card' },
        challengeVisual(c),
        h('div', { class: `fraction-options ${c.type === 'compare' ? 'fraction-options--two' : ''} ${c.type === 'decimal' || c.type === 'percent' ? 'fraction-options--text' : ''}`.trim(), role: 'group', 'aria-label': 'Pilihan jawaban' },
          c.options.map((value) => optionButton(value))
        ),
        state.hintLevel > 0 && !state.locked ? hintPanel(
          state.hintLevel === 1
            ? c.type === 'identify'
              ? 'Hitung jumlah semua potongan, lalu jumlah potongan berwarna. Pembilang adalah bagian berwarna.'
              : c.type === 'compare'
                ? 'Bandingkan kedua pecahan dengan setengah, atau cari pecahan senilai yang penyebutnya sama.'
                : c.type === 'equivalent'
                  ? 'Kalikan pembilang dan penyebut dengan bilangan yang sama.'
                  : c.type === 'percent'
                    ? 'Ubah pecahan menjadi perseratus. 1/2 = 50/100 = 50%.'
                    : 'Bagi pembilang dengan penyebut. 3/4 berarti 3 ÷ 4.'
            : c.type === 'identify'
              ? `Ada ${c.denominator} bagian sama besar, dan ${c.numerator} di antaranya berwarna.`
              : c.type === 'compare'
                ? `A = ${fractionText(c.a)} ≈ ${decimalString(c.a.n, c.a.d)}; B = ${fractionText(c.b)} ≈ ${decimalString(c.b.n, c.b.d)}.`
                : c.type === 'equivalent'
                  ? `Pecahan ${c.answer} memiliki nilai yang sama dengan ${fractionText(c.visual)}.`
                  : `Jawabannya ${c.answer}.`
        ) : null,
        state.wrong > 0 && !state.locked ? feedback('try', 'Belum tepat —lihat bagiannya lagi.', 'Gambar adalah alat bantu. Bandingkan ukuran bagian, bukan hanya jumlah potongannya.') : null,
        state.locked ? feedback('good', 'Pecahan berhasil kamu baca!', c.type === 'identify'
          ? `Ada ${c.denominator} bagian sama besar; ${c.numerator} diwarnai. Jadi pecahannya ${c.numerator}/${c.denominator}.`
          : c.type === 'compare'
            ? `${fractionText(c.a)} dan ${fractionText(c.b)}: ${fractionText(c[ c.answer ])} lebih besar.`
            : c.type === 'equivalent'
              ? `${c.answer} senilai dengan ${fractionText(c.visual)} karena pembilang dan penyebut dikalikan bilangan yang sama.`
              : `${fractionText(c.fraction)} = ${c.answer}.`, {
          actions: h('button', { type: 'button', class: 'btn btn--primary', onclick: nextRound },
            state.round >= TOTAL_ROUNDS ? 'Lihat hasil' : 'Tantangan berikutnya', icon('arrow-right', 18))
        }) : null,
        h('p', { class: 'activity-footnote' }, 'Pecahan, desimal, dan persen adalah tiga cara membaca bagian yang sama.')
      ));
    }

    function build() {
      const fragment = document.createDocumentFragment();
      if (state.mode === 'lab') labBuild(fragment);
      else if (state.mode === 'compare') compareBuild(fragment);
      else challengeBuild(fragment);
      return fragment;
    }

    rerender();
  }

  NS.registerModule({
    id: 'fractions',
    order: 8,
    title: 'Fraction Lab',
    subtitle: 'Bagian & keseluruhan',
    description: 'Potong batang dan lingkaran, temukan pecahan senilai, bandingkan ukuran, lalu hubungkan dengan desimal, persen, dan garis bilangan.',
    stage: 'D',
    icon: '🍕',
    accent: 'pink',
    minutes: 10,
    skills: [SKILL_PARTS, SKILL_EQUIV],
    goal: 'Membangun gambar mental pecahan, kesetaraan, dan hubungannya dengan desimal serta persen.',
    render
  });
})();
