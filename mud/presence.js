function pick(list, rng = Math.random) {
  return list[Math.floor(rng() * list.length)];
}

const institutionalIdentities = [
  'M. Fry',
  'E. Vale',
  'Rowan Hale',
  'J. Mercer',
  'C. North',
  'R. Dyer',
  'S. Wren',
  'L. Pike',
];

const ghostProfiles = [
  { id: 'r_vale', display: 'R. Vale', surname: 'Vale', signature: 'R. Vale' },
  { id: 's_hart', display: 'S. Hart', surname: 'Hart', signature: 'S. Hart' },
  { id: 'm_cole', display: 'M. Cole', surname: 'Cole', signature: 'M. Cole' },
  { id: 'j_mercer', display: 'J. Mercer', surname: 'Mercer', signature: 'J. Mercer' },
  { id: 'k_only', display: 'signed only: K.', surname: 'K.', signature: 'signed only: K.' },
];

const proposalFragments = [
  'clarity before urgency',
  'record before momentum',
  'courtesy survives pressure',
  'minor repairs before major promises',
  'questions before force',
  'defer acclaim, preserve process',
  'repair trust before tallying wins',
];

export function createPlayerIdentity(rng = Math.random) {
  return {
    name: pick(institutionalIdentities, rng),
    establishedTurn: 0,
  };
}

export function ensurePlayerIdentity(player, rng = Math.random) {
  if (!player.identity?.name) {
    player.identity = createPlayerIdentity(rng);
  }
  return player.identity;
}

export function createGhostPresenceState(rng = Math.random) {
  const roster = [...ghostProfiles]
    .sort(() => rng() - 0.5)
    .slice(0, 4);
  return {
    turn: 0,
    lastEventTurn: -9,
    proposalCooldown: 0,
    roomResidue: {},
    lastPorterNearMissTurn: -99,
    seededAtLeastOnce: false,
    lastSignature: null,
    roster,
    lastActorId: roster[0]?.id ?? null,
    nearEncounterCooldown: 0,
  };
}

export function ensureGhostPresenceState(ghost, rng = Math.random) {
  const fallback = createGhostPresenceState(rng);
  ghost.turn ??= fallback.turn;
  ghost.lastEventTurn ??= fallback.lastEventTurn;
  ghost.proposalCooldown ??= fallback.proposalCooldown;
  ghost.roomResidue ??= {};
  ghost.lastPorterNearMissTurn ??= fallback.lastPorterNearMissTurn;
  ghost.seededAtLeastOnce ??= false;
  ghost.lastSignature ??= null;
  ghost.roster = Array.isArray(ghost.roster) && ghost.roster.length ? ghost.roster : fallback.roster;
  ghost.lastActorId ??= ghost.roster[0]?.id ?? null;
  ghost.nearEncounterCooldown ??= 0;
  return ghost;
}

export function chooseGhostActor(ghost, rng = Math.random) {
  const roster = ghost.roster ?? ghostProfiles;
  const actor = pick(roster, rng);
  ghost.lastActorId = actor.id;
  ghost.lastSignature = actor.signature;
  return actor;
}

export function ghostProposalEntry(ghost, rng = Math.random) {
  const actor = chooseGhostActor(ghost, rng);
  const text = pick(proposalFragments, rng);
  return {
    actor,
    text,
    line: `A proposal is already waiting in the minutes: "${text}" (initialled in the margin: ${actor.display}).`,
    memory: `tabled before arrival: ${text} [${actor.display}]`,
  };
}

export function porterIdentityLine(identity, rng = Math.random) {
  const surname = identity.name.includes(' ') ? identity.name.split(' ').slice(-1)[0].replace('.', '') : identity.name;
  const lines = [
    `Porter: "Ah, ${surname}. Still choosing doors before committees?"`,
    `Porter: "${surname}, then. The register says you prefer motion to waiting."`,
    `Porter: "${surname}. You have been here before, in one form or another."`,
  ];
  return pick(lines, rng);
}

export function porterGhostWitnessLine(ghost, rng = Math.random) {
  const actor = ghost.roster?.find((entry) => entry.id === ghost.lastActorId) ?? pick(ghost.roster ?? ghostProfiles, rng);
  const lines = [
    `Porter: "You're asking the same question ${actor.surname} asked yesterday."`,
    `Porter: "${actor.surname} initialled the ledger, then vanished before roll call."`,
    `Porter: "You just missed ${actor.surname}; apology already in motion."`,
    `Porter: "${actor.display} left a note, then left before agreeing with themselves."`,
    `Porter: "${actor.surname} nearly collided with you at the stair turn, or so the register insists."`,
  ];
  return pick(lines, rng);
}

export function ghostNearEncounterLine(ghost, rng = Math.random) {
  const actor = chooseGhostActor(ghost, rng);
  const lines = [
    `${actor.display} is here.` ,
    `You catch ${actor.surname} halfway through leaving, apology already in motion.`,
    `${actor.display} reaches for a key, thinks better of it, and is gone by the second look.`,
  ];
  return pick(lines, rng);
}

export function scoreIdentityComparison(identity, ghost, rng = Math.random) {
  const actor = ghost.roster?.find((entry) => entry.id === ghost.lastActorId) ?? pick(ghost.roster ?? ghostProfiles, rng);
  const lines = [
    `${identity.name} is now cited in hallway shorthand, usually in the same breath as ${actor.display}.`,
    `Clerks file ${identity.name} under "persistent" this week, near old annotations by ${actor.display}.`,
    `${identity.name} appears in the margin language now: not ranked, but remembered beside ${actor.display}.`,
  ];
  return pick(lines, rng);
}
