import { addItemToRoom, removeItemFromRoom } from './world.js';
import { shiftTension } from './system.js';

function pick(list, rng = Math.random) {
  return list[Math.floor(rng() * list.length)];
}

function pickActor(agents, ghost, rng = Math.random) {
  const localActors = [
    { id: 'ada', display: agents.ada?.name ?? 'Ada', kind: 'npc' },
    { id: 'bernard', display: agents.bernard?.name ?? 'Bernard', kind: 'npc' },
    { id: 'cyra', display: agents.cyra?.name ?? 'Cyra', kind: 'npc' },
    { id: 'porter', display: agents.porter?.name ?? 'Porter', kind: 'npc' },
  ];
  const ghosts = (ghost?.roster ?? []).map((entry) => ({ id: entry.id, display: entry.display, kind: 'ghost' }));
  return pick([...localActors, ...ghosts], rng);
}

function extractPastProposal(memory = []) {
  const remembered = memory.find((entry) => /^(accepted|rejected):\s+/i.test(entry));
  if (!remembered) return null;
  return remembered.replace(/^(accepted|rejected):\s+/i, '').trim();
}

function noteRoomConsequence(autonomy, roomId, text, freshness = 5) {
  autonomy.roomConsequences[roomId] = { text, freshness };
}

function moveInstitutionalItem(world, autonomy, actor, rng = Math.random) {
  const movable = Object.values(world.rooms)
    .filter((room) => Array.isArray(room.items) && room.items.length)
    .flatMap((room) => room.items.map((item) => ({ item, source: room.id })));
  if (!movable.length) return null;

  const selection = pick(movable, rng);
  const roomIds = Object.keys(world.rooms).filter((id) => id !== selection.source);
  const target = pick(roomIds, rng);
  removeItemFromRoom(world, selection.source, selection.item);
  addItemToRoom(world, target, selection.item);

  noteRoomConsequence(
    autonomy,
    target,
    `${actor.display} has already moved the ${selection.item} here and left no forwarding note.`,
  );
  noteRoomConsequence(
    autonomy,
    selection.source,
    `The ${selection.item} is gone; someone has already carried it onward.`,
  );

  return {
    porterLine: `Porter: "${actor.display} asked for the ${selection.item} this morning."`,
  };
}

function repeatOrSeedProposal(governance, autonomy, actor, rng = Math.random) {
  if (governance.pendingProposal) return null;
  const repeated = extractPastProposal(governance.committeeMemory);
  const freshText = pick([
    'agreement without timing is theatre',
    'stage commitments before ceremony',
    'record dissent before declaring closure',
  ], rng);
  const proposalText = repeated ?? freshText;

  governance.pendingProposal = {
    text: proposalText,
    turnOpened: Date.now(),
    source: 'autonomous-institutional',
    attribution: actor.display,
  };
  governance.committeeMemory.unshift(`tabled before arrival: ${proposalText} [${actor.display}]`);
  governance.committeeMemory = governance.committeeMemory.slice(0, 8);

  noteRoomConsequence(
    autonomy,
    'lockedRoom',
    repeated
      ? `${actor.display} had already suggested the same rule yesterday.`
      : `${actor.display} has added a new proposal card before roll call.`,
    6,
  );

  return {
    porterLine: `Porter: "You are late to that argument. ${actor.display} raised it earlier."`,
  };
}

function pressureNorms(governance, system, autonomy, actor, rng = Math.random) {
  const key = rng() < 0.5 ? 'consensusFirst' : 'blessOnSneeze';
  const harder = rng() < 0.5;
  const delta = shiftTension(system, harder ? 1 : -1);
  const phrasing = key === 'consensusFirst'
    ? harder
      ? 'timing has begun to outrank consensus in hallway talk.'
      : 'people are quietly demanding agreement before commitment again.'
    : harder
      ? 'courtesy rituals are being treated as optional.'
      : 'small courtesies are being enforced with fresh seriousness.';

  noteRoomConsequence(
    autonomy,
    'hall',
    `${actor.display} pressed the norm: ${phrasing}`,
    5,
  );
  governance.committeeMemory.unshift(`norm pressure: ${key} (${harder ? 'up' : 'down'}) [${actor.display}]`);
  governance.committeeMemory = governance.committeeMemory.slice(0, 8);

  return {
    porterLine: delta.direction === 'up'
      ? `Porter: "${actor.display} tightened the tone before you arrived."`
      : `Porter: "${actor.display} cooled that dispute a notch before you got here."`,
  };
}

function supportOrResist(governance, system, autonomy, actor, rng = Math.random) {
  if (!governance.pendingProposal) return null;
  const support = rng() < 0.5;
  shiftTension(system, support ? -1 : 1);
  noteRoomConsequence(
    autonomy,
    'lockedRoom',
    support
      ? `${actor.display} has already seconded the standing proposal in the margin.`
      : `${actor.display} has marked the standing proposal "resist pending timing".`,
    6,
  );
  return {
    porterLine: support
      ? `Porter: "${actor.display} is already supporting that motion."`
      : `Porter: "${actor.display} has already argued against that wording."`,
  };
}

function leaveInstitutionalNote(autonomy, actor, rng = Math.random) {
  const roomId = pick(['foyer', 'hall', 'archive', 'eastCorridor'], rng);
  const note = pick([
    'Agreement without timing is theatre.',
    'Already discussed before noon.',
    'Return this key after the second vote.',
  ], rng);
  noteRoomConsequence(autonomy, roomId, `${actor.display} has left a note: "${note}"`, 6);
  return { porterLine: `Porter: "${actor.display} left a note and moved on."` };
}

function undoPlayerAssumption(player, world, autonomy, actor, rng = Math.random) {
  const assumptionItem = player.lastReferencedItem;
  if (!assumptionItem) return null;
  const itemRoom = Object.values(world.rooms).find((room) => room.items.includes(assumptionItem));
  if (!itemRoom) return null;
  const target = pick(Object.keys(world.rooms).filter((id) => id !== itemRoom.id), rng);
  removeItemFromRoom(world, itemRoom.id, assumptionItem);
  addItemToRoom(world, target, assumptionItem);
  noteRoomConsequence(autonomy, target, `${actor.display} has already refiled the ${assumptionItem}.`, 5);
  return {
    porterLine: `Porter: "The ${assumptionItem} was moved after your last assumption."`,
  };
}

export function createAutonomyState() {
  return {
    turn: 0,
    lastActionTurn: -99,
    cooldown: 0,
    roomConsequences: {},
    pendingPorterWitness: null,
  };
}

export function ensureAutonomyState(autonomy) {
  const fallback = createAutonomyState();
  autonomy.turn ??= fallback.turn;
  autonomy.lastActionTurn ??= fallback.lastActionTurn;
  autonomy.cooldown ??= fallback.cooldown;
  autonomy.roomConsequences ??= {};
  autonomy.pendingPorterWitness ??= null;
  return autonomy;
}

export function decayAutonomyState(autonomy) {
  Object.entries(autonomy.roomConsequences).forEach(([roomId, consequence]) => {
    if (!consequence) return;
    consequence.freshness = (consequence.freshness ?? 0) - 1;
    if (consequence.freshness <= 0) delete autonomy.roomConsequences[roomId];
  });
  autonomy.cooldown = Math.max(0, (autonomy.cooldown ?? 0) - 1);
}

export function roomAutonomyConsequence(roomId, autonomy) {
  return autonomy.roomConsequences?.[roomId]?.text ?? null;
}

export function maybeAdvanceInstitutionalAutonomy(context, rng = Math.random) {
  const {
    world,
    governance,
    system,
    agents,
    ghost,
    player,
  } = context;
  const autonomy = ensureAutonomyState(context.autonomy);

  autonomy.turn += 1;
  decayAutonomyState(autonomy);

  if (autonomy.cooldown > 0) return null;
  if (autonomy.turn - autonomy.lastActionTurn < 3) return null;

  const baseChance = system.state === 'stagnant' ? 0.11 : 0.08;
  if (rng() > baseChance) return null;

  const actor = pickActor(agents, ghost, rng);
  const actionPool = [
    () => moveInstitutionalItem(world, autonomy, actor, rng),
    () => repeatOrSeedProposal(governance, autonomy, actor, rng),
    () => pressureNorms(governance, system, autonomy, actor, rng),
    () => leaveInstitutionalNote(autonomy, actor, rng),
    () => supportOrResist(governance, system, autonomy, actor, rng),
    () => undoPlayerAssumption(player, world, autonomy, actor, rng),
  ];

  const shuffled = [...actionPool].sort(() => rng() - 0.5);
  const outcome = shuffled.map((fn) => fn()).find(Boolean) ?? null;
  if (!outcome) return null;

  autonomy.lastActionTurn = autonomy.turn;
  autonomy.cooldown = 4 + Math.floor(rng() * 4);
  autonomy.pendingPorterWitness = outcome.porterLine ?? null;
  return outcome;
}

export function takePorterWitnessLine(autonomy) {
  if (!autonomy.pendingPorterWitness) return null;
  const line = autonomy.pendingPorterWitness;
  autonomy.pendingPorterWitness = null;
  return line;
}
