const concernFlow = [
  {
    id: 'missing-minute',
    title: 'Recover the missing minute',
    unresolved: 'The missing minute matters more than the missing key.',
    resolvedBy: 'A missing minute has been recovered into live memory.',
    porterHints: [
      "The porter says, 'The missing minute matters more than the missing key.'",
      "The porter taps his ledger. 'Minutes go missing when someone needs the room to forget timing.'",
    ],
    ambientHints: [
      "A marginal note reads: 'Ask why Item 7 vanished.'",
      'A clerk-sheet has a blank line where a minute reference should be.',
    ],
  },
  {
    id: 'east-chamber',
    title: 'Gain access to the east chamber',
    unresolved: 'The east chamber remains unresolved.',
    resolvedBy: 'Access to the east chamber has been re-established.',
    porterHints: [
      "The porter says, 'Keys open metal. Standing opens rooms.'",
      "The porter murmurs, 'The east chamber does not open to urgency alone.'",
    ],
    ambientHints: [
      "A docket edge reads: 'East chamber pending procedural release.'",
      'The brass plate shows recent handling, but no final clearance mark.',
    ],
  },
  {
    id: 'ledger-contradiction',
    title: 'Resolve the contradiction in the ledger',
    unresolved: 'The ledger still contradicts the chamber record.',
    resolvedBy: 'The ledger contradiction has been formally answered.',
    porterHints: [
      "The porter says, 'The ledger disagrees with the vote log. One of them is lying politely.'",
    ],
    ambientHints: [
      "A pencilled line says: 'Item carried, then struck, then carried again.'",
      "A margin mark asks: 'Which record is meant to survive scrutiny?'",
    ],
  },
  {
    id: 'm-cole',
    title: 'Discover why M. Cole keeps being referenced',
    unresolved: 'M. Cole remains a live reference without attribution.',
    resolvedBy: 'The M. Cole references have been acknowledged in committee memory.',
    porterHints: [
      "The porter says, 'People cite M. Cole when they need authority without a person in the room.'",
    ],
    ambientHints: [
      'A corridor slip says: "M. Cole already objected." No signature follows.',
      "A note in the archive margin reads: 'M.C. appears where accountability thins.'",
    ],
  },
  {
    id: 'stillness',
    title: 'Prevent permanent stillness',
    unresolved: 'The committee risks settling into permanent stillness.',
    resolvedBy: 'Stillness has been interrupted before it became policy.',
    porterHints: [
      "The porter says, 'If pause becomes doctrine, the building will call it stability.'",
    ],
    ambientHints: [
      "A note clipped to a bench says: 'Motion deferred until deferment becomes normal.'",
    ],
  },
  {
    id: 'changed-proposal',
    title: 'Identify who changed the proposal before the vote',
    unresolved: 'A proposal is still being altered before decisions settle.',
    resolvedBy: 'A pre-vote alteration has been surfaced into the record.',
    porterHints: [
      "The porter says, 'Someone edits proposals between intent and vote. Find the hand, not the ink.'",
    ],
    ambientHints: [
      "A docket strip reads: 'Language differs from filed draft.'",
    ],
  },
  {
    id: 'procedural-movement',
    title: 'Restore procedural movement before stagnation becomes policy',
    unresolved: 'Procedural movement remains fragile.',
    resolvedBy: 'Procedural movement has been restored for now.',
    porterHints: [
      "The porter says, 'Resolution is maintenance. The next problem is already walking toward us.'",
    ],
    ambientHints: [
      'A closing note reads: "Do not mistake one resolved file for institutional recovery."',
    ],
  },
];

export function createObjectiveState() {
  return {
    currentIndex: 0,
    flags: {
      minuteRead: false,
      minutePorterDiscussed: false,
      eastVisited: false,
      contradictionVoteSeen: false,
      mColeAsked: false,
      stillnessObserved: false,
      stillnessInterrupted: false,
      editedProposalSeen: false,
      editedProposalVoted: false,
      movementRestored: false,
    },
    discovered: [concernFlow[0].id],
    resolved: [],
    history: [],
  };
}

export function ensureObjectiveState(objectives) {
  const defaults = createObjectiveState();
  const next = { ...defaults, ...(objectives ?? {}) };
  next.flags = { ...defaults.flags, ...(objectives?.flags ?? {}) };
  if (!Array.isArray(next.discovered) || !next.discovered.length) next.discovered = [concernFlow[0].id];
  if (!Array.isArray(next.resolved)) next.resolved = [];
  if (!Array.isArray(next.history)) next.history = [];
  if (typeof next.currentIndex !== 'number') next.currentIndex = 0;
  next.currentIndex = Math.max(0, Math.min(next.currentIndex, concernFlow.length - 1));
  return next;
}

export function currentConcern(objectives) {
  const safe = ensureObjectiveState(objectives);
  return concernFlow[safe.currentIndex];
}

export function currentConcernLine(objectives) {
  return `Current concern: "${currentConcern(objectives).unresolved}"`;
}

function markResolved(objectives, reason) {
  const safe = ensureObjectiveState(objectives);
  const current = concernFlow[safe.currentIndex];
  if (safe.resolved.includes(current.id)) return null;
  safe.resolved.push(current.id);
  safe.history.unshift(`${current.title} — ${reason || current.resolvedBy}`);
  safe.history = safe.history.slice(0, 8);
  if (safe.currentIndex < concernFlow.length - 1) {
    safe.currentIndex += 1;
    const next = concernFlow[safe.currentIndex];
    if (!safe.discovered.includes(next.id)) safe.discovered.push(next.id);
    return {
      resolvedLine: `The file closes: ${current.resolvedBy}`,
      nextLine: `A new concern surfaces quietly: ${next.unresolved}`,
    };
  }
  return {
    resolvedLine: `The file closes: ${current.resolvedBy}`,
    nextLine: 'No office stays resolved for long, but no larger concern has surfaced yet.',
  };
}

export function noteObjectiveEvent(objectives, event, context = {}) {
  const safe = ensureObjectiveState(objectives);
  const flags = safe.flags;

  if (event === 'read-item' && context.item === 'ledger fragment') flags.minuteRead = true;
  if (event === 'talk-porter' && flags.minuteRead) flags.minutePorterDiscussed = true;
  if (event === 'entered-east-chamber') flags.eastVisited = true;
  if (event === 'vote-resolved-ledger') flags.contradictionVoteSeen = true;
  if (event === 'asked-m-cole') flags.mColeAsked = true;
  if (event === 'state-stagnant') flags.stillnessObserved = true;
  if (event === 'state-not-stagnant' && flags.stillnessObserved) flags.stillnessInterrupted = true;
  if (event === 'edited-proposal-seen') flags.editedProposalSeen = true;
  if (event === 'edited-proposal-voted') flags.editedProposalVoted = true;
  if (event === 'movement-restored') flags.movementRestored = true;

  const concernId = concernFlow[safe.currentIndex].id;
  if (concernId === 'missing-minute' && flags.minuteRead && flags.minutePorterDiscussed) {
    return markResolved(safe, 'The porter acknowledged the missing minute as active record.');
  }
  if (concernId === 'east-chamber' && flags.eastVisited) {
    return markResolved(safe, 'Entry to the east chamber was achieved through standing and mechanism.');
  }
  if (concernId === 'ledger-contradiction' && flags.contradictionVoteSeen) {
    return markResolved(safe, 'A contradictory ledger line was answered by decision.');
  }
  if (concernId === 'm-cole' && flags.mColeAsked) {
    return markResolved(safe, 'M. Cole moved from rumor to explicit inquiry.');
  }
  if (concernId === 'stillness' && flags.stillnessInterrupted) {
    return markResolved(safe, 'Institutional stillness was interrupted before hardening.');
  }
  if (concernId === 'changed-proposal' && flags.editedProposalSeen && flags.editedProposalVoted) {
    return markResolved(safe, 'A changed proposal was surfaced before vote closure.');
  }
  if (concernId === 'procedural-movement' && flags.movementRestored) {
    return markResolved(safe, 'Movement was restored through trust, access, and governance action.');
  }
  return null;
}

export function maybeConcernHint(objectives, source = 'ambient') {
  const concern = currentConcern(objectives);
  const lines = source === 'porter' ? concern.porterHints : concern.ambientHints;
  if (!Array.isArray(lines) || !lines.length) return null;
  return lines[Math.floor(Math.random() * lines.length)];
}
