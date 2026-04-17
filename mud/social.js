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
  };
}

export function applyRelationship(social, target, delta) {
  social.relationships[target] = (social.relationships[target] ?? 0) + delta;
}

export function logBehaviour(social, label) {
  social.behaviouralLog.push(label);
  if (social.behaviouralLog.length > 20) social.behaviouralLog.shift();
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

  return `Identity drift: ${tags.join(', ')}.`;
}
