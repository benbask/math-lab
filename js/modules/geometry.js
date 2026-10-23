/* Shape & Geometry Lab — shape recognition, a tangram-style puzzle, and coordinate polygons. */
(function () {
  'use strict';

  const NS = window.MathLab;
  const { h, s, icon, randInt, pick, shuffle, clamp, onPointerMove } = NS.util;
  const { feedback, hintPanel, roundBanner, segmented, shapeSvg } = NS.Components;
  const SKILL_SHAPES = 'geometry.shapes';
  const SKILL_TANGRAM = 'geometry.tangram';
  const SKILL_COORDS = 'geometry.coordinates';
  const SHAPE_ROUNDS = 5;

  const SHAPES = {
    circle: { name: 'Lingkaran', sides: 0, color: '#ff7a59' },
    square: { name: 'Persegi', sides: 4, color: '#22b8a6' },
    rectangle: { name: 'Persegi panjang', sides: 4, color: '#5b8def' },
    triangle: { name: 'Segitiga', sides: 3, color: '#f2b544' },
    trapezoid: { name: 'Trapesium', sides: 4, color: '#8b5cf6' },
    diamond: { name: 'Belah ketupat', sides: 4, color: '#ec6aa0' },
    hexagon: { name: 'Segi enam', sides: 6, color: '#20a98f' },
    pentagon: { name: 'Segi lima', sides: 5, color: '#e2853b' },
    parallelogram: { name: 'Jajar genjang', sides: 4, color: '#4789e5' }
  };

  const SHAPE_POOL = {
    1: ['circle', 'square', 'triangle'],
    2: ['circle', 'square', 'rectangle', 'triangle', 'diamond'],
    3: ['square', 'rectangle', 'triangle', 'trapezoid', 'diamond', 'pentagon'],
    4: ['rectangle', 'triangle', 'trapezoid', 'diamond', 'hexagon', 'pentagon', 'parallelogram'],
    5: ['rectangle', 'triangle', 'trapezoid', 'diamond', 'hexagon', 'pentagon', 'parallelogram']
  };

  function makeShapeTask(level) {
    const pool = SHAPE_POOL[clamp(level, 1, 5)] || SHAPE_POOL[3];
    let key = pick(pool);
    const type = level >= 2 && Math.random() < 0.36 ? 'sides' : 'name';
    if (type === 'sides' && key === 'circle') key = pick(pool.filter((shape) => shape !== 'circle'));
    const shape = SHAPES[key];
    const answer = type === 'sides' ? String(shape.sides) : shape.name;
    let options;
    if (type === 'sides') {
      const values = new Set([String(shape.sides), '3', '4', '5', '6', '8']);
      options = shuffle(Array.from(values).slice(0, 4));
      if (!options.includes(answer)) options[0] = answer;
    } else {
      const names = [shape.name, ...shuffle(pool.filter((item) => item !== key).map((item) => SHAPES[item].name)).slice(0, 3)];
      options = shuffle(names);
    }
    return {
      key,
      shape,
      type,
      answer,
      options,
      rotation: level >= 2 ? pick([0, 15, 30, 45, 90, 180]) : 0,
      question: type === 'sides' ? `Berapa banyak sisi pada ${shape.name.toLowerCase()}?` : 'Bentuk apa ini?',
      instruction: type === 'sides' ? 'Hitung sisi lurus di sekeliling bentuk.' : 'Perhatikan jumlah sisi dan ciri bentuknya, bukan hanya warnanya.'
    };
  }

  const ROTATIONS = [
    [[0, 0], [1, 0], [0, 1]],
    [[0, 0], [0, 1], [1, 1]],
    [[1, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [1, 1]]
  ];

  const TANGRAM_ROWS = 6;
  const TANGRAM_COLS = 7;
  const STEP = 50;
  const TARGET_ROWS = [1, 2, 3];
  const TARGET_COLS = [1, 2, 3, 4];
  const PIECE_COLORS = ['#ff7a59', '#22b8a6', '#5b8def', '#8b5cf6'];
  const PIECE_NAMES = ['Jingga', 'Hijau', 'Biru', 'Ungu'];

  function tangramPieces() {
    return [
      { id: 0, x: 0, y: 0, rot: 0 },
      { id: 1, x: 5, y: 0, rot: 0 },
      { id: 2, x: 0, y: 4, rot: 1 },
      { id: 3, x: 5, y: 4, rot: 1 }
    ];
  }

  function targetCells() {
    const set = new Set();
    TARGET_ROWS.forEach((row) => TARGET_COLS.forEach((col) => set.add(`${row},${col}`)));
    return set;
  }

  function absoluteCells(piece, rot = piece.rot, x = piece.x, y = piece.y) {
    return ROTATIONS[rot].map(([dr, dc]) => ({ row: Math.round(y) + dr, col: Math.round(x) + dc }));
  }

  function pieceBounds(piece, rot = piece.rot, x = piece.x, y = piece.y) {
    const cells = ROTATIONS[rot];
    const maxR = Math.max(...cells.map(([r]) => r));
    const maxC = Math.max(...cells.map(([, c]) => c));
    return { width: maxC + 1, height: maxR + 1 };
  }

  function canPlace(pieces, piece, x, y, rot, ignoreId = null) {
    if (x < 0 || y < 0) return false;
    const bounds = pieceBounds(piece, rot, x, y);
    if (x + bounds.width > TANGRAM_COLS || y + bounds.height > TANGRAM_ROWS) return false;
    const mine = absoluteCells(piece, rot, x, y);
    const occupied = new Set();
    for (const other of pieces) {
      if (other.id === (ignoreId === null ? piece.id : ignoreId)) continue;
      for (const cell of absoluteCells(other)) occupied.add(`${cell.row},${cell.col}`);
    }
    return mine.every((cell) => !occupied.has(`${cell.row},${cell.col}`));
  }

  function polygonArea(points) {
    if (points.length < 3) return 0;
    let sumValue = 0;
    for (let index = 0; index < points.length; index += 1) {
      const current = points[index];
      const next = points[(index + 1) % points.length];
      sumValue += current.x * next.y - next.x * current.y;
    }
    return Math.abs(sumValue) / 2;
  }

  function polygonPerimeter(points) {
    if (points.length < 2) return 0;
    let total = 0;
    for (let index = 0; index < points.length; index += 1) {
      const current = points[index];
      const next = points[(index + 1) % points.length];
      total += Math.hypot(next.x - current.x, next.y - current.y);
    }
    return total;
  }

  function axisAlignedRectangle(points) {
    if (points.length !== 4) return null;
    const xs = Array.from(new Set(points.map((point) => point.x)));
    const ys = Array.from(new Set(points.map((point) => point.y)));
    if (xs.length !== 2 || ys.length !== 2) return null;
    const corners = new Set(points.map((point) => `${point.x},${point.y}`));
    for (const x of xs) {
      for (const y of ys) {
        if (!corners.has(`${x},${y}`)) return null;
      }
    }
    const width = Math.abs(xs[0] - xs[1]);
    const height = Math.abs(ys[0] - ys[1]);
    return { width, height, area: width * height };
  }

  function render(root, ctx) {
    const state = {
      mode: 'shapes',
      shapeLevel: ctx.getLevel(SKILL_SHAPES),
      coordLevel: ctx.getLevel(SKILL_COORDS),
      shapeRound: 1,
      shapeTask: null,
      shapeLocked: false,
      shapeWrong: 0,
      shapeHint: 0,
      shapeSelected: null,
      pieces: tangramPieces(),
      selectedPiece: 0,
      solved: false,
      puzzleWrong: 0,
      puzzleHint: 0,
      ghost: false,
      puzzleMessage: '',
      points: [],
      coordTarget: [4, 6, 8, 12, 18][clamp(ctx.getLevel(SKILL_COORDS), 1, 5) - 1],
      coordsSolved: false,
      coordsWrong: 0,
      coordsHint: 0,
      coordsMessage: ''
    };
    state.shapeTask = makeShapeTask(state.shapeLevel);
    let dragCleanup = null;
    ctx.addCleanup(() => {
      if (dragCleanup) dragCleanup();
    });

    const clear = NS.util.clear;
    function rerender() {
      clear(root);
      root.appendChild(build());
    }

    function setMode(mode) {
      if (state.mode === mode) return;
      state.mode = mode;
      rerender();
    }

    /* ---------------- Shape hunt ---------------- */
    function chooseShape(value) {
      if (state.shapeLocked) return;
      const correct = String(value) === state.shapeTask.answer;
      state.shapeSelected = String(value);
      ctx.recordAttempt({ correct, skillId: SKILL_SHAPES });
      if (correct) {
        state.shapeLocked = true;
        ctx.sound('good');
      } else {
        state.shapeWrong += 1;
        ctx.sound('try');
      }
      rerender();
    }

    function shapeHint() {
      if (state.shapeLocked || state.shapeHint >= 2) return;
      state.shapeHint += 1;
      ctx.recordHint(SKILL_SHAPES);
      rerender();
    }

    function nextShapeRound() {
      if (state.shapeRound >= SHAPE_ROUNDS) {
        ctx.finish({ completed: true });
        return;
      }
      state.shapeRound += 1;
      state.shapeTask = makeShapeTask(state.shapeLevel);
      state.shapeLocked = false;
      state.shapeWrong = 0;
      state.shapeHint = 0;
      state.shapeSelected = null;
      rerender();
    }

    function shapeBuild(fragment) {
      const task = state.shapeTask;
      fragment.appendChild(h('div', { class: 'activity-intro' },
        h('div', {},
          h('p', { class: 'activity-intro__eyebrow' }, 'Shape and Geometry Lab'),
          h('p', { class: 'activity-intro__text' }, 'Bentuk tetap dikenali meskipun diputar atau dipindahkan. Perhatikan ciri-cirinya.')
        ),
        h('div', { class: 'level-chip' }, `Tingkat ${state.shapeLevel}`)
      ));
      fragment.appendChild(roundBanner({
        round: state.shapeRound,
        total: SHAPE_ROUNDS,
        tag: `Tantangan ${state.shapeRound} dari ${SHAPE_ROUNDS}`,
        title: task.question,
        instruction: task.instruction
      }));
      fragment.appendChild(h('div', { class: 'activity-toolbar activity-toolbar--center' },
        h('span', { class: 'chip chip--soft' }, task.type === 'sides' ? 'Menghitung sisi' : 'Mengenali bentuk'),
        !state.shapeLocked ? h('button', { type: 'button', class: 'btn btn--soft btn--small', onclick: shapeHint }, icon('bulb', 17), 'Petunjuk') : null
      ));
      fragment.appendChild(h('section', { class: 'activity-card shape-card' },
        h('div', { class: 'shape-showcase', style: task.rotation ? { transform: `rotate(${task.rotation}deg)` } : {} },
          shapeSvg(task.key, task.shape.color, 180)
        ),
        h('div', { class: 'shape-options', role: 'group', 'aria-label': 'Pilihan jawaban' },
          task.options.map((value) => {
            const correct = String(value) === task.answer;
            const selected = state.shapeSelected === String(value);
            return h('button', {
              type: 'button',
              class: `shape-option ${selected ? (correct ? 'is-correct' : 'is-wrong') : ''} ${state.shapeLocked && correct ? 'is-correct' : ''}`.trim(),
              disabled: state.shapeLocked,
              onclick: () => chooseShape(value)
            }, String(value));
          })
        ),
        state.shapeHint > 0 && !state.shapeLocked ? hintPanel(
          state.shapeHint === 1
            ? task.type === 'sides'
              ? 'Mulai dari satu titik sudut dan hitung setiap sisi lurus sampai kembali ke titik awal.'
              : 'Perhatikan jumlah sisi dan sudut. Nama bentuk tidak bergantung pada warnanya.'
            : task.type === 'sides'
              ? `Bentuk ini memiliki ${task.shape.sides} sisi.`
              : `Bentuk ini adalah ${task.shape.name.toLowerCase()}.`
        ) : null,
        state.shapeLocked ? feedback('good', 'Bentuknya kamu kenali!', task.type === 'sides'
          ? `${task.shape.name} memiliki ${task.shape.sides} sisi.`
          : `Bentuk itu adalah ${task.shape.name.toLowerCase()}.`, {
          actions: h('button', { type: 'button', class: 'btn btn--primary', onclick: nextShapeRound },
            state.shapeRound >= SHAPE_ROUNDS ? 'Lihat hasil' : 'Tantangan berikutnya', icon('arrow-right', 18))
        }) : null,
        state.shapeWrong > 0 && !state.shapeLocked ? feedback('try', 'Bukan itu — tetap tenang.', 'Lihat lagi jumlah sisi dan sudutnya. Bentuk yang diputar tetap bentuk yang sama.') : null
      ));
    }

    /* ---------------- Tangram puzzle ---------------- */
    function targetNode() {
      const group = s('g', { class: 'tangram-target' });
      TARGET_ROWS.forEach((row) => TARGET_COLS.forEach((col) => {
        group.appendChild(s('rect', {
          x: col * STEP + 2,
          y: row * STEP + 2,
          width: STEP - 4,
          height: STEP - 4,
          rx: 6,
          class: 'tangram-target-cell'
        }));
      }));
      return group;
    }

    function ghostNode() {
      const group = s('g', { class: 'tangram-ghost' });
      const solution = [
        { x: 1, y: 1, rot: 0 },
        { x: 3, y: 1, rot: 0 },
        { x: 1, y: 2, rot: 2 },
        { x: 3, y: 2, rot: 2 }
      ];
      solution.forEach((item, index) => {
        const cells = ROTATIONS[item.rot].map(([dr, dc]) => ({ row: item.y + dr, col: item.x + dc }));
        cells.forEach((cell) => group.appendChild(s('rect', {
          x: cell.col * STEP + 5,
          y: cell.row * STEP + 5,
          width: STEP - 10,
          height: STEP - 10,
          rx: 4,
          class: 'tangram-ghost-cell',
          style: `--ghost-color:${PIECE_COLORS[index]}`
        })));
      });
      return group;
    }

    function boardPoint(event, svgNode) {
      const rect = svgNode.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * TANGRAM_COLS,
        y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * TANGRAM_ROWS
      };
    }

    function attachPieceEvents(group, piece, svgNode) {
      group.addEventListener('pointerdown', (event) => {
        if (state.solved) return;
        event.preventDefault();
        event.stopPropagation();
        state.selectedPiece = piece.id;
        const start = boardPoint(event, svgNode);
        const origin = { x: piece.x, y: piece.y };
        let moved = false;
        if (dragCleanup) dragCleanup();
        dragCleanup = onPointerMove(window, (moveEvent) => {
          moveEvent.preventDefault();
          const current = boardPoint(moveEvent, svgNode);
          const dx = current.x - start.x;
          const dy = current.y - start.y;
          if (Math.abs(dx) > 0.04 || Math.abs(dy) > 0.04) moved = true;
          piece.x = origin.x + dx;
          piece.y = origin.y + dy;
          const node = svgNode.querySelector(`[data-piece-id="${piece.id}"]`);
          if (node) node.setAttribute('transform', `translate(${piece.x * STEP} ${piece.y * STEP})`);
        }, () => {
          dragCleanup = null;
          if (!moved) {
            rerender();
            return;
          }
          const x = Math.round(piece.x);
          const y = Math.round(piece.y);
          if (canPlace(state.pieces, piece, x, y, piece.rot)) {
            piece.x = x;
            piece.y = y;
            state.puzzleMessage = '';
          } else {
            piece.x = origin.x;
            piece.y = origin.y;
            state.puzzleMessage = 'Tempat itu bertabrakan dengan potongan lain atau keluar papan.';
          }
          rerender();
        });
      });
    }

    function tangramBoard() {
      const svgNode = s('svg', {
        viewBox: `0 0 ${TANGRAM_COLS * STEP} ${TANGRAM_ROWS * STEP}`,
        class: 'tangram-board',
        role: 'application',
        tabindex: '0',
        'aria-label': 'Papan puzzle tangram. Pilih potongan, lalu gunakan tombol putar atau tombol panah untuk memindahkan.'
      });
      svgNode.appendChild(s('rect', { x: 0, y: 0, width: TANGRAM_COLS * STEP, height: TANGRAM_ROWS * STEP, class: 'tangram-bg' }));
      for (let row = 0; row <= TANGRAM_ROWS; row += 1) {
        svgNode.appendChild(s('line', { x1: 0, y1: row * STEP, x2: TANGRAM_COLS * STEP, y2: row * STEP, class: 'tangram-grid-line' }));
      }
      for (let col = 0; col <= TANGRAM_COLS; col += 1) {
        svgNode.appendChild(s('line', { x1: col * STEP, y1: 0, x2: col * STEP, y2: TANGRAM_ROWS * STEP, class: 'tangram-grid-line' }));
      }
      svgNode.appendChild(targetNode());
      if (state.ghost) svgNode.appendChild(ghostNode());
      const pieces = state.pieces.slice().sort((a, b) => (a.id === state.selectedPiece ? 1 : 0) - (b.id === state.selectedPiece ? 1 : 0));
      for (const piece of pieces) {
        const group = s('g', {
          class: `tangram-piece ${piece.id === state.selectedPiece ? 'is-selected' : ''}`.trim(),
          'data-piece-id': String(piece.id),
          transform: `translate(${piece.x * STEP} ${piece.y * STEP})`,
          tabindex: '0',
          role: 'button',
          'aria-label': `${PIECE_NAMES[piece.id]} potongan ${piece.id + 1}`
        });
        for (const [dr, dc] of ROTATIONS[piece.rot]) {
          group.appendChild(s('rect', {
            x: dc * STEP + 3,
            y: dr * STEP + 3,
            width: STEP - 6,
            height: STEP - 6,
            rx: 9,
            class: 'tangram-piece-cell',
            style: `--piece-color:${PIECE_COLORS[piece.id]}`
          }));
        }
        attachPieceEvents(group, piece, svgNode);
        svgNode.appendChild(group);
      }
      svgNode.addEventListener('keydown', (event) => {
        if (state.solved) return;
        const piece = state.pieces.find((item) => item.id === state.selectedPiece);
        if (!piece) return;
        let dx = 0;
        let dy = 0;
        if (event.key === 'ArrowLeft') dx = -1;
        else if (event.key === 'ArrowRight') dx = 1;
        else if (event.key === 'ArrowUp') dy = -1;
        else if (event.key === 'ArrowDown') dy = 1;
        else if (event.key.toLowerCase() === 'r') {
          rotatePiece(1);
          event.preventDefault();
          return;
        } else return;
        event.preventDefault();
        const x = clamp(Math.round(piece.x) + dx, 0, TANGRAM_COLS - 1);
        const y = clamp(Math.round(piece.y) + dy, 0, TANGRAM_ROWS - 1);
        if (canPlace(state.pieces, piece, x, y, piece.rot)) {
          piece.x = x;
          piece.y = y;
          state.puzzleMessage = '';
        } else {
          state.puzzleMessage = 'Potongan tidak bisa diletakkan di sana.';
        }
        rerender();
      });
      return svgNode;
    }

    function selectedPiece() {
      return state.pieces.find((piece) => piece.id === state.selectedPiece) || state.pieces[0];
    }

    function rotatePiece(dir) {
      if (state.solved) return;
      const piece = selectedPiece();
      const rot = (piece.rot + dir + 4) % 4;
      const x = Math.round(piece.x);
      const y = Math.round(piece.y);
      if (canPlace(state.pieces, piece, x, y, rot)) {
        piece.rot = rot;
        piece.x = x;
        piece.y = y;
        state.puzzleMessage = '';
      } else {
        state.puzzleMessage = 'Putaran itu membuat potongan keluar papan atau bertabrakan.';
      }
      rerender();
    }

    function checkTangram() {
      if (state.solved) return;
      const target = targetCells();
      const covered = new Set();
      state.pieces.forEach((piece) => absoluteCells(piece).forEach((cell) => covered.add(`${cell.row},${cell.col}`)));
      const solved = Array.from(target).every((key) => covered.has(key)) && covered.size === target.size;
      ctx.recordAttempt({ correct: solved, skillId: SKILL_TANGRAM });
      if (solved) {
        state.solved = true;
        ctx.sound('good');
      } else {
        state.puzzleWrong += 1;
        state.puzzleMessage = 'Belum semua kotak target terisi. Periksa potongan yang masih di luar.';
        ctx.sound('try');
      }
      rerender();
    }

    function puzzleHint() {
      if (state.solved || state.puzzleHint >= 2) return;
      state.puzzleHint += 1;
      ctx.recordHint(SKILL_TANGRAM);
      if (state.puzzleHint >= 2) state.ghost = true;
      rerender();
    }

    function tangramBuild(fragment) {
      fragment.appendChild(h('div', { class: 'activity-intro' },
        h('div', {},
          h('p', { class: 'activity-intro__eyebrow' }, 'Shape and Geometry Lab'),
          h('p', { class: 'activity-intro__text' }, 'Pindahkan dan putar empat potongan L untuk memenuhi persegi panjang target.')
        ),
        h('div', { class: 'level-chip' }, 'Puzzle komposisi')
      ));
      fragment.appendChild(h('div', { class: 'challenge-note' },
        h('strong', {}, 'Cara bermain'),
        h('span', {}, 'Seret potongan ke kotak berwarna. Ketuk potongan untuk memilih, lalu gunakan tombol putar. Di keyboard: panah untuk memindahkan, R untuk memutar.')
      ));
      fragment.appendChild(h('section', { class: 'activity-card tangram-card' },
        tangramBoard(),
        h('div', { class: 'tangram-side' },
          h('div', { class: 'tangram-pieces' },
            h('span', { class: 'small-label' }, 'Pilih potongan'),
            state.pieces.map((piece) => h('button', {
              type: 'button',
              class: `piece-picker ${piece.id === state.selectedPiece ? 'is-selected' : ''}`.trim(),
              style: { '--piece-color': PIECE_COLORS[piece.id] },
              disabled: state.solved,
              'aria-label': `Pilih potongan ${PIECE_NAMES[piece.id]}`,
              onclick: () => { state.selectedPiece = piece.id; state.puzzleMessage = ''; rerender(); }
            }, h('span', { class: 'piece-picker__swatch', 'aria-hidden': 'true' }), PIECE_NAMES[piece.id]))
          ),
          h('div', { class: 'tangram-actions' },
            h('button', { type: 'button', class: 'btn btn--soft', disabled: state.solved, onclick: () => rotatePiece(-1) }, icon('rotate', 17), 'Putar kiri'),
            h('button', { type: 'button', class: 'btn btn--soft', disabled: state.solved, onclick: () => rotatePiece(1) }, icon('rotate', 17), 'Putar kanan')
          ),
          h('div', { class: 'tangram-actions' },
            h('button', { type: 'button', class: 'btn btn--primary', disabled: state.solved, onclick: checkTangram }, icon('check', 17), 'Periksa puzzle'),
            h('button', { type: 'button', class: 'btn btn--soft', disabled: state.solved, onclick: puzzleHint }, icon('bulb', 17), 'Petunjuk')
          ),
          state.puzzleMessage ? h('p', { class: 'inline-message', role: 'status' }, state.puzzleMessage) : null,
          state.puzzleHint > 0 && !state.solved ? hintPanel(
            state.puzzleHint === 1
              ? 'Isi baris paling atas target terlebih dahulu. Dua potongan dapat menghadap ke bawah.'
              : 'Garis putus-putus menunjukkan satu cara penyelesaian. Susun potonganmu mengikuti warna tersebut.'
          ) : null,
          state.solved ? feedback('good', 'Puzzle tersusun!', 'Empat potongan L memenuhi target tanpa celah. Bentuk dapat dipindahkan dan diputar tanpa mengubah luasnya.', {
            actions: h('button', { type: 'button', class: 'btn btn--primary', onclick: () => ctx.finish({ completed: true }) }, 'Lihat hasil', icon('arrow-right', 18))
          }) : null
        )
      ));
    }

    /* ---------------- Coordinate polygons ---------------- */
    function coordGrid(points) {
      const size = 440;
      const pad = 40;
      const plot = size - pad * 2;
      const unit = plot / 8;
      const toX = (x) => pad + x * unit;
      const toY = (y) => size - pad - y * unit;
      const svgNode = s('svg', {
        viewBox: `0 0 ${size} ${size}`,
        class: 'coordinate-grid',
        role: 'application',
        tabindex: '0',
        'aria-label': 'Kisi koordinat 0 sampai 8. Ketuk titik potong untuk menambah titik sudut.'
      });
      svgNode.appendChild(s('rect', { x: 0, y: 0, width: size, height: size, class: 'coord-bg' }));
      for (let index = 0; index <= 8; index += 1) {
        svgNode.appendChild(s('line', { x1: toX(index), y1: toY(0), x2: toX(index), y2: toY(8), class: 'coord-grid-line' }));
        svgNode.appendChild(s('line', { x1: toX(0), y1: toY(index), x2: toX(8), y2: toY(index), class: 'coord-grid-line' }));
        svgNode.appendChild(s('text', { x: toX(index), y: size - pad + 18, class: 'coord-label', 'text-anchor': 'middle' }, String(index)));
        svgNode.appendChild(s('text', { x: pad - 18, y: toY(index) + 4, class: 'coord-label', 'text-anchor': 'middle' }, String(index)));
      }
      svgNode.appendChild(s('text', { x: size - pad + 6, y: size - pad + 18, class: 'coord-axis-name' }, 'x'));
      svgNode.appendChild(s('text', { x: pad - 20, y: pad - 20, class: 'coord-axis-name' }, 'y'));

      if (points.length) {
        const screenPoints = points.map((point) => `${toX(point.x)},${toY(point.y)}`);
        if (points.length >= 3) {
          svgNode.appendChild(s('polygon', {
            points: screenPoints.join(' '),
            class: `coord-polygon ${state.coordsSolved ? 'is-solved' : ''}`.trim()
          }));
        } else if (points.length === 2) {
          svgNode.appendChild(s('line', {
            x1: toX(points[0].x), y1: toY(points[0].y),
            x2: toX(points[1].x), y2: toY(points[1].y),
            class: 'coord-edge'
          }));
        }
        points.forEach((point, index) => {
          svgNode.appendChild(s('circle', {
            cx: toX(point.x), cy: toY(point.y), r: 8,
            class: 'coord-point'
          }));
          svgNode.appendChild(s('text', {
            x: toX(point.x), y: toY(point.y) - 14,
            class: 'coord-point-label', 'text-anchor': 'middle'
          }, String(index + 1)));
        });
      }

      svgNode.addEventListener('pointerdown', (event) => {
        if (state.coordsSolved) return;
        event.preventDefault();
        const rect = svgNode.getBoundingClientRect();
        const ratioX = (event.clientX - rect.left) / rect.width;
        const ratioY = (event.clientY - rect.top) / rect.height;
        const x = Math.round(((ratioX * size - pad) / unit));
        const y = Math.round(((size - pad - ratioY * size) / unit));
        if (x < 0 || x > 8 || y < 0 || y > 8) return;
        addPoint(x, y);
      });
      return svgNode;
    }

    function addPoint(x, y) {
      if (state.coordsSolved) return;
      if (state.points.some((point) => point.x === x && point.y === y)) {
        state.coordsMessage = 'Titik itu sudah ada. Pilih titik sudut yang lain.';
        rerender();
        return;
      }
      if (state.points.length >= 8) {
        state.coordsMessage = 'Maksimal 8 titik. Gunakan “Hapus titik” jika ingin mengganti.';
        rerender();
        return;
      }
      state.points.push({ x, y });
      state.coordsMessage = '';
      rerender();
    }

    function undoPoint() {
      if (state.coordsSolved) return;
      state.points.pop();
      state.coordsMessage = '';
      rerender();
    }

    function clearPoints() {
      if (state.coordsSolved) return;
      state.points = [];
      state.coordsMessage = '';
      rerender();
    }

    function checkCoordinates() {
      if (state.coordsSolved) return;
      const rect = axisAlignedRectangle(state.points);
      const area = rect ? rect.area : polygonArea(state.points);
      const correct = Boolean(rect && rect.area === state.coordTarget);
      ctx.recordAttempt({ correct, skillId: SKILL_COORDS });
      if (correct) {
        state.coordsSolved = true;
        ctx.sound('good');
      } else {
        state.coordsWrong += 1;
        state.coordsMessage = rect
          ? `Bentukmu persegi panjang dengan luas ${rect.area}, sedangkan targetnya ${state.coordTarget}.`
          : state.points.length < 4
            ? `Baru ada ${state.points.length} titik. Persegi panjang membutuhkan empat titik sudut.`
            : `Bentukmu punya luas ${area}, tetapi belum berupa persegi panjang dengan luas ${state.coordTarget}.`;
        ctx.sound('try');
      }
      rerender();
    }

    function coordsHint() {
      if (state.coordsSolved || state.coordsHint >= 2) return;
      state.coordsHint += 1;
      ctx.recordHint(SKILL_COORDS);
      rerender();
    }

    function coordinateBuild(fragment) {
      const area = polygonArea(state.points);
      const perimeter = polygonPerimeter(state.points);
      const rect = axisAlignedRectangle(state.points);
      const xInput = h('input', { type: 'number', min: '0', max: '8', value: '0', class: 'coord-input', 'aria-label': 'Koordinat x' });
      const yInput = h('input', { type: 'number', min: '0', max: '8', value: '0', class: 'coord-input', 'aria-label': 'Koordinat y' });
      fragment.appendChild(h('div', { class: 'activity-intro' },
        h('div', {},
          h('p', { class: 'activity-intro__eyebrow' }, 'Shape and Geometry Lab'),
          h('p', { class: 'activity-intro__text' }, 'Hubungkan titik pada kisi. Setiap titik memiliki posisi (x, y), dan bentuk punya keliling serta luas.')
        ),
        h('div', { class: 'level-chip' }, `Tingkat ${state.coordLevel}`)
      ));
      fragment.appendChild(h('section', { class: 'activity-card' },
        h('div', { class: 'card-heading' },
          h('div', {},
            h('h2', {}, `Buat persegi panjang berluas ${state.coordTarget}`),
            h('p', {}, 'Ketuk empat titik sudut. Titik yang dipilih harus membentuk persegi panjang yang sisinya sejajar kisi.')
          ),
          rect ? h('span', { class: 'chip chip--good' }, `${rect.width} × ${rect.height} = ${rect.area}`) : h('span', { class: 'chip chip--soft' }, `${state.points.length} titik`)
        ),
        h('div', { class: 'coordinate-layout' },
          coordGrid(state.points),
          h('div', { class: 'coord-side' },
            h('div', { class: 'coord-stats' },
              h('div', {}, h('span', {}, 'Luas'), h('strong', {}, area ? String(Math.round(area * 100) / 100) : '—')),
              h('div', {}, h('span', {}, 'Keliling'), h('strong', {}, perimeter ? String(Math.round(perimeter * 100) / 100) : '—'))
            ),
            h('div', { class: 'coord-entry' },
              h('label', {}, 'X', xInput),
              h('label', {}, 'Y', yInput),
              h('button', {
                type: 'button', class: 'btn btn--soft btn--small',
                disabled: state.coordsSolved,
                onclick: () => {
                  const rawX = Number(xInput.value);
                  const rawY = Number(yInput.value);
                  if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) {
                    state.coordsMessage = 'Masukkan koordinat x dan y berupa angka 0–8.';
                    rerender();
                    return;
                  }
                  addPoint(clamp(Math.round(rawX), 0, 8), clamp(Math.round(rawY), 0, 8));
                }
              }, 'Tambah titik')
            ),
            h('div', { class: 'tangram-actions' },
              h('button', { type: 'button', class: 'btn btn--soft btn--small', disabled: state.coordsSolved, onclick: undoPoint }, 'Hapus titik'),
              h('button', { type: 'button', class: 'btn btn--soft btn--small', disabled: state.coordsSolved, onclick: clearPoints }, 'Mulai ulang')
            ),
            h('div', { class: 'tangram-actions' },
              h('button', { type: 'button', class: 'btn btn--primary', disabled: state.coordsSolved, onclick: checkCoordinates }, icon('check', 17), 'Periksa bentuk'),
              h('button', { type: 'button', class: 'btn btn--soft', disabled: state.coordsSolved, onclick: coordsHint }, icon('bulb', 17), 'Petunjuk')
            ),
            state.points.length ? h('div', { class: 'coord-points' },
              h('span', { class: 'small-label' }, 'Titik-titik'),
              state.points.map((point, index) => h('span', { class: 'coord-point-chip' }, `${index + 1}. (${point.x}, ${point.y})`))
            ) : h('p', { class: 'coord-empty' }, 'Belum ada titik. Ketuk kisi atau tambahkan koordinat.'),
            state.coordsMessage ? h('p', { class: 'inline-message', role: 'status' }, state.coordsMessage) : null,
            state.coordsHint > 0 && !state.coordsSolved ? hintPanel(
              state.coordsHint === 1
                ? 'Persegi panjang memiliki dua pasang sisi sejajar. Mulai dari satu sudut, lalu tentukan lebar dan tingginya.'
                : `Luas ${state.coordTarget} dapat dibentuk dari pasangan faktor seperti ${factorHintText(state.coordTarget)}.`
            ) : null,
            state.coordsSolved ? feedback('good', 'Bentuk dan ukurannya tepat!', `Persegi panjang ${rect.width} × ${rect.height} memiliki luas ${rect.area} satuan dan keliling ${(rect.width + rect.height) * 2} satuan.`, {
              actions: h('button', { type: 'button', class: 'btn btn--primary', onclick: () => ctx.finish({ completed: true }) }, 'Lihat hasil', icon('arrow-right', 18))
            }) : null
          )
        )
      ));
    }

    function factorHintText(value) {
      const pairs = [];
      for (let factor = 2; factor <= 6; factor += 1) {
        if (value % factor === 0 && value / factor <= 8) pairs.push(`${factor} × ${value / factor}`);
      }
      return pairs.length ? pairs.join(' atau ') : `${value} satuan persegi`;
    }

    /* ---------------- Shared screen ---------------- */
    function build() {
      const fragment = document.createDocumentFragment();
      fragment.appendChild(h('div', { class: 'mode-row mode-row--wide' },
        segmented({
          label: 'Mode Shape and Geometry Lab',
          value: state.mode,
          options: [
            { value: 'shapes', label: 'Bentuk' },
            { value: 'tangram', label: 'Puzzle tangram' },
            { value: 'coordinates', label: 'Koordinat' }
          ],
          onChange: setMode
        })
      ));
      if (state.mode === 'shapes') shapeBuild(fragment);
      else if (state.mode === 'tangram') tangramBuild(fragment);
      else coordinateBuild(fragment);
      return fragment;
    }

    rerender();
  }

  NS.registerModule({
    id: 'geometry',
    order: 9,
    title: 'Shape & Geometry Lab',
    subtitle: 'Bentuk, ruang, koordinat',
    description: 'Kenali bentuk yang diputar, susun puzzle potongan L, lalu bangun poligon pada kisi koordinat dan ukur keliling serta luasnya.',
    stage: 'D',
    alsoStages: ['F'],
    icon: '📐',
    accent: 'blue',
    minutes: 12,
    skills: [SKILL_SHAPES, SKILL_TANGRAM, SKILL_COORDS],
    goal: 'Melihat bentuk sebagai objek yang dapat dipindahkan, diputar, dan diukur.',
    render
  });
})();
