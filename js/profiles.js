/* MathLab — profile-facing helpers. */
(function () {
  'use strict';

  const NS = (window.MathLab = window.MathLab || {});
  const Storage = NS.Storage;

  function list() {
    return Storage.getProfiles();
  }

  function get(id) {
    return Storage.getProfile(id);
  }

  function active() {
    return Storage.getActiveProfile();
  }

  function create(input) {
    if (!input || !String(input.name || '').trim()) {
      throw new Error('Tulis nama panggilan anak terlebih dahulu.');
    }
    return Storage.createProfile(input);
  }

  function update(id, patch) {
    return Storage.updateProfile(id, patch);
  }

  function remove(id) {
    return Storage.deleteProfile(id);
  }

  function setActive(id) {
    return Storage.setActiveProfile(id);
  }

  function levelMeta(id) {
    return NS.LEARNING_LEVELS.find((level) => level.id === id) || NS.LEARNING_LEVELS[1];
  }

  function avatarFor(profile) {
    return profile && profile.avatar ? profile.avatar : '🦊';
  }

  function ageHint(profile) {
    return profile ? levelMeta(profile.learningLevel).age : '';
  }

  NS.Profiles = {
    list,
    get,
    active,
    create,
    update,
    remove,
    setActive,
    levelMeta,
    avatarFor,
    ageHint
  };
})();
