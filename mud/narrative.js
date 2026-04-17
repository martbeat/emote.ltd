function pick(list, rng = Math.random) {
  return list[Math.floor(rng() * list.length)];
}

function ensureNarrativeInternals(narrative) {
  if (!Array.isArray(narrative.recentLines)) narrative.recentLines = [];
  if (!narrative.recentByCategory) narrative.recentByCategory = {};
  if (!Object.prototype.hasOwnProperty.call(narrative, 'lastSceneSignature')) narrative.lastSceneSignature = null;
  if (!narrative.context) {
    narrative.context = {
      lastVote: null,
      lastTensionDirection: null,
      lastIntervention: null,
    };
  }
}

function pickFresh(list, recent, rng = Math.random, window = 5) {
  const blocked = recent.slice(-window);
  const options = list.filter((line) => !blocked.includes(line));
  return pick(options.length ? options : list, rng);
}

function remember(narrative, text, category = 'general') {
  if (!text) return;
  ensureNarrativeInternals(narrative);
  narrative.recentLines.push(text);
  narrative.recentByCategory[category] = text;
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
  continuity: {
    tense: [
      'Porter: "That edge from a moment ago is still in the room."',
      'Porter: "You can feel the earlier strain lingering under the next sentence."',
    ],
    settled: [
      'Porter: "The room still carries that brief easing."',
      'Porter: "The calmer note from before has not fully left us yet."',
    ],
    accepted: [
      'Porter: "The last decision still frames how they listen now."',
      'Porter: "That acceptance has not become trust, but it has become context."',
    ],
    rejected: [
      'Porter: "The failed motion is still steering the conversation."',
      'Porter: "Rejection lingers; everyone now speaks around it."',
    ],
  },
};

const agentPositioning = {
  alignment: [
    'Ada and Cyra appear aligned, and Bernard signals assent with only a short nod.',
    'There is a sense that positions are converging; Cyra trims her mediation to brief clarifications.',
    'Agreement forms quietly, with Ada and Bernard borrowing each other\'s phrasing.',
  ],
  disagreement: [
    'Ada and Bernard seem further apart, and Cyra works sentence by sentence to keep a shared frame.',
    'Their positions no longer overlap; Bernard appears unconvinced by Ada\'s urgency.',
    'There is visible distance between them, with Cyra reframing conflict as timing rather than intent.',
  ],
  mediation: [
    'Cyra stands between them and recasts each objection into workable sequencing.',
    'Cyra appears to translate rather than decide, adjusting her framing to whoever just spoke.',
    'Cyra negotiates the space between positions, bridging disagreement without flattening it.',
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
  acceptedUnanimous: [
    'The proposal carries with a rare single voice.',
    'Agreement arrives without visible fracture.',
    'A unified front settles over the table, at least for this moment.',
  ],
  acceptedNarrow: [
    'The proposal passes on a thin edge of consent.',
    'A fragile coalition carries the motion across.',
    'It passes, though the room treats it as provisional.',
  ],
  rejectedStrong: [
    'The proposal is set aside with little appetite for revision.',
    'Resistance consolidates quickly and holds.',
    'The room closes around refusal.',
  ],
  rejectedContested: [
    'The proposal fails, but only after a close and unsettled exchange.',
    'Rejection lands narrowly and invites immediate second-guessing.',
    'It does not pass, yet nobody sounds fully certain of the refusal.',
  ],
  borderlineAmbiguity: [
    'Even now, several remarks sound like delayed votes rather than conclusions.',
    'The decision stands, but the tone suggests unfinished business.',
    'Procedure gives a result; conviction remains harder to locate.',
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
    'You let the sharp edges settle before anyone commits to them.',
    'The room exhales and keeps talking in a lower register.',
    'People adjust their tone without needing to admit it.',
  ],
  challenge: [
    'You push the idea forward and everyone has to answer it.',
    'The room tightens, then re-forms around the new pressure.',
    'Disagreement sparks, but it stays in the open.',
  ],
  reset: [
    'You shift the routine and watch who follows first.',
    'People keep moving, but on a slightly different track.',
    'The shared pattern changes by a small, visible degree.',
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

const ghostTraceTemplates = {
  movement: [
    'A few moments late, footsteps seem to pass where no one is now.',
    'You catch the tail end of movement, as if someone just rounded a corner.',
    'A doorframe holds the afterimage of someone having moved through it recently.',
  ],
  distantPresence: [
    'From somewhere deeper in the structure, a voice almost forms, then falls away.',
    'A faint rustle suggests activity several rooms off, never close enough to place.',
    'You sense someone nearby in the way silence keeps changing shape.',
  ],
  partialVisibility: [
    'At the edge of sight, a figure pauses, then is no longer there.',
    'For a second, someone is framed by a threshold, then swallowed by shadow.',
    'A shoulder, a turn, a vanishing line of motion—never enough to confirm.',
  ],
};

const ghostDirectionalTemplates = [
  'In an adjacent room, a figure crosses your view and disappears.',
  'Something moves just beyond the threshold, then leaves only still air.',
  'A silhouette seems to pass through the next space and dissolve into distance.',
  'You glimpse movement one room over; by the time you focus, it is gone.',
];

const ambientSneezeTemplates = {
  primary: [
    'Somewhere nearby, someone sneezes.',
    'A sneeze breaks the air from somewhere just out of sight.',
    'From another room, a quick sneeze echoes and fades.',
  ],
  porterReply: [
    'The porter, somewhere off to the side, answers: "Bless you."',
    'From nearby, the porter calls out a restrained "Bless you."',
  ],
  unknownReply: [
    'A voice responds: "Bless you."',
    'Someone answers from an uncertain distance: "Bless you."',
  ],
};

const ambientWorldTemplates = {
  movementTrace: [
    'Down the corridor, a figure passes between doorframes and is gone before the shape settles.',
    'A presence seems to cross a lit threshold, leaving only ordinary stillness behind it.',
    'At the far edge of the hall, movement folds into shadow before you can place who it was.',
  ],
  distantSound: [
    'Far off, footsteps gather and then scatter as if choosing another route.',
    'A door closes somewhere out of sight; the sound arrives late and thin.',
    'From deeper in the building, voices rise briefly and blur into distance.',
  ],
  socialEcho: [
    'A stray phrase drifts in from elsewhere — not enough to know who said it or why.',
    'Two sentences overlap in another room, then dissolve before any subject becomes clear.',
    'You catch the tail of a conversation fragment that could have belonged to anyone.',
  ],
  sneeze: [
    'From some uncertain room, a muffled sneeze interrupts the quiet and vanishes.',
    'A distant sneeze arrives through the passageways, then nothing follows it.',
  ],
};

export function createNarrativeState() {
  return {
    recentLines: [],
    recentByCategory: {},
    lastSceneSignature: null,
    context: {
      lastVote: null,
      lastTensionDirection: null,
      lastIntervention: null,
    },
  };
}

export function maybeGhostTraceNarrative(narrative, rng = Math.random, chance = 0.14) {
  ensureNarrativeInternals(narrative);
  if (rng() > chance) return null;
  const category = pick(['movement', 'distantPresence', 'partialVisibility'], rng);
  const line = pickFresh(ghostTraceTemplates[category], narrative.recentLines, rng, 8);
  remember(narrative, line, 'ghost');
  return line;
}

export function maybeDirectionalGhostGlimpse(narrative, rng = Math.random, chance = 0.14) {
  ensureNarrativeInternals(narrative);
  if (rng() > chance) return null;
  const line = pickFresh(ghostDirectionalTemplates, narrative.recentLines, rng, 8);
  remember(narrative, line, 'ghost-directional');
  return line;
}

export function maybeAmbientSneezeNarrative(context = {}, narrative, rng = Math.random, chance = 0.035) {
  ensureNarrativeInternals(narrative);
  if (rng() > chance) return [];
  const lines = [];
  const sneezeLine = pickFresh(ambientSneezeTemplates.primary, narrative.recentLines, rng, 8);
  remember(narrative, sneezeLine, 'ambient-sneeze');
  lines.push(sneezeLine);

  if (rng() > 0.42) return lines;
  const porterNearby = Boolean(context.porterNearby);
  const replyPool = porterNearby && rng() < 0.65
    ? ambientSneezeTemplates.porterReply
    : ambientSneezeTemplates.unknownReply;
  const reply = pickFresh(replyPool, narrative.recentLines, rng, 8);
  remember(narrative, reply, 'ambient-sneeze');
  lines.push(reply);
  return lines;
}

export function maybeAmbientWorldEvent(narrative, rng = Math.random, chance = 0.24) {
  ensureNarrativeInternals(narrative);
  if (rng() > chance) return null;

  const weightedTypes = ['movementTrace', 'movementTrace', 'distantSound', 'distantSound', 'socialEcho', 'socialEcho', 'sneeze'];
  const selectedType = pick(weightedTypes, rng);
  const line = pickFresh(ambientWorldTemplates[selectedType], narrative.recentLines, rng, 10);
  remember(narrative, line, 'ambient-world');
  return {
    line,
    delayed: rng() < 0.32,
  };
}

export function porterReflection(systemState, social, narrative, rng = Math.random) {
  ensureNarrativeInternals(narrative);
  const streak = social.repeatedCommandStreak;
  const recent = social.behaviouralLog.slice(-6);
  const challenges = recent.filter((v) => v === 'challenge').length;
  const mediations = recent.filter((v) => v === 'mediate').length;

  let pool = porterTemplates.general;
  const lastAction = recent[recent.length - 1];
  const context = narrative.context ?? {};

  if (context.lastTensionDirection === 'up' && rng() < 0.65) pool = porterTemplates.continuity.tense;
  else if (context.lastTensionDirection === 'down' && rng() < 0.55) pool = porterTemplates.continuity.settled;
  else if (context.lastVote === 'accepted' && rng() < 0.5) pool = porterTemplates.continuity.accepted;
  else if (context.lastVote === 'rejected' && rng() < 0.5) pool = porterTemplates.continuity.rejected;
  else if (streak.count >= 3 && streak.command === 'challenge') pool = porterTemplates.challenge;
  else if (streak.count >= 3 && streak.command === 'mediate') pool = porterTemplates.mediate;
  else if (lastAction === 'challenge' && systemState !== 'stagnant' && rng() < 0.5) pool = porterTemplates.challenge;
  else if (lastAction === 'mediate' && systemState !== 'chaotic' && rng() < 0.5) pool = porterTemplates.mediate;
  else if (challenges > 0 && mediations > 0 && Math.abs(challenges - mediations) <= 1) pool = porterTemplates.mixed;
  else if (rng() < 0.45) pool = porterTemplates.system[systemState];

  const line = pickFresh(pool, narrative.recentLines, rng, 5);
  remember(narrative, line, 'porter');
  return line;
}

export function positioningNarrative(kind, narrative, rng = Math.random) {
  ensureNarrativeInternals(narrative);
  const pool = agentPositioning[kind] ?? agentPositioning.unclear;
  const line = pickFresh(pool, narrative.recentLines, rng, 5);
  remember(narrative, line, 'positioning');
  return line;
}

export function atmosphereNarrative(systemState, narrative, rng = Math.random) {
  ensureNarrativeInternals(narrative);
  const pool = atmosphere[systemState];
  const continuity = {
    up: 'The same strain hangs in the air, sharper than before.',
    down: 'A residue of calm remains, though it feels conditional.',
  };
  const withContinuity =
    narrative.context?.lastTensionDirection && rng() < 0.35
      ? [...pool, continuity[narrative.context.lastTensionDirection]]
      : pool;
  const line = pickFresh(withContinuity, narrative.recentLines, rng, 5);
  remember(narrative, line, 'atmosphere');
  return line;
}

export function voteNarrative(ok, yesVotes, narrative, rng = Math.random) {
  ensureNarrativeInternals(narrative);
  const unanimous = yesVotes === 3;
  const narrowPass = ok && yesVotes === 2;
  const contestedFail = !ok && yesVotes === 1;
  const pool = ok
    ? (unanimous ? voteOutcomes.acceptedUnanimous : voteOutcomes.acceptedNarrow)
    : (contestedFail ? voteOutcomes.rejectedContested : voteOutcomes.rejectedStrong);
  const primary = pickFresh(pool, narrative.recentLines, rng, 5);
  remember(narrative, primary, 'vote');
  narrative.context.lastVote = ok ? 'accepted' : 'rejected';

  if (narrowPass || contestedFail) {
    const ambiguityLine = pickFresh(voteOutcomes.borderlineAmbiguity, narrative.recentLines, rng, 5);
    remember(narrative, ambiguityLine, 'vote');
    return `${primary} ${ambiguityLine}`;
  }

  return primary;
}

export function tensionShiftNarrative(before, after, narrative, rng = Math.random) {
  ensureNarrativeInternals(narrative);
  if (after === before) return null;
  const direction = after > before ? 'up' : 'down';
  const line = pickFresh(tensionTemplates[direction], narrative.recentLines, rng, 5);
  remember(narrative, line, 'tension');
  narrative.context.lastTensionDirection = direction;
  return line;
}

export function interventionNarrative(action, narrative, rng = Math.random) {
  ensureNarrativeInternals(narrative);
  const pool = intervention[action];
  if (!pool) return null;
  const line = pickFresh(pool, narrative.recentLines, rng, 5);
  remember(narrative, line, 'intervention');
  narrative.context.lastIntervention = action;
  return line;
}

export function phaseNarrative(system, committeeMemory, narrative, rng = Math.random) {
  ensureNarrativeInternals(narrative);
  const recent = committeeMemory.slice(0, 3);
  const accepted = recent.filter((line) => line.startsWith('accepted')).length;
  const rejected = recent.filter((line) => line.startsWith('rejected')).length;

  let key = 'managed';
  if (system.tension >= 8 || rejected >= 2) key = 'instability';
  else if (system.tension <= 2 && recent.length >= 2) key = 'stagnation';
  else if (accepted >= 2 && system.tension <= 5) key = 'emerging';

  const line = pickFresh(phaseTemplates[key], narrative.recentLines, rng, 5);
  remember(narrative, line, 'phase');
  return line;
}

export function maybeComposedScene(systemState, social, positioningKind, narrative, rng = Math.random) {
  ensureNarrativeInternals(narrative);
  if (rng() > 0.16) return [];

  let scene = [];
  for (let attempts = 0; attempts < 3; attempts += 1) {
    scene = [
      porterReflection(systemState, social, narrative, rng),
      positioningNarrative(positioningKind, narrative, rng),
      atmosphereNarrative(systemState, narrative, rng),
    ];
    const signature = scene.join(' | ');
    if (signature !== narrative.lastSceneSignature) {
      narrative.lastSceneSignature = signature;
      break;
    }
  }

  return scene;
}
