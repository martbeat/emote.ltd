import { shiftTension } from './system.js';
import { applyRelationship, logBehaviour } from './social.js';
import { shiftPorterTrust, recordPorterMemory } from './agents.js';

const normNarratives = {
  blessOnSneeze: {
    true: 'Courtesy still follows sneezing.',
    false: 'Sneezes pass without ceremonial reply.',
  },
  consensusFirst: {
    true: 'Agreement is preferred before commitment.',
    false: 'Commitment can proceed before full agreement.',
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
  const normalized = String(value) === 'true';

  if (key === 'consensusFirst') {
    return {
      summary: normalized
        ? 'The chamber returns to consensus-first deliberation before commitments are made.'
        : 'The chamber allows commitments before full consensus, speeding up decisions.',
      gameplay: normalized
        ? 'Deliberation slows as participants check for broad agreement before moving forward.'
        : 'Debates resolve faster, but unresolved disagreement is more likely to spill into later turns.',
    };
  }

  if (key === 'blessOnSneeze') {
    return {
      summary: normalized
        ? 'Blessing a sneeze is once again treated as expected social courtesy.'
        : 'The blessing ritual is suspended; sneezes pass without formal acknowledgment.',
      gameplay: normalized
        ? 'Courtesy cues become more visible, reinforcing social warmth in ambient scenes.'
        : 'Ambient interactions feel more transactional as courtesy rituals fade into background noise.',
    };
  }

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
    access: {
      gates: {
        'hall:east': {
          label: 'East committee door',
          status: 'socially blocked',
          resistance: 0,
          approvals: 0,
        },
      },
    },
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

function parseAccessProposal(text = '') {
  const compact = text.toLowerCase().trim().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ');
  if (!compact) return null;

  const eastRouteMentioned = /\b(east|east door|door east|go east|access east)\b/.test(compact);
  if (!eastRouteMentioned) return null;

  const accessIntent = compact === 'east'
    || /\b(open|unlock|unblock|grant|allow|approve|access|go|move|enter)\b/.test(compact);
  if (!accessIntent) return null;

  return { gateId: 'hall:east' };
}

function applyAccessOutcome(governance, proposalText, passed, context = {}) {
  const parsed = parseAccessProposal(proposalText);
  if (!parsed) return null;

  const gate = governance.access?.gates?.[parsed.gateId];
  if (!gate) return null;

  const hasKey = Boolean(context.hasHallKey);
  if (passed) {
    gate.approvals = (gate.approvals ?? 0) + 1;
    gate.resistance = Math.max(0, (gate.resistance ?? 0) - 1);
    gate.status = hasKey ? 'open' : 'provisionally approved';
    return hasKey
      ? 'Facilities release the east mechanism at once; key and approval align.'
      : 'Facilities grant provisional east access pending porter intervention.';
  }

  gate.resistance = (gate.resistance ?? 0) + 1;
  gate.approvals = Math.max(0, (gate.approvals ?? 0) - 1);
  gate.status = gate.resistance >= 2 ? 'locked' : 'socially blocked';
  return gate.resistance >= 2
    ? 'The refusal settles into the lock; institutional resistance hardens.'
    : 'The refusal settles into social clearance; east access remains blocked.';
}

export function vote(governance, agents, social, system, context = {}, rng = Math.random) {
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
  const accessOutcome = applyAccessOutcome(governance, governance.pendingProposal.text, passed, context);

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
    accessOutcome,
  };
}

function hashString(text = '') {
  return [...String(text)].reduce((acc, char) => ((acc * 31) + char.charCodeAt(0)) >>> 0, 7);
}

function pickByHash(options, seedText) {
  if (!options.length) return '';
  return options[hashString(seedText) % options.length];
}

function extractMemoryPayload(entry = '', prefix = '') {
  return entry.startsWith(prefix) ? entry.slice(prefix.length).trim() : '';
}

function parseVoteMemory(entry = '', label = '') {
  const proposal = extractMemoryPayload(entry, `${label}:`);
  const narrow = /\b(narrow|provisional|temporary|faster|urgent|food)\b/i.test(proposal);
  return { proposal, narrow };
}

export function renderCommitteeMemory(entry = '') {
  if (!entry) return 'Institutional memory remains unsettled.';

  if (entry.startsWith('read:')) {
    const source = extractMemoryPayload(entry, 'read:');
    return pickByHash([
      'The ledger was consulted before agreement.',
      'A record was opened, then interpreted more than trusted.',
      'The room remembers the consultation more than what it proved.',
      source.includes('ledger')
        ? 'A ledger fragment changed the mood before anyone changed position.'
        : 'A fragment was read aloud, and the tone shifted before conclusions did.',
    ], entry);
  }

  if (entry.startsWith('accepted:')) {
    const { proposal, narrow } = parseVoteMemory(entry, 'accepted');
    const narrowed = narrow
      ? [
        'The proposal passed, but only narrowly.',
        'Agreement was reached, though no one fully claimed it.',
        'Consensus was recorded before conviction existed.',
      ]
      : [
        'Agreement was reached, though no one fully claimed it.',
        'The committee marked assent while motives remained private.',
        'Consensus was recorded before conviction existed.',
      ];
    if (/\bfood\b/i.test(proposal)) narrowed.push('Food was approved faster than procedure usually permits.');
    return pickByHash(narrowed, entry);
  }

  if (entry.startsWith('rejected:')) {
    return pickByHash([
      'The room remembers the resistance more than the motion.',
      'Refusal held for now, though its reasons never fully aligned.',
      'The proposal stalled, and the argument outlived the vote.',
      'The room remembers that challenge more than the decision.',
    ], entry);
  }

  if (entry.startsWith('gifted:')) {
    return pickByHash([
      'An item changed hands, and responsibility changed shape with it.',
      'The transfer was noted as trust, not merely logistics.',
      'Custody shifted; interpretation followed.',
    ], entry);
  }

  if (entry.startsWith('norm pressure:')) {
    return pickByHash([
      'Pressure gathered around process before any formal amendment appeared.',
      'Procedure bent slightly under repeated insistence.',
      'The room felt nudged toward a different norm before anyone admitted it.',
    ], entry);
  }

  if (entry.startsWith('tabled before arrival:')) {
    return pickByHash([
      'A proposal was already waiting when the room assembled.',
      'The agenda remembered someone who was no longer present.',
      'The motion arrived before its author could be held to it.',
    ], entry);
  }

  return pickByHash([
    'The institution keeps the consequence and lets the motive blur.',
    'The record preserved an outcome and misplaced the certainty.',
    'What was decided survived; why it was decided did not.',
  ], entry);
}

export function renderCommitteeMemoryHistory(entries = []) {
  return entries.map((entry) => renderCommitteeMemory(entry));
}
