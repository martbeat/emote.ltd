export function createSystemState() {
  return {
    tension: 3,
    alignment: 0,
    turns: 0,
    state: 'balanced',
    lastTransition: null,
    recentRipples: [],
    currentPhase: 'watchful equilibrium',
    phaseHistory: [],
  };
}

export function recalcSystemState(system) {
  const previous = system.state;
  if (system.tension >= 8) {
    system.state = 'chaotic';
  } else if (system.tension <= 2 && system.turns >= 8) {
    system.state = 'stagnant';
  } else {
    system.state = 'balanced';
  }
  if (previous !== system.state) {
    system.lastTransition = {
      from: previous,
      to: system.state,
      turn: system.turns,
    };
  }
}

export function shiftTension(system, delta) {
  const before = system.tension;
  system.tension = Math.min(10, Math.max(0, system.tension + delta));
  recalcSystemState(system);
  return {
    before,
    after: system.tension,
    direction: system.tension > before ? 'up' : system.tension < before ? 'down' : 'flat',
  };
}

export function tickSystem(system) {
  system.turns += 1;
  recalcSystemState(system);
}

export function interpretiveMessage(system) {
  if (system.state === 'chaotic') return 'There is a sense of growing friction; outcomes wobble before they land.';
  if (system.state === 'stagnant') return 'The room feels rigid, as though agreement hardened into habit.';
  return 'A coalition seems to hold the latest outcome in place.';
}

export function transitionMessage(system) {
  if (!system.lastTransition) return null;
  const { from, to } = system.lastTransition;
  if (to === 'chaotic') return `The institution slips from ${from} to chaos; even routine language sounds newly sharp.`;
  if (to === 'stagnant') return `Movement drains away: ${from} settles into stillness, polite and immovable.`;
  return `Some balance returns. The mood lifts from ${from} toward workable equilibrium.`;
}

export function tensionNarrative(before, after, systemState) {
  if (after === before) return null;
  if (after > before) {
    if (systemState === 'chaotic') return 'Friction compounds; even small remarks now land like demands.';
    return 'Pressure rises. People begin treating assumptions as territory.';
  }
  if (systemState === 'stagnant') return 'Tension dips, though so does initiative; calm and inertia blur.';
  return 'Pressure eases just enough for nuance to re-enter the room.';
}

export function derivePhaseSummary(system, committeeMemory) {
  const recent = committeeMemory.slice(0, 3);
  const accepted = recent.filter((line) => line.startsWith('accepted')).length;
  const rejected = recent.filter((line) => line.startsWith('rejected')).length;

  let phase = 'watchful equilibrium';
  if (system.tension >= 8 || rejected >= 2) {
    phase = 'contested escalation';
  } else if (system.tension <= 2 && recent.length >= 2) {
    phase = 'ceremonial stillness';
  } else if (accepted >= 2 && system.tension <= 5) {
    phase = 'pragmatic alignment';
  }

  if (phase !== system.currentPhase) {
    system.currentPhase = phase;
    system.phaseHistory.unshift(phase);
    system.phaseHistory = system.phaseHistory.slice(0, 5);
  }

  const gloss = {
    'watchful equilibrium': 'The committee moves carefully, as if testing each sentence for weight.',
    'contested escalation': 'Disagreement now sets the agenda; even silence feels partisan.',
    'ceremonial stillness': 'Procedure is smooth, perhaps too smooth, and novelty struggles to enter.',
    'pragmatic alignment': 'A working coalition holds, though nobody confuses it with unanimity.',
  }[phase];

  return `Phase: ${phase}. ${gloss}`;
}

function resolveActionChance(base, drift, rng, min, max) {
  const softenedDrift = drift / (1 + Math.abs(drift) * 2.2);
  const microSwing = (rng() - 0.5) * 0.06;
  return Math.max(min, Math.min(max, base + softenedDrift + microSwing));
}

function undertowLine(drift, rng, favoursText, resistsText) {
  if (Math.abs(drift) < 0.015 || rng() < 0.35) return null;
  return drift > 0 ? favoursText : resistsText;
}

export function mediate(system, drift = 0, rng = Math.random) {
  const baseChance = system.state === 'chaotic' ? 0.82 : 0.68;
  const chance = resolveActionChance(baseChance, drift, rng, 0.1, 0.9);
  const undertow = undertowLine(
    drift,
    rng,
    'A side glance suggests some people were already ready to meet you halfway.',
    'The tone is right, but familiarity blunts some of the invitation.',
  );
  const roll = rng();
  if (roll < chance) {
    const delta = shiftTension(system, -2);
    system.alignment += 1;
    system.recentRipples.unshift('A quiet side-conversation continues after your mediation.');
    system.recentRipples = system.recentRipples.slice(0, 4);
    return {
      ok: true,
      text: 'You mediate between blocs. Voices lower, and one knot loosens.',
      ripple: `${delta.direction === 'down'
        ? 'A few members now defer to form rather than personality.'
        : 'The room nods, though nobody is ready to call it harmony.'}${undertow ? ` ${undertow}` : ''}`,
    };
  }
  if (roll < chance + 0.25) {
    const delta = shiftTension(system, 0);
    system.recentRipples.unshift('People accept the lower register, but no one changes their footing yet.');
    system.recentRipples = system.recentRipples.slice(0, 4);
    return {
      ok: false,
      text: 'Your mediation steadies the tone, but positions mostly hold.',
      ripple: `${delta.direction === 'flat'
        ? 'There is less heat, but the same distance between positions.'
        : 'The room appears calmer without becoming more flexible.'}${undertow ? ` ${undertow}` : ''}`,
    };
  }
  const delta = shiftTension(system, 1);
  system.recentRipples.unshift('Two factions thank you and then resume disagreeing.');
  system.recentRipples = system.recentRipples.slice(0, 4);
  return {
    ok: false,
    text: 'Your mediation lands like choreography. Nobody objects, nobody yields.',
    ripple: `${delta.direction === 'up'
      ? 'By evening, your compromise is quoted by both sides, not quite the same way.'
      : 'It is unclear whether anything moved or merely looked busy.'}${undertow ? ` ${undertow}` : ''}`,
  };
}

export function challenge(system, drift = 0, rng = Math.random) {
  const baseChance = system.state === 'stagnant' ? 0.76 : 0.56;
  const chance = resolveActionChance(baseChance, drift, rng, 0.1, 0.9);
  const undertow = undertowLine(
    drift,
    rng,
    'The room had been waiting for someone to press the weak seam aloud.',
    'Several listeners seem unsurprised, as if they had rehearsed their resistance.',
  );
  const roll = rng();
  const unlocksMovement = roll < chance && rng() < (system.state === 'stagnant' ? 0.32 : 0.18);
  const delta = shiftTension(system, unlocksMovement ? -1 : 2);
  if (roll < chance) {
    system.alignment += 1;
    system.recentRipples.unshift('A reluctant coalition forms around your challenge, then denies it did.');
    system.recentRipples = system.recentRipples.slice(0, 4);
    return {
      ok: true,
      text: unlocksMovement
        ? 'You challenge assumptions directly; unexpectedly, the pressure breaks into movement.'
        : 'You challenge assumptions directly. The room bristles, then re-engages.',
      ripple: `${delta.direction === 'up'
        ? 'Energy rises; tomorrow may produce either progress or fresh stalemate.'
        : 'The challenge opens a narrow path; people move before they can re-argue first principles.'}${undertow ? ` ${undertow}` : ''}`,
    };
  }
  system.recentRipples.unshift('Your challenge becomes a cautionary anecdote in the corridor.');
  system.recentRipples = system.recentRipples.slice(0, 4);
  return {
    ok: false,
    text: 'You challenge too early; factions harden around old instincts.',
    ripple: `A few listeners seemed persuaded, but not enough to admit it publicly.${undertow ? ` ${undertow}` : ''}`,
  };
}

export function resetNormAttempt(system, drift = 0, rng = Math.random) {
  const base = 0.4 + system.alignment * 0.05;
  const modifier = system.state === 'chaotic' ? -0.15 : system.state === 'stagnant' ? -0.05 : 0.08;
  const chance = resolveActionChance(base + modifier, drift, rng, 0.1, 0.85);
  const undertow = undertowLine(
    drift,
    rng,
    'You sense small pockets of readiness before anyone commits out loud.',
    'The proposal sounds clear, but the room treats it like familiar weather.',
  );
  const ok = rng() < chance;
  const delta = shiftTension(system, ok ? -1 : 1);
  system.recentRipples.unshift(
    ok
      ? 'Clerks begin rewriting templates, though some keep the old copies.'
      : 'Nobody blocks the reset directly; it simply fails to take root.',
  );
  system.recentRipples = system.recentRipples.slice(0, 4);
  return {
    ok,
    text: ok
      ? 'A reset attempt succeeds. The committee accepts a new form, for now.'
      : 'The reset fails. The institution speaks of continuity while watching for drift.',
    ripple: `${delta.direction === 'down'
      ? 'Effects may arrive late: conduct often follows language by a step.'
      : 'The formal rule may stand, but practice appears to be waiting you out.'}${undertow ? ` ${undertow}` : ''}`,
  };
}
