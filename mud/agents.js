function porterTrustLabel(score) {
  if (score <= -2) return 'resistant';
  if (score >= 4) return 'cooperative';
  return 'watchful';
}

export function createAgents() {
  const baseMemorySignals = () => ({
    hello: 0,
    ask: 0,
    askRepeat: 0,
    insult: 0,
    physical: 0,
    gift: 0,
    help: 0,
    sneeze: 0,
    cough: 0,
    governancePush: 0,
    governanceCalm: 0,
    governancePropose: 0,
    bypassNorms: 0,
  });
  return {
    porter: {
      id: 'porter',
      name: 'Porter',
      roomId: 'foyer',
      memory: [],
      memorySignals: baseMemorySignals(),
      lastAskTopic: '',
      repeatedAskStreak: 0,
      trust: 0,
      cooperation: 0,
      attitude: 'watchful',
      turnsSinceSeen: 0,
      lastSeenRoom: 'foyer',
    },
    ada: {
      id: 'ada',
      name: 'Ada',
      roomId: 'hall',
      influence: 0.75,
      bias: 'change',
      relationship: 0,
      cooperation: 0,
      memorySignals: baseMemorySignals(),
      lastAskTopic: '',
      repeatedAskStreak: 0,
    },
    bernard: {
      id: 'bernard',
      name: 'Bernard',
      roomId: 'eastCorridor',
      influence: 0.45,
      bias: 'stability',
      relationship: 0,
      cooperation: 0,
      memorySignals: baseMemorySignals(),
      lastAskTopic: '',
      repeatedAskStreak: 0,
    },
    cyra: {
      id: 'cyra',
      name: 'Cyra',
      roomId: 'courtyard',
      influence: 0.6,
      bias: 'stability',
      relationship: 0,
      cooperation: 0,
      memorySignals: baseMemorySignals(),
      lastAskTopic: '',
      repeatedAskStreak: 0,
    },
  };
}

const interactionProfiles = {
  porter: {
    hello: [
      "The porter inclines his head. 'Good. We can proceed without theatre.'",
      "The porter says, 'Hello. Courtesy keeps hinges from squealing.'",
    ],
    ask: (topic) => `The porter considers. '${topic ? `On ${topic},` : 'On that,'} procedure reveals character faster than confession.'`,
    give: (item) => `The porter receives ${item} without hurry. 'Items move; obligations remain.'`,
    thank: [
      "The porter says, 'Gratitude is efficient. Keep it precise.'",
      "The porter nods once. 'Noted. Let's not canonise basic decency.'",
    ],
    insult: [
      "The porter lets the remark pass. 'Volume is not authority.'",
      "The porter says, 'You can mock me. The lock still reports to procedure.'",
    ],
    observe: [
      'The porter stands in practiced stillness, as if conserving conclusions.',
      "You notice the porter tracks exits more than faces. Habit, or philosophy.",
    ],
    physical: (kind) => `The porter steps back before you complete the ${kind}. 'Let's remain civil and ambulatory.'`,
  },
  ada: {
    hello: ["Ada smiles briefly. 'Good. Less ceremony, more momentum.'"],
    ask: (topic) => `Ada says, '${topic ? `${topic} is` : 'That is'} mostly timing disguised as principle.'`,
    give: (item) => `Ada takes ${item} and immediately asks what it enables next.`,
    thank: ["Ada says, 'You're welcome, but don't confuse help with agreement.'"],
    insult: ["Ada raises an eyebrow. 'If this is strategy, it lacks a second step.'"],
    observe: ['Ada paces half a step ahead of the room, rehearsing outcomes before anyone votes.'],
    physical: (kind) => `Ada avoids the ${kind} with irritated ease. 'Use words, unless you've misplaced them.'`,
  },
  bernard: {
    hello: ["Bernard nods. 'Hello. Let's keep assumptions labelled.'"],
    ask: (topic) => `Bernard says, '${topic ? `${topic} deserves` : 'It deserves'} slower claims and better evidence.'`,
    give: (item) => `Bernard accepts ${item} as though it might still be a test case.`,
    thank: ["Bernard says, 'Acknowledged. Appreciation is easier than accountability.'"],
    insult: ["Bernard exhales. 'Mockery is quick. Repair is slower.'"],
    observe: ['Bernard watches people finish speaking, then edits the room in quieter terms.'],
    physical: (kind) => `Bernard recoils from the ${kind}. 'Unnecessary. Also unhelpful.'`,
  },
  cyra: {
    hello: ["Cyra gives you a crooked smile. 'Hi. We can pretend this is simple.'"],
    ask: (topic) => `Cyra says, '${topic ? `${topic}?` : 'That?'} Depends who gets blamed when it works.'`,
    give: (item) => `Cyra pockets ${item} lightly. 'I'll call it a gift unless accounting objects.'`,
    thank: ["Cyra shrugs. 'Thanks accepted. Interest accrues as future favours.'"],
    insult: ["Cyra laughs once. 'Sharp. Not deep, but sharp.'"],
    observe: ['Cyra watches corners and conversations equally, as if both leak useful truth.'],
    physical: (kind) => `Cyra catches your wrist before the ${kind} lands. 'We said no combat systems, remember?'`,
  },
};

function profileLine(agentId, action, detail = '') {
  const profile = interactionProfiles[agentId] ?? interactionProfiles.porter;
  const entry = profile[action];
  if (typeof entry === 'function') return entry(detail);
  if (Array.isArray(entry)) return entry[Math.floor(Math.random() * entry.length)];
  return "They acknowledge you, but reserve interpretation.";
}

function memorySignal(agent, key) {
  return agent?.memorySignals?.[key] ?? 0;
}

function bumpSignal(agent, key, amount = 1) {
  if (!agent) return;
  if (!agent.memorySignals) agent.memorySignals = {};
  agent.memorySignals[key] = (agent.memorySignals[key] ?? 0) + amount;
}

function applyInteractionMemory(agent, action, detail = '') {
  if (!agent) return;
  if (action === 'hello') bumpSignal(agent, 'hello', 1);
  if (action === 'ask') {
    bumpSignal(agent, 'ask', 1);
    const topic = String(detail).trim().toLowerCase();
    if (topic && topic === agent.lastAskTopic) {
      agent.repeatedAskStreak = (agent.repeatedAskStreak ?? 0) + 1;
      bumpSignal(agent, 'askRepeat', 1);
    } else {
      agent.repeatedAskStreak = 0;
    }
    agent.lastAskTopic = topic;
  }
  if (action === 'insult') bumpSignal(agent, 'insult', 1.6);
  if (['poke', 'slap', 'kick'].includes(action)) bumpSignal(agent, 'physical', action === 'poke' ? 2 : 3.5);
  if (action === 'give') bumpSignal(agent, 'gift', 1.6);
}

function porterMemoryLine(agent, action, rng = Math.random) {
  if (!agent || rng() > 0.34) return null;
  const style = porterTrustLabel(agent.trust ?? 0);
  const repeatedHello = memorySignal(agent, 'hello');
  const repeatedAsk = memorySignal(agent, 'askRepeat');
  const insults = memorySignal(agent, 'insult');
  const physical = memorySignal(agent, 'physical');
  const gifts = memorySignal(agent, 'gift');
  const sneeze = memorySignal(agent, 'sneeze');
  const push = memorySignal(agent, 'governancePush');
  const calm = memorySignal(agent, 'governanceCalm');
  const bypass = memorySignal(agent, 'bypassNorms');

  if (physical >= 3 && rng() < 0.65) {
    return "He adds, 'We are apparently past formal greetings.'";
  }
  if (action === 'hello' && repeatedHello >= 2 && rng() < 0.7) {
    return style === 'resistant'
      ? "He says, 'We have already established your existence.'"
      : "He says, 'Yes. We have, in fact, met.'";
  }
  if (action === 'ask' && repeatedAsk >= 1 && rng() < 0.75) {
    return "He says, 'You asked that already.'";
  }
  if (action === 'insult' && insults >= 1.5 && rng() < 0.8) {
    return "He says, 'You remain committed to style over usefulness.'";
  }
  if (action === 'give' && gifts >= 1.5 && rng() < 0.8) {
    return "He nods once. 'That was noticed.'";
  }
  if (sneeze >= 2 && rng() < 0.45) {
    return "He says, 'Yes, still blessed.'";
  }
  if (push >= 3 && rng() < 0.65) {
    return "He says, 'I notice you prefer doors that open before agreement arrives.'";
  }
  if (calm >= 3 && calm > push && rng() < 0.55) {
    return "He observes, 'You keep trying to cool rooms that prefer friction.'";
  }
  if (bypass >= 2 && rng() < 0.68) {
    return "He says, 'You continue to negotiate with outcomes before terms.'";
  }
  return null;
}

function porterToneSuffix(agent, rng = Math.random) {
  if (!agent || rng() > 0.36) return null;
  const style = porterTrustLabel(agent.trust ?? 0);
  if (style === 'resistant') return 'His tone is clipped, transactional, and done early.';
  if (style === 'cooperative') return 'His tone softens by a degree, practical rather than ceremonial.';
  return 'His tone stays neutral, as if filing your presence beside procedure.';
}

function adjustCooperation(agent, delta) {
  if (!agent) return;
  agent.cooperation = (agent.cooperation ?? 0) + delta;
}

const interactionEffects = {
  porter: {
    hello: { relationship: 1, cooperation: 1, trust: 1 },
    ask: { relationship: 1, cooperation: 1, trust: 1 },
    give: { relationship: 2, cooperation: 2, trust: 2 },
    thank: { relationship: 1, cooperation: 1, trust: 1 },
    insult: { relationship: -2, cooperation: -2, trust: -2 },
    observe: { relationship: 0, cooperation: 0, trust: 0 },
    poke: { relationship: -2, cooperation: -2, trust: -3 },
    slap: { relationship: -4, cooperation: -4, trust: -5 },
    kick: { relationship: -4, cooperation: -4, trust: -5 },
  },
  ada: {
    hello: { relationship: 1, cooperation: 1, trust: 0 },
    ask: { relationship: 1, cooperation: 1, trust: 0 },
    give: { relationship: 2, cooperation: 2, trust: 0 },
    thank: { relationship: 1, cooperation: 1, trust: 0 },
    insult: { relationship: -2, cooperation: -2, trust: 0 },
    observe: { relationship: 0, cooperation: 0, trust: 0 },
    poke: { relationship: -2, cooperation: -2, trust: 0 },
    slap: { relationship: -4, cooperation: -3, trust: 0 },
    kick: { relationship: -4, cooperation: -3, trust: 0 },
  },
  bernard: {
    hello: { relationship: 1, cooperation: 1, trust: 0 },
    ask: { relationship: 2, cooperation: 1, trust: 0 },
    give: { relationship: 1, cooperation: 2, trust: 0 },
    thank: { relationship: 1, cooperation: 1, trust: 0 },
    insult: { relationship: -2, cooperation: -2, trust: 0 },
    observe: { relationship: 0, cooperation: 0, trust: 0 },
    poke: { relationship: -2, cooperation: -2, trust: 0 },
    slap: { relationship: -4, cooperation: -4, trust: 0 },
    kick: { relationship: -4, cooperation: -4, trust: 0 },
  },
  cyra: {
    hello: { relationship: 1, cooperation: 1, trust: 0 },
    ask: { relationship: 1, cooperation: 1, trust: 0 },
    give: { relationship: 1, cooperation: 2, trust: 0 },
    thank: { relationship: 1, cooperation: 1, trust: 0 },
    insult: { relationship: -1, cooperation: -2, trust: 0 },
    observe: { relationship: 0, cooperation: 0, trust: 0 },
    poke: { relationship: -2, cooperation: -2, trust: 0 },
    slap: { relationship: -5, cooperation: -4, trust: 0 },
    kick: { relationship: -5, cooperation: -4, trust: 0 },
  },
};

export function interpretAgentInteraction(agents, social, payload) {
  const {
    targetId,
    action,
    topic = '',
    item = '',
  } = payload;

  const agent = agents[targetId];
  if (!agent) {
    return { ok: false, text: 'Nobody by that name answers here.', css: 'warn' };
  }

  const effects = interactionEffects[targetId]?.[action]
    ?? interactionEffects.porter[action]
    ?? { relationship: 0, cooperation: 0, trust: 0 };

  applyInteractionShift(social, targetId, effects.relationship);
  adjustCooperation(agent, effects.cooperation);
  if (targetId === 'porter') shiftPorterTrust(agents, effects.trust);
  applyInteractionMemory(agent, action, action === 'ask' ? topic : item);

  const styleAction = ['poke', 'slap', 'kick'].includes(action) ? 'physical' : action;
  const detail = styleAction === 'ask' ? topic : styleAction === 'physical' ? action : item;
  const response = profileLine(targetId, styleAction, detail);
  const memoryLine = targetId === 'porter' ? porterMemoryLine(agent, action) : null;
  const toneLine = targetId === 'porter' ? porterToneSuffix(agent) : null;
  const relationship = social.relationships[targetId] ?? 0;
  const posture = relationship >= 4
    ? 'They seem readier to cooperate with you now.'
    : relationship <= -3
      ? 'Future cooperation from them now feels less likely.'
      : 'The relationship shifts by a quiet degree.';

  return {
    ok: true,
    text: [response, memoryLine, toneLine, posture].filter(Boolean).join(' '),
    css: ['insult', 'poke', 'slap', 'kick'].includes(action) ? 'danger' : 'hint',
  };
}

function applyInteractionShift(social, targetId, delta) {
  social.relationships[targetId] = (social.relationships[targetId] ?? 0) + delta;
}

const roamingRooms = {
  porter: ['hall', 'foyer', 'eastCorridor', 'courtyard', 'lockedRoom', 'westPassage', 'quadrangle', 'stairwell', 'archive'],
  ada: ['hall', 'eastCorridor', 'lockedRoom', 'gallery', 'upperLanding'],
  bernard: ['hall', 'eastCorridor', 'archive', 'upperLanding', 'gallery'],
  cyra: ['hall', 'foyer', 'courtyard', 'eastCorridor', 'garden', 'westPassage'],
};

function pick(list, rng = Math.random) {
  return list[Math.floor(rng() * list.length)];
}

function absenceChance(systemState, profile) {
  if (profile === 'anchor') {
    return {
      balanced: 0.2,
      chaotic: 0.08,
      stagnant: 0.25,
    }[systemState] ?? 0.2;
  }

  return {
    balanced: 0.16,
    chaotic: 0.08,
    stagnant: 0.2,
  }[systemState] ?? 0.16;
}

export function moveAgents(agents, systemState, rng = Math.random) {
  const previousRooms = Object.fromEntries(
    Object.entries(agents).map(([agentId, agent]) => [agentId, agent?.roomId ?? null]),
  );

  Object.entries(roamingRooms).forEach(([agentId, route]) => {
    const agent = agents[agentId];
    if (!agent) return;

    const profile = agentId === 'porter' ? 'anchor' : 'mobile';
    const absentRoll = rng();
    if (absentRoll < absenceChance(systemState, profile)) {
      agent.roomId = null;
      return;
    }

    const baseMoveChance = profile === 'anchor' ? 0.18 : 0.66;
    const returnFromAbsenceChance = profile === 'anchor' ? 0.35 : 0.8;
    if (!agent.roomId) {
      if (rng() < returnFromAbsenceChance) {
        agent.roomId = pick(route, rng);
      }
      return;
    }

    if (rng() < baseMoveChance) {
      const alternatives = route.filter((roomId) => roomId !== agent.roomId);
      agent.roomId = pick(alternatives.length ? alternatives : route, rng);
    }
  });

  return previousRooms;
}

export function agentsInRoom(agents, roomId) {
  return Object.values(agents).filter((agent) => agent.roomId === roomId);
}

export function updatePorterVisibility(agents, playerRoomId) {
  const porter = agents.porter;
  if (!porter) return;
  if (porter.roomId && porter.roomId === playerRoomId) {
    porter.turnsSinceSeen = 0;
    porter.lastSeenRoom = playerRoomId;
    return;
  }
  porter.turnsSinceSeen = (porter.turnsSinceSeen ?? 0) + 1;
}

const agentLabel = {
  porter: 'the porter',
  ada: 'Ada',
  bernard: 'Bernard',
  cyra: 'Cyra',
};

const arrivalVerbs = {
  porter: ['arrives with measured steps', 'appears at the edge of the room'],
  ada: ['arrives quietly', 'joins you without ceremony'],
  bernard: ['enters without comment', 'steps in, scanning the room once'],
  cyra: ['joins you from nearby', 'appears with an easy, unreadable pace'],
};

const departureVerbs = {
  porter: ['heads on without fanfare', 'slips away toward other duties'],
  ada: ['leaves without lingering', 'steps away before the room settles'],
  bernard: ['leaves without comment', 'moves off with clipped purpose'],
  cyra: ['drifts out of sight', 'heads off before anyone calls after her'],
};

const nearMissLines = {
  porter: [
    'You catch sight of the porter disappearing down a side corridor.',
    'A familiar coat passes a doorway and is gone before you focus.',
  ],
  generic: [
    'Someone has just moved on; the room still feels recently occupied.',
    'A quick movement nearby fades before it resolves into a face.',
    'At the edge of your vision, someone turns a corner and vanishes.',
  ],
};

function titleCaseRoom(roomId = '') {
  if (!roomId) return 'nearby';
  return roomId
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .toLowerCase();
}

function maybePresenceContinuityLine(agents, previousRooms, playerRoomId, rng = Math.random) {
  if (!playerRoomId) return null;

  const arrivals = [];
  const departures = [];
  const nearMisses = [];

  Object.entries(previousRooms).forEach(([agentId, fromRoom]) => {
    const toRoom = agents[agentId]?.roomId ?? null;
    if (fromRoom === toRoom) return;

    if (fromRoom !== playerRoomId && toRoom === playerRoomId) arrivals.push(agentId);
    if (fromRoom === playerRoomId && toRoom !== playerRoomId) departures.push(agentId);

    const porterLastSeen = agents.porter?.lastSeenRoom;
    if (agentId === 'porter' && fromRoom && fromRoom === porterLastSeen && toRoom !== playerRoomId) {
      nearMisses.push('porter');
      return;
    }

    if (fromRoom !== playerRoomId && toRoom !== playerRoomId && rng() < 0.18) {
      nearMisses.push(agentId);
    }
  });

  if (arrivals.length && rng() < 0.6) {
    const agentId = pick(arrivals, rng);
    const subject = agentLabel[agentId] ?? 'Someone';
    const roomHint = playerRoomId === 'hall' ? 'from the stairwell' : `from the ${titleCaseRoom(previousRooms[agentId])}`;
    const verb = pick(arrivalVerbs[agentId] ?? arrivalVerbs.ada, rng);
    return `${subject} ${verb} ${roomHint}.`;
  }

  if (departures.length && rng() < 0.52) {
    const agentId = pick(departures, rng);
    const subject = agentLabel[agentId] ?? 'Someone';
    const verb = pick(departureVerbs[agentId] ?? departureVerbs.bernard, rng);
    return `${subject} ${verb}.`;
  }

  if (nearMisses.length && rng() < 0.26) {
    const agentId = pick(nearMisses, rng);
    if (agentId === 'porter') return pick(nearMissLines.porter, rng);
    return pick(nearMissLines.generic, rng);
  }

  return null;
}

export function narrateAgentContinuity(agents, previousRooms, playerRoomId, rng = Math.random) {
  return maybePresenceContinuityLine(agents, previousRooms, playerRoomId, rng);
}

export function maybePorterAbsenceLine(agents, rng = Math.random) {
  const turns = agents?.porter?.turnsSinceSeen ?? 0;
  if (turns < 4) return null;
  const chance = Math.min(0.28, 0.08 + (turns - 3) * 0.04);
  if (rng() >= chance) return null;
  return pick([
    'You notice the institution has been functioning for a while without the porter in sight.',
    'The porter remains unseen; routine carries on in his absence.',
    'No sign of the porter lately. Procedures continue, quieter but intact.',
  ], rng);
}

export function recordPorterMemory(agents, event) {
  const porter = agents.porter;
  porter.memory.push(event);
  if (porter.memory.length > 8) porter.memory.shift();
}

export function shiftPorterTrust(agents, delta) {
  const porter = agents.porter;
  porter.trust += delta;
  porter.attitude = porterTrustLabel(porter.trust);
}

const memoryDecayRates = {
  hello: 0.34,
  ask: 0.28,
  askRepeat: 0.2,
  insult: 0.1,
  physical: 0.07,
  gift: 0.08,
  help: 0.09,
  sneeze: 0.18,
  cough: 0.18,
  governancePush: 0.09,
  governanceCalm: 0.1,
  governancePropose: 0.11,
  bypassNorms: 0.08,
};

export function decayAgentMemories(agents) {
  Object.values(agents ?? {}).forEach((agent) => {
    if (!agent?.memorySignals) return;
    Object.entries(memoryDecayRates).forEach(([key, rate]) => {
      const current = agent.memorySignals[key] ?? 0;
      if (current <= 0) return;
      agent.memorySignals[key] = Math.max(0, current - rate);
    });
  });
}

export function notePorterGovernancePattern(agents, pattern) {
  const porter = agents?.porter;
  if (!porter) return;
  if (pattern === 'push') bumpSignal(porter, 'governancePush', 1.2);
  if (pattern === 'calm') bumpSignal(porter, 'governanceCalm', 1);
  if (pattern === 'propose') bumpSignal(porter, 'governancePropose', 1);
  if (pattern === 'bypass') bumpSignal(porter, 'bypassNorms', 1.4);
}

export function notePorterSocialMemory(agents, kind, amount = 1) {
  const porter = agents?.porter;
  if (!porter) return;
  if (kind === 'sneeze') bumpSignal(porter, 'sneeze', amount);
  if (kind === 'cough') bumpSignal(porter, 'cough', amount);
  if (kind === 'help') bumpSignal(porter, 'help', amount);
  if (kind === 'gift') bumpSignal(porter, 'gift', amount);
}

function inferPattern(social) {
  const recent = social.behaviouralLog.slice(-6);
  const challenges = recent.filter((s) => s === 'challenge').length;
  const mediations = recent.filter((s) => s === 'mediate').length;
  const proposals = recent.filter((s) => s === 'propose').length;
  if (proposals >= 3) return "The porter adds, 'You keep returning to the table. Persistence has a smell.'";
  if (challenges > mediations + 1) return "The porter says, 'You strike flint often. Useful, if one likes sparks.'";
  if (mediations > challenges + 1) return "The porter says, 'You mend seams even when cloth is still tearing.'";
  return "The porter says, 'You're still deciding whether to steer the room or outlast it.'";
}

export function talkToPorter(agents, systemState, social) {
  const porter = agents.porter;
  if (!porter?.roomId) return null;
  const base = {
    resistant:
      "The porter says, 'Procedure exists because panic is fast and memory is slow.'",
    watchful:
      "The porter says, 'Most locks are social first, mechanical second.'",
    cooperative:
      "The porter says, 'You have learned to knock before reforming the hinges. Rare.'",
  }[porter.attitude];

  const texture = {
    balanced: 'He sounds almost amused by the temporary coherence.',
    chaotic: 'He speaks over distant arguments and does not raise his voice.',
    stagnant: 'He pauses, as if waiting for initiative to wake up on its own.',
  }[systemState];

  const pattern = inferPattern(social);
  const patternMemory = porterMemoryLine(porter, 'talk', Math.random);
  const tone = porterToneSuffix(porter, Math.random);
  return [base, texture, pattern, patternMemory, tone].filter(Boolean).join(' ');
}

export function getInfluenceHint(agents) {
  if (agents.ada.influence > agents.bernard.influence) {
    return 'Ada reframes urgency as duty; Bernard often objects first, then borrows her wording.';
  }
  return 'Bernard asks one cautious question and the room slows to his tempo, including Ada.';
}

export function porterOutcomeReflection(system, governance, social) {
  if (!system?.porterPresent) return null;
  const latestDecision = governance.committeeMemory[0];
  if (!latestDecision) {
    return "The porter says, 'Institutions reveal themselves most clearly after their first refusal.'";
  }

  const streak = social.repeatedCommandStreak;
  const patternNote =
    streak.count >= 3
      ? ` He adds, 'You again with ${streak.command}. Habits become signatures.'`
      : '';
  const porterMemory = system?.porterSignals ?? social?.porterSignals ?? null;
  const signature = porterMemory?.governancePush >= 3 && (porterMemory.governancePush > (porterMemory.governanceCalm ?? 0))
    ? " He adds, 'Pressure is becoming your preferred punctuation.'"
    : '';

  if (system.state === 'chaotic') {
    return `The porter says, 'In chaos, even agreement carries splinters.' ${patternNote}${signature}`.trim();
  }
  if (system.state === 'stagnant') {
    return `The porter says, 'Stagnation applauds every decision, then changes nothing.' ${patternNote}${signature}`.trim();
  }
  if (latestDecision.startsWith('accepted')) {
    return `The porter says, 'Accepted is not settled; watch what people do tomorrow.' ${patternNote}${signature}`.trim();
  }
  return `The porter says, 'Rejection can be a pause or a verdict. One only learns later.' ${patternNote}${signature}`.trim();
}

export function porterSneezeResponse(agents, social, rng = Math.random) {
  const porter = agents?.porter;
  if (!porter?.roomId) return null;
  if (rng() >= 0.12) return null;

  const repetition = social?.sneezeCount ?? 0;
  if (repetition >= 4 && rng() < 0.65) {
    return pick([
      'The porter says, "Bless you, again. At this point it sounds procedural."',
      'The porter nods. "Still sneezing. Still noted."',
      'The porter mutters, "Bless you. We may need to classify this as a recurring event."',
    ], rng);
  }

  return pick([
    'The porter says, "Bless you."',
    'The porter lifts two fingers in acknowledgment and says, "Bless."',
    'Without looking up, the porter says, "Good health, if available."',
    'The porter says, "Bless you," then returns to watching the room.',
  ], rng);
}

function behaviouralMemoryCue(social) {
  const recent = social.behaviouralLog.slice(-6);
  if (!recent.length) return null;
  const challenges = recent.filter((label) => label === 'challenge').length;
  const mediations = recent.filter((label) => label === 'mediate').length;
  if (challenges >= 3 && challenges > mediations + 1) {
    return "Cyra notes, 'You tend to challenge first, then negotiate the aftermath.'";
  }
  if (mediations >= 3 && mediations > challenges + 1) {
    return "Bernard says, 'You smooth things over before anyone names the cost.'";
  }
  return null;
}

function alignmentBand(alignmentScore = 0) {
  if (alignmentScore >= 3) return 'high';
  if (alignmentScore <= 0) return 'low';
  return 'mid';
}

export function agentExchangeHint(systemState, governance, social, alignmentScore = 0) {
  const band = alignmentBand(alignmentScore);
  const memoryCue = behaviouralMemoryCue(social);
  const latest = governance.committeeMemory[0] ?? '';
  if (band === 'high') {
    const subtle = [
      'Ada glances toward Bernard; he gives a brief nod, and Cyra quietly reframes the shared point as procedure.',
      'Bernard answers in half-sentences because Ada is already finishing them; Cyra only adjusts tone, not direction.',
      'Cyra paraphrases once, and both Ada and Bernard accept it without reopening the argument.',
    ];
    return memoryCue && latest.startsWith('accepted')
      ? `${subtle[0]} ${memoryCue}`
      : subtle[Math.floor(Math.random() * subtle.length)];
  }

  if (band === 'low') {
    const contrast = [
      'Ada leans in before Bernard finishes; Bernard appears unconvinced and restates every premise while Cyra threads a narrower middle path.',
      'Bernard challenges Ada line by line; Ada answers faster than he approves, and Cyra keeps recasting both positions into shared risks.',
      'Ada glances toward Bernard before responding, then rejects his caution outright; Cyra reframes the clash as timing rather than principle.',
    ];
    if (memoryCue) return `${contrast[Math.floor(Math.random() * contrast.length)]} ${memoryCue}`;
    return contrast[Math.floor(Math.random() * contrast.length)];
  }

  if (systemState === 'chaotic') {
    return memoryCue
      ? `Ada cuts in before Bernard finishes; Bernard hesitates, unconvinced, and Cyra translates both readings into a temporary bridge. ${memoryCue}`
      : 'Ada cuts in before Bernard finishes; Bernard hesitates, unconvinced, and Cyra translates both readings into a temporary bridge.';
  }
  if (systemState === 'stagnant') {
    return "Bernard and Cyra agree on caution so quickly that Ada's objections sound almost ceremonial; Cyra reframes Ada's urgency as sequencing rather than rebellion.";
  }
  if (latest.startsWith('accepted')) {
    return "Ada thanks Cyra for 'pragmatism'; Bernard calls it 'temporary pragmatism,' then accepts Cyra's bridge without further contest.";
  }
  if (latest.startsWith('rejected')) {
    return 'Bernard and Ada disagree openly, but both quote Cyra\'s phrasing as if it were neutral ground while she reframes the dispute around scope.';
  }
  return memoryCue
    ? `Ada and Bernard circle the same issue from opposite directions while Cyra translates between them. ${memoryCue}`
    : 'Ada and Bernard circle the same issue from opposite directions while Cyra translates between them.';
}
