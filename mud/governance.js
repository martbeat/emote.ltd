import { shiftTension } from './system.js';
import { applyRelationship, logBehaviour } from './social.js';
import { shiftPorterTrust, recordPorterMemory } from './agents.js';

const normNarratives = {
  blessOnSneeze: {
    true: 'People still observe the blessing ritual after sneezes.',
    false: 'People no longer expect anyone to bless a sneeze.',
  },
  consensusFirst: {
    true: 'People prefer agreement before commitment.',
    false: 'People permit commitments before full agreement.',
  },
};

const normGameplayEffects = {
  blessOnSneeze: {
    true: 'Ambient sneezes are socially acknowledged again, reinforcing courtesy signals.',
    false: 'Sneezes are treated as ambient noise, reducing courtesy rituals in moment-to-moment play.',
  },
  consensusFirst: {
    true: 'Deliberation tends to slow down as the room seeks shared agreement before decisions.',
    false: 'Decisions can move faster, with less pressure to secure broad agreement first.',
  },
};

function describeNorm(key, value) {
  return normNarratives[key]?.[String(value)] ?? `${key}=${value}`;
}

export function describeNorms(norms) {
  return Object.entries(norms).map(([key, value]) => describeNorm(key, value));
}

export function describeNormChange(key, value) {
  return {
    summary: describeNorm(key, value),
    gameplay: normGameplayEffects[key]?.[String(value)] ?? 'The institution adjusts how routine interactions play out.',
  };
}

export function createGovernanceState() {
  return {
    norms: {
      blessOnSneeze: true,
      consensusFirst: true,
    },
    pendingProposal: null,
    committeeMemory: [],
  };
}

export function proposeRule(governance, social, ruleText) {
  governance.pendingProposal = {
    text: ruleText,
    turnOpened: Date.now(),
  };
  logBehaviour(social, 'propose');
  return `The clerk marks your proposal: "${ruleText}". The table waits on a vote.`;
}

function parseNormChange(text) {
  const lower = text.toLowerCase().trim().replaceAll('consesus', 'consensus');
  if (!lower) return null;

  const normalizedKey = (raw = '') => raw.toLowerCase().replace(/[\s_-]/g, '');
  const parseBoolToken = (raw = '') => {
    const token = raw.trim().toLowerCase();
    if (['true', 'on', 'yes', 'enable', 'enabled', 'more', 'higher', 'increase', 'slower'].includes(token)) return true;
    if (['false', 'off', 'no', 'disable', 'disabled', 'less', 'lower', 'reduce', 'faster'].includes(token)) return false;
    return null;
  };

  const keyAliases = {
    blessonsneeze: 'blessOnSneeze',
    sneezeblessing: 'blessOnSneeze',
    sneezeritual: 'blessOnSneeze',
    consensusfirst: 'consensusFirst',
    consensus: 'consensusFirst',
    agreementfirst: 'consensusFirst',
    decisionpace: 'consensusFirst',
  };

  const equalsMatch = lower.match(/^([^=]+)=([^=]+)$/);
  if (equalsMatch) {
    const key = keyAliases[normalizedKey(equalsMatch[1])];
    const value = parseBoolToken(equalsMatch[2]);
    if (key && value !== null) return { key, value };
  }

  const compact = lower.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!compact) return null;
  if (compact.includes('faster decision') || compact.includes('less consensus')) {
    return { key: 'consensusFirst', value: false };
  }
  if (compact.includes('slower decision') || compact.includes('more consensus')) {
    return { key: 'consensusFirst', value: true };
  }
  if (compact.includes('agreement before commitment')) {
    return { key: 'consensusFirst', value: true };
  }

  return null;
}

function agentVote(agent, relationship, systemState, influencePull) {
  let score = 0;
  score += relationship * 0.15;
  score += agent.bias === 'change' ? 0.2 : -0.1;
  score += influencePull;
  if (systemState === 'chaotic' && agent.bias === 'stability') score += 0.25;
  if (systemState === 'stagnant' && agent.bias === 'change') score += 0.25;
  return score >= 0;
}

export function vote(governance, agents, social, system, rng = Math.random) {
  if (!governance.pendingProposal) {
    return { ok: false, text: 'No proposal currently stands before the table.' };
  }

  const pull = (agents.ada.influence - agents.bernard.influence) * 0.2;
  const votes = [
    agentVote(agents.ada, social.relationships.ada, system.state, pull),
    agentVote(agents.bernard, social.relationships.bernard, system.state, -pull / 2),
    agentVote(agents.cyra, social.relationships.cyra, system.state, -0.02),
  ];

  if (system.state === 'chaotic' && rng() < 0.3) {
    votes[Math.floor(rng() * votes.length)] = false;
  }

  const yes = votes.filter(Boolean).length;
  const passed = yes >= 2;
  const coalitionHint = (() => {
    const [ada, bernard, cyra] = votes;
    if (ada && !bernard && cyra) return 'Cyra sided with Ada while Bernard withheld support.';
    if (ada && bernard && !cyra) return 'Ada and Bernard converged briefly; Cyra stayed unconvinced.';
    if (!ada && bernard && cyra) return 'Bernard gathered a cautious coalition around Cyra.';
    if (ada && bernard && cyra) return 'A rare unanimous front forms, though not for identical reasons.';
    return 'No stable coalition was obvious; assent and reluctance overlapped.';
  })();
  const stanceScene = (() => {
    const [ada, bernard, cyra] = votes;
    const highAlignment = system.alignment >= 3;
    const lowAlignment = system.alignment <= 0;
    if (highAlignment) {
      if (ada === bernard && bernard === cyra) {
        return 'Ada and Bernard exchange a quick glance; Cyra gives a quiet confirming nod.';
      }
      return 'Cyra paraphrases once, and the others mostly accept the framing.';
    }
    if (lowAlignment) {
      if (ada !== bernard) {
        return ada
          ? 'Ada pushes for motion; Bernard openly contests her premise, and Cyra reframes both arguments into a narrower compromise.'
          : 'Bernard slows everything down and Ada rejects the delay; Cyra bridges by splitting principle from timing.';
      }
      return 'Even when they vote alike, Ada and Bernard sound unconvinced by each other; Cyra keeps translating intent.';
    }
    if (ada === bernard && bernard === cyra) {
      return 'Ada and Bernard exchange a cautious glance; Cyra mirrors it a beat later.';
    }
    if (ada !== bernard) {
      return ada
        ? 'Ada presses for motion; Bernard replies with procedural caution. Cyra watches who blinks first.'
        : 'Bernard sets a careful pace; Ada challenges the caution, and Cyra negotiates between them.';
    }
    return 'Bernard and Cyra settle into similar language while Ada tests the edges of consent.';
  })();

  const parsed = parseNormChange(governance.pendingProposal.text);
  if (passed && parsed) {
    governance.norms[parsed.key] = parsed.value;
  }

  governance.committeeMemory.unshift(`${passed ? 'accepted' : 'rejected'}: ${governance.pendingProposal.text}`);
  governance.committeeMemory = governance.committeeMemory.slice(0, 6);

  if (passed) {
    const delta = shiftTension(system, -1);
    applyRelationship(social, 'porter', 1);
    shiftPorterTrust(agents, 1);
    recordPorterMemory(agents, `Proposal passed: ${governance.pendingProposal.text}`);
    governance.lastNarrative = delta.direction === 'down'
      ? 'The vote passes and conversation softens, though motives remain politely disputed.'
      : 'The vote passes, but nobody celebrates in exactly the same way.';
  } else {
    const delta = shiftTension(system, 2);
    applyRelationship(social, 'porter', -1);
    shiftPorterTrust(agents, -1);
    recordPorterMemory(agents, `Proposal failed: ${governance.pendingProposal.text}`);
    governance.lastNarrative = delta.direction === 'up'
      ? 'The rejection echoes longer than expected; side discussions gather near doorways.'
      : 'The proposal fails, yet dissent remains strangely subdued.';
  }

  const memo = governance.pendingProposal.text;
  governance.pendingProposal = null;

  return {
    ok: passed,
    yesVotes: yes,
    text: passed
      ? `The vote carries (${yes}/3). The adjustment stands, in the record at least.`
      : `The vote fails (${yes}/3). Objections gather again around risk and precedent.`,
    detail: `Most recent vote: ${memo}`,
    narrative: governance.lastNarrative,
    coalitionHint,
    stanceScene,
    ambiguity:
      yes === 2
        ? 'It was a narrow outcome; allegiance may shift again by morning.'
        : 'The margin looked clear, but intent did not.',
    normChange: passed && parsed ? describeNormChange(parsed.key, parsed.value) : null,
  };
}
