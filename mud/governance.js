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

  const parsed = parseNormChange(governance.pendingProposal.text);
  if (passed && parsed) {
    governance.norms[parsed.key] = parsed.value;
  }

  governance.committeeMemory.unshift(`${passed ? 'accepted' : 'rejected'}: ${governance.pendingProposal.text}`);
  governance.committeeMemory = governance.committeeMemory.slice(0, 6);

  if (passed) {
    shiftTension(system, -1);
    applyRelationship(social, 'porter', 1);
    shiftPorterTrust(agents, 1);
    recordPorterMemory(agents, `Proposal passed: ${governance.pendingProposal.text}`);
  } else {
    shiftTension(system, 2);
    applyRelationship(social, 'porter', -1);
    shiftPorterTrust(agents, -1);
    recordPorterMemory(agents, `Proposal failed: ${governance.pendingProposal.text}`);
  }

  const memo = governance.pendingProposal.text;
  governance.pendingProposal = null;

  return {
    ok: passed,
    text: passed
      ? `Vote carried (${yes}/3). Norm adjustments stand.`
      : `Vote failed (${yes}/3). Objections regroup around risk and precedent.`,
    detail: `Most recent vote: ${memo}`,
  };
}
