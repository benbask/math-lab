/* MathLab — centralized, defensive localStorage persistence. */
(function () {
  'use strict';

  const NS = (window.MathLab = window.MathLab || {});
  const KEY = 'mathlab.v1';
  const CORRUPT_PREFIX = 'mathlab.corrupt.';
  const SCHEMA_VERSION = 1;
  const VALID_LEVELS = new Set(['preschool', 'early-primary', 'upper-primary', 'middle']);
  const ID_PATTERN = /^[A-Za-z0-9_-]{3,80}$/;
  const SKILL_PATTERN = /^[a-z][a-z0-9._-]{0,60}$/;

  let state = null;
  let initialized = false;
  let available = true;
  let warning = null;
  let lastSavedAt = null;

  function nowIso() {
    return new Date().toISOString();
  }

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function asString(value, fallback = '') {
    return typeof value === 'string' ? value : fallback;
  }

  function asInt(value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, Math.round(number)));
  }

  function asDate(value) {
    if (typeof value !== 'string') return nowIso();
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? nowIso() : date.toISOString();
  }

  function cleanName(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, 24);
  }

  function cleanAvatar(value) {
    const avatar = asString(value, '🦊').trim();
    return avatar ? Array.from(avatar).slice(0, 3).join('') : '🦊';
  }

  function defaultProgress() {
    return {
      skills: {},
      completedActivities: [],
      sessionHistory: [],
      totalSessions: 0
    };
  }

  function defaultState() {
    return {
      version: SCHEMA_VERSION,
      profiles: [],
      activeProfileId: null,
      settings: {
        sound: true,
        reduceMotion: false
      },
      meta: {
        createdAt: nowIso(),
        updatedAt: nowIso(),
        app: 'MathLab'
      }
    };
  }

  function normalizeRecent(list) {
    if (!Array.isArray(list)) return [];
    return list.slice(-40).map((entry) => {
      if (!isObject(entry)) return null;
      return {
        correct: Boolean(entry.correct),
        hint: Boolean(entry.hint),
        at: asDate(entry.at),
        level: asInt(entry.level, 1, 1, 5)
      };
    }).filter(Boolean);
  }

  function normalizeSkill(raw) {
    if (!isObject(raw)) return null;
    const attempts = asInt(raw.attempts, 0, 0, 100000);
    return {
      attempts,
      correct: Math.min(attempts, asInt(raw.correct, 0, 0, 100000)),
      hints: asInt(raw.hints, 0, 0, 100000),
      sessions: asInt(raw.sessions, 0, 0, 100000),
      level: asInt(raw.level, 1, 1, 5),
      goodStreak: asInt(raw.goodStreak, 0, 0, 1000),
      struggleStreak: asInt(raw.struggleStreak, 0, 0, 1000),
      lastPracticed: raw.lastPracticed ? asDate(raw.lastPracticed) : null,
      recent: normalizeRecent(raw.recent)
    };
  }

  function normalizeSkills(raw) {
    const result = {};
    if (!isObject(raw)) return result;
    for (const key of Object.keys(raw)) {
      if (!SKILL_PATTERN.test(key)) continue;
      const skill = normalizeSkill(raw[key]);
      if (skill) {
        Object.defineProperty(result, key, {
          value: skill,
          enumerable: true,
          configurable: true,
          writable: true
        });
      }
    }
    return result;
  }

  function normalizeHistoryEntry(raw, index) {
    if (!isObject(raw)) return null;
    const attempts = asInt(raw.attempts, 0, 0, 100000);
    const correct = Math.min(attempts, asInt(raw.correct, 0, 0, 100000));
    const startedAt = asDate(raw.startedAt);
    const endedAt = asDate(raw.endedAt || new Date(new Date(startedAt).getTime() + 1000).toISOString());
    return {
      id: ID_PATTERN.test(asString(raw.id)) ? raw.id : `session_${index}_${Date.now()}`,
      moduleId: asString(raw.moduleId, 'unknown').slice(0, 60),
      moduleTitle: asString(raw.moduleTitle, 'Aktivitas').slice(0, 80),
      startedAt,
      endedAt,
      attempts,
      correct,
      hints: asInt(raw.hints, 0, 0, 100000),
      completed: Boolean(raw.completed),
      durationSeconds: asInt(raw.durationSeconds, 0, 0, 86400),
      skillIds: Array.isArray(raw.skillIds)
        ? raw.skillIds.filter((id) => typeof id === 'string' && SKILL_PATTERN.test(id)).slice(0, 12)
        : []
    };
  }

  function normalizeProgress(raw) {
    if (!isObject(raw)) throw new Error('Data progres tidak ditemukan.');
    const history = Array.isArray(raw.sessionHistory)
      ? raw.sessionHistory.slice(0, 100).map(normalizeHistoryEntry).filter(Boolean)
      : [];
    return {
      skills: normalizeSkills(raw.skills),
      completedActivities: Array.isArray(raw.completedActivities)
        ? Array.from(new Set(raw.completedActivities.filter((id) => typeof id === 'string' && ID_PATTERN.test(id)).slice(0, 60)))
        : [],
      sessionHistory: history,
      totalSessions: asInt(raw.totalSessions, history.length, 0, 100000)
    };
  }

  function normalizeProfile(raw, index) {
    if (!isObject(raw)) throw new Error(`Profil ke-${index + 1} tidak valid.`);
    const id = asString(raw.id).trim();
    if (!ID_PATTERN.test(id)) throw new Error(`ID profil ke-${index + 1} tidak valid.`);
    const name = cleanName(raw.name);
    if (!name) throw new Error(`Nama profil ke-${index + 1} kosong.`);
    const learningLevel = VALID_LEVELS.has(raw.learningLevel) ? raw.learningLevel : 'early-primary';
    return {
      id,
      name,
      avatar: cleanAvatar(raw.avatar),
      learningLevel,
      createdAt: asDate(raw.createdAt),
      updatedAt: asDate(raw.updatedAt || raw.createdAt),
      progress: normalizeProgress(raw.progress || defaultProgress())
    };
  }

  function normalizeState(raw) {
    if (!isObject(raw)) throw new Error('Format data bukan objek.');
    if (Number(raw.version) !== SCHEMA_VERSION) {
      throw new Error(`Versi data ${raw.version || 'tidak dikenal'} tidak didukung.`);
    }
    if (!Array.isArray(raw.profiles)) throw new Error('Daftar profil tidak ditemukan.');
    const seen = new Set();
    const profiles = raw.profiles.slice(0, 30).map((profile, index) => {
      const normalized = normalizeProfile(profile, index);
      if (seen.has(normalized.id)) throw new Error('Terdapat ID profil ganda.');
      seen.add(normalized.id);
      return normalized;
    });
    const activeProfileId = seen.has(raw.activeProfileId) ? raw.activeProfileId : null;
    const settings = isObject(raw.settings) ? raw.settings : {};
    return {
      version: SCHEMA_VERSION,
      profiles,
      activeProfileId,
      settings: {
        sound: settings.sound !== false,
        reduceMotion: settings.reduceMotion === true
      },
      meta: {
        createdAt: raw.meta && raw.meta.createdAt ? asDate(raw.meta.createdAt) : nowIso(),
        updatedAt: raw.meta && raw.meta.updatedAt ? asDate(raw.meta.updatedAt) : nowIso(),
        app: 'MathLab'
      }
    };
  }

  function testStorage() {
    try {
      const testKey = 'mathlab.storage-test';
      window.localStorage.setItem(testKey, 'ok');
      window.localStorage.removeItem(testKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  function readRaw() {
    if (!available) return null;
    try {
      return window.localStorage.getItem(KEY);
    } catch (error) {
      available = false;
      warning = {
        type: 'unavailable',
        title: 'Penyimpanan browser tidak bisa diakses',
        message: 'Progres hanya bertahan selama tab ini terbuka.'
      };
      return null;
    }
  }

  function backupCorrupt(raw) {
    if (!raw || !available) return null;
    try {
      const key = `${CORRUPT_PREFIX}${Date.now()}`;
      window.localStorage.setItem(key, raw);
      return key;
    } catch (_) {
      return null;
    }
  }

  function init() {
    if (initialized) {
      return { state, warning, available, lastSavedAt };
    }
    initialized = true;
    available = testStorage();

    if (!available) {
      state = defaultState();
      warning = {
        type: 'unavailable',
        title: 'Penyimpanan lokal tidak tersedia',
        message: 'MathLab tetap bisa dipakai, tetapi progres hanya tersimpan selama tab ini terbuka.'
      };
      return { state, warning, available, lastSavedAt };
    }

    const raw = readRaw();
    if (!raw) {
      state = defaultState();
      return { state, warning, available, lastSavedAt };
    }

    try {
      const parsed = JSON.parse(raw);
      state = normalizeState(parsed);
      lastSavedAt = state.meta.updatedAt || null;
    } catch (error) {
      const backupKey = backupCorrupt(raw);
      state = defaultState();
      warning = {
        type: 'corrupt',
        title: 'Data lama tidak dapat dibaca',
        message: backupKey
          ? 'Data asli tidak dihapus; salinan darurat telah disimpan di browser. Kamu bisa mulai dengan data baru atau memulihkan cadangan JSON.'
          : 'Data asli tidak dapat dibaca. Kamu bisa mulai dengan data baru atau memulihkan cadangan JSON.',
        backupKey,
        detail: error.message
      };
    }
    return { state, warning, available, lastSavedAt };
  }

  function save() {
    if (!state) state = defaultState();
    state.meta = state.meta || {};
    state.meta.updatedAt = nowIso();
    lastSavedAt = state.meta.updatedAt;
    if (!available) {
      warning = warning || {
        type: 'unavailable',
        title: 'Penyimpanan lokal tidak tersedia',
        message: 'Perubahan hanya bertahan selama tab ini terbuka.'
      };
      return { ok: false, error: warning.message };
    }
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
      if (warning && warning.type === 'quota') warning = null;
      return { ok: true };
    } catch (error) {
      const quota = error && (error.name === 'QuotaExceededError' || error.code === 22);
      warning = {
        type: quota ? 'quota' : 'write',
        title: quota ? 'Penyimpanan browser penuh' : 'Gagal menyimpan perubahan',
        message: quota
          ? 'Ekspor data, hapus riwayat yang tidak diperlukan, lalu coba lagi.'
          : 'Perubahan mungkin hanya bertahan selama tab ini terbuka.'
      };
      return { ok: false, error: warning.message };
    }
  }

  function getState() {
    if (!state) init();
    return state;
  }

  function getProfiles() {
    return getState().profiles.slice();
  }

  function getProfile(id) {
    return getState().profiles.find((profile) => profile.id === id) || null;
  }

  function getActiveProfile() {
    const current = getState();
    return current.profiles.find((profile) => profile.id === current.activeProfileId) || null;
  }

  function createProfile(input) {
    const name = cleanName(input && input.name);
    if (!name) throw new Error('Nama panggilan perlu diisi.');
    if (name.length > 24) throw new Error('Nama panggilan maksimal 24 huruf.');
    const learningLevel = VALID_LEVELS.has(input && input.learningLevel) ? input.learningLevel : 'early-primary';
    const profile = {
      id: `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      name,
      avatar: cleanAvatar(input && input.avatar),
      learningLevel,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      progress: defaultProgress()
    };
    getState().profiles.push(profile);
    getState().activeProfileId = profile.id;
    save();
    return profile;
  }

  function updateProfile(id, patch) {
    const profile = getProfile(id);
    if (!profile) throw new Error('Profil tidak ditemukan.');
    if (patch.name !== undefined) {
      const name = cleanName(patch.name);
      if (!name) throw new Error('Nama panggilan perlu diisi.');
      profile.name = name;
    }
    if (patch.avatar !== undefined) profile.avatar = cleanAvatar(patch.avatar);
    if (patch.learningLevel !== undefined) {
      if (!VALID_LEVELS.has(patch.learningLevel)) throw new Error('Tingkat belajar tidak valid.');
      profile.learningLevel = patch.learningLevel;
    }
    profile.updatedAt = nowIso();
    save();
    return profile;
  }

  function deleteProfile(id) {
    const current = getState();
    const before = current.profiles.length;
    current.profiles = current.profiles.filter((profile) => profile.id !== id);
    if (current.profiles.length === before) return false;
    if (current.activeProfileId === id) {
      current.activeProfileId = null;
    }
    save();
    return true;
  }

  function setActiveProfile(id) {
    const current = getState();
    if (id === null) {
      current.activeProfileId = null;
      save();
      return null;
    }
    const profile = getProfile(id);
    if (!profile) throw new Error('Profil tidak ditemukan.');
    current.activeProfileId = profile.id;
    save();
    return profile;
  }

  function updateSettings(patch) {
    const settings = getState().settings;
    if (patch.sound !== undefined) settings.sound = Boolean(patch.sound);
    if (patch.reduceMotion !== undefined) settings.reduceMotion = Boolean(patch.reduceMotion);
    save();
    return settings;
  }

  function exportObject() {
    return {
      app: 'MathLab',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: nowIso(),
      data: JSON.parse(JSON.stringify(getState()))
    };
  }

  function exportJSON() {
    return JSON.stringify(exportObject(), null, 2);
  }

  function validateBackup(input) {
    let parsed = input;
    if (typeof input === 'string') {
      try {
        parsed = JSON.parse(input);
      } catch (error) {
        throw new Error('File bukan JSON yang valid.');
      }
    }
    if (!isObject(parsed)) throw new Error('Isi cadangan tidak valid.');
    let candidateData = parsed;
    if (parsed.data !== undefined) {
      if (parsed.app && parsed.app !== 'MathLab') throw new Error('Berkas bukan cadangan MathLab.');
      candidateData = parsed.data;
    }
    const candidate = normalizeState(candidateData);
    return candidate;
  }

  function mergeBackup(input) {
    const candidate = validateBackup(input);
    const current = getState();
    const existingById = new Map(current.profiles.map((profile) => [profile.id, profile]));
    let added = 0;
    let updated = 0;
    for (const profile of candidate.profiles) {
      if (existingById.has(profile.id)) {
        const index = current.profiles.findIndex((item) => item.id === profile.id);
        current.profiles[index] = profile;
        updated += 1;
      } else {
        current.profiles.push(profile);
        added += 1;
      }
    }
    if (candidate.settings) current.settings = candidate.settings;
    if (!getProfile(current.activeProfileId)) {
      current.activeProfileId = candidate.activeProfileId && getProfile(candidate.activeProfileId)
        ? candidate.activeProfileId
        : (current.profiles[0] ? current.profiles[0].id : null);
    }
    save();
    return { added, updated, total: current.profiles.length };
  }

  function removeAllData() {
    const current = getState();
    state = defaultState();
    try {
      if (available) window.localStorage.removeItem(KEY);
    } catch (_) {
      // In-memory state has already been reset.
    }
    return current;
  }

  function checkAvailability() {
    return available;
  }

  function dismissWarning() {
    warning = null;
  }

  function getLastSavedAt() {
    return lastSavedAt;
  }

  NS.Storage = {
    KEY,
    SCHEMA_VERSION,
    init,
    save,
    getState,
    getProfiles,
    getProfile,
    getActiveProfile,
    createProfile,
    updateProfile,
    deleteProfile,
    setActiveProfile,
    updateSettings,
    exportObject,
    exportJSON,
    validateBackup,
    mergeBackup,
    removeAllData,
    checkAvailability,
    dismissWarning,
    getLastSavedAt,
    getWarning: () => warning,
    resetForTests: () => {
      initialized = false;
      state = null;
      warning = null;
      available = true;
      lastSavedAt = null;
    }
  };
})();
