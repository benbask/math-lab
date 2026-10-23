/* MathLab — per-profile progress, transparent mastery estimates, and adaptive difficulty. */
(function () {
  'use strict';

  const NS = (window.MathLab = window.MathLab || {});
  const Storage = NS.Storage;
  const util = NS.util;

  const BASE_LEVEL_BY_PROFILE = {
    preschool: 1,
    'early-primary': 1,
    'upper-primary': 2,
    middle: 3
  };

  const STAGE_LEVEL_CAP = { A: 2, B: 2, C: 3, D: 3, E: 4, F: 4 };

  function ensureSkill(profile, skillId) {
    const skillDef = NS.getSkill(skillId);
    if (!skillDef) throw new Error('Kemampuan tidak dikenal.');
    if (!profile.progress.skills[skillId]) {
      profile.progress.skills[skillId] = {
        attempts: 0,
        correct: 0,
        hints: 0,
        sessions: 0,
        level: defaultLevel(profile, skillDef),
        goodStreak: 0,
        struggleStreak: 0,
        lastPracticed: null,
        recent: []
      };
    }
    return profile.progress.skills[skillId];
  }

  function defaultLevel(profile, skillOrId) {
    const skill = typeof skillOrId === 'string' ? NS.getSkill(skillOrId) : skillOrId;
    if (!skill) return 1;
    const base = BASE_LEVEL_BY_PROFILE[profile.learningLevel] || 1;
    return util.clamp(base, 1, STAGE_LEVEL_CAP[skill.stage] || 3);
  }

  function getLevel(profile, skillId) {
    if (!profile) return 1;
    const record = profile.progress.skills[skillId];
    if (record && Number.isFinite(record.level)) return util.clamp(record.level, 1, 5);
    return defaultLevel(profile, skillId);
  }

  function recentAccuracy(record, count = 8) {
    if (!record || !Array.isArray(record.recent) || !record.recent.length) return null;
    const recent = record.recent.slice(-count);
    return recent.filter((entry) => entry.correct).length / recent.length;
  }

  function statusFor(profile, skillId) {
    const record = profile.progress.skills[skillId];
    if (!record || record.attempts === 0) return NS.STATUS.not_tried;
    const accuracy = record.correct / Math.max(1, record.attempts);
    const recent = recentAccuracy(record);
    if (
      record.attempts >= 8 &&
      record.sessions >= 2 &&
      accuracy >= 0.75 &&
      recent !== null &&
      recent >= 0.7
    ) {
      return NS.STATUS.mastered;
    }
    if (record.attempts >= 6 && (accuracy < 0.55 || (recent !== null && recent < 0.5))) {
      return NS.STATUS.needs_practice;
    }
    return NS.STATUS.learning;
  }

  function skillView(profile, skillId) {
    const skill = NS.getSkill(skillId);
    if (!skill) return null;
    const record = profile.progress.skills[skillId];
    const status = statusFor(profile, skillId);
    const attempts = record ? record.attempts : 0;
    const correct = record ? record.correct : 0;
    return {
      ...skill,
      record,
      status,
      attempts,
      correct,
      accuracy: attempts ? correct / attempts : null,
      hints: record ? record.hints : 0,
      sessions: record ? record.sessions : 0,
      level: getLevel(profile, skillId),
      recentAccuracy: record ? recentAccuracy(record) : null,
      lastPracticed: record && record.lastPracticed ? record.lastPracticed : null
    };
  }

  function recordAttempt(profileId, skillId, options = {}) {
    const profile = Storage.getProfile(profileId);
    if (!profile) return null;
    const skill = ensureSkill(profile, skillId);
    const correct = Boolean(options.correct);
    skill.attempts += 1;
    if (correct) skill.correct += 1;
    skill.lastPracticed = new Date().toISOString();
    skill.recent.push({
      correct,
      hint: Boolean(options.hintUsed),
      at: skill.lastPracticed,
      level: skill.level
    });
    skill.recent = skill.recent.slice(-40);
    Storage.save();
    return { attempts: skill.attempts, correct: skill.correct, level: skill.level };
  }

  function recordHint(profileId, skillId) {
    const profile = Storage.getProfile(profileId);
    if (!profile) return null;
    const skill = ensureSkill(profile, skillId);
    skill.hints += 1;
    skill.lastPracticed = new Date().toISOString();
    Storage.save();
    return { hints: skill.hints };
  }

  function adaptLevel(profile, skillId, stat) {
    const skill = ensureSkill(profile, skillId);
    const attempts = Number(stat.attempts) || 0;
    if (attempts < 4) {
      return null;
    }
    const accuracy = (Number(stat.correct) || 0) / attempts;
    const hintRate = (Number(stat.hints) || 0) / attempts;
    let change = null;

    if (accuracy >= 0.8 && hintRate <= 0.2) {
      skill.goodStreak = (skill.goodStreak || 0) + 1;
      skill.struggleStreak = 0;
    } else if (accuracy < 0.5 || hintRate >= 0.5) {
      skill.struggleStreak = (skill.struggleStreak || 0) + 1;
      skill.goodStreak = 0;
    } else {
      skill.goodStreak = 0;
      skill.struggleStreak = 0;
    }

    if (skill.goodStreak >= 2 && skill.level < 5) {
      const from = skill.level;
      skill.level += 1;
      skill.goodStreak = 0;
      skill.struggleStreak = 0;
      change = { skillId, from, to: skill.level, direction: 'up', label: NS.getSkill(skillId).label };
    } else if (skill.struggleStreak >= 2 && skill.level > 1) {
      const from = skill.level;
      skill.level -= 1;
      skill.goodStreak = 0;
      skill.struggleStreak = 0;
      change = { skillId, from, to: skill.level, direction: 'down', label: NS.getSkill(skillId).label };
    }
    return change;
  }

  function recordSession(profileId, session) {
    const profile = Storage.getProfile(profileId);
    if (!profile) return { levelChanges: [], entry: null };
    const progress = profile.progress;
    const skillStats = session.skillStats || {};
    const levelChanges = [];

    for (const skillId of Object.keys(skillStats)) {
      if (!NS.getSkill(skillId)) continue;
      const stat = skillStats[skillId];
      const skill = ensureSkill(profile, skillId);
      if ((Number(stat.attempts) || 0) > 0) {
        skill.sessions = (skill.sessions || 0) + 1;
        skill.lastPracticed = session.endedAt || new Date().toISOString();
        const change = adaptLevel(profile, skillId, stat);
        if (change) levelChanges.push(change);
      }
    }

    const entry = {
      id: session.id || util.randomId('session'),
      moduleId: session.moduleId,
      moduleTitle: session.moduleTitle || 'Aktivitas',
      startedAt: session.startedAt,
      endedAt: session.endedAt || new Date().toISOString(),
      attempts: Number(session.attempts) || 0,
      correct: Number(session.correct) || 0,
      hints: Number(session.hints) || 0,
      completed: Boolean(session.completed),
      durationSeconds: Number(session.durationSeconds) || 0,
      skillIds: session.skillIds || Object.keys(skillStats)
    };
    progress.sessionHistory.unshift(entry);
    progress.sessionHistory = progress.sessionHistory.slice(0, 100);
    progress.totalSessions += 1;
    if (session.completed && !progress.completedActivities.includes(session.moduleId)) {
      progress.completedActivities.push(session.moduleId);
    }
    profile.updatedAt = new Date().toISOString();
    Storage.save();
    return { levelChanges, entry };
  }

  function moduleView(profile, module) {
    const skills = (module.skills || []).map((id) => skillView(profile, id)).filter(Boolean);
    const primary = skills[0] || null;
    const practiced = skills.filter((skill) => skill.attempts > 0);
    let status;
    if (!practiced.length) {
      status = NS.STATUS.not_tried;
    } else if (skills.every((skill) => skill.status.id === 'mastered')) {
      status = NS.STATUS.mastered;
    } else if (skills.some((skill) => skill.status.id === 'needs_practice')) {
      status = NS.STATUS.needs_practice;
    } else {
      status = NS.STATUS.learning;
    }
    const completed = profile.progress.completedActivities.includes(module.id);
    return {
      module,
      skills,
      primary,
      status,
      completed,
      level: getLevel(profile, (module.skills || [])[0]),
      attempts: skills.reduce((total, skill) => total + skill.attempts, 0)
    };
  }

  function stageViews(profile) {
    return NS.STAGES.map((stage) => {
      const skills = NS.skillsForStage(stage.id).map((skill) => skillView(profile, skill.id));
      const modules = NS.modulesForStage(stage.id).map((module) => moduleView(profile, module));
      return { stage, skills, modules };
    });
  }

  function overview(profile) {
    const skills = Object.values(NS.SKILLS).map((skill) => skillView(profile, skill.id));
    const moduleIds = new Set(NS.getModules().map((module) => module.id));
    return {
      sessions: profile.progress.totalSessions,
      completedActivities: profile.progress.completedActivities.filter((id) => moduleIds.has(id)).length,
      totalActivities: NS.getModules().length,
      skillsStarted: skills.filter((skill) => skill.attempts > 0).length,
      skillsMastered: skills.filter((skill) => skill.status.id === 'mastered').length,
      needsPractice: skills.filter((skill) => skill.status.id === 'needs_practice').length,
      totalAttempts: skills.reduce((total, skill) => total + skill.attempts, 0),
      totalCorrect: skills.reduce((total, skill) => total + skill.correct, 0)
    };
  }

  function stageAffinity(profile) {
    const map = {
      preschool: 'A',
      'early-primary': 'B',
      'upper-primary': 'C',
      middle: 'E'
    };
    const target = map[profile.learningLevel] || 'B';
    return NS.STAGES.indexOf(NS.getStage(target));
  }

  function recommendations(profile, limit = 3) {
    const modules = NS.getModules();
    const affinity = stageAffinity(profile);
    const rank = { needs_practice: 0, learning: 1, not_tried: 2, mastered: 3 };
    const scored = modules.map((module) => {
      const view = moduleView(profile, module);
      const stageIndex = NS.STAGES.findIndex((stage) => stage.id === module.stage);
      const distance = Math.abs(stageIndex - affinity);
      let score = rank[view.status.id] * 10 + distance * 2;
      if (view.completed) score += 1;
      if (module.alsoStages && module.alsoStages.includes(NS.STAGES[affinity] && NS.STAGES[affinity].id)) score -= 1;
      return { ...view, score, distance };
    });
    scored.sort((a, b) => a.score - b.score);
    return scored.slice(0, limit);
  }

  function recommendationReason(view) {
    if (view.status.id === 'needs_practice') return 'Butuh sedikit penguatan, cocok dicoba lagi.';
    if (view.status.id === 'learning') return 'Lanjutkan latihan yang sedang berjalan.';
    if (view.status.id === 'mastered') return 'Sudah mulai dikuasai — coba variasi baru.';
    if (view.attempts === 0) return 'Aktivitas baru untuk dijelajahi.';
    return 'Cocok untuk melanjutkan petualanganmu.';
  }

  function history(profile, limit = 12) {
    return profile.progress.sessionHistory.slice(0, limit);
  }

  function isCompleted(profile, moduleId) {
    return profile.progress.completedActivities.includes(moduleId);
  }

  NS.Progress = {
    defaultLevel,
    getLevel,
    recordAttempt,
    recordHint,
    recordSession,
    statusFor,
    skillView,
    moduleView,
    stageViews,
    overview,
    recommendations,
    recommendationReason,
    history,
    isCompleted
  };
})();
