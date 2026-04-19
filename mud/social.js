import {
  porterSneezeResponse,
  recordPorterMemory,
  shiftPorterTrust,
  notePorterSocialMemory,
} from './agents.js';

export function createSocialState() {
  return {
    relationships: {
      porter: 0,
      ada: 0,
      bernard: 0,
      cyra: 0,
    },
    playerCold: false,
    turnsUntilSneezeCheck: 2,
    sneezeCount: 0,
    behaviouralLog: [],
    repeatedCommandStreak: {
      command: null,
      count: 0,
    },
    porterSignals: {},
  };
}

export function applyRelationship(social, target, delta) {
  social.relationships[target] = (social.relationships[target] ?? 0) + delta;
}

export function logBehaviour(social, label) {
  if (social.repeatedCommandStreak.command === label) {
    social.repeatedCommandStreak.count += 1;
  } else {
    social.repeatedCommandStreak.command = label;
    social.repeatedCommandStreak.count = 1;
  }
  social.behaviouralLog.push(label);
  if (social.behaviouralLog.length > 20) social.behaviouralLog.shift();
}

export function behaviourEcho(social) {
  const { command, count } = social.repeatedCommandStreak;
  if (!command || count < 3) return null;
  if (command === 'challenge') return 'You keep to challenge; resistance arrives faster, and so does attention.';
  if (command === 'mediate') return 'You keep to mediation; comfort rises, along with quiet skepticism.';
  if (command === 'propose') return 'You return to proposals with ritual regularity; the room begins to anticipate your cadence.';
  return null;
}

export function behaviouralDrift(social, action, rng = Math.random) {
  const streak = social.repeatedCommandStreak;
  if (streak.command !== action || streak.count < 2) {
    return { modifier: 0, hint: null };
  }

  const repetitionDepth = streak.count - 1;
  const softDecay = 1 / (1 + Math.max(0, repetitionDepth - 1) * 0.55);
  const baseByAction = {
    mediate: 0.07,
    challenge: 0.05,
    reset: 0.04,
  };
  const base = baseByAction[action] ?? 0;
  const organicNoise = (rng() - 0.5) * 0.03;
  let modifier = base * softDecay + organicNoise;

  if (streak.count >= 5) {
    const fatigueChance = Math.min(0.45, (streak.count - 4) * 0.12);
    if (rng() < fatigueChance) {
      modifier -= 0.02 + rng() * 0.03;
    }
  }

  modifier = Math.max(-0.06, Math.min(0.1, modifier));
  if (Math.abs(modifier) < 0.01) {
    return {
      modifier,
      hint: 'The room takes your familiar move in stride, without showing its hand.',
    };
  }

  if (action === 'mediate') {
    return {
      modifier,
      hint:
        modifier > 0
          ? 'Your cadence feels known now; some shoulders loosen before you finish.'
          : 'Polite nods arrive a beat early, as if comfort is replacing conviction.',
    };
  }

  if (action === 'challenge') {
    return {
      modifier,
      hint:
        modifier > 0
          ? 'A few members tense in advance; anticipation does some of your work.'
          : 'The challenge lands on prepared ground, and surprise is harder to borrow.',
    };
  }

  if (action === 'reset') {
    return {
      modifier,
      hint:
        modifier > 0
          ? 'The language of reset still carries a trace of freshness in the room.'
          : 'The reset arrives with familiar ceremony; attention drifts to implementation.',
    };
  }

  return { modifier, hint: null };
}

export function maybeTriggerCold(social, rng = Math.random) {
  if (social.playerCold) return null;
  if (rng() < 0.03) {
    social.playerCold = true;
    social.turnsUntilSneezeCheck = 4 + Math.floor(rng() * 2);
    return 'A scratchy chill settles in your throat. You may be coming down with something.';
  }
  return null;
}

export function maybeSneeze(social, agents, playerRoomId, rng = Math.random) {
  if (!social.playerCold) return null;
  social.turnsUntilSneezeCheck -= 1;
  if (social.turnsUntilSneezeCheck > 0) return null;
  social.turnsUntilSneezeCheck = 5 + Math.floor(rng() * 4);
  social.sneezeCount += 1;
  const porterPresent = agents?.porter?.roomId && agents.porter.roomId === playerRoomId;
  const porterReply = porterPresent ? porterSneezeResponse(agents, social, rng) : null;

  if (porterReply) {
    applyRelationship(social, 'porter', 1);
    shiftPorterTrust(agents, 1);
    notePorterSocialMemory(agents, 'sneeze', 1);
    recordPorterMemory(agents, 'Player sneezed; porter acknowledged with ritual courtesy.');
    return `You sneeze. ${porterReply}`;
  }

  return 'You sneeze. The sound dissipates without ceremony.';
}

export function inferIdentity(social, system) {
  const tags = [];
  const recent = social.behaviouralLog;
  const challengeCount = recent.filter((item) => item === 'challenge').length;
  const mediateCount = recent.filter((item) => item === 'mediate').length;

  if (challengeCount > mediateCount + 1) tags.push('aligned with change');
  if (mediateCount > challengeCount + 1) tags.push('aligned with stability');
  if (system.tension >= 7) tags.push('under pressure');
  if (recent.slice(-6).filter((v) => v === 'propose').length >= 3) tags.push('persistent');
  if (!tags.length) tags.push('still forming');

  return `A shape emerges: ${tags.join(', ')}.`;
}
