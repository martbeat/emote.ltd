import { shiftTension } from './system.js';
import { applyRelationship, logBehaviour } from './social.js';
import { shiftPorterTrust, recordPorterMemory } from './agents.js';

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
  return `Proposal logged: "${ruleText}". Call 'vote' when ready.`;
}

function parseNormChange(text) {
  const compact = text.toLowerCase().trim();
  if (compact === 'blessonsneeze=true') return { key: 'blessOnSneeze', value: true };
  if (compact === 'blessonsneeze=false') return { key: 'blessOnSneeze', value: false };
  if (compact === 'consensusfirst=true') return { key: 'consensusFirst', value: true };
  if (compact === 'consensusfirst=false') return { key: 'consensusFirst', value: false };
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
    return { ok: false, text: 'There is no active proposal to vote on.' };
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
    text: passed
      ? `Vote carried (${yes}/3). Norm adjustments stand, at least in writing.`
      : `Vote failed (${yes}/3). Objections regroup around risk and precedent.`,
    detail: `Most recent vote: ${memo}`,
    narrative: governance.lastNarrative,
    coalitionHint,
    stanceScene,
    ambiguity:
      yes === 2
        ? 'It was a narrow outcome; allegiance may shift again by morning.'
        : 'The margin looked clear, but intent did not.',
  };
}
