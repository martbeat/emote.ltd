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

export function talkToPorter(agents, systemState) {
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
    balanced: 'He sounds almost amused.',
    chaotic: 'He speaks over distant arguments and does not raise his voice.',
    stagnant: 'He pauses, as if waiting for initiative to wake up.',
  }[systemState];

  return `${base} ${texture}`;
}

export function getInfluenceHint(agents) {
  if (agents.ada.influence > agents.bernard.influence) {
    return 'Ada seems to sway Bernard when urgency enters the room.';
  }
  return 'Bernard quietly anchors Ada whenever risk is discussed.';
}
