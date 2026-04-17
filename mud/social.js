import { recordPorterMemory, shiftPorterTrust } from './agents.js';

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

export function behaviouralDrift(social, action) {
  const streak = social.repeatedCommandStreak;
  if (streak.command !== action || streak.count < 2) {
    return { modifier: 0, hint: null };
  }

  if (action === 'mediate') {
    if (streak.count >= 4) {
      return {
        modifier: -0.08,
        hint: 'Your mediation grows familiar; agreement arrives more slowly.',
      };
    }
    return {
      modifier: 0.05,
      hint: 'For now, repetition helps; people recognise your calming pattern.',
    };
  }

  if (action === 'challenge') {
    if (streak.count >= 4) {
      return {
        modifier: 0.08,
        hint: 'Repeated challenge gathers momentum, and nerves with it.',
      };
    }
    return {
      modifier: 0.03,
      hint: 'The room braces for another challenge before you finish.',
    };
  }

  if (action === 'reset') {
    return {
      modifier: streak.count >= 3 ? -0.06 : 0.02,
      hint:
        streak.count >= 3
          ? 'Frequent resets begin to feel ceremonial rather than transformative.'
          : 'A fresh reset proposal still carries some novelty.',
    };
  }

  return { modifier: 0, hint: null };
}

export function maybeTriggerCold(social, rng = Math.random) {
  if (social.playerCold) return null;
  if (rng() < 0.12) {
    social.playerCold = true;
    social.turnsUntilSneezeCheck = 1;
    return 'A scratchy chill settles in your throat. You may be coming down with something.';
  }
  return null;
}

export function maybeSneeze(social, agents, rng = Math.random) {
  if (!social.playerCold) return null;
  social.turnsUntilSneezeCheck -= 1;
  if (social.turnsUntilSneezeCheck > 0) return null;
  social.turnsUntilSneezeCheck = 2 + Math.floor(rng() * 2);
  social.sneezeCount += 1;
  applyRelationship(social, 'porter', 1);
  shiftPorterTrust(agents, 1);
  recordPorterMemory(agents, 'Player sneezed; offered a social opening.');
  return 'You sneeze. The porter murmurs, "Bless you." Courtesy lands better than strategy.';
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
