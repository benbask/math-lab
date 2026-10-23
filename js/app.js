/* MathLab — application shell, routing, sessions, settings, and data tools. */
(function () {
  'use strict';

  const NS = window.MathLab;
  const util = NS.util;
  const Storage = NS.Storage;
  const Profiles = NS.Profiles;
  const Progress = NS.Progress;
  const Comp = NS.Components;
  const {
    h, icon, clear, qs, formatDate, formatDuration, downloadFile, announce, randomId, range
  } = util;

  const APP = {
    route: [],
    currentSession: null,
    lastResult: null,
    screenCleanup: [],
    audio: null,
    modal: null,
    booted: false
  };

  const el = {};

  const NAV_ITEMS = [
    { hash: '#/home', label: 'Beranda', icon: 'home', match: ['home'] },
    { hash: '#/skills', label: 'Peta', icon: 'map', match: ['skills', 'module'] },
    { hash: '#/progress', label: 'Progres', icon: 'chart', match: ['progress'] },
    { hash: '#/settings', label: 'Atur', icon: 'settings', match: ['settings'] }
  ];

  const PUBLIC_ROUTES = new Set(['welcome', 'profiles', 'profile']);

  const ROUTE_TITLES = {
    welcome: 'Pilih profil',
    profiles: 'Profil anak',
    profile: 'Profil',
    home: 'Beranda',
    skills: 'Peta kemampuan',
    progress: 'Progres belajar',
    settings: 'Pengaturan',
    module: 'Aktivitas',
    play: 'Sesi belajar',
    result: 'Hasil sesi'
  };

  /* ------------------------------------------------------------------ boot */

  function boot() {
    if (APP.booted) return;
    APP.booted = true;
    el.topbar = document.getElementById('topbar');
    el.view = document.getElementById('view');
    el.banner = document.getElementById('system-banner');
    el.nav = document.getElementById('bottom-nav');
    el.modalRoot = document.getElementById('modal-root');
    el.toastRegion = document.getElementById('toast-region');

    Storage.init();
    applyMotionPreference();

    if (!window.location.hash) {
      const target = Profiles.active() ? '#/home' : '#/welcome';
      window.history.replaceState(null, '', target);
    }

    APP.route = parseRoute();
    render();

    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('beforeunload', () => {
      if (APP.currentSession) {
        finalizeSession({ completed: false, silent: true });
      }
    });
    document.addEventListener('keydown', onDocumentKeyDown, true);
  }

  function parseRoute() {
    const raw = String(window.location.hash || '').replace(/^#\/?/, '');
    return raw.split('/').filter(Boolean).map((part) => {
      try {
        return decodeURIComponent(part);
      } catch (_) {
        return part;
      }
    });
  }

  function replaceHash(hash) {
    if (window.location.hash !== hash) {
      window.history.replaceState(null, '', hash);
    }
    APP.route = parseRoute();
  }

  function navigate(hash) {
    if (window.location.hash === hash) {
      render();
    } else {
      window.location.hash = hash;
    }
  }

  function onHashChange() {
    if (APP.currentSession) {
      finalizeSession({ completed: false, silent: true, notify: true });
    }
    closeDialog({ restoreFocus: false });
    APP.route = parseRoute();
    render();
  }

  function onDocumentKeyDown(event) {
    if (!APP.modal) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDialog();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusables = Array.from(APP.modal.dialog.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((node) => node.offsetParent !== null || node === document.activeElement);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /* ----------------------------------------------------------- page render */

  function render() {
    runScreenCleanup();
    clear(el.view);

    let route = APP.route;
    const profile = Profiles.active();

    if (!route.length) {
      replaceHash(profile ? '#/home' : '#/welcome');
      route = APP.route;
    }

    if (!profile && !PUBLIC_ROUTES.has(route[0])) {
      replaceHash('#/welcome');
      route = APP.route;
    }

    if (route[0] === 'profile' && route[2] === 'edit' && !Profiles.get(route[1])) {
      replaceHash(profile ? '#/profiles' : '#/welcome');
      route = APP.route;
    }

    let screen;
    switch (route[0]) {
      case 'welcome':
        screen = welcomeScreen();
        break;
      case 'profiles':
        screen = profilesScreen();
        break;
      case 'profile':
        screen = profileFormScreen(route[1], route[2]);
        break;
      case 'home':
        screen = homeScreen(profile);
        break;
      case 'skills':
        screen = skillsScreen(profile);
        break;
      case 'progress':
        screen = progressScreen(profile);
        break;
      case 'settings':
        screen = settingsScreen(profile);
        break;
      case 'module':
        screen = moduleScreen(profile, route[1]);
        break;
      case 'play':
        screen = playScreen(profile, route[1]);
        break;
      case 'result':
        screen = resultScreen(profile, route[1]);
        break;
      default:
        replaceHash(profile ? '#/home' : '#/welcome');
        screen = profile ? homeScreen(profile) : welcomeScreen();
    }

    el.view.appendChild(screen);
    renderChrome();
    renderBanner();

    const title = pageTitle(route);
    document.title = `${title} · MathLab`;
    announce(title);

    window.scrollTo({ top: 0, behavior: 'auto' });
    window.setTimeout(() => {
      if (el.view && document.activeElement !== el.view) el.view.focus({ preventScroll: true });
    }, 20);
  }

  function pageTitle(route) {
    if (route[0] === 'module') {
      const module = NS.getModule(route[1]);
      return module ? module.title : 'Aktivitas';
    }
    if (route[0] === 'profile' && route[2] === 'edit') return 'Ubah profil';
    if (route[0] === 'profile') return 'Profil baru';
    if (route[0] === 'result') return 'Hasil sesi';
    return ROUTE_TITLES[route[0]] || 'MathLab';
  }

  function addScreenCleanup(fn) {
    if (typeof fn === 'function') APP.screenCleanup.push(fn);
  }

  function runScreenCleanup() {
    const list = APP.screenCleanup.splice(0);
    for (const fn of list) {
      try {
        fn();
      } catch (error) {
        console.warn('MathLab: cleanup gagal.', error);
      }
    }
  }

  function refreshChrome() {
    renderChrome();
    renderBanner();
  }

  /* --------------------------------------------------------------- chrome */

  function renderChrome() {
    const route = APP.route;
    const profile = Profiles.active();
    clear(el.topbar);

    const top = h('div', { class: 'topbar__inner' });

    if (route[0] === 'play') {
      top.appendChild(h('button', {
        type: 'button',
        class: 'btn btn--soft btn--small topbar__leave',
        onclick: requestEndSession
      }, icon('arrow-left', 18), 'Keluar'));
      top.appendChild(h('div', { class: 'topbar__session-title' },
        h('span', { class: 'topbar__session-eyebrow' }, 'Sedang belajar'),
        h('strong', {}, currentModuleTitle())
      ));
    } else {
      top.appendChild(h('button', {
        type: 'button',
        class: 'brand',
        'aria-label': 'MathLab, kembali ke beranda',
        onclick: () => navigate(profile ? '#/home' : '#/welcome')
      },
        h('span', { class: 'brand__mark', 'aria-hidden': 'true' }, '＋'),
        h('span', { class: 'brand__text' },
          h('strong', {}, 'MathLab'),
          h('small', {}, 'laboratorium matematika')
        )
      ));
    }

    const actions = h('div', { class: 'topbar__actions' });
    if (profile) {
      const level = Profiles.levelMeta(profile.learningLevel);
      actions.appendChild(h('button', {
        type: 'button',
        class: 'profile-chip',
        'aria-label': `Profil ${profile.name}. Buka daftar profil`,
        onclick: () => navigate('#/profiles')
      },
        h('span', { class: 'profile-chip__avatar', 'aria-hidden': 'true' }, Profiles.avatarFor(profile)),
        h('span', { class: 'profile-chip__text' },
          h('strong', {}, profile.name),
          h('small', {}, level.emoji + ' ' + level.label)
        ),
        icon('chevron-right', 15)
      ));
    }

    const soundOn = Storage.getState().settings.sound;
    actions.appendChild(h('button', {
      type: 'button',
      class: 'icon-btn',
      'aria-label': soundOn ? 'Matikan suara' : 'Nyalakan suara',
      'aria-pressed': soundOn ? 'true' : 'false',
      title: soundOn ? 'Suara aktif' : 'Suara mati',
      onclick: () => {
        const next = !Storage.getState().settings.sound;
        Storage.updateSettings({ sound: next });
        renderChrome();
        showToast(next ? 'Suara diaktifkan.' : 'Suara dimatikan.', { tone: 'info' });
      }
    }, icon(soundOn ? 'volume' : 'volume-off', 21)));

    top.appendChild(actions);
    el.topbar.appendChild(top);

    renderNav(route, profile);
  }

  function currentModuleTitle() {
    if (APP.currentSession) {
      const module = NS.getModule(APP.currentSession.moduleId);
      return module ? module.title : APP.currentSession.moduleTitle;
    }
    return NS.getModule(APP.route[1]) ? NS.getModule(APP.route[1]).title : 'Aktivitas';
  }

  function renderNav(route, profile) {
    clear(el.nav);
    const hidden = !profile || ['play', 'result', 'welcome', 'profiles', 'profile'].includes(route[0]);
    el.nav.hidden = hidden;
    if (hidden) return;

    for (const item of NAV_ITEMS) {
      const active = item.match.includes(route[0]);
      el.nav.appendChild(h('button', {
        type: 'button',
        class: `nav-item ${active ? 'is-active' : ''}`.trim(),
        'aria-current': active ? 'page' : null,
        onclick: () => navigate(item.hash)
      },
        h('span', { class: 'nav-item__icon', 'aria-hidden': 'true' }, icon(item.icon, 21)),
        h('span', {}, item.label)
      ));
    }
  }

  function renderBanner() {
    clear(el.banner);
    const warning = Storage.getWarning();
    if (!warning) {
      el.banner.hidden = true;
      return;
    }
    el.banner.hidden = false;
    const actions = h('div', { class: 'system-banner__actions' });
    if (warning.type === 'corrupt') {
      actions.appendChild(h('button', {
        type: 'button',
        class: 'btn btn--soft btn--tiny',
        onclick: () => pickBackupFile(null)
      }, icon('upload', 15), 'Impor cadangan'));
    } else if (Storage.checkAvailability()) {
      actions.appendChild(h('button', {
        type: 'button',
        class: 'btn btn--soft btn--tiny',
        onclick: exportData
      }, icon('download', 15), 'Ekspor'));
    }
    actions.appendChild(h('button', {
      type: 'button',
      class: 'btn btn--ghost btn--tiny',
      onclick: () => {
        Storage.dismissWarning();
        renderBanner();
      }
    }, 'Tutup'));

    el.banner.appendChild(h('div', { class: `system-banner system-banner--${warning.type}` },
      h('span', { class: 'system-banner__icon', 'aria-hidden': 'true' }, icon(warning.type === 'corrupt' ? 'info' : 'lock', 20)),
      h('div', { class: 'system-banner__body' },
        h('strong', {}, warning.title),
        h('p', {}, warning.message)
      ),
      actions
    ));
  }

  /* ------------------------------------------------------------- welcome */

  function welcomeScreen() {
    const profiles = Profiles.list();
    const screen = h('div', { class: 'screen screen--welcome' });

    screen.appendChild(h('section', { class: 'welcome-hero' },
      Comp.decorativeDoodles(),
      h('div', { class: 'welcome-hero__content' },
        h('p', { class: 'eyebrow' }, 'Laboratorium matematika anak'),
        h('h1', {}, 'Matematika yang bisa ', h('span', { class: 'highlight' }, 'disentuh')),
        h('p', { class: 'welcome-hero__lead' }, 'Sepuluh aktivitas visual untuk membangun rasa bilangan, pola, pecahan, bentuk, dan aljabar — dari prasekolah sampai SMP.'),
        h('div', { class: 'welcome-hero__badges' },
          h('span', { class: 'chip chip--soft' }, '✨ 10 aktivitas'),
          h('span', { class: 'chip chip--soft' }, '📶 Tanpa internet'),
          h('span', { class: 'chip chip--soft' }, '💾 Tersimpan di perangkat')
        )
      ),
      h('div', { class: 'welcome-hero__art', 'aria-hidden': 'true' },
        h('span', { class: 'float-shape float-shape--1' }, '△'),
        h('span', { class: 'float-shape float-shape--2' }, '5'),
        h('span', { class: 'float-shape float-shape--3' }, '½'),
        h('span', { class: 'float-shape float-shape--4' }, '＋'),
        h('span', { class: 'float-shape float-shape--5' }, '●')
      )
    ));

    const section = h('section', { class: 'welcome-profiles' },
      h('div', { class: 'section-heading' },
        h('div', {},
          h('p', { class: 'eyebrow' }, 'Profil belajar'),
          h('h2', {}, profiles.length ? 'Siapa yang belajar hari ini?' : 'Mulai petualangan pertama')
        ),
        profiles.length ? h('button', {
          type: 'button',
          class: 'btn btn--soft btn--small',
          onclick: () => navigate('#/profiles')
        }, icon('users', 17), 'Kelola profil') : null
      )
    );

    if (profiles.length) {
      const grid = h('div', { class: 'profile-grid' });
      for (const profile of profiles) {
        grid.appendChild(profileTile(profile));
      }
      grid.appendChild(h('button', {
        type: 'button',
        class: 'profile-tile profile-tile--add',
        onclick: () => navigate('#/profile/new')
      },
        h('span', { class: 'profile-tile__avatar', 'aria-hidden': 'true' }, '＋'),
        h('span', { class: 'profile-tile__name' }, 'Tambah anak'),
        h('span', { class: 'profile-tile__meta' }, 'Profil baru, progres baru')
      ));
      section.appendChild(grid);
    } else {
      section.appendChild(Comp.emptyState({
        emoji: '🌱',
        title: 'Belum ada profil',
        message: 'Buat profil pertama agar progres setiap anak tersimpan terpisah di perangkat ini.',
        action: h('button', {
          type: 'button',
          class: 'btn btn--primary',
          onclick: () => navigate('#/profile/new')
        }, icon('user-plus', 18), 'Buat profil')
      }));
    }

    screen.appendChild(section);
    screen.appendChild(h('p', { class: 'welcome-footnote' },
      'MathLab berjalan sepenuhnya offline. Data belajar tidak dikirim ke mana pun dan hanya tersimpan di browser perangkat ini. ',
      h('button', {
        type: 'button',
        class: 'link-button',
        onclick: () => navigate('#/profiles')
      }, 'Lihat semua profil')
    ));
    return screen;
  }

  function profileTile(profile) {
    const stats = Progress.overview(profile);
    const level = Profiles.levelMeta(profile.learningLevel);
    return h('button', {
      type: 'button',
      class: 'profile-tile',
      onclick: () => selectProfile(profile.id)
    },
      h('span', { class: 'profile-tile__avatar', 'aria-hidden': 'true' }, Profiles.avatarFor(profile)),
      h('span', { class: 'profile-tile__name' }, profile.name),
      h('span', { class: 'profile-tile__level' }, `${level.emoji} ${level.label} · ${level.age}`),
      h('span', { class: 'profile-tile__meta' }, `${stats.sessions} sesi · ${stats.completedActivities}/${stats.totalActivities} aktivitas selesai`),
      h('span', { class: 'profile-tile__cta' }, 'Mulai belajar', icon('arrow-right', 16))
    );
  }

  function selectProfile(id) {
    try {
      const profile = Profiles.setActive(id);
      APP.lastResult = null;
      showToast(`Halo, ${profile.name}! Siap mencoba sesuatu yang baru?`, { tone: 'good' });
      navigate('#/home');
    } catch (error) {
      showToast(error.message || 'Profil tidak dapat dibuka.', { tone: 'danger' });
    }
  }

  /* -------------------------------------------------------------- profiles */

  function profilesScreen() {
    const profiles = Profiles.list();
    const active = Profiles.active();
    const screen = h('div', { class: 'screen screen--profiles' });

    screen.appendChild(screenHeader({
      eyebrow: 'Profil belajar',
      title: 'Satu perangkat, banyak petualangan',
      description: 'Setiap profil punya progres, riwayat sesi, dan tingkat latihan sendiri. Pilih atau kelola profil di bawah.',
      actions: h('button', {
        type: 'button',
        class: 'btn btn--primary btn--small',
        onclick: () => navigate('#/profile/new')
      }, icon('user-plus', 17), 'Tambah profil')
    }));

    if (!profiles.length) {
      screen.appendChild(h('div', { class: 'panel' }, Comp.emptyState({
        emoji: '🌼',
        title: 'Belum ada profil',
        message: 'Profil membantu MathLab mengingat kemajuan setiap anak secara terpisah.',
        action: h('button', {
          type: 'button',
          class: 'btn btn--primary',
          onclick: () => navigate('#/profile/new')
        }, 'Buat profil pertama')
      })));
      return screen;
    }

    const list = h('div', { class: 'profile-manage-grid' });
    for (const profile of profiles) {
      const isActive = active && active.id === profile.id;
      const stats = Progress.overview(profile);
      const level = Profiles.levelMeta(profile.learningLevel);
      list.appendChild(h('article', { class: `profile-manage-card ${isActive ? 'is-active' : ''}`.trim() },
        h('div', { class: 'profile-manage-card__head' },
          h('span', { class: 'profile-manage-card__avatar', 'aria-hidden': 'true' }, Profiles.avatarFor(profile)),
          h('div', {},
            h('h3', {}, profile.name),
            h('p', {}, `${level.emoji} ${level.label} · ${level.age}`),
            isActive ? h('span', { class: 'chip chip--good' }, 'Profil aktif') : null
          )
        ),
        h('div', { class: 'profile-manage-card__stats' },
          h('span', {}, h('strong', {}, String(stats.sessions)), ' sesi'),
          h('span', {}, h('strong', {}, String(stats.skillsMastered)), ' mulai dikuasai'),
          h('span', {}, h('strong', {}, `${Math.round((stats.totalAttempts ? stats.totalCorrect / stats.totalAttempts : 0) * 100)}%`), ' ketepatan')
        ),
        h('div', { class: 'profile-manage-card__actions' },
          isActive
            ? h('button', { type: 'button', class: 'btn btn--primary btn--small', onclick: () => navigate('#/home') }, 'Lanjutkan', icon('arrow-right', 16))
            : h('button', { type: 'button', class: 'btn btn--primary btn--small', onclick: () => selectProfile(profile.id) }, 'Gunakan profil'),
          h('button', {
            type: 'button',
            class: 'btn btn--soft btn--small',
            onclick: () => navigate(`#/profile/${encodeURIComponent(profile.id)}/edit`)
          }, icon('edit', 16), 'Ubah'),
          h('button', {
            type: 'button',
            class: 'btn btn--ghost btn--small profile-delete',
            onclick: () => confirmDeleteProfile(profile)
          }, icon('trash', 16), 'Hapus')
        )
      ));
    }
    screen.appendChild(list);

    screen.appendChild(h('div', { class: 'profiles-footer' },
      h('button', {
        type: 'button',
        class: 'btn btn--soft btn--small',
        onclick: () => {
          Storage.setActiveProfile(null);
          navigate('#/welcome');
          showToast('Profil ditutup. Data tetap tersimpan.', { tone: 'info' });
        }
      }, icon('users', 16), 'Tutup profil aktif'),
      h('p', {}, 'Menghapus profil juga menghapus seluruh progres dan riwayatnya. Ekspor cadangan dari Pengaturan bila perlu.')
    ));

    return screen;
  }

  function confirmDeleteProfile(profile) {
    const stats = Progress.overview(profile);
    openDialog({
      title: `Hapus profil ${profile.name}?`,
      body: h('div', {},
        h('p', {}, `Progres ${stats.sessions} sesi, ${stats.totalAttempts} jawaban, dan seluruh riwayat belajar akan dihapus dari perangkat ini.`),
        h('p', { class: 'dialog-note' }, 'Tindakan ini tidak dapat dibatalkan. Ekspor cadangan terlebih dahulu jika datanya masih dibutuhkan.')
      ),
      confirmLabel: 'Hapus profil',
      tone: 'danger',
      onConfirm: () => {
        const wasActive = Boolean(Profiles.active() && Profiles.active().id === profile.id);
        Profiles.remove(profile.id);
        APP.lastResult = null;
        showToast(`Profil ${profile.name} dihapus.`, { tone: 'info' });
        if (wasActive) navigate('#/welcome');
        else render();
      }
    });
  }

  /* ----------------------------------------------------------- profile form */

  function profileFormScreen(id, action) {
    const editing = action === 'edit' && id;
    const existing = editing ? Profiles.get(id) : null;
    if (editing && !existing) {
      return h('div', { class: 'screen' }, Comp.emptyState({
        emoji: '🔎',
        title: 'Profil tidak ditemukan',
        message: 'Profil mungkin sudah dihapus. Kembali ke daftar profil untuk melanjutkan.',
        action: h('button', { type: 'button', class: 'btn btn--primary', onclick: () => navigate('#/profiles') }, 'Lihat profil')
      }));
    }

    const active = Profiles.active();
    const cancelHash = editing ? (active ? '#/profiles' : '#/welcome') : (Profiles.list().length ? '#/profiles' : '#/welcome');
    const screen = h('div', { class: 'screen screen--profile-form' });

    screen.appendChild(screenHeader({
      eyebrow: editing ? 'Ubah profil' : 'Profil baru',
      title: editing ? `Atur profil ${existing.name}` : 'Siapa yang akan belajar?',
      description: editing
        ? 'Nama, avatar, dan tingkat belajar bisa disesuaikan. Progres yang sudah ada tetap aman.'
        : 'Cukup nama panggilan dan tingkat belajar. Semua data tetap berada di perangkat ini.',
      actions: h('button', {
        type: 'button',
        class: 'btn btn--ghost btn--small',
        onclick: () => navigate(cancelHash)
      }, icon('arrow-left', 16), 'Batal')
    }));

    const form = h('form', { class: 'profile-form panel', novalidate: 'novalidate' });
    const nameInput = h('input', {
      id: 'profile-name',
      class: 'text-input',
      type: 'text',
      name: 'name',
      maxlength: '24',
      autocomplete: 'off',
      placeholder: 'Contoh: Aira',
      value: existing ? existing.name : ''
    });

    const errorNode = h('p', { class: 'form-error', role: 'alert' });

    form.appendChild(h('div', { class: 'form-field' },
      h('label', { for: 'profile-name' }, 'Nama panggilan'),
      nameInput,
      h('p', { class: 'form-hint' }, 'Maksimal 24 huruf. Nama ini hanya tersimpan di perangkatmu.')
    ));

    const avatarValue = h('input', { type: 'hidden', name: 'avatar', value: existing ? existing.avatar : NS.AVATARS[0] });
    const avatarGrid = h('div', { class: 'avatar-grid', role: 'group', 'aria-label': 'Pilih avatar' });
    const avatarButtons = [];
    for (const avatar of NS.AVATARS) {
      const button = h('button', {
        type: 'button',
        class: `avatar-choice ${avatarValue.value === avatar ? 'is-selected' : ''}`.trim(),
        'aria-label': `Pilih avatar ${avatar}`,
        'aria-pressed': avatarValue.value === avatar ? 'true' : 'false'
      }, avatar);
      button.addEventListener('click', () => {
        avatarValue.value = avatar;
        for (const other of avatarButtons) {
          const selected = other === button;
          other.classList.toggle('is-selected', selected);
          other.setAttribute('aria-pressed', selected ? 'true' : 'false');
        }
      });
      avatarButtons.push(button);
      avatarGrid.appendChild(button);
    }
    form.appendChild(h('div', { class: 'form-field' },
      h('span', { class: 'form-label' }, 'Avatar'),
      avatarGrid,
      h('p', { class: 'form-hint' }, 'Pilih wajah yang ingin dipakai di beranda.')
    ));

    const levelGroup = h('div', { class: 'level-choice-grid', role: 'radiogroup', 'aria-label': 'Tingkat belajar' });
    const selectedLevel = existing ? existing.learningLevel : 'early-primary';
    for (const level of NS.LEARNING_LEVELS) {
      const input = h('input', {
        type: 'radio',
        name: 'learningLevel',
        value: level.id,
        checked: selectedLevel === level.id
      });
      levelGroup.appendChild(h('label', { class: `level-choice ${selectedLevel === level.id ? 'is-selected' : ''}`.trim() },
        input,
        h('span', { class: 'level-choice__emoji', 'aria-hidden': 'true' }, level.emoji),
        h('span', { class: 'level-choice__text' },
          h('strong', {}, level.label),
          h('span', {}, level.age),
          h('small', {}, level.hint)
        )
      ));
    }
    levelGroup.addEventListener('change', () => {
      for (const label of Array.from(levelGroup.querySelectorAll('.level-choice'))) {
        const input = label.querySelector('input');
        label.classList.toggle('is-selected', Boolean(input && input.checked));
      }
    });
    form.appendChild(h('div', { class: 'form-field' },
      h('span', { class: 'form-label' }, 'Tingkat belajar'),
      h('p', { class: 'form-hint form-hint--top' }, 'Tingkat awal untuk menyesuaikan soal. MathLab tetap menyesuaikan sendiri dari jawaban anak.'),
      levelGroup
    ));

    form.appendChild(errorNode);
    form.appendChild(h('div', { class: 'form-actions' },
      h('button', { type: 'button', class: 'btn btn--ghost', onclick: () => navigate(cancelHash) }, 'Batal'),
      h('button', { type: 'submit', class: 'btn btn--primary' },
        editing ? icon('check', 18) : icon('user-plus', 18),
        editing ? 'Simpan perubahan' : 'Buat profil'
      )
    ));

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const name = nameInput.value.replace(/\s+/g, ' ').trim();
      errorNode.textContent = '';
      if (!name) {
        errorNode.textContent = 'Tulis nama panggilan terlebih dahulu, ya.';
        nameInput.focus();
        return;
      }
      if (name.length > 24) {
        errorNode.textContent = 'Nama panggilan maksimal 24 huruf.';
        nameInput.focus();
        return;
      }
      const chosenLevel = qs('input[name="learningLevel"]:checked', levelGroup);
      try {
        if (editing) {
          Profiles.update(existing.id, {
            name,
            avatar: avatarValue.value,
            learningLevel: chosenLevel ? chosenLevel.value : existing.learningLevel
          });
          showToast('Profil diperbarui.', { tone: 'good' });
          navigate(active ? '#/home' : '#/profiles');
        } else {
          const created = Profiles.create({
            name,
            avatar: avatarValue.value,
            learningLevel: chosenLevel ? chosenLevel.value : 'early-primary'
          });
          APP.lastResult = null;
          showToast(`Profil ${created.name} siap! Mari mulai.`, { tone: 'good' });
          navigate('#/home');
        }
      } catch (error) {
        errorNode.textContent = error.message || 'Profil tidak dapat disimpan.';
        nameInput.focus();
      }
    });

    screen.appendChild(form);
    addScreenCleanup(() => {
      // Focus is intentional; no timers are needed after submission.
    });
    window.setTimeout(() => nameInput.focus(), 80);
    return screen;
  }

  /* ------------------------------------------------------------------ home */

  function homeScreen(profile) {
    if (!profile) return welcomeScreen();
    const overview = Progress.overview(profile);
    const recommendations = Progress.recommendations(profile, 3);
    const modules = NS.getModules();
    const level = Profiles.levelMeta(profile.learningLevel);
    const accuracy = overview.totalAttempts ? Math.round((overview.totalCorrect / overview.totalAttempts) * 100) : 0;
    const screen = h('div', { class: 'screen screen--home' });

    screen.appendChild(h('section', { class: 'home-hero' },
      h('div', { class: 'home-hero__main' },
        h('span', { class: 'home-hero__avatar', 'aria-hidden': 'true' }, Profiles.avatarFor(profile)),
        h('div', {},
          h('p', { class: 'eyebrow' }, `Halo, ${profile.name}!`),
          h('h1', {}, greetingLine(profile)),
          h('p', { class: 'home-hero__sub' }, `Kamu berada di tingkat ${level.label} (${level.age}). Tidak perlu terburu-buru — pilih satu hal kecil untuk dipelajari hari ini.`),
          h('div', { class: 'home-hero__actions' },
            h('button', {
              type: 'button',
              class: 'btn btn--primary',
              onclick: () => {
                const next = recommendations[0];
                if (next) navigate(`#/module/${encodeURIComponent(next.module.id)}`);
                else navigate('#/skills');
              }
            }, icon('play', 18), 'Lanjutkan belajar'),
            h('button', {
              type: 'button',
              class: 'btn btn--soft',
              onclick: () => navigate('#/skills')
            }, icon('map', 18), 'Lihat peta')
          )
        )
      ),
      h('div', { class: 'home-hero__stats' },
        miniStat('Sesi belajar', String(overview.sessions), 'clock'),
        miniStat('Aktivitas selesai', `${overview.completedActivities}/${overview.totalActivities}`, 'check'),
        miniStat('Mulai dikuasai', `${overview.skillsMastered} kemampuan`, 'star'),
        miniStat('Ketepatan', `${accuracy}%`, 'target')
      )
    ));

    const continueSection = h('section', { class: 'home-section' },
      sectionHeading('Rekomendasi untukmu', 'Langkah kecil berikutnya', 'Dipilih dari status kemampuan dan tingkat yang sedang kamu latih.'),
      h('div', { class: 'module-grid module-grid--featured' },
        recommendations.map((view) => moduleCard(view.module, view, { featured: true, reason: Progress.recommendationReason(view) }))
      )
    );
    screen.appendChild(continueSection);

    screen.appendChild(h('section', { class: 'home-section' },
      sectionHeading('Semua aktivitas', 'Pilih petualanganmu', 'Sepuluh laboratorium interaktif, dari membandingkan benda sampai menjaga timbangan tetap seimbang.'),
      h('div', { class: 'module-grid' },
        modules.map((module) => moduleCard(module, Progress.moduleView(profile, module)))
      )
    ));

    screen.appendChild(h('div', { class: 'home-note' },
      h('span', { 'aria-hidden': 'true' }, '💡'),
      h('p', {}, 'Aktivitas yang selesai belum tentu langsung dikuasai. MathLab menilai penguasaan dari beberapa sesi, bukan dari satu jawaban. ',
        h('button', { type: 'button', class: 'link-button', onclick: () => navigate('#/progress') }, 'Lihat cara membaca progres')
      )
    ));

    return screen;
  }

  function greetingLine(profile) {
    const hour = new Date().getHours();
    const greeting = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 19 ? 'Selamat sore' : 'Selamat malam';
    const overview = Progress.overview(profile);
    if (!overview.totalAttempts) return `${greeting}, ${profile.name}! Mulai dari satu hal kecil.`;
    if (overview.needsPractice > 0) return `${greeting}, ${profile.name}! Ada yang seru untuk diulang.`;
    return `${greeting}, ${profile.name}! Mau mencoba apa hari ini?`;
  }

  function miniStat(label, value, iconName) {
    return h('div', { class: 'mini-stat' },
      h('span', { class: 'mini-stat__icon', 'aria-hidden': 'true' }, icon(iconName, 18)),
      h('div', {},
        h('strong', {}, value),
        h('span', {}, label)
      )
    );
  }

  /* ---------------------------------------------------------------- module */

  function moduleScreen(profile, moduleId) {
    if (!profile) return welcomeScreen();
    const module = NS.getModule(moduleId);
    if (!module) {
      return h('div', { class: 'screen' }, Comp.emptyState({
        emoji: '🧭',
        title: 'Aktivitas tidak ditemukan',
        message: 'Tautan mungkin sudah berubah. Kembali ke beranda untuk memilih aktivitas.',
        action: h('button', { type: 'button', class: 'btn btn--primary', onclick: () => navigate('#/home') }, 'Ke beranda')
      }));
    }

    const view = Progress.moduleView(profile, module);
    const stage = NS.getStage(module.stage);
    const screen = h('div', { class: `screen screen--module module-accent-${module.accent}` });

    screen.appendChild(h('div', { class: 'module-detail-hero' },
      h('div', { class: 'module-detail-hero__icon', 'aria-hidden': 'true' }, module.icon),
      h('div', { class: 'module-detail-hero__content' },
        h('div', { class: 'chip-row' },
          stageChip(stage),
          h('span', { class: 'chip chip--soft' }, icon('clock', 14), `${module.minutes} menit`),
          Comp.statusBadge(view.status, true),
          view.completed ? h('span', { class: 'chip chip--good' }, icon('check', 14), 'Pernah diselesaikan') : null
        ),
        h('h1', {}, module.title),
        h('p', { class: 'module-detail-hero__subtitle' }, module.subtitle),
        h('p', { class: 'module-detail-hero__desc' }, module.description)
      ),
      h('div', { class: 'module-detail-hero__cta' },
        h('div', { class: 'level-readout' },
          h('span', {}, 'Tingkat saat ini'),
          h('strong', {}, String(view.level)),
          levelDots(view.level)
        ),
        h('button', {
          type: 'button',
          class: 'btn btn--primary btn--large',
          onclick: () => navigate(`#/play/${encodeURIComponent(module.id)}`)
        }, icon('play', 20), 'Mulai sesi')
      )
    ));

    const info = h('div', { class: 'module-detail-grid' },
      h('section', { class: 'panel' },
        h('h2', {}, 'Yang akan dilatih'),
        h('p', { class: 'panel__lead' }, module.goal),
        h('div', { class: 'skill-list compact' },
          view.skills.map((skill) => h('div', { class: 'skill-row' },
            h('div', { class: 'skill-row__body' },
              h('strong', {}, skill.label),
              h('p', {}, skill.description)
            ),
            h('div', { class: 'skill-row__meta' },
              Comp.statusBadge(skill.status, true),
              h('span', { class: 'level-mini' }, `Tingkat ${skill.level}`),
              h('span', { class: 'skill-row__attempts' }, skill.attempts ? `${skill.attempts} jawaban` : 'belum dicoba')
            )
          ))
        )
      ),
      h('aside', { class: 'panel panel--soft' },
        h('h2', {}, 'Cara sesi bekerja'),
        h('ul', { class: 'check-list' },
          h('li', {}, 'Satu sesi biasanya berisi sekitar lima tantangan interaktif.'),
          h('li', {}, 'Setiap jawaban langsung dicatat untuk menyesuaikan tingkat berikutnya.'),
          h('li', {}, 'Petunjuk tersedia dan tidak dihitung sebagai jawaban salah.'),
          h('li', {}, 'Kamu bisa mengakhiri sesi kapan saja; jawaban yang sudah tercatat tetap tersimpan.')
        ),
        h('div', { class: 'panel__note' },
          h('strong', {}, 'Selesai berbeda dari dikuasai.'),
          h('p', {}, 'Menyelesaikan satu sesi menandai aktivitas selesai. Status “mulai dikuasai” baru muncul setelah beberapa sesi dengan ketepatan yang stabil.')
        ),
        module.alsoStages && module.alsoStages.length
          ? h('p', { class: 'panel__small' }, `Juga cocok untuk tahap ${module.alsoStages.map((id) => NS.getStage(id) ? NS.getStage(id).short : id).join(', ')}.`)
          : null
      )
    );
    screen.appendChild(info);

    screen.appendChild(h('div', { class: 'inline-actions' },
      h('button', { type: 'button', class: 'btn btn--soft', onclick: () => navigate('#/home') }, icon('arrow-left', 17), 'Semua aktivitas'),
      h('button', { type: 'button', class: 'btn btn--ghost', onclick: () => navigate('#/skills') }, 'Lihat peta kemampuan')
    ));

    return screen;
  }

  /* ------------------------------------------------------------------ play */

  function playScreen(profile, moduleId) {
    if (!profile) return welcomeScreen();
    const module = NS.getModule(moduleId);
    if (!module) {
      return h('div', { class: 'screen' }, Comp.emptyState({
        emoji: '🧭',
        title: 'Aktivitas tidak ditemukan',
        message: 'Kembali ke beranda untuk memilih aktivitas lain.',
        action: h('button', { type: 'button', class: 'btn btn--primary', onclick: () => navigate('#/home') }, 'Ke beranda')
      }));
    }

    if (!APP.currentSession || APP.currentSession.moduleId !== module.id) {
      startSession(module, profile);
    }
    const session = APP.currentSession;
    const screen = h('div', { class: `screen screen--play module-accent-${module.accent}` });

    screen.appendChild(buildSessionBar(module, session));
    const moduleRoot = h('div', { class: 'module-root' });
    screen.appendChild(moduleRoot);

    const ctx = makeContext(session, module);
    try {
      module.render(moduleRoot, ctx);
    } catch (error) {
      console.error('MathLab: aktivitas gagal dimuat.', error);
      clear(moduleRoot);
      moduleRoot.appendChild(activityErrorCard(error));
    }

    session.timer = window.setInterval(updateSessionTimer, 1000);
    addScreenCleanup(() => {
      if (session.timer) {
        window.clearInterval(session.timer);
        session.timer = null;
      }
    });
    updateSessionStats();
    return screen;
  }

  function buildSessionBar(module, session) {
    const profile = Profiles.active();
    const level = Progress.getLevel(profile, module.skills && module.skills[0]);
    const bar = h('div', { class: 'session-bar', role: 'region', 'aria-label': 'Ringkasan sesi belajar' },
      h('div', { class: 'session-bar__identity' },
        h('span', { class: 'session-bar__emoji', 'aria-hidden': 'true' }, module.icon),
        h('div', {},
          h('strong', {}, module.title),
          h('span', { class: 'session-bar__meta' }, `Tingkat ${level} · jawaban tersimpan otomatis`)
        )
      ),
      h('div', { class: 'session-bar__stats' },
        h('span', { class: 'session-stat' }, h('strong', { id: 'session-attempts' }, '0'), 'jawaban'),
        h('span', { class: 'session-stat session-stat--good' }, h('strong', { id: 'session-correct' }, '0'), 'tepat'),
        h('span', { class: 'session-stat' }, h('strong', { id: 'session-hints' }, '0'), 'petunjuk'),
        h('span', { class: 'session-stat session-stat--timer' }, icon('clock', 14), h('strong', { id: 'session-timer' }, '0 dtk'))
      ),
      h('button', {
        type: 'button',
        class: 'btn btn--soft btn--small session-bar__end',
        onclick: requestEndSession
      }, 'Akhiri sesi')
    );
    return bar;
  }

  function activityErrorCard(error) {
    return h('div', { class: 'panel error-panel' },
      Comp.feedback('info', 'Aktivitas ini belum bisa ditampilkan', 'Terjadi kendala saat memuat aktivitas. Jawaban yang sudah tercatat tetap aman. Kamu bisa mengakhiri sesi lalu mencoba lagi.', {
        actions: h('div', { class: 'inline-actions' },
          h('button', { type: 'button', class: 'btn btn--primary', onclick: requestEndSession }, 'Akhiri sesi'),
          h('button', { type: 'button', class: 'btn btn--soft', onclick: () => navigate('#/home') }, 'Ke beranda')
        )
      }),
      h('details', { class: 'error-details' },
        h('summary', {}, 'Detail teknis'),
        h('pre', {}, String(error && error.message ? error.message : error))
      )
    );
  }

  function startSession(module, profile) {
    APP.lastResult = null;
    const now = Date.now();
    const skills = Array.isArray(module.skills) ? module.skills.slice() : [];
    const session = {
      id: randomId('session'),
      profileId: profile.id,
      moduleId: module.id,
      moduleTitle: module.title,
      moduleAccent: module.accent,
      moduleIcon: module.icon,
      primarySkill: skills[0] || null,
      skills,
      startedAt: new Date(now).toISOString(),
      startedMs: now,
      attempts: 0,
      correct: 0,
      hints: 0,
      skillStats: {},
      completed: false,
      finished: false,
      cleanups: [],
      timer: null
    };
    APP.currentSession = session;
    return session;
  }

  function resolveSessionSkill(session, skillId) {
    if (skillId && NS.getSkill(skillId)) return skillId;
    if (session.primarySkill && NS.getSkill(session.primarySkill)) return session.primarySkill;
    const module = NS.getModule(session.moduleId);
    if (module && module.skills) {
      const found = module.skills.find((id) => NS.getSkill(id));
      if (found) return found;
    }
    return null;
  }

  function makeContext(session, module) {
    const profile = Profiles.get(session.profileId) || Profiles.active();
    return {
      getLevel(skillId) {
        const id = resolveSessionSkill(session, skillId);
        return id ? Progress.getLevel(profile, id) : 1;
      },
      recordAttempt(options = {}) {
        if (session.finished) return;
        const targets = [];
        const primary = resolveSessionSkill(session, options.skillId);
        if (primary) targets.push(primary);
        const also = resolveSessionSkill(session, options.alsoSkillId);
        if (also && !targets.includes(also)) targets.push(also);
        if (!targets.length) return;
        const correct = Boolean(options.correct);
        session.attempts += 1;
        if (correct) session.correct += 1;
        for (const skillId of targets) {
          if (!session.skillStats[skillId]) {
            session.skillStats[skillId] = { attempts: 0, correct: 0, hints: 0 };
          }
          const stat = session.skillStats[skillId];
          stat.attempts += 1;
          if (correct) stat.correct += 1;
          if (options.hintUsed) stat.hints += 1;
          Progress.recordAttempt(session.profileId, skillId, {
            correct,
            hintUsed: Boolean(options.hintUsed)
          });
        }
        updateSessionStats();
      },
      recordHint(skillId) {
        if (session.finished) return;
        const id = resolveSessionSkill(session, skillId);
        if (!id) return;
        if (!session.skillStats[id]) {
          session.skillStats[id] = { attempts: 0, correct: 0, hints: 0 };
        }
        session.hints += 1;
        session.skillStats[id].hints += 1;
        Progress.recordHint(session.profileId, id);
        updateSessionStats();
      },
      finish(options = {}) {
        finalizeSession({ completed: options.completed !== false, silent: false });
      },
      sound: playSound,
      addCleanup(fn) {
        if (typeof fn === 'function') session.cleanups.push(fn);
      }
    };
  }

  function updateSessionStats() {
    const session = APP.currentSession;
    if (!session) return;
    const attempts = document.getElementById('session-attempts');
    const correct = document.getElementById('session-correct');
    const hints = document.getElementById('session-hints');
    if (attempts) attempts.textContent = String(session.attempts);
    if (correct) correct.textContent = String(session.correct);
    if (hints) hints.textContent = String(session.hints);
  }

  function updateSessionTimer() {
    const session = APP.currentSession;
    const node = document.getElementById('session-timer');
    if (!session || !node) return;
    node.textContent = formatDuration((Date.now() - session.startedMs) / 1000);
  }

  function requestEndSession() {
    const session = APP.currentSession;
    if (!session) {
      navigate('#/home');
      return;
    }
    if (session.attempts === 0) {
      openDialog({
        title: 'Keluar dari aktivitas?',
        body: h('p', {}, 'Belum ada jawaban yang tercatat pada sesi ini. Kamu bisa keluar dan memulai lagi kapan saja.'),
        confirmLabel: 'Keluar',
        cancelLabel: 'Tetap di sini',
        tone: 'danger',
        onConfirm: () => finalizeSession({ completed: false, silent: false })
      });
      return;
    }
    openDialog({
      title: 'Akhiri sesi sekarang?',
      body: h('div', {},
        h('p', {}, `Kamu sudah menjawab ${session.attempts} kali (${session.correct} tepat) dan memakai ${session.hints} petunjuk.`),
        h('p', { class: 'dialog-note' }, 'Sesi akan disimpan sebagai belum selesai. Semua jawaban tetap masuk ke progres, dan kamu bisa melanjutkan kapan saja.')
      ),
      confirmLabel: 'Akhiri & simpan',
      cancelLabel: 'Lanjut belajar',
      tone: 'danger',
      onConfirm: () => finalizeSession({ completed: false, silent: false })
    });
  }

  function finalizeSession(options = {}) {
    const session = APP.currentSession;
    if (!session || session.finished) return null;
    const { completed = false, silent = false, notify = false } = options;
    session.finished = true;
    session.completed = Boolean(completed);

    if (session.timer) {
      window.clearInterval(session.timer);
      session.timer = null;
    }
    for (const fn of session.cleanups.splice(0)) {
      try {
        fn();
      } catch (error) {
        console.warn('MathLab: cleanup modul gagal.', error);
      }
    }

    const profile = Profiles.get(session.profileId);
    let result = null;
    const endedAt = new Date().toISOString();
    const durationSeconds = Math.max(0, Math.round((Date.now() - session.startedMs) / 1000));

    if (profile && session.attempts > 0) {
      let recorded;
      try {
        recorded = Progress.recordSession(session.profileId, {
          id: session.id,
          moduleId: session.moduleId,
          moduleTitle: session.moduleTitle,
          startedAt: session.startedAt,
          endedAt,
          completed: session.completed,
          attempts: session.attempts,
          correct: session.correct,
          hints: session.hints,
          durationSeconds,
          skillIds: Object.keys(session.skillStats),
          skillStats: session.skillStats
        });
      } catch (error) {
        console.error('MathLab: gagal menyimpan sesi.', error);
        showToast('Sesi belum bisa disimpan. Coba ekspor data dari Pengaturan.', { tone: 'danger' });
        recorded = null;
      }

      if (recorded) {
        const fresh = Profiles.get(session.profileId);
        const skillViews = Object.keys(session.skillStats)
          .map((id) => Progress.skillView(fresh, id))
          .filter(Boolean);
        result = {
          sessionId: session.id,
          moduleId: session.moduleId,
          moduleTitle: session.moduleTitle,
          moduleIcon: session.moduleIcon,
          moduleAccent: session.moduleAccent,
          completed: session.completed,
          attempts: session.attempts,
          correct: session.correct,
          hints: session.hints,
          durationSeconds,
          startedAt: session.startedAt,
          endedAt,
          accuracy: session.attempts ? session.correct / session.attempts : 0,
          levelChanges: recorded.levelChanges || [],
          skills: skillViews
        };
        APP.lastResult = result;
        renderBanner();
      }
    }

    APP.currentSession = null;

    if (!silent) {
      if (result) {
        navigate(`#/result/${encodeURIComponent(session.moduleId)}`);
      } else {
        navigate('#/home');
        showToast('Sesi ditutup tanpa jawaban. Mulai lagi kapan saja, ya.', { tone: 'info' });
      }
    } else if (notify && result) {
      showToast('Sesi sebelumnya diakhiri dan progresnya tersimpan.', { tone: 'info' });
    }
    return result;
  }

  /* ---------------------------------------------------------------- result */

  function resultScreen(profile, moduleId) {
    if (!profile) return welcomeScreen();
    const result = APP.lastResult;
    if (!result || (moduleId && result.moduleId !== moduleId)) {
      return h('div', { class: 'screen' }, Comp.emptyState({
        emoji: '📘',
        title: 'Ringkasan sesi tidak tersedia',
        message: 'Ringkasan hanya disimpan selama halaman ini terbuka. Progres jawabanmu tetap tersimpan dan bisa dilihat di halaman Progres.',
        action: h('div', { class: 'inline-actions' },
          h('button', { type: 'button', class: 'btn btn--primary', onclick: () => navigate('#/home') }, 'Ke beranda'),
          h('button', { type: 'button', class: 'btn btn--soft', onclick: () => navigate('#/progress') }, 'Lihat progres')
        )
      }));
    }

    const percent = Math.round(result.accuracy * 100);
    const screen = h('div', { class: 'screen screen--result' });

    screen.appendChild(h('section', { class: 'result-hero' },
      h('div', { class: 'result-hero__mark', 'aria-hidden': 'true' }, result.completed ? '🎉' : '🌱'),
      h('div', { class: 'result-hero__body' },
        h('p', { class: 'eyebrow' }, result.completed ? 'Sesi selesai' : 'Sesi diakhiri lebih awal'),
        h('h1', {}, result.completed ? `Kerja bagus, ${profile.name}!` : `Terima kasih sudah mencoba, ${profile.name}.`),
        h('p', {}, result.completed
          ? 'Kamu sudah melewati seluruh rangkaian tantangan. Berikut catatan sesi ini.'
          : 'Sesi ini belum selesai, tetapi semua jawaban yang sudah kamu berikan tetap tercatat.'),
        h('div', { class: 'chip-row' },
          h('span', { class: 'chip chip--soft' }, result.moduleIcon + ' ' + result.moduleTitle),
          result.completed ? h('span', { class: 'chip chip--good' }, icon('check', 14), 'Aktivitas selesai') : h('span', { class: 'chip chip--soft' }, 'Belum selesai'),
          h('span', { class: 'chip chip--soft' }, icon('clock', 14), formatDuration(result.durationSeconds))
        )
      ),
      h('div', { class: 'result-ring', style: { '--ring-pct': `${percent}%` }, role: 'img', 'aria-label': `Ketepatan ${percent} persen` },
        h('strong', {}, `${percent}%`),
        h('span', {}, 'ketepatan')
      )
    ));

    screen.appendChild(h('div', { class: 'result-stat-grid' },
      resultStat('Jawaban tepat', `${result.correct} dari ${result.attempts}`, 'check'),
      resultStat('Petunjuk dipakai', String(result.hints), 'bulb'),
      resultStat('Durasi', formatDuration(result.durationSeconds), 'clock'),
      resultStat('Aktivitas', result.completed ? 'Selesai' : 'Sebagian', 'map')
    ));

    const skillPanel = h('section', { class: 'panel' },
      h('div', { class: 'section-heading section-heading--tight' },
        h('div', {},
          h('h2', {}, 'Status kemampuan'),
          h('p', {}, 'Status ini dihitung dari seluruh riwayat, bukan hanya sesi tadi.')
        )
      ),
      h('div', { class: 'skill-list compact' },
        result.skills.length
          ? result.skills.map((skill) => h('div', { class: 'skill-row' },
            h('div', { class: 'skill-row__body' },
              h('strong', {}, skill.label),
              h('p', {}, `Sesi ini: ${result.correct}/${result.attempts} jawaban tepat secara keseluruhan · ${skill.attempts} jawaban tercatat`)
            ),
            h('div', { class: 'skill-row__meta' },
              Comp.statusBadge(skill.status),
              h('span', { class: 'level-mini' }, `Tingkat ${skill.level}`),
              levelDots(skill.level)
            )
          ))
          : h('p', { class: 'muted' }, 'Belum ada kemampuan yang tercatat pada sesi ini.')
      )
    );
    screen.appendChild(skillPanel);

    if (result.levelChanges.length) {
      screen.appendChild(h('section', { class: 'panel panel--soft' },
        h('h2', {}, 'Penyesuaian tingkat'),
        h('div', { class: 'level-change-list' },
          result.levelChanges.map((change) => h('div', { class: `level-change level-change--${change.direction}` },
            h('span', { class: 'level-change__icon', 'aria-hidden': 'true' }, change.direction === 'up' ? '↑' : '↓'),
            h('div', {},
              h('strong', {}, change.label),
              h('p', {}, change.direction === 'up'
                ? `Tingkat naik dari ${change.from} ke ${change.to}. Tantangan berikutnya akan sedikit lebih menantang.`
                : `Tingkat disesuaikan dari ${change.from} ke ${change.to} agar tidak terlalu berat. Ini bukan hukuman, melainkan bantuan.`)
            )
          ))
        )
      ));
    }

    screen.appendChild(h('section', { class: 'mastery-note' },
      h('span', { class: 'mastery-note__icon', 'aria-hidden': 'true' }, '🧠'),
      h('div', {},
        h('strong', {}, 'Selesai ≠ langsung dikuasai'),
        h('p', {}, 'Menyelesaikan aktivitas berarti kamu sudah melewati sesi ini. Status “mulai dikuasai” memerlukan beberapa sesi dengan ketepatan yang stabil, sedangkan “perlu penguatan” berarti latihan tambahan akan membantu. Satu jawaban tidak menentukan kesimpulan.')
      )
    ));

    screen.appendChild(h('div', { class: 'result-actions' },
      h('button', {
        type: 'button',
        class: 'btn btn--primary',
        onclick: () => navigate(`#/play/${encodeURIComponent(result.moduleId)}`)
      }, icon('refresh', 18), 'Ulangi aktivitas'),
      h('button', { type: 'button', class: 'btn btn--soft', onclick: () => navigate('#/skills') }, icon('map', 18), 'Coba aktivitas lain'),
      h('button', { type: 'button', class: 'btn btn--ghost', onclick: () => navigate('#/home') }, 'Ke beranda')
    ));

    return screen;
  }

  function resultStat(label, value, iconName) {
    return h('div', { class: 'result-stat' },
      h('span', { class: 'result-stat__icon', 'aria-hidden': 'true' }, icon(iconName, 18)),
      h('div', {}, h('strong', {}, value), h('span', {}, label))
    );
  }

  /* ---------------------------------------------------------------- skills */

  function skillsScreen(profile) {
    if (!profile) return welcomeScreen();
    const stageViews = Progress.stageViews(profile);
    const overview = Progress.overview(profile);
    const affinity = profile.learningLevel === 'preschool' ? 'A'
      : profile.learningLevel === 'early-primary' ? 'B'
        : profile.learningLevel === 'upper-primary' ? 'C' : 'E';
    const screen = h('div', { class: 'screen screen--skills' });

    screen.appendChild(screenHeader({
      eyebrow: 'Peta kemampuan',
      title: 'Lihat perjalanan matematikamu',
      description: 'Setiap tahap berisi kemampuan dan aktivitas. Status dihitung dari beberapa sesi, bukan satu jawaban.',
      actions: h('div', { class: 'chip-row' },
        h('span', { class: 'chip chip--soft' }, `${overview.skillsStarted} kemampuan dimulai`),
        h('span', { class: 'chip chip--good' }, `${overview.skillsMastered} mulai dikuasai`),
        overview.needsPractice ? h('span', { class: 'chip chip--practice' }, `${overview.needsPractice} perlu penguatan`) : null
      )
    }));

    screen.appendChild(h('div', { class: 'status-legend panel panel--soft' },
      h('strong', {}, 'Arti status'),
      h('div', { class: 'status-legend__items' },
        Object.values(NS.STATUS).map((status) => h('span', { class: 'status-legend__item' },
          Comp.statusBadge(status, true),
          h('small', {}, statusDescription(status.id))
        ))
      )
    ));

    for (const view of stageViews) {
      const { stage, skills, modules } = view;
      const attempted = skills.some((skill) => skill.attempts > 0);
      const mastered = skills.filter((skill) => skill.status.id === 'mastered').length;
      const open = stage.id === affinity || attempted;
      const details = h('details', { class: `stage-card stage-card--${stage.color}`, open: open ? '' : null });
      details.appendChild(h('summary', { class: 'stage-card__summary' },
        h('span', { class: 'stage-card__dot', 'aria-hidden': 'true' }),
        h('div', { class: 'stage-card__title' },
          h('h2', {}, stage.title),
          h('p', {}, `${stage.age} · ${stage.tagline}`)
        ),
        h('div', { class: 'stage-card__summary-meta' },
          h('span', { class: 'chip chip--soft' }, `${mastered}/${skills.length} dikuasai`),
          h('span', { class: 'stage-card__chevron', 'aria-hidden': 'true' }, icon('chevron-right', 18))
        )
      ));
      const body = h('div', { class: 'stage-card__body' });
      body.appendChild(h('p', { class: 'stage-card__description' }, stage.description));

      if (modules.length) {
        body.appendChild(h('div', { class: 'stage-module-list' },
          modules.map((moduleView) => {
            const module = moduleView.module;
            return h('button', {
              type: 'button',
              class: 'stage-module',
              onclick: () => navigate(`#/module/${encodeURIComponent(module.id)}`)
            },
              h('span', { class: 'stage-module__icon', 'aria-hidden': 'true' }, module.icon),
              h('span', { class: 'stage-module__text' },
                h('strong', {}, module.title),
                h('small', {}, module.subtitle)
              ),
              Comp.statusBadge(moduleView.status, true),
              icon('chevron-right', 16)
            );
          })
        ));
      }

      body.appendChild(h('div', { class: 'skill-list' },
        skills.map((skill) => h('div', { class: 'skill-row' },
          h('div', { class: 'skill-row__body' },
            h('strong', {}, skill.label),
            h('p', {}, skill.description),
            h('span', { class: 'skill-row__sub' },
              skill.attempts ? `${skill.attempts} jawaban · ${Math.round((skill.accuracy || 0) * 100)}% tepat` : 'Belum dicoba',
              skill.lastPracticed ? ` · terakhir ${formatDate(skill.lastPracticed)}` : ''
            )
          ),
          h('div', { class: 'skill-row__meta' },
            Comp.statusBadge(skill.status),
            h('span', { class: 'level-mini' }, `Tingkat ${skill.level}`),
            levelDots(skill.level)
          )
        ))
      ));

      if (stage.id === 'F') {
        body.appendChild(h('div', { class: 'planned-topics' },
          h('strong', {}, 'Topik yang masih direncanakan'),
          h('p', {}, 'Belum tersedia sebagai aktivitas pada versi ini:'),
          h('ul', {}, NS.PLANNED_TOPICS.map((topic) => h('li', {}, topic)))
        ));
      }

      details.appendChild(body);
      screen.appendChild(details);
    }

    screen.appendChild(h('div', { class: 'home-note' },
      h('span', { 'aria-hidden': 'true' }, '🧭'),
      h('p', {}, 'Tahap tidak dikunci. Kamu boleh menjelajah aktivitas mana pun; tingkat soal tetap menyesuaikan jawabanmu. ')
    ));
    return screen;
  }

  function statusDescription(id) {
    if (id === 'not_tried') return 'Belum ada jawaban.';
    if (id === 'learning') return 'Sedang dibangun lewat latihan.';
    if (id === 'mastered') return 'Beberapa sesi stabil dan tepat.';
    return 'Perlu latihan tambahan dengan petunjuk.';
  }

  /* -------------------------------------------------------------- progress */

  function progressScreen(profile) {
    if (!profile) return welcomeScreen();
    const overview = Progress.overview(profile);
    const history = Progress.history(profile, 12);
    const accuracy = overview.totalAttempts ? Math.round((overview.totalCorrect / overview.totalAttempts) * 100) : 0;
    const screen = h('div', { class: 'screen screen--progress' });

    screen.appendChild(screenHeader({
      eyebrow: 'Progres belajar',
      title: `Catatan ${profile.name}`,
      description: 'Ringkasan ini disimpan hanya di perangkat ini. Gunakan untuk melihat kebiasaan belajar, bukan untuk membandingkan anak.',
      actions: h('button', { type: 'button', class: 'btn btn--primary btn--small', onclick: () => navigate('#/skills') }, icon('map', 16), 'Buka peta')
    }));

    screen.appendChild(h('div', { class: 'overview-grid' },
      overviewCard('Total sesi', String(overview.sessions), 'Sesi yang tersimpan', 'clock'),
      overviewCard('Jawaban', String(overview.totalAttempts), `${overview.totalCorrect} tepat`, 'target'),
      overviewCard('Ketepatan', `${accuracy}%`, 'Dari seluruh jawaban', 'chart'),
      overviewCard('Aktivitas selesai', `${overview.completedActivities}/${overview.totalActivities}`, `${overview.skillsMastered} kemampuan mulai dikuasai`, 'check')
    ));

    screen.appendChild(h('section', { class: 'panel panel--soft explainer' },
      h('h2', {}, 'Cara MathLab membaca progres'),
      h('div', { class: 'explainer-grid' },
        h('div', {},
          h('strong', {}, 'Selesai'),
          h('p', {}, 'Kamu sudah melewati seluruh rangkaian tantangan dalam satu aktivitas. Ini menandai aktivitas selesai, bukan penguasaan.')
        ),
        h('div', {},
          h('strong', {}, 'Mulai dikuasai'),
          h('p', {}, 'Muncul setelah minimal beberapa sesi dan delapan jawaban dengan ketepatan yang stabil. Satu jawaban benar tidak cukup.')
        ),
        h('div', {},
          h('strong', {}, 'Tingkat adaptif'),
          h('p', {}, 'Tingkat naik setelah minimal empat jawaban dalam sesi dan dua sesi berturut-turut yang konsisten. Tingkat juga bisa turun bila perlu.')
        )
      )
    ));

    const skillsByStage = h('div', { class: 'progress-skill-groups' });
    for (const stage of NS.STAGES) {
      const skills = NS.skillsForStage(stage.id).map((skill) => Progress.skillView(profile, skill.id));
      if (!skills.length) continue;
      skillsByStage.appendChild(h('div', { class: `progress-skill-group stage-tone-${stage.color}` },
        h('div', { class: 'progress-skill-group__head' },
          h('strong', {}, stage.title),
          h('span', {}, `${skills.filter((skill) => skill.status.id === 'mastered').length}/${skills.length} dikuasai`)
        ),
        h('div', { class: 'progress-skill-row' },
          skills.map((skill) => h('div', { class: 'progress-skill-chip' },
            h('span', {}, skill.label),
            Comp.statusBadge(skill.status, true),
            h('small', {}, skill.attempts ? `${Math.round((skill.accuracy || 0) * 100)}% · tingkat ${skill.level}` : 'baru')
          ))
        )
      ));
    }
    screen.appendChild(h('section', { class: 'panel' }, h('h2', {}, 'Peta status kemampuan'), skillsByStage));

    const historySection = h('section', { class: 'panel' },
      h('div', { class: 'section-heading section-heading--tight' },
        h('div', {},
          h('h2', {}, 'Riwayat sesi terakhir'),
          h('p', {}, 'Maksimal 100 sesi disimpan per profil; daftar ini menampilkan 12 terbaru.')
        )
      )
    );
    if (!history.length) {
      historySection.appendChild(Comp.emptyState({
        emoji: '📖',
        title: 'Belum ada riwayat',
        message: 'Setelah menyelesaikan atau mengakhiri sesi dengan jawaban, ringkasannya akan muncul di sini.',
        action: h('button', { type: 'button', class: 'btn btn--primary', onclick: () => navigate('#/home') }, 'Mulai belajar')
      }));
    } else {
      historySection.appendChild(h('div', { class: 'history-list' },
        history.map((entry) => {
          const module = NS.getModule(entry.moduleId);
          const pct = entry.attempts ? Math.round((entry.correct / entry.attempts) * 100) : 0;
          return h('div', { class: 'history-item' },
            h('span', { class: 'history-item__icon', 'aria-hidden': 'true' }, module ? module.icon : '📘'),
            h('div', { class: 'history-item__body' },
              h('strong', {}, entry.moduleTitle),
              h('span', {}, `${formatDate(entry.endedAt, { time: true })} · ${formatDuration(entry.durationSeconds)} · ${entry.hints} petunjuk`),
              h('div', { class: 'history-item__tags' },
                entry.completed ? h('span', { class: 'chip chip--good' }, icon('check', 12), 'Selesai') : h('span', { class: 'chip chip--soft' }, 'Sebagian'),
                h('span', { class: 'chip chip--soft' }, `${entry.correct}/${entry.attempts} tepat`)
              )
            ),
            h('div', { class: 'history-item__score' },
              h('strong', {}, `${pct}%`),
              Comp.progressBar(entry.attempts ? entry.correct / entry.attempts : 0, { label: `Ketepatan ${entry.moduleTitle}` })
            )
          );
        })
      ));
    }
    screen.appendChild(historySection);

    const recs = Progress.recommendations(profile, 2);
    if (recs.length) {
      screen.appendChild(h('section', { class: 'home-section' },
        sectionHeading('Langkah berikutnya', 'Latihan yang disarankan', 'Berdasarkan status kemampuan dan aktivitas terakhir.'),
        h('div', { class: 'module-grid module-grid--featured' },
          recs.map((view) => moduleCard(view.module, view, { featured: true, reason: Progress.recommendationReason(view) }))
        )
      ));
    }

    return screen;
  }

  function overviewCard(label, value, note, iconName) {
    return h('div', { class: 'overview-card' },
      h('span', { class: 'overview-card__icon', 'aria-hidden': 'true' }, icon(iconName, 20)),
      h('strong', {}, value),
      h('span', { class: 'overview-card__label' }, label),
      h('small', {}, note)
    );
  }

  /* -------------------------------------------------------------- settings */

  function settingsScreen(profile) {
    if (!profile) return welcomeScreen();
    const settings = Storage.getState().settings;
    const screen = h('div', { class: 'screen screen--settings' });

    screen.appendChild(screenHeader({
      eyebrow: 'Pengaturan',
      title: 'Atur pengalaman belajar',
      description: 'Preferensi berlaku di perangkat ini. Tidak ada akun, server, atau data yang dikirim keluar.'
    }));

    const prefPanel = h('section', { class: 'panel' },
      h('h2', {}, 'Preferensi'),
      h('label', { class: 'switch-row' },
        h('span', { class: 'switch-row__text' },
          h('strong', {}, 'Suara'),
          h('span', {}, 'Bunyi pendek saat jawaban tepat atau perlu dicoba lagi.')
        ),
        h('span', { class: 'switch' },
          h('input', {
            type: 'checkbox',
            checked: settings.sound,
            onchange: (event) => {
              Storage.updateSettings({ sound: event.target.checked });
              renderChrome();
              showToast(event.target.checked ? 'Suara diaktifkan.' : 'Suara dimatikan.', { tone: 'info' });
            }
          }),
          h('span', { class: 'switch__track', 'aria-hidden': 'true' })
        )
      ),
      h('label', { class: 'switch-row' },
        h('span', { class: 'switch-row__text' },
          h('strong', {}, 'Kurangi gerakan'),
          h('span', {}, 'Hentikan animasi dekoratif dan transisi agar lebih tenang.')
        ),
        h('span', { class: 'switch' },
          h('input', {
            type: 'checkbox',
            checked: settings.reduceMotion,
            onchange: (event) => {
              Storage.updateSettings({ reduceMotion: event.target.checked });
              applyMotionPreference();
              showToast(event.target.checked ? 'Gerakan dikurangi.' : 'Animasi diaktifkan kembali.', { tone: 'info' });
            }
          }),
          h('span', { class: 'switch__track', 'aria-hidden': 'true' })
        )
      )
    );
    screen.appendChild(prefPanel);

    const settingsGrid = h('div', { class: 'settings-grid' });
    settingsGrid.appendChild(h('section', { class: 'panel' },
      h('h2', {}, 'Profil aktif'),
      h('div', { class: 'settings-profile' },
        h('span', { class: 'settings-profile__avatar', 'aria-hidden': 'true' }, Profiles.avatarFor(profile)),
        h('div', {},
          h('strong', {}, profile.name),
          h('span', {}, `${Profiles.levelMeta(profile.learningLevel).label} · ${Profiles.levelMeta(profile.learningLevel).age}`)
        )
      ),
      h('div', { class: 'inline-actions' },
        h('button', { type: 'button', class: 'btn btn--soft btn--small', onclick: () => navigate(`#/profile/${encodeURIComponent(profile.id)}/edit`) }, icon('edit', 16), 'Ubah profil'),
        h('button', { type: 'button', class: 'btn btn--ghost btn--small', onclick: () => navigate('#/profiles') }, icon('users', 16), 'Ganti profil')
      )
    ));

    const dataPanel = h('section', { class: 'panel' },
      h('h2', {}, 'Data & cadangan'),
      h('p', { class: 'panel__lead' }, 'Semua progres disimpan di localStorage browser ini. Ekspor JSON secara berkala agar data tidak hilang saat browser dibersihkan.')
    );
    const importError = h('p', { class: 'form-error', role: 'alert' });
    dataPanel.appendChild(h('dl', { class: 'info-list' },
      h('div', {}, h('dt', {}, 'Penyimpanan'), h('dd', {}, Storage.checkAvailability() ? 'Tersedia' : 'Tidak tersedia')),
      h('div', {}, h('dt', {}, 'Terakhir tersimpan'), h('dd', {}, Storage.getLastSavedAt() ? formatDate(Storage.getLastSavedAt(), { time: true }) : 'Belum ada perubahan')),
      h('div', {}, h('dt', {}, 'Jumlah profil'), h('dd', {}, String(Profiles.list().length))),
      h('div', {}, h('dt', {}, 'Kunci data'), h('dd', {}, h('code', {}, Storage.KEY)))
    ));
    dataPanel.appendChild(h('div', { class: 'data-actions' },
      h('button', { type: 'button', class: 'btn btn--primary btn--small', onclick: exportData }, icon('download', 16), 'Ekspor JSON'),
      h('button', { type: 'button', class: 'btn btn--soft btn--small', onclick: () => pickBackupFile(importError) }, icon('upload', 16), 'Impor cadangan'),
      h('button', {
        type: 'button',
        class: 'btn btn--ghost btn--small danger-text',
        onclick: () => confirmResetData()
      }, icon('trash', 16), 'Hapus semua data')
    ));
    dataPanel.appendChild(importError);
    dataPanel.appendChild(h('p', { class: 'form-hint' }, 'Impor akan menggabungkan profil. Profil dengan ID yang sama akan diganti oleh isi cadangan.'));
    settingsGrid.appendChild(dataPanel);
    screen.appendChild(settingsGrid);

    screen.appendChild(h('section', { class: 'panel panel--soft about-panel' },
      h('h2', {}, 'Tentang MathLab'),
      h('p', {}, 'MathLab adalah laboratorium matematika visual yang berjalan tanpa server. Aktivitasnya mencakup kuantitas, frame bilangan, pasangan bilangan, garis bilangan, pola, hitung, perkalian, pecahan, geometri, dan aljabar awal.'),
      h('div', { class: 'about-badges' },
        h('span', { class: 'chip chip--soft' }, 'HTML · CSS · JavaScript'),
        h('span', { class: 'chip chip--soft' }, 'Tanpa akun'),
        h('span', { class: 'chip chip--soft' }, 'Tanpa iklan'),
        h('span', { class: 'chip chip--soft' }, 'Skema data v' + Storage.SCHEMA_VERSION)
      ),
      h('p', { class: 'form-hint' }, 'Statistika, peluang, Pythagoras, transformasi, dan sistem persamaan linear masih direncanakan dan belum tersedia sebagai aktivitas. Topik tersebut ditandai jelas di peta kemampuan.')
    ));

    screen.appendChild(h('div', { class: 'settings-danger-zone' },
      h('button', {
        type: 'button',
        class: 'btn btn--ghost btn--small',
        onclick: () => {
          Storage.setActiveProfile(null);
          navigate('#/welcome');
        }
      }, 'Tutup profil aktif tanpa menghapus data')
    ));

    return screen;
  }

  function exportData() {
    try {
      const date = new Date().toISOString().slice(0, 10);
      downloadFile(`mathlab-cadangan-${date}.json`, Storage.exportJSON(), 'application/json');
      showToast('Cadangan JSON dibuat. Periksa folder unduhan browser.', { tone: 'good' });
    } catch (error) {
      console.error('MathLab: ekspor gagal.', error);
      showToast('Cadangan belum bisa dibuat. Coba lagi dari browser lain.', { tone: 'danger' });
    }
  }

  function pickBackupFile(errorNode) {
    const input = h('input', { type: 'file', accept: '.json,application/json', class: 'sr-only' });
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) return;
      handleImportFile(file, errorNode);
    });
    document.body.appendChild(input);
    input.click();
  }

  function readBackupFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Berkas tidak dapat dibaca.'));
      reader.readAsText(file);
    });
  }

  function handleImportFile(file, errorNode) {
    const setError = (message) => {
      if (errorNode) errorNode.textContent = message;
      showToast(message, { tone: 'danger' });
    };
    if (errorNode) errorNode.textContent = '';
    if (file.size > 5 * 1024 * 1024) {
      setError('Berkas cadangan terlalu besar (maksimal 5 MB).');
      return;
    }
    readBackupFile(file).then((text) => {
      let candidate;
      try {
        candidate = Storage.validateBackup(text);
      } catch (error) {
        setError(`Cadangan tidak valid: ${error.message}`);
        return;
      }
      const sessions = candidate.profiles.reduce((total, profile) => {
        return total + (profile.progress && Number(profile.progress.totalSessions) || 0);
      }, 0);
      const names = candidate.profiles.map((profile) => profile.name).join(', ') || 'tidak ada profil';
      openDialog({
        title: 'Gabungkan cadangan?',
        body: h('div', {},
          h('p', {}, `Cadangan berisi ${candidate.profiles.length} profil (${names}) dan sekitar ${sessions} sesi.`),
          h('p', { class: 'dialog-note' }, 'Profil dengan ID yang sama akan diganti oleh data dari cadangan. Profil lain tidak dihapus.'),
          h('p', { class: 'dialog-note' }, 'Data saat ini sebaiknya diekspor terlebih dahulu sebagai pengaman.')
        ),
        confirmLabel: 'Gabungkan',
        cancelLabel: 'Batal',
        onConfirm: () => {
          try {
            const summary = Storage.mergeBackup(text);
            showToast(`Cadangan digabungkan: ${summary.added} profil baru, ${summary.updated} diperbarui.`, { tone: 'good' });
            APP.lastResult = null;
            if (Profiles.active()) navigate('#/home');
            else if (Profiles.list().length) navigate('#/profiles');
            else navigate('#/welcome');
          } catch (error) {
            const message = `Cadangan gagal digabungkan: ${error.message}`;
            if (errorNode) errorNode.textContent = message;
            showToast(message, { tone: 'danger' });
          }
        }
      });
    }).catch((error) => {
      setError(error.message || 'Berkas cadangan tidak dapat dibaca.');
    });
  }

  function confirmResetData() {
    openDialog({
      title: 'Hapus semua data MathLab?',
      body: h('div', {},
        h('p', {}, 'Seluruh profil, progres, dan riwayat sesi di perangkat ini akan dihapus. Tindakan ini tidak dapat dibatalkan.'),
        h('p', { class: 'dialog-note' }, 'Ekspor cadangan JSON terlebih dahulu jika data masih dibutuhkan.')
      ),
      confirmLabel: 'Hapus semua data',
      cancelLabel: 'Batal',
      tone: 'danger',
      onConfirm: () => {
        Storage.removeAllData();
        APP.lastResult = null;
        applyMotionPreference();
        showToast('Semua data lokal sudah dihapus.', { tone: 'info' });
        navigate('#/welcome');
      }
    });
  }

  /* ------------------------------------------------------------ components */

  function screenHeader({ eyebrow, title, description, actions }) {
    return h('div', { class: 'screen-header' },
      h('div', { class: 'screen-header__text' },
        eyebrow ? h('p', { class: 'eyebrow' }, eyebrow) : null,
        h('h1', {}, title),
        description ? h('p', { class: 'screen-header__description' }, description) : null
      ),
      actions ? h('div', { class: 'screen-header__actions' }, actions) : null
    );
  }

  function sectionHeading(eyebrow, title, description) {
    return h('div', { class: 'section-heading' },
      h('div', {},
        eyebrow ? h('p', { class: 'eyebrow' }, eyebrow) : null,
        h('h2', {}, title),
        description ? h('p', {}, description) : null
      )
    );
  }

  function stageChip(stage) {
    if (!stage) return h('span', { class: 'chip' }, 'Tahap');
    return h('span', { class: `chip stage-chip stage-chip--${stage.color}` },
      h('span', { class: 'stage-chip__dot', 'aria-hidden': 'true' }),
      `${stage.short} · ${stage.age}`
    );
  }

  function levelDots(level) {
    return h('span', { class: 'level-dots', 'aria-label': `Tingkat ${level} dari 5` },
      range(1, 5).map((index) => h('span', { class: `level-dot ${index <= level ? 'is-on' : ''}`.trim() }))
    );
  }

  function moduleCard(module, view, options = {}) {
    const stage = NS.getStage(module.stage);
    return h('article', { class: `module-card module-card--${module.accent} ${options.featured ? 'is-featured' : ''}`.trim() },
      h('div', { class: 'module-card__top' },
        h('span', { class: 'module-card__icon', 'aria-hidden': 'true' }, module.icon),
        h('div', { class: 'module-card__badges' },
          stageChip(stage),
          h('span', { class: 'chip chip--soft' }, icon('clock', 13), `${module.minutes} mnt`)
        )
      ),
      h('div', { class: 'module-card__body' },
        h('h3', {}, module.title),
        h('p', { class: 'module-card__subtitle' }, module.subtitle),
        h('p', { class: 'module-card__description' }, options.reason || module.description),
        h('div', { class: 'module-card__meta' },
          Comp.statusBadge(view.status, true),
          view.completed ? h('span', { class: 'chip chip--good' }, icon('check', 13), 'Selesai') : null,
          h('span', { class: 'level-mini' }, `Tingkat ${view.level}`)
        )
      ),
      h('div', { class: 'module-card__footer' },
        h('button', {
          type: 'button',
          class: 'btn btn--primary btn--small module-card__button',
          onclick: () => navigate(`#/module/${encodeURIComponent(module.id)}`)
        }, view.attempts ? 'Lanjutkan' : 'Buka aktivitas', icon('arrow-right', 16))
      )
    );
  }

  /* --------------------------------------------------------------- dialogs */

  function openDialog(options) {
    closeDialog({ restoreFocus: false });
    if (!el.modalRoot) return;
    APP.lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const titleId = 'dialog-title-' + Date.now();
    const dialog = h('div', {
      class: 'modal',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': titleId
    },
      h('h2', { id: titleId, class: 'modal__title' }, options.title || 'Konfirmasi'),
      h('div', { class: 'modal__body' }, options.body || null),
      h('div', { class: 'modal__actions' },
        h('button', {
          type: 'button',
          class: 'btn btn--ghost',
          onclick: () => closeDialog()
        }, options.cancelLabel || 'Batal'),
        h('button', {
          type: 'button',
          class: `btn ${options.tone === 'danger' ? 'btn--danger' : 'btn--primary'}`,
          onclick: () => {
            let keepOpen = false;
            if (typeof options.onConfirm === 'function') {
              try {
                keepOpen = options.onConfirm() === false;
              } catch (error) {
                console.error('MathLab: aksi dialog gagal.', error);
                showToast(error.message || 'Tindakan tidak dapat diselesaikan.', { tone: 'danger' });
                keepOpen = true;
              }
            }
            if (!keepOpen) closeDialog();
          }
        }, options.confirmLabel || 'Lanjutkan')
      )
    );
    const overlay = h('div', { class: 'modal-overlay' }, dialog);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeDialog();
    });
    el.modalRoot.appendChild(overlay);
    document.body.classList.add('modal-open');
    APP.modal = { overlay, dialog, lastFocus: APP.lastFocus };
    requestAnimationFrame(() => {
      overlay.classList.add('is-open');
      const confirm = dialog.querySelector('.modal__actions .btn:last-child');
      (confirm || dialog).focus();
    });
  }

  function closeDialog(options = {}) {
    if (!APP.modal) return;
    const { overlay, lastFocus } = APP.modal;
    const restoreFocus = options.restoreFocus !== false;
    APP.modal = null;
    overlay.classList.remove('is-open');
    overlay.remove();
    document.body.classList.remove('modal-open');
    if (restoreFocus && lastFocus && document.body.contains(lastFocus)) {
      lastFocus.focus({ preventScroll: true });
    }
  }

  function showToast(message, options = {}) {
    if (!el.toastRegion) return;
    const tone = ['good', 'info', 'danger', 'try'].includes(options.tone) ? options.tone : 'info';
    const toast = h('div', {
      class: `toast toast--${tone}`,
      role: tone === 'danger' ? 'alert' : 'status'
    },
      h('span', { class: 'toast__icon', 'aria-hidden': 'true' }, icon(tone === 'good' ? 'check' : tone === 'danger' ? 'info' : 'info', 17)),
      h('span', { class: 'toast__text' }, message),
      h('button', {
        type: 'button',
        class: 'toast__close',
        'aria-label': 'Tutup pemberitahuan',
        onclick: () => dismissToast(toast)
      }, icon('x', 15))
    );
    el.toastRegion.appendChild(toast);
    while (el.toastRegion.children.length > 3) {
      el.toastRegion.removeChild(el.toastRegion.firstElementChild);
    }
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    const timer = window.setTimeout(() => dismissToast(toast), tone === 'danger' ? 7000 : 4800);
    toast.dataset.timer = String(timer);
    announce(message);
  }

  function dismissToast(toast) {
    if (!toast || !toast.parentNode) return;
    const timer = Number(toast.dataset.timer);
    if (timer) window.clearTimeout(timer);
    toast.classList.remove('is-visible');
    window.setTimeout(() => toast.remove(), 180);
  }

  /* ----------------------------------------------------------------- audio */

  function playSound(kind) {
    const settings = Storage.getState().settings;
    if (!settings.sound) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    try {
      if (!APP.audio) APP.audio = new AudioContext();
      const ctx = APP.audio;
      if (ctx.state === 'suspended') ctx.resume();
      const tones = {
        good: [[523.25, 0, 0.12], [659.25, 0.09, 0.12], [783.99, 0.18, 0.16]],
        try: [[349.23, 0, 0.12], [293.66, 0.11, 0.16]],
        hint: [[440, 0, 0.12]],
        click: [[660, 0, 0.04]]
      };
      const sequence = tones[kind] || [];
      for (const [frequency, offset, duration] of sequence) {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = kind === 'click' ? 'triangle' : 'sine';
        oscillator.frequency.value = frequency;
        const start = ctx.currentTime + offset;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.045, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(start);
        oscillator.stop(start + duration + 0.02);
      }
    } catch (error) {
      // Audio is an enhancement; silent failure is fine.
    }
  }

  function applyMotionPreference() {
    const settings = Storage.getState().settings;
    document.body.classList.toggle('reduce-motion', Boolean(settings.reduceMotion));
  }

  /* ------------------------------------------------------------------- go */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
