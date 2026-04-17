function porterTrustLabel(score) {
  if (score <= -2) return 'resistant';
  if (score >= 4) return 'cooperative';
  return 'watchful';
}

export function createAgents() {
  return {
    porter: {
      id: 'porter',
      name: 'Porter',
      roomId: 'hall',
      memory: [],
      trust: 0,
      attitude: 'watchful',
    },
    ada: {
      id: 'ada',
      name: 'Ada',
      roomId: 'hall',
      influence: 0.75,
      bias: 'change',
      relationship: 0,
    },
    bernard: {
      id: 'bernard',
      name: 'Bernard',
      roomId: 'eastCorridor',
      influence: 0.45,
      bias: 'stability',
      relationship: 0,
    },
    cyra: {
      id: 'cyra',
      name: 'Cyra',
      roomId: 'courtyard',
      influence: 0.6,
      bias: 'stability',
      relationship: 0,
    },
  };
}

const roamingRooms = {
  porter: ['hall', 'foyer', 'eastCorridor', 'courtyard', 'lockedRoom', 'westPassage'],
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
      balanced: 0.16,
      chaotic: 0.08,
      stagnant: 0.22,
    }[systemState] ?? 0.16;
  }

  return {
    balanced: 0.24,
    chaotic: 0.12,
    stagnant: 0.3,
  }[systemState] ?? 0.24;
}

export function moveAgents(agents, systemState, rng = Math.random) {
  Object.entries(roamingRooms).forEach(([agentId, route]) => {
    const agent = agents[agentId];
    if (!agent) return;

    const profile = agentId === 'porter' ? 'anchor' : 'mobile';
    const absentRoll = rng();
    if (absentRoll < absenceChance(systemState, profile)) {
      agent.roomId = null;
      return;
    }

    const baseMoveChance = profile === 'anchor' ? 0.45 : 0.6;
    if (!agent.roomId || rng() < baseMoveChance) {
      agent.roomId = pick(route, rng);
    }
  });
}

export function agentsInRoom(agents, roomId) {
  return Object.values(agents).filter((agent) => agent.roomId === roomId);
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
  return `${base} ${texture} ${pattern}`;
}

export function getInfluenceHint(agents) {
  if (agents.ada.influence > agents.bernard.influence) {
    return 'Ada reframes urgency as duty; Bernard often objects first, then borrows her wording.';
  }
  return 'Bernard asks one cautious question and the room slows to his tempo, including Ada.';
}

export function porterOutcomeReflection(system, governance, social) {
  const latestDecision = governance.committeeMemory[0];
  if (!latestDecision) {
    return "The porter says, 'Institutions reveal themselves most clearly after their first refusal.'";
  }

  const streak = social.repeatedCommandStreak;
  const patternNote =
    streak.count >= 3
      ? ` He adds, 'You again with ${streak.command}. Habits become signatures.'`
      : '';

  if (system.state === 'chaotic') {
    return `The porter says, 'In chaos, even agreement carries splinters.' ${patternNote}`.trim();
  }
  if (system.state === 'stagnant') {
    return `The porter says, 'Stagnation applauds every decision, then changes nothing.' ${patternNote}`.trim();
  }
  if (latestDecision.startsWith('accepted')) {
    return `The porter says, 'Accepted is not settled; watch what people do tomorrow.' ${patternNote}`.trim();
  }
  return `The porter says, 'Rejection can be a pause or a verdict. One only learns later.' ${patternNote}`.trim();
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
