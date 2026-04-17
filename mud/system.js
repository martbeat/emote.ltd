export function createSystemState() {
  return {
    tension: 3,
    alignment: 0,
    turns: 0,
    state: 'balanced',
  };
}

export function recalcSystemState(system) {
  if (system.tension >= 8) {
    system.state = 'chaotic';
  } else if (system.tension <= 2 && system.turns >= 8) {
    system.state = 'stagnant';
  } else {
    system.state = 'balanced';
  }
}

export function shiftTension(system, delta) {
  system.tension = Math.min(10, Math.max(0, system.tension + delta));
  recalcSystemState(system);
}

export function tickSystem(system) {
  system.turns += 1;
  recalcSystemState(system);
}

export function interpretiveMessage(system) {
  if (system.state === 'chaotic') return 'There is a sense of growing friction; outcomes wobble before they land.';
  if (system.state === 'stagnant') return 'The system feels rigid, as though agreement hardened into habit.';
  return 'A coalition seems to have stabilised the latest outcome.';
}

export function mediate(system, rng = Math.random) {
  const chance = system.state === 'chaotic' ? 0.75 : 0.55;
  if (rng() < chance) {
    shiftTension(system, -2);
    system.alignment += 1;
    return { ok: true, text: 'You mediate between blocs. Voices lower, and one procedural knot loosens.' };
  }
  shiftTension(system, 1);
  return { ok: false, text: 'Your mediation lands as choreography. Nobody objects, nobody yields.' };
}

export function challenge(system, rng = Math.random) {
  const chance = system.state === 'stagnant' ? 0.72 : 0.52;
  shiftTension(system, 2);
  if (rng() < chance) {
    system.alignment += 1;
    return { ok: true, text: 'You challenge assumptions directly. The room bristles, then re-engages.' };
  }
  return { ok: false, text: 'You challenge too early; factions harden around old instincts.' };
}

export function resetNormAttempt(system, rng = Math.random) {
  const base = 0.4 + system.alignment * 0.05;
  const modifier = system.state === 'chaotic' ? -0.15 : system.state === 'stagnant' ? -0.05 : 0.08;
  const chance = Math.max(0.1, Math.min(0.85, base + modifier));
  const ok = rng() < chance;
  shiftTension(system, ok ? -1 : 1);
  return {
    ok,
    text: ok
      ? 'A reset attempt succeeds. The committee accepts procedural reconfiguration for now.'
      : 'The reset fails. The institution cites continuity while quietly fearing drift.',
  };
}
