export function createSystemState() {
  return {
    tension: 3,
    alignment: 0,
    turns: 0,
    state: 'balanced',
    lastTransition: null,
    recentRipples: [],
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
  if (system.state === 'stagnant') return 'The system feels rigid, as though agreement hardened into habit.';
  return 'A coalition seems to have stabilised the latest outcome.';
}

export function transitionMessage(system) {
  if (!system.lastTransition) return null;
  const { from, to } = system.lastTransition;
  if (to === 'chaotic') return `The institution slips from ${from} to chaos; even routine language sounds newly sharp.`;
  if (to === 'stagnant') return `Movement drains away: ${from} settles into stagnation, polite and immovable.`;
  return `Some balance returns. The mood lifts from ${from} toward workable equilibrium.`;
}

export function mediate(system, rng = Math.random) {
  const chance = system.state === 'chaotic' ? 0.75 : 0.55;
  if (rng() < chance) {
    const delta = shiftTension(system, -2);
    system.alignment += 1;
    system.recentRipples.unshift('A quiet side-conversation continues after your mediation.');
    system.recentRipples = system.recentRipples.slice(0, 4);
    return {
      ok: true,
      text: 'You mediate between blocs. Voices lower, and one procedural knot loosens.',
      ripple: delta.direction === 'down'
        ? 'A few members now defer to process rather than personality.'
        : 'The room nods, though nobody is ready to call it harmony.',
    };
  }
  const delta = shiftTension(system, 1);
  system.recentRipples.unshift('Two factions thank you and then resume disagreeing.');
  system.recentRipples = system.recentRipples.slice(0, 4);
  return {
    ok: false,
    text: 'Your mediation lands as choreography. Nobody objects, nobody yields.',
    ripple: delta.direction === 'up'
      ? 'By evening, your compromise is quoted selectively by both sides.'
      : 'It is unclear whether anything moved or merely looked busy.',
  };
}

export function challenge(system, rng = Math.random) {
  const chance = system.state === 'stagnant' ? 0.72 : 0.52;
  const delta = shiftTension(system, 2);
  if (rng() < chance) {
    system.alignment += 1;
    system.recentRipples.unshift('A reluctant coalition forms around your challenge, then denies it did.');
    system.recentRipples = system.recentRipples.slice(0, 4);
    return {
      ok: true,
      text: 'You challenge assumptions directly. The room bristles, then re-engages.',
      ripple: delta.direction === 'up'
        ? 'Energy rises; tomorrow may produce either progress or fresh stalemate.'
        : 'The challenge lands softly, which is somehow more unsettling.',
    };
  }
  system.recentRipples.unshift('Your challenge becomes a cautionary anecdote in the corridor.');
  system.recentRipples = system.recentRipples.slice(0, 4);
  return {
    ok: false,
    text: 'You challenge too early; factions harden around old instincts.',
    ripple: 'A few listeners seemed persuaded, but not enough to admit it publicly.',
  };
}

export function resetNormAttempt(system, rng = Math.random) {
  const base = 0.4 + system.alignment * 0.05;
  const modifier = system.state === 'chaotic' ? -0.15 : system.state === 'stagnant' ? -0.05 : 0.08;
  const chance = Math.max(0.1, Math.min(0.85, base + modifier));
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
      ? 'A reset attempt succeeds. The committee accepts procedural reconfiguration for now.'
      : 'The reset fails. The institution cites continuity while quietly fearing drift.',
    ripple:
      delta.direction === 'down'
        ? 'Expect delayed effects: behaviour often updates after language does.'
        : 'The formal rule may stand, but practice appears to be waiting you out.',
  };
}
