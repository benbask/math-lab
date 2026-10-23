/* MathLab — reusable learning UI pieces. */
(function () {
  'use strict';

  const NS = (window.MathLab = window.MathLab || {});
  const { h, s, icon, pick } = NS.util;

  const SHAPE_POINTS = {
    star: '50,6 61,37 95,38 68,58 78,92 50,72 22,92 32,58 5,38 39,37',
    triangle: '50,8 92,84 8,84',
    diamond: '50,6 94,50 50,94 6,50',
    pentagon: '50,6 94,38 77,90 23,90 6,38',
    hexagon: '50,6 89,28 89,72 50,94 11,72 11,28',
    trapezoid: '25,20 75,20 94,80 6,80',
    parallelogram: '28,20 94,20 72,80 6,80',
    arrow: '8,38 58,38 58,18 94,50 58,82 58,62 8,62'
  };

  function shapeSvg(shape, color = '#ff7a59', size = 58, options = {}) {
    const outline = options.outline || 'rgba(37,50,75,.16)';
    const node = s('svg', {
      viewBox: '0 0 100 100',
      width: size,
      height: size,
      class: `shape-svg ${options.className || ''}`.trim(),
      'aria-hidden': 'true',
      focusable: 'false'
    });
    if (shape === 'circle') {
      node.appendChild(s('circle', { cx: 50, cy: 50, r: 40, fill: color, stroke: outline, 'stroke-width': 3 }));
    } else if (shape === 'square') {
      node.appendChild(s('rect', { x: 14, y: 14, width: 72, height: 72, rx: 7, fill: color, stroke: outline, 'stroke-width': 3 }));
    } else if (shape === 'rectangle') {
      node.appendChild(s('rect', { x: 6, y: 25, width: 88, height: 50, rx: 6, fill: color, stroke: outline, 'stroke-width': 3 }));
    } else {
      node.appendChild(s('polygon', {
        points: SHAPE_POINTS[shape] || SHAPE_POINTS.triangle,
        fill: color,
        stroke: outline,
        'stroke-width': 3,
        'stroke-linejoin': 'round'
      }));
    }
    return node;
  }

  function statusBadge(status, compact = false) {
    const meta = status || NS.STATUS.not_tried;
    return h('span', { class: `status-badge status-badge--${meta.tone} ${compact ? 'status-badge--compact' : ''}` },
      h('span', { class: 'status-badge__symbol', 'aria-hidden': 'true' }, meta.symbol),
      h('span', {}, compact ? meta.short : meta.label)
    );
  }

  function feedback(kind, title, message, options = {}) {
    const safeKind = ['good', 'try', 'hint', 'info'].includes(kind) ? kind : 'info';
    const iconName = safeKind === 'good' ? 'check' : safeKind === 'try' ? 'refresh' : safeKind === 'hint' ? 'bulb' : 'info';
    const section = h('section', {
      class: `feedback feedback--${safeKind}`,
      role: 'status',
      'aria-live': 'polite'
    },
      h('div', { class: 'feedback__icon', 'aria-hidden': 'true' }, icon(iconName, 22)),
      h('div', { class: 'feedback__content' },
        h('strong', { class: 'feedback__title' }, title),
        message ? h('p', { class: 'feedback__text' }, message) : null,
        options.children || null
      )
    );
    if (options.actions) {
      section.querySelector('.feedback__content').appendChild(
        h('div', { class: 'feedback__actions' }, options.actions)
      );
    }
    return section;
  }

  function hintPanel(text, options = {}) {
    return h('aside', { class: 'hint-panel', role: 'note' },
      h('span', { class: 'hint-panel__icon', 'aria-hidden': 'true' }, icon('bulb', 20)),
      h('div', {},
        h('strong', {}, options.title || 'Petunjuk kecil'),
        h('p', {}, text)
      )
    );
  }

  function roundBanner({ round = 1, total = 5, title = '', instruction = '', tag = '' }) {
    return h('div', { class: 'round-banner' },
      h('div', { class: 'round-banner__top' },
        h('span', { class: 'round-banner__tag' }, tag || `Tantangan ${round} dari ${total}`),
        h('div', { class: 'pips', 'aria-label': `${round} dari ${total} tantangan` },
          Array.from({ length: total }, (_, index) => h('span', {
            class: `pip ${index < round - 1 ? 'pip--done' : index === round - 1 ? 'pip--active' : ''}`
          }))
        )
      ),
      title ? h('h2', { class: 'round-banner__title' }, title) : null,
      instruction ? h('p', { class: 'round-banner__instruction' }, instruction) : null
    );
  }

  function stepper({ label, value, onMinus, onPlus, min = 1, max = 10, suffix = '', disabled = false }) {
    const minus = h('button', {
      type: 'button',
      class: 'stepper__btn',
      'aria-label': `Kurangi ${label}`,
      disabled: disabled || value <= min,
      onclick: onMinus
    }, icon('minus', 20));
    const plus = h('button', {
      type: 'button',
      class: 'stepper__btn',
      'aria-label': `Tambah ${label}`,
      disabled: disabled || value >= max,
      onclick: onPlus
    }, icon('plus', 20));
    return h('div', { class: 'stepper' },
      label ? h('span', { class: 'stepper__label' }, label) : null,
      h('div', { class: 'stepper__controls' },
        minus,
        h('output', { class: 'stepper__value', 'aria-live': 'polite' }, String(value), suffix ? h('small', {}, suffix) : null),
        plus
      )
    );
  }

  function segmented({ label, options, value, onChange, className = '' }) {
    const group = h('div', { class: `segmented ${className}`.trim(), role: 'group', 'aria-label': label || 'Pilihan' });
    for (const option of options) {
      const active = option.value === value;
      group.appendChild(h('button', {
        type: 'button',
        class: `segmented__btn ${active ? 'is-active' : ''}`.trim(),
        'aria-pressed': active ? 'true' : 'false',
        onclick: () => onChange(option.value)
      }, option.label));
    }
    return group;
  }

  function infoBox(title, children, options = {}) {
    return h('aside', { class: `info-box ${options.className || ''}`.trim() },
      h('div', { class: 'info-box__icon', 'aria-hidden': 'true' }, icon(options.icon || 'info', 20)),
      h('div', {},
        h('strong', {}, title),
        typeof children === 'string' ? h('p', {}, children) : children
      )
    );
  }

  function emptyState({ emoji = '🌱', title, message, action }) {
    return h('div', { class: 'empty-state' },
      h('div', { class: 'empty-state__emoji', 'aria-hidden': 'true' }, emoji),
      h('h3', {}, title),
      message ? h('p', {}, message) : null,
      action || null
    );
  }

  function numberEntry({ onSubmit, maxLength = 4, label = 'Jawabanmu', submitLabel = 'Cek jawaban', allowNegative = false }) {
    const input = h('input', {
      class: 'answer-input',
      type: 'text',
      inputmode: allowNegative ? 'text' : 'numeric',
      autocomplete: 'off',
      spellcheck: 'false',
      'aria-label': label,
      placeholder: '?',
      maxlength: String(maxLength)
    });
    const feedbackLine = h('p', { class: 'answer-pad__hint' }, 'Ketik angka atau gunakan tombol di bawah.');
    const keys = allowNegative
      ? ['1', '2', '3', '4', '5', '6', '7', '8', '9', '−', '0', '⌫']
      : ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'C'];
    const pad = h('div', { class: 'answer-pad__keys' });
    for (const key of keys) {
      pad.appendChild(h('button', {
        type: 'button',
        class: 'answer-key',
        'aria-label': key === '⌫' ? 'Hapus angka terakhir' : key === 'C' ? 'Hapus semua angka' : `Angka ${key}`,
        onclick: () => {
          if (key === '⌫') {
            input.value = input.value.slice(0, -1);
          } else if (key === 'C') {
            input.value = '';
          } else if (key === '−') {
            input.value = input.value.startsWith('−') ? input.value.slice(1) : `−${input.value}`;
          } else if (input.value.length < maxLength) {
            input.value += key;
          }
          input.focus();
        }
      }, key));
    }

    function submit() {
      const raw = input.value.replace('−', '-').trim();
      if (!raw || raw === '-') {
        feedbackLine.textContent = 'Tulis angka jawabanmu dulu, ya.';
        feedbackLine.classList.add('is-warn');
        input.focus();
        return;
      }
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        feedbackLine.textContent = 'Gunakan angka, ya.';
        feedbackLine.classList.add('is-warn');
        return;
      }
      feedbackLine.classList.remove('is-warn');
      onSubmit(value, input);
    }

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        submit();
      }
    });
    input.addEventListener('input', () => {
      const allowed = allowNegative ? /^-?[0-9]*$/ : /^[0-9]*$/;
      if (!allowed.test(input.value)) {
        input.value = input.value.replace(/[^0-9-]/g, '').slice(0, maxLength + 1);
      }
      if (!allowNegative) input.value = input.value.replace(/-/g, '');
    });

    const submitButton = h('button', { type: 'button', class: 'btn btn--primary answer-pad__submit', onclick: submit },
      icon('check', 19), submitLabel
    );

    const node = h('div', { class: 'answer-pad' },
      h('label', { class: 'answer-pad__label' }, label),
      input,
      pad,
      feedbackLine,
      submitButton
    );

    return {
      node,
      input,
      submit,
      focus: () => input.focus(),
      setValue: (value) => { input.value = value === null || value === undefined ? '' : String(value); },
      getValue: () => input.value
    };
  }

  function fractionBadge(numerator, denominator, options = {}) {
    return h('span', { class: `fraction-badge ${options.className || ''}`.trim(), 'aria-label': `${numerator} per ${denominator}` },
      h('span', { class: 'fraction-badge__num' }, String(numerator)),
      h('span', { class: 'fraction-badge__line', 'aria-hidden': 'true' }),
      h('span', { class: 'fraction-badge__den' }, String(denominator))
    );
  }

  function progressBar(value, options = {}) {
    const percent = Math.round(Math.max(0, Math.min(1, value || 0)) * 100);
    return h('div', {
      class: `progress-bar ${options.className || ''}`.trim(),
      role: 'progressbar',
      'aria-valuemin': '0',
      'aria-valuemax': '100',
      'aria-valuenow': String(percent),
      'aria-label': options.label || 'Kemajuan'
    }, h('span', { style: { width: `${percent}%` } }));
  }

  function decorativeDoodles() {
    return h('div', { class: 'doodles', 'aria-hidden': 'true' },
      h('span', { class: 'doodle doodle--1' }, '＋'),
      h('span', { class: 'doodle doodle--2' }, '△'),
      h('span', { class: 'doodle doodle--3' }, '●'),
      h('span', { class: 'doodle doodle--4' }, '＝'),
      h('span', { class: 'doodle doodle--5' }, '✶')
    );
  }

  function randomShapeColor() {
    return pick(['#ff7a59', '#22b8a6', '#5b8def', '#f2b544', '#8b5cf6', '#ec6aa0']);
  }

  NS.Components = {
    shapeSvg,
    statusBadge,
    feedback,
    hintPanel,
    roundBanner,
    stepper,
    segmented,
    infoBox,
    emptyState,
    numberEntry,
    fractionBadge,
    progressBar,
    decorativeDoodles,
    randomShapeColor
  };
})();
