/* MathLab — small, dependency-free DOM and math helpers. */
(function () {
  'use strict';

  const NS = (window.MathLab = window.MathLab || {});

  const SVG_NS = 'http://www.w3.org/2000/svg';

  function addChildren(node, children) {
    for (const child of children) {
      if (child === null || child === undefined || child === false) continue;
      if (Array.isArray(child)) {
        addChildren(node, child);
      } else if (child instanceof Node) {
        node.appendChild(child);
      } else {
        node.appendChild(document.createTextNode(String(child)));
      }
    }
  }

  function applyAttributes(node, attrs, isSvg) {
    if (!attrs) return;
    for (const key of Object.keys(attrs)) {
      const value = attrs[key];
      if (value === null || value === undefined || value === false) continue;

      if (key === 'class' || key === 'className') {
        if (isSvg) node.setAttribute('class', String(value));
        else node.className = String(value);
      } else if (key === 'text') {
        node.textContent = String(value);
      } else if (key === 'dataset') {
        for (const dataKey of Object.keys(value)) node.dataset[dataKey] = String(value[dataKey]);
      } else if (key === 'style' && typeof value === 'object') {
        for (const styleKey of Object.keys(value)) node.style.setProperty(styleKey, String(value[styleKey]));
      } else if (key.startsWith('on') && typeof value === 'function') {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key === 'ref' && typeof value === 'function') {
        value(node);
      } else if (isSvg) {
        node.setAttribute(key, String(value));
      } else if (key in node && typeof value !== 'string' && key !== 'list' && key !== 'form') {
        try {
          node[key] = value;
        } catch (_) {
          node.setAttribute(key, String(value));
        }
      } else {
        node.setAttribute(key, String(value));
      }
    }
  }

  function h(tag, attrs, ...children) {
    const node = document.createElement(tag);
    applyAttributes(node, attrs, false);
    addChildren(node, children);
    return node;
  }

  function svg(tag, attrs, ...children) {
    const node = document.createElementNS(SVG_NS, tag);
    applyAttributes(node, attrs, true);
    addChildren(node, children);
    return node;
  }

  function clear(node) {
    if (!node) return node;
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  const ICONS = {
    'arrow-left': [['path', { d: 'M19 12H5M11 18l-6-6 6-6', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }]],
    'arrow-right': [['path', { d: 'M5 12h14M13 6l6 6-6 6', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }]],
    'chevron-right': [['path', { d: 'm9 6 6 6-6 6', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.4', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }]],
    home: [['path', { d: 'm3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }]],
    map: [['path', { d: 'm3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }]],
    chart: [['path', { d: 'M4 20V10M10 20V4M16 20v-7M22 20H2', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.2', 'stroke-linecap': 'round' }]],
    settings: [['circle', { cx: '12', cy: '12', r: '3', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }], ['path', { d: 'M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }]],
    play: [['path', { d: 'm8 5 11 7-11 7z', fill: 'currentColor', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linejoin': 'round' }]],
    plus: [['path', { d: 'M12 5v14M5 12h14', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.4', 'stroke-linecap': 'round' }]],
    minus: [['path', { d: 'M5 12h14', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.4', 'stroke-linecap': 'round' }]],
    shuffle: [['path', { d: 'M16 4h4v4M20 4l-6.5 6.5M4 4l16 16M16 20h4v-4M4 20l5-5', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }]],
    check: [['path', { d: 'm4 12 5 5L20 6', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }]],
    x: [['path', { d: 'M6 6l12 12M18 6 6 18', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.4', 'stroke-linecap': 'round' }]],
    bulb: [['path', { d: 'M9 18h6M10 21h4M8.2 14.5A6 6 0 1 1 15.8 14.5C14.7 15.2 14 16 14 18h-4c0-2-.7-2.8-1.8-3.5z', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.9', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }]],
    rotate: [['path', { d: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }]],
    trash: [['path', { d: 'M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.9', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }]],
    download: [['path', { d: 'M12 3v12M7 10l5 5 5-5M4 20h16', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.1', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }]],
    upload: [['path', { d: 'M12 16V4M7 9l5-5 5 5M4 20h16', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.1', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }]],
    edit: [['path', { d: 'm4 16v4h4L20 8l-4-4zM14 6l4 4', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }]],
    'user-plus': [['circle', { cx: '9', cy: '8', r: '4', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }], ['path', { d: 'M2 21a7 7 0 0 1 14 0M18 8v6M15 11h6', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round' }]],
    star: [['path', { d: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z', fill: 'currentColor', stroke: 'none' }]],
    info: [['circle', { cx: '12', cy: '12', r: '9', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }], ['path', { d: 'M12 11v6M12 7.5v.1', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.4', 'stroke-linecap': 'round' }]],
    volume: [['path', { d: 'M4 9h4l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }]],
    'volume-off': [['path', { d: 'M4 9h4l5-4v14l-5-4H4zM16 9l5 6M21 9l-5 6', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }]],
    refresh: [['path', { d: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }]],
    sparkles: [['path', { d: 'm12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8zM5 3l.6 1.4L7 5l-1.4.6L5 7l-.6-1.4L3 5l1.4-.6z', fill: 'currentColor', stroke: 'none' }]],
    grid: [['rect', { x: '3', y: '3', width: '18', height: '18', rx: '2', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }], ['path', { d: 'M3 9h18M3 15h18M9 3v18M15 3v18', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', opacity: '.7' }]],
    lock: [['rect', { x: '4', y: '10', width: '16', height: '11', rx: '2', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }], ['path', { d: 'M8 10V7a4 4 0 0 1 8 0v3', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }]],
    clock: [['circle', { cx: '12', cy: '12', r: '9', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }], ['path', { d: 'M12 7v5l3 2', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round' }]],
    target: [['circle', { cx: '12', cy: '12', r: '9', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }], ['circle', { cx: '12', cy: '12', r: '5', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }], ['circle', { cx: '12', cy: '12', r: '1.5', fill: 'currentColor' }]],
    users: [['circle', { cx: '9', cy: '8', r: '3.5', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }], ['path', { d: 'M2.5 20a6.5 6.5 0 0 1 13 0M16 5a3.5 3.5 0 0 1 0 7M17 14a6 6 0 0 1 4.5 6', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round' }]],
    eye: [['path', { d: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }], ['circle', { cx: '12', cy: '12', r: '3', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }]],
    menu: [['path', { d: 'M4 6h16M4 12h16M4 18h16', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.3', 'stroke-linecap': 'round' }]]
  };

  function icon(name, size = 20, extraClass = '') {
    const iconNode = svg('svg', {
      viewBox: '0 0 24 24',
      width: size,
      height: size,
      'aria-hidden': 'true',
      focusable: 'false',
      class: `icon ${extraClass}`.trim()
    });
    for (const [tag, attrs] of ICONS[name] || ICONS.info) {
      iconNode.appendChild(svg(tag, attrs));
    }
    return iconNode;
  }

  function randomId(prefix = 'id') {
    let value;
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      value = window.crypto.randomUUID().replace(/-/g, '');
    } else {
      value = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    }
    return `${prefix}_${value.slice(0, 20)}`;
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function shuffle(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function range(start, end, step = 1) {
    const values = [];
    if (step === 0) return values;
    if (step > 0) {
      for (let value = start; value <= end; value += step) values.push(value);
    } else {
      for (let value = start; value >= end; value += step) values.push(value);
    }
    return values;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function sum(values) {
    return values.reduce((total, value) => total + value, 0);
  }

  function gcd(a, b) {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y) {
      [x, y] = [y, x % y];
    }
    return x || 1;
  }

  function lcm(a, b) {
    return Math.abs(a * b) / gcd(a, b);
  }

  function simplifyFraction(numerator, denominator) {
    const divisor = gcd(numerator, denominator);
    return { numerator: numerator / divisor, denominator: denominator / divisor };
  }

  function fractionText(numerator, denominator) {
    return `${numerator}/${denominator}`;
  }

  function formatDate(iso, options = {}) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: options.year ? 'numeric' : undefined,
      hour: options.time ? '2-digit' : undefined,
      minute: options.time ? '2-digit' : undefined
    }).format(date);
  }

  function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '—';
    if (seconds < 60) return `${Math.round(seconds)} dtk`;
    const minutes = Math.floor(seconds / 60);
    const rest = Math.round(seconds % 60);
    return `${minutes} mnt ${rest} dtk`;
  }

  function safeFilePart(value) {
    return String(value || 'mathlab')
      .normalize('NFKD')
      .replace(/[^\w\-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'mathlab';
  }

  function downloadFile(filename, text, type = 'application/json') {
    const blob = new Blob([text], { type: `${type};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = h('a', { href: url, download: filename, class: 'sr-only' });
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function announce(message) {
    const region = document.getElementById('sr-status');
    if (!region) return;
    region.textContent = '';
    window.setTimeout(() => {
      region.textContent = message;
    }, 30);
  }

  function onPointerMove(target, moveHandler, endHandler) {
    const move = (event) => moveHandler(event);
    const end = (event) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      if (endHandler) endHandler(event);
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }

  NS.util = {
    h,
    s: svg,
    svg,
    clear,
    qs,
    qsa,
    icon,
    randomId,
    randInt,
    pick,
    shuffle,
    range,
    clamp,
    sum,
    gcd,
    lcm,
    simplifyFraction,
    fractionText,
    formatDate,
    formatDuration,
    safeFilePart,
    downloadFile,
    prefersReducedMotion,
    announce,
    onPointerMove,
    SVG_NS
  };
})();
