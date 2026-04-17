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
      influence: 0.75,
      bias: 'change',
      relationship: 0,
    },
    bernard: {
      id: 'bernard',
      name: 'Bernard',
      influence: 0.45,
      bias: 'stability',
      relationship: 0,
    },
    cyra: {
      id: 'cyra',
      name: 'Cyra',
      influence: 0.6,
      bias: 'stability',
      relationship: 0,
    },
  };
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
