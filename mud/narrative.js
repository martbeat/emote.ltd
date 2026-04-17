function pick(list, rng = Math.random) {
  return list[Math.floor(rng() * list.length)];
}

function pickFresh(list, recent, rng = Math.random) {
  const options = list.filter((line) => !recent.includes(line));
  return pick(options.length ? options : list, rng);
}

function remember(narrative, text) {
  if (!text) return;
  narrative.recentLines.push(text);
  if (narrative.recentLines.length > 14) narrative.recentLines.shift();
}

const porterTemplates = {
  general: [
    'Porter: "Most arrive with intent. Fewer arrive with awareness."',
    'Porter: "You are not the first to try this."',
    'Porter: "It is rarely the action. It is the pattern."',
    'Porter: "You are beginning to leave a trace."',
  ],
  challenge: [
    'Porter: "You press forward, again and again."',
    'Porter: "Force has a rhythm. You seem to have found it."',
    'Porter: "You favour disruption."',
  ],
  mediate: [
    'Porter: "You smooth what others roughen."',
    'Porter: "You prefer balance to movement."',
    'Porter: "Not all tensions should be resolved."',
  ],
  mixed: [
    'Porter: "You adjust."',
    'Porter: "You do not just act. You respond."',
    'Porter: "Most never notice the difference."',
  ],
  system: {
    chaotic: [
      'Porter: "You are pushing too quickly."',
      'Porter: "The system is not keeping pace with you."',
      'Porter: "This rarely ends cleanly."',
    ],
    stagnant: [
      'Porter: "Nothing moves. That is also a decision."',
      'Porter: "You could push. Or you could wait."',
      'Porter: "Stillness can be mistaken for stability."',
    ],
    balanced: [
      'Porter: "For now, things hold."',
      'Porter: "You have not broken it."',
      'Porter: "It could go either way."',
    ],
  },
};

const agentPositioning = {
  alignment: [
    'Ada and Cyra appear aligned.',
    'There is a sense that positions are converging.',
    'Agreement forms quietly.',
  ],
  disagreement: [
    'Ada and Bernard seem further apart.',
    'Their positions no longer overlap.',
    'There is visible distance between them.',
  ],
  mediation: [
    'Cyra stands between them.',
    'Cyra appears to translate rather than decide.',
    'Cyra negotiates the space between positions.',
  ],
  unclear: [
    'No clear alignment emerges.',
    'Positions shift, but do not settle.',
    'The outcome remains difficult to read.',
  ],
};

const atmosphere = {
  balanced: [
    'The air feels active, but not strained.',
    'Things seem to move, but without urgency.',
    'There is a sense of quiet possibility.',
  ],
  chaotic: [
    'The air feels unsettled.',
    'Nothing quite lands.',
    'Voices seem to overlap, even when no one is speaking.',
  ],
  stagnant: [
    'The air feels still.',
    'Nothing seems to respond.',
    'Decisions echo without effect.',
  ],
};

const voteOutcomes = {
  acceptedClear: [
    'The proposal finds support.',
    'Agreement forms with little resistance.',
    'The system absorbs the change.',
  ],
  acceptedNarrow: [
    'The outcome is narrow.',
    'A small coalition carries the decision.',
    'It passes, but not cleanly.',
  ],
  rejectedClear: [
    'The proposal fails to gain traction.',
    'Resistance is immediate.',
    'It does not move.',
  ],
  rejectedAmbiguous: [
    'It falters before settling.',
    'There is movement, but not enough.',
    'The outcome remains unresolved, but leans toward rejection.',
  ],
};

const tensionTemplates = {
  up: [
    'There is a sense of growing friction.',
    'The system tightens.',
    'Something resists.',
  ],
  down: [
    'The pressure eases slightly.',
    'There is a sense of release.',
    'Things settle, for now.',
  ],
};

const intervention = {
  mediate: [
    'Positions soften.',
    'The edges blur slightly.',
    'Not everything needs to be pushed.',
  ],
  challenge: [
    'The room tightens.',
    'Something has been set in motion.',
    'There is a spark of disagreement.',
  ],
  reset: [
    'Something subtle shifts.',
    'It is not immediately clear what changed.',
    'The system reorients slightly.',
  ],
};

const phaseTemplates = {
  emerging: [
    'There is a sense of movement toward agreement.',
    'Things begin to cohere.',
    'Patterns start to repeat.',
  ],
  instability: [
    'The system feels unstable.',
    'Outcomes become harder to predict.',
    'Nothing quite settles.',
  ],
  stagnation: [
    'Nothing moves.',
    'The system resists change by default.',
    'Stillness becomes the dominant pattern.',
  ],
  managed: [
    'The tension is held, not resolved.',
    'There is strain, but also control.',
    'Things are being managed rather than changed.',
  ],
};

export function createNarrativeState() {
  return { recentLines: [] };
}

export function porterReflection(systemState, social, narrative, rng = Math.random) {
  const streak = social.repeatedCommandStreak;
  const recent = social.behaviouralLog.slice(-6);
  const challenges = recent.filter((v) => v === 'challenge').length;
  const mediations = recent.filter((v) => v === 'mediate').length;

  let pool = porterTemplates.general;
  if (streak.count >= 3 && streak.command === 'challenge') pool = porterTemplates.challenge;
  else if (streak.count >= 3 && streak.command === 'mediate') pool = porterTemplates.mediate;
  else if (challenges > 0 && mediations > 0 && Math.abs(challenges - mediations) <= 1) pool = porterTemplates.mixed;
  else if (rng() < 0.45) pool = porterTemplates.system[systemState];

  const line = pickFresh(pool, narrative.recentLines, rng);
  remember(narrative, line);
  return line;
}

export function positioningNarrative(kind, narrative, rng = Math.random) {
  const pool = agentPositioning[kind] ?? agentPositioning.unclear;
  const line = pickFresh(pool, narrative.recentLines, rng);
  remember(narrative, line);
  return line;
}

export function atmosphereNarrative(systemState, narrative, rng = Math.random) {
  const line = pickFresh(atmosphere[systemState], narrative.recentLines, rng);
  remember(narrative, line);
  return line;
}

export function voteNarrative(ok, yesVotes, narrative, rng = Math.random) {
  const pool = ok
    ? (yesVotes === 3 ? voteOutcomes.acceptedClear : voteOutcomes.acceptedNarrow)
    : (yesVotes <= 1 ? voteOutcomes.rejectedClear : voteOutcomes.rejectedAmbiguous);
  const line = pickFresh(pool, narrative.recentLines, rng);
  remember(narrative, line);
  return line;
}

export function tensionShiftNarrative(before, after, narrative, rng = Math.random) {
  if (after === before) return null;
  const line = pickFresh(after > before ? tensionTemplates.up : tensionTemplates.down, narrative.recentLines, rng);
  remember(narrative, line);
  return line;
}

export function interventionNarrative(action, narrative, rng = Math.random) {
  const pool = intervention[action];
  if (!pool) return null;
  const line = pickFresh(pool, narrative.recentLines, rng);
  remember(narrative, line);
  return line;
}

export function phaseNarrative(system, committeeMemory, narrative, rng = Math.random) {
  const recent = committeeMemory.slice(0, 3);
  const accepted = recent.filter((line) => line.startsWith('accepted')).length;
  const rejected = recent.filter((line) => line.startsWith('rejected')).length;

  let key = 'managed';
  if (system.tension >= 8 || rejected >= 2) key = 'instability';
  else if (system.tension <= 2 && recent.length >= 2) key = 'stagnation';
  else if (accepted >= 2 && system.tension <= 5) key = 'emerging';

  const line = pickFresh(phaseTemplates[key], narrative.recentLines, rng);
  remember(narrative, line);
  return line;
}

export function maybeComposedScene(systemState, social, positioningKind, narrative, rng = Math.random) {
  if (rng() > 0.2) return [];
  return [
    porterReflection(systemState, social, narrative, rng),
    positioningNarrative(positioningKind, narrative, rng),
    atmosphereNarrative(systemState, narrative, rng),
  ];
}
