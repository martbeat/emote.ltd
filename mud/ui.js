import {
  createWorld,
  describeRoom,
  getRoomPacing,
  removeItemFromRoom,
  addItemToRoom,
  getItemDefinition,
} from './world.js';
import {
  createAgents,
  moveAgents,
  talkToPorter,
  getInfluenceHint,
  agentExchangeHint,
  porterOutcomeReflection,
  porterSneezeResponse,
  updatePorterVisibility,
  maybePorterAbsenceLine,
  shiftPorterTrust,
  recordPorterMemory,
  decayAgentMemories,
  notePorterGovernancePattern,
  notePorterSocialMemory,
  narrateAgentContinuity,
  interpretAgentInteraction,
} from './agents.js';
import {
  createSocialState,
  applyRelationship,
  shiftStanding,
  behaviourEcho,
  behaviouralDrift,
  maybeTriggerCold,
  maybeSneeze,
  inferIdentity,
  logBehaviour,
} from './social.js';
import {
  createGovernanceState,
  proposeRule,
  assessProposalRelevance,
  vote,
  describeNorms,
  describeNormChange,
  renderCommitteeMemory,
  renderCommitteeMemoryHistory,
} from './governance.js';
import {
  createSystemState,
  tickSystem,
  interpretiveMessage,
  derivePhaseSummary,
  transitionMessage,
  mediate,
  challenge,
  resetNormAttempt,
} from './system.js';
import {
  createNarrativeState,
  porterReflection,
  positioningNarrative,
  atmosphereNarrative,
  voteNarrative,
  tensionShiftNarrative,
  interventionNarrative,
  phaseNarrative,
  maybeComposedScene,
  maybeGhostTraceNarrative,
  maybeDirectionalGhostGlimpse,
  maybeAmbientSneezeNarrative,
  maybeAmbientWorldEvent,
} from './narrative.js';
import {
  createWeatherState,
  tickWeather,
  weatherSocialTexture,
  weatherPhaseLabel,
  weatherShiftLine,
  maybeWeatherGovernanceMoment,
  describeInstitutionalWeather,
} from './weather.js';
import {
  createPlayerIdentity,
  ensurePlayerIdentity,
  createGhostPresenceState,
  ensureGhostPresenceState,
  ghostProposalEntry,
  porterIdentityLine,
  porterGhostWitnessLine,
  ghostNearEncounterLine,
  scoreIdentityComparison,
} from './presence.js';
import {
  createAutonomyState,
  ensureAutonomyState,
  maybeAdvanceInstitutionalAutonomy,
  roomAutonomyConsequence,
  takePorterWitnessLine,
} from './autonomy.js';
import {
  createObjectiveState,
  ensureObjectiveState,
  currentConcern,
  currentConcernLine,
  recentUnresolvedConcernLines,
  noteObjectiveEvent,
  maybeConcernHint,
} from './objectives.js';

function createGameState() {
  return {
    world: createWorld(),
    agents: createAgents(),
    social: createSocialState(),
    governance: createGovernanceState(),
    system: createSystemState(),
    narrative: createNarrativeState(),
    weather: createWeatherState(),
    player: {
      currentRoom: 'foyer',
      inventory: [],
      lastReferencedItem: null,
      attemptedForceDoor: false,
      archiveInvestigation: {
        latchChecked: false,
        cabinetOpened: false,
        boxMoved: false,
        shelvesExamined: false,
        ledgersChecked: false,
        clueCount: 0,
        minuteDiscovered: false,
      },
      visitCounts: {},
      recentDeparturesByRoom: {},
      identity: createPlayerIdentity(),
    },
    governanceUi: {
      suggestionStreak: 0,
      lastDecisionFailed: false,
      lowRelevanceStreak: 0,
    },
    ghost: createGhostPresenceState(),
    autonomy: createAutonomyState(),
    objectives: createObjectiveState(),
    turnVisibleNpcs: [],
    turnVisibleNpcRoomId: null,
  };
}

const SAVE_KEY = 'essexMudGovV2';
const LEGACY_SAVE_KEY = 'essexMudGovV1';
let state = createGameState();
const governanceKeyRooms = new Set(['hall', 'lockedRoom']);
const governanceSupportRooms = new Set(['foyer', 'eastCorridor', 'archive']);

const dom = {
  output: document.getElementById('output'),
  form: document.getElementById('commandForm'),
  input: document.getElementById('commandInput'),
  room: document.getElementById('roomLabel'),
  identity: document.getElementById('identityLabel'),
  exits: document.getElementById('exitsLabel'),
  inventory: document.getElementById('inventoryLabel'),
  norms: document.getElementById('normsLabel'),
  tension: document.getElementById('tensionLabel'),
  memory: document.getElementById('memoryLabel'),
};

const narrativePriority = {
  P1: 1,
  P2: 2,
  P3: 3,
};

function ensureGhostState() {
  if (!state.ghost) state.ghost = createGhostPresenceState();
  return ensureGhostPresenceState(state.ghost);
}

function ensureAutonomy() {
  if (!state.autonomy) state.autonomy = createAutonomyState();
  return ensureAutonomyState(state.autonomy);
}

function ensureObjectives() {
  state.objectives = ensureObjectiveState(state.objectives);
  return state.objectives;
}

function applyObjectiveEvent(event, context = {}) {
  const outcome = noteObjectiveEvent(ensureObjectives(), event, context);
  if (!outcome) return;
  line(outcome.resolvedLine, 'good');
  line(outcome.nextLine, 'hint');
}

function ensureArchiveInvestigationState() {
  state.player.archiveInvestigation ??= {};
  const archive = state.player.archiveInvestigation;
  archive.latchChecked ??= false;
  archive.cabinetOpened ??= false;
  archive.boxMoved ??= false;
  archive.shelvesExamined ??= false;
  archive.ledgersChecked ??= false;
  archive.clueCount ??= 0;
  archive.minuteDiscovered ??= false;
  return archive;
}

function ensureGovernanceAccessState() {
  const defaults = createGovernanceState().access;
  state.governance.access ??= defaults;
  state.governance.access.gates ??= {};
  Object.entries(defaults.gates).forEach(([gateId, gateDefault]) => {
    state.governance.access.gates[gateId] = {
      ...gateDefault,
      ...(state.governance.access.gates[gateId] ?? {}),
    };
  });
  return state.governance.access;
}

function eastGateState() {
  ensureGovernanceAccessState();
  return state.governance.access.gates['hall:east'];
}

const ghostResidueTemplates = {
  foyer: [
    'The noticeboard has been altered since your last certainty: two pins moved, one line underlined twice, and "carry Item 2" initialled "R.V.".',
    'A partial signature trails off in the margin of a posted agenda: "signed only: K."',
    'A posted motion already bears a seconding mark from "J.M." though no seconder is present.',
  ],
  hall: [
    'One chair by the table still carries body-warmth, though no one claims it.',
    'The table already holds a proposal card, weighted with a brass clip you did not place.',
    'The iron key sits at a new angle, recently handled, as if returned by someone rushing onward.',
  ],
  lockedRoom: [
    'A pen lies uncapped beside the minutes, as if interrupted mid-sentence.',
    'The seal sits a finger-width off its usual place, recently handled.',
    'The minutes include an added line — "provisional assent logged" — initialled only "S.H.".',
  ],
  eastCorridor: [
    'Recent footsteps seem to have ended at a blank wall and then chosen silence.',
    'A door is not fully latched, as if someone left in a hurry and remembered decorum late.',
    'A margin slip on the notice rail reads "M.C. already objected" in hurried pencil.',
  ],
  archive: [
    'The ledger fragment is not where memory says it was.',
    'A folder spine has a fresh pencilled initial: "M. Vale".',
    'A bound ledger is open to a page marked "carried over by K." and then shut before context arrives.',
  ],
  courtyard: [
    'Two sentences drift from an unseen corner, then stop before either speaker can be identified.',
    'A distant sneeze is followed by a faint "bless you" from somewhere the walls do not specify.',
    'Someone has shifted a rain barrel ledger slate; the chalk note now reads "E.V. passed through".',
  ],
};

function maybeSeedGhostProposal(initial = false) {
  const ghost = ensureGhostState();
  if (state.governance.pendingProposal) return null;
  if (ghost.proposalCooldown > 0) return null;
  const chance = initial ? 0.45 : 0.09;
  if (Math.random() > chance) return null;
  const seeded = ghostProposalEntry(ghost);
  state.governance.pendingProposal = {
    text: seeded.text,
    turnOpened: Date.now(),
    source: 'institutional-trace',
    attribution: seeded.actor.display,
  };
  state.governance.committeeMemory.unshift(seeded.memory);
  state.governance.committeeMemory = state.governance.committeeMemory.slice(0, 8);
  ghost.seededAtLeastOnce = true;
  ghost.proposalCooldown = 7;
  return seeded.line;
}

function decayGhostResidue() {
  const ghost = ensureGhostState();
  Object.entries(ghost.roomResidue).forEach(([roomId, residue]) => {
    if (!residue) return;
    residue.freshness = (residue.freshness ?? 0) - 1;
    if (residue.freshness <= 0) delete ghost.roomResidue[roomId];
  });
  ghost.proposalCooldown = Math.max(0, (ghost.proposalCooldown ?? 0) - 1);
}

function maybeAdvanceGhostPresence() {
  const ghost = ensureGhostState();
  ensurePlayerIdentity(state.player);
  ghost.turn += 1;
  decayGhostResidue();

  const initialSeed = !ghost.seededAtLeastOnce && ghost.turn <= 1;
  const seeded = maybeSeedGhostProposal(initialSeed);
  if (seeded) emitNarrativeLine(seeded, { priority: narrativePriority.P2, cooldownKey: 'ghost-proposal', cooldownTurns: 6 });

  if (ghost.nearEncounterCooldown > 0) ghost.nearEncounterCooldown -= 1;
  if (ghost.turn - ghost.lastEventTurn < 2) return;
  if (Math.random() > 0.2) return;

  const candidateRooms = Object.keys(ghostResidueTemplates);
  const roomId = candidateRooms[Math.floor(Math.random() * candidateRooms.length)];
  const options = ghostResidueTemplates[roomId];
  const lineText = options[Math.floor(Math.random() * options.length)];
  ghost.roomResidue[roomId] = {
    text: lineText,
    freshness: 5 + Math.floor(Math.random() * 4),
  };
  if (Math.random() < 0.5) ghostProposalEntry(ghost);
  if (ghost.nearEncounterCooldown <= 0 && Math.random() < 0.03) {
    emitNarrativeLine(ghostNearEncounterLine(ghost), {
      priority: narrativePriority.P2,
      cooldownKey: 'ghost-near-encounter',
      cooldownTurns: 10,
    });
    ghost.nearEncounterCooldown = 8;
  }
  ghost.lastEventTurn = ghost.turn;
}

function roomGhostResidueLine(roomId) {
  const ghost = ensureGhostState();
  const residue = ghost.roomResidue?.[roomId];
  if (!residue?.text) return null;
  return residue.text;
}

function maybePorterNearMissDialogue() {
  const ghost = ensureGhostState();
  if (!porterIsHere()) return null;
  if (ghost.turn - ghost.lastPorterNearMissTurn < 4) return null;
  if (Math.random() > 0.28) return null;

  const baseLines = [
    porterGhostWitnessLine(ghost),
    'Porter: "Hart preferred the east door and refused to explain why."',
    'Porter: "Another visitor moved the proposal cards into urgency order, signed only J.M."',
    'Porter: "Vale nearly crossed paths with you at the archive bend, then thought better of being seen."',
    'Porter: "Someone left before agreeing with themselves."',
  ];
  const signatureLine = ghost.lastSignature && Math.random() < 0.3
    ? `Porter: "The register kept only ${ghost.lastSignature}."`
    : null;
  ghost.lastPorterNearMissTurn = ghost.turn;
  return [baseLines[Math.floor(Math.random() * baseLines.length)], signatureLine].filter(Boolean).join(' ');
}

function line(text, cls = '') {
  const p = document.createElement('p');
  p.className = `line ${cls}`.trim();
  p.textContent = text;
  dom.output.appendChild(p);
  dom.output.scrollTop = dom.output.scrollHeight;
}

function porterIsHere() {
  return isAgentPresentInRoom('porter', state.player.currentRoom);
}

function createNpcTurnInvariant() {
  return {
    roomId: state.player.currentRoom,
    presentHereIds: new Set(),
    arrivedIds: new Set(),
    ambientSpeakerIds: new Set(),
  };
}

let npcTurnInvariant = createNpcTurnInvariant();

function setTurnVisibleNpcs(agentIds = [], roomId = state.player.currentRoom) {
  state.turnVisibleNpcs = [...agentIds];
  state.turnVisibleNpcRoomId = roomId;
}

function getTurnVisibleNpcSet(roomId = state.player.currentRoom) {
  if (state.turnVisibleNpcRoomId !== roomId) return new Set();
  return new Set(state.turnVisibleNpcs ?? []);
}

function capturePresenceSnapshot(roomId = state.player.currentRoom) {
  const presentIds = new Set(
    Object.values(state.agents)
      .filter((agent) => agent?.roomId === roomId)
      .map((agent) => agent.id),
  );
  return { roomId, presentIds };
}

function presentAgentsForRoom(roomId = state.player.currentRoom, presence = null) {
  const activePresence = presence && presence.roomId === roomId
    ? presence
    : capturePresenceSnapshot(roomId);
  return Object.values(state.agents).filter((agent) => activePresence.presentIds.has(agent.id));
}

function isAgentPresentInRoom(agentId, roomId = state.player.currentRoom, presence = null) {
  if (!agentId) return false;
  if (presence && presence.roomId === roomId) return presence.presentIds.has(agentId);
  return state.agents[agentId]?.roomId === roomId;
}

function rememberRecentDepartures(previousRooms, playerRoomId) {
  if (!state.player.recentDeparturesByRoom) state.player.recentDeparturesByRoom = {};
  const departed = Object.entries(previousRooms)
    .filter(([, fromRoom]) => fromRoom === playerRoomId)
    .map(([agentId]) => agentId)
    .filter((agentId) => state.agents[agentId]?.roomId !== playerRoomId);
  state.player.recentDeparturesByRoom[playerRoomId] = departed;
}

function wasRecentlyPresent(agentId, roomId = state.player.currentRoom) {
  const departures = state.player.recentDeparturesByRoom?.[roomId] ?? [];
  return departures.includes(agentId);
}

function ensureNarrativePacing() {
  if (!state.narrative.pacing) {
    state.narrative.pacing = {
      turn: 0,
      priorityCap: narrativePriority.P3,
      cooldowns: {},
      lastTensionWarningTurn: -999,
      lastTensionWarnedAt: null,
    };
  }
  return state.narrative.pacing;
}

function beginNarrativeTurn() {
  const pacing = ensureNarrativePacing();
  pacing.turn += 1;
  pacing.priorityCap = narrativePriority.P3;
  npcTurnInvariant = createNpcTurnInvariant();
}

function notePresentHere(agentIds, roomId = state.player.currentRoom) {
  if (!npcTurnInvariant || npcTurnInvariant.roomId !== roomId) return;
  agentIds.forEach((id) => npcTurnInvariant.presentHereIds.add(id));
}

function noteArrivals(agentIds, roomId = state.player.currentRoom) {
  if (!npcTurnInvariant || npcTurnInvariant.roomId !== roomId) return;
  agentIds.forEach((id) => npcTurnInvariant.arrivedIds.add(id));
}

function noteAmbientSpeech(agentId, roomId = state.player.currentRoom) {
  if (!agentId) return;
  if (!npcTurnInvariant || npcTurnInvariant.roomId !== roomId) return;
  npcTurnInvariant.ambientSpeakerIds.add(agentId);
}

function markNarrativePriority(priority) {
  const pacing = ensureNarrativePacing();
  pacing.priorityCap = Math.min(pacing.priorityCap, priority);
}

function emitNarrativeLine(text, options = {}) {
  if (!text) return false;
  const {
    cls = 'hint',
    priority = narrativePriority.P3,
    cooldownKey = null,
    cooldownTurns = 0,
  } = options;
  const pacing = ensureNarrativePacing();
  if (priority > pacing.priorityCap) return false;
  if (cooldownKey && cooldownTurns > 0) {
    const lastTurn = pacing.cooldowns[cooldownKey];
    if (Number.isInteger(lastTurn) && pacing.turn - lastTurn < cooldownTurns) return false;
  }
  line(text, cls);
  pacing.priorityCap = Math.min(pacing.priorityCap, priority);
  if (cooldownKey) pacing.cooldowns[cooldownKey] = pacing.turn;
  return true;
}

function rememberPorterLine(text) {
  if (!text) return;
  const recent = state.narrative?.recentLines;
  if (!Array.isArray(recent)) return;
  recent.push(text);
  if (recent.length > 14) recent.shift();
}

function porterContextSystem() {
  return {
    ...state.system,
    porterPresent: porterIsHere(),
    porterSignals: { ...(state.agents.porter.memorySignals ?? {}) },
  };
}

function maybeLinePorter(text, chance = 1, cls = 'hint') {
  if (!text || !porterIsHere() || Math.random() > chance) return false;
  const recent = state.narrative?.recentLines ?? [];
  if (recent.slice(-10).includes(text)) return false;
  line(text, cls);
  noteAmbientSpeech('porter');
  rememberPorterLine(text);
  return true;
}

function levenshteinDistance(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, (_, i) => {
    const row = Array(cols).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}

function typoDistanceLimit(input) {
  if (input.length <= 4) return 1;
  return 2;
}

function buildItemReferenceCandidates(scopes = []) {
  const candidateNames = [...new Set(scopes.flat().filter(Boolean))];
  const phraseToItems = new Map();

  const addPhrase = (phraseRaw, itemName) => {
    const phrase = normalizeCommandInput(phraseRaw);
    if (!phrase) return;
    if (!phraseToItems.has(phrase)) phraseToItems.set(phrase, new Set());
    phraseToItems.get(phrase).add(itemName);
  };

  candidateNames.forEach((itemName) => {
    const def = getItemDefinition(state.world, itemName);
    const label = def?.label ?? itemName;
    const aliases = def?.aliases ?? [];
    const basePhrases = new Set([itemName, label, ...aliases]);
    basePhrases.forEach((phrase) => {
      addPhrase(phrase, itemName);
      const words = normalizeCommandInput(phrase).split(' ').filter(Boolean);
      words.forEach((word) => {
        if (word.length >= 3) addPhrase(word, itemName);
      });
    });
  });

  return { candidateNames, phraseToItems };
}

function resolveItemName(inputRaw, scopes = []) {
  const input = normalizeCommandInput(inputRaw);
  if (!input) return { matchedName: null, suggestion: null };
  const { candidateNames, phraseToItems } = buildItemReferenceCandidates(scopes);
  if (!candidateNames.length) return { matchedName: null, suggestion: null };
  const words = input.split(' ');

  const exactMatches = phraseToItems.get(input);
  if (exactMatches?.size === 1) return { matchedName: [...exactMatches][0], suggestion: null };

  const partialMatches = [...phraseToItems.entries()]
    .filter(([phrase]) => phrase.startsWith(input) || words.every((word) => phrase.includes(word)))
    .flatMap(([, itemNames]) => [...itemNames]);
  const partialItems = [...new Set(partialMatches)];
  if (partialItems.length === 1) return { matchedName: partialItems[0], suggestion: null };

  const rankedByItem = new Map();
  [...phraseToItems.entries()].forEach(([phrase, itemNames]) => {
    const limit = Math.min(typoDistanceLimit(input), typoDistanceLimit(phrase));
    const distance = levenshteinDistance(input, phrase);
    if (distance > limit) return;
    itemNames.forEach((itemName) => {
      const current = rankedByItem.get(itemName);
      if (!current || distance < current.distance) rankedByItem.set(itemName, { itemName, distance });
    });
  });

  const ranked = [...rankedByItem.values()].sort((a, b) => a.distance - b.distance);
  if (!ranked.length) return { matchedName: null, suggestion: null };
  if (ranked.length === 1) return { matchedName: ranked[0].itemName, suggestion: null };
  if (ranked[0].distance < ranked[1].distance) return { matchedName: ranked[0].itemName, suggestion: null };
  return { matchedName: null, suggestion: ranked[0].itemName };
}

function resolveItemInScope(itemRaw, scopes = []) {
  return resolveItemName(itemRaw, scopes);
}

const itemPronouns = new Set(['it', 'that', 'this']);
const itemArticles = new Set(['the', 'a', 'an', 'my']);

function stripItemArticles(itemRaw = '') {
  const words = normalizeCommandInput(itemRaw).split(' ').filter(Boolean);
  while (words.length > 1 && itemArticles.has(words[0])) words.shift();
  return words.join(' ');
}

function resolveItemReference(itemRaw, scopes = []) {
  const normalized = normalizeCommandInput(itemRaw);
  const usingPronoun = itemPronouns.has(normalized);
  const pronounFallback = usingPronoun ? state.player.lastReferencedItem : null;
  const resolution = usingPronoun
    ? resolveItemInScope(pronounFallback ?? '', scopes)
    : resolveItemInScope(stripItemArticles(itemRaw), scopes);
  return {
    matchedName: resolution.matchedName,
    suggestion: resolution.suggestion,
    usedPronoun: usingPronoun,
    pronounFailed: usingPronoun && !resolution.matchedName,
  };
}

function rememberReferencedItem(itemName) {
  if (!itemName) return;
  state.player.lastReferencedItem = itemName;
}

function itemDisplayLabel(itemName) {
  const def = getItemDefinition(state.world, itemName);
  return def?.label ?? itemName;
}

function governancePresence(roomId) {
  if (governanceKeyRooms.has(roomId)) return 'primary';
  if (governanceSupportRooms.has(roomId)) return 'secondary';
  return 'background';
}

function suggestionThreshold(roomId) {
  const presence = governancePresence(roomId);
  if (presence === 'primary') return 1;
  if (presence === 'secondary') return 2;
  return 3;
}

function governanceRelevanceContext() {
  const objectives = ensureObjectives();
  const concern = currentConcern(objectives);
  return {
    currentConcern: concern?.unresolved ?? '',
    activeObjective: concern?.title ?? '',
    recentUnresolvedIssues: recentUnresolvedConcernLines(objectives, 3),
  };
}

function governanceRedirectionLine(streak, speaker = 'porter') {
  if (speaker === 'bernard') {
    return streak >= 3
      ? "Bernard says, 'Procedure is elegant. Item 7 is still missing.'"
      : "Bernard says, 'Useful form. The unresolved minute still outranks it.'";
  }
  if (speaker === 'room') {
    return streak >= 3
      ? 'The room records your vote, but the absent minute remains absent.'
      : 'The room accepts the formality, while the unresolved file keeps its weight.';
  }
  return streak >= 3
    ? "The porter says, 'That may matter later. The missing minute matters now.'"
    : "The porter says, 'Noted. Keep one hand on the live concern while we do this.'";
}

function governanceNarrativeDepth(roomId) {
  const presence = governancePresence(roomId);
  if (presence === 'primary') return 3;
  if (presence === 'secondary') return 2;
  return 1;
}

function maybeShowGovernanceHints(lastVerb) {
  const depth = governanceNarrativeDepth(state.player.currentRoom);
  if (state.governanceUi.lastDecisionFailed && depth >= 2 && ensureNarrativePacing().priorityCap >= narrativePriority.P2) {
    emitNarrativeLine('The idea stalls. You can push it forward with "push".', {
      priority: narrativePriority.P2,
      cooldownKey: 'decision-stall',
      cooldownTurns: 3,
    });
  }
}

function maybeShowTensionWarning(lastVerb, tensionBefore) {
  const depth = governanceNarrativeDepth(state.player.currentRoom);
  if (depth < 1 || ['calm', 'mediate'].includes(lastVerb) || state.system.tension < 7) return;
  const pacing = ensureNarrativePacing();
  const tensionRise = state.system.tension - tensionBefore;
  const enoughTimePassed = pacing.turn - pacing.lastTensionWarningTurn >= 7;
  const meaningfulRise = tensionRise >= 2 || (tensionRise >= 1 && state.system.tension >= 8);
  if (!meaningfulRise && !enoughTimePassed) return;
  const emitted = emitNarrativeLine('The room is getting sharp; you can calm things with "calm".', {
    priority: narrativePriority.P2,
    cooldownKey: 'tension-warning',
    cooldownTurns: 5,
  });
  if (emitted) {
    pacing.lastTensionWarningTurn = pacing.turn;
    pacing.lastTensionWarnedAt = state.system.tension;
  }
}

function tagsFromObject(obj) {
  return describeNorms(obj).join(' • ');
}

function moodDescriptor(system) {
  if (system.tension <= 2) {
    return {
      title: 'Quiet confidence',
      reflection: 'People proceed gently, as if the room trusts its own rhythm for now.',
    };
  }
  if (system.tension <= 4) {
    return {
      title: 'Workable equilibrium',
      reflection: 'Differences are still manageable, and process is carrying more weight than personality.',
    };
  }
  if (system.tension <= 6) {
    return {
      title: 'Careful strain',
      reflection: 'The group is still functioning, though tone now matters as much as substance.',
    };
  }
  if (system.tension <= 8) {
    return {
      title: 'Frayed coordination',
      reflection: 'Everyone is tracking risk; small gestures are interpreted as signals.',
    };
  }
  return {
    title: 'Brittle atmosphere',
    reflection: 'The institution is operating, but every move is being read for threat or retreat.',
  };
}

function socialStandingLine(name, value) {
  if (value >= 3) return `${name} now treats you as a credible participant, not a passing interruption.`;
  if (value >= 1) return `${name} remains open to your voice, though not unguarded.`;
  if (value <= -3) return `${name} keeps marked distance, expecting disruption before cooperation.`;
  if (value <= -1) return `${name} has become watchful around your interventions.`;
  return `${name} is still reading you in real time.`;
}

const standingSignalThresholds = {
  ada: [
    { at: 2, up: 'Ada stops interrupting.', down: 'Ada starts cutting in before your point lands.' },
    { at: 4, up: 'Ada treats your calls for motion as timing, not noise.', down: 'Ada now reads your urgency as noise again.' },
  ],
  bernard: [
    { at: 2, up: 'Bernard no longer challenges the premise first.', down: 'Bernard returns to contesting your premise before anything else.' },
    { at: 4, up: 'Bernard asks process questions as if you already belong in the sequence.', down: 'Bernard reverts to procedural cross-examination.' },
  ],
  cyra: [
    { at: 2, up: 'Cyra answers directly for once.', down: 'Cyra returns to framing around you rather than with you.' },
    { at: 4, up: 'Cyra starts using your wording when mediating between others.', down: 'Cyra drops your wording and reframes from distance again.' },
  ],
  porter: [
    { at: 2, up: 'The porter does not correct your wording.', down: 'The porter resumes correcting your terms.' },
    { at: 4, up: 'The porter treats your requests as continuity, not interruption.', down: 'The porter reads you as interruption again.' },
  ],
};

function applyStandingDelta(target, delta, reason = 'routine') {
  const result = shiftStanding(state.social, target, delta);
  if (!result.delta) return;
  const thresholds = standingSignalThresholds[target] ?? [];
  thresholds.forEach((threshold) => {
    if (result.before < threshold.at && result.after >= threshold.at) {
      line(threshold.up, result.delta > 0 ? 'good' : 'hint');
    } else if (result.before >= threshold.at && result.after < threshold.at) {
      line(threshold.down, 'warn');
    }
  });
  if (reason === 'drift' && delta < 0 && Math.random() < 0.45) {
    line('Someone notes the move as procedural theatre rather than contribution.', 'warn');
  }
}

function legitimacyStandingScore() {
  const standing = state.social.standing ?? {};
  const total = (standing.ada ?? 0) + (standing.bernard ?? 0) + (standing.cyra ?? 0) + (standing.porter ?? 0);
  const supports = ['ada', 'bernard', 'cyra', 'porter'].filter((id) => (standing[id] ?? 0) >= 1).length;
  const ready = (standing.porter ?? 0) >= 2 && total >= 7 && supports >= 3;
  return { total, supports, ready };
}

function legitimacyStatusLine() {
  const { ready, total, supports } = legitimacyStandingScore();
  if (ready) return 'You are beginning to be treated as part of the process.';
  if (total <= 0 || supports <= 1) return 'They still hear you as interruption, not continuity.';
  if (total <= 4) return 'Some members now treat you as procedural, others as temporary noise.';
  return 'Your legitimacy is uneven but increasingly legible across the room.';
}

function behaviouralReputationLine(log) {
  if (!log.length) return 'Your procedural reputation has not yet settled.';
  const recent = log.slice(-10);
  const counts = recent.reduce((acc, label) => {
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = ranked[0]?.[0];
  if (top === 'challenge') return 'You are known for pushing pressure points until the room has to answer.';
  if (top === 'mediate') return 'You are read as a stabiliser who prefers de-escalation over spectacle.';
  if (top === 'propose') return 'You are seen as someone who keeps introducing frames for collective action.';
  if (top === 'reset') return 'You are associated with revisiting routines when they harden too quickly.';
  return 'Your behavioural signature is still mixed, and interpretations vary by observer.';
}

function institutionalEffectLine(system) {
  if (!system.recentRipples.length) return 'No durable institutional effect is visible yet.';
  const ripple = system.recentRipples[0].toLowerCase();
  if (ripple.includes('de-escalation') || ripple.includes('calm')) {
    return 'Recent moves have lowered the emotional temperature of committee work.';
  }
  if (ripple.includes('escalation') || ripple.includes('conflict')) {
    return 'Recent moves have made contestation feel more central to how decisions happen.';
  }
  return `Current institutional drift: ${system.recentRipples[0]}`;
}

function showScore() {
  ensurePlayerIdentity(state.player);
  const identityName = state.player.identity.name;
  line('Standing review:', 'system');
  line(`- Record identity: ${identityName}.`, 'hint');
  line(`- ${socialStandingLine('The porter', state.social.relationships.porter)}`, 'hint');
  const porterAttitude = state.agents.porter.attitude;
  if (porterAttitude === 'resistant') {
    line('- The porter remains polite, but no longer assumes good intent.', 'hint');
  } else if (porterAttitude === 'cooperative') {
    line('- The porter now meets you with practical trust and occasional procedural shortcuts.', 'hint');
  } else {
    line('- The porter is watchful: civil, observant, and not yet persuaded.', 'hint');
  }
  line(`- ${socialStandingLine('Ada', state.social.relationships.ada)}`, 'hint');
  line(`- ${socialStandingLine('Bernard', state.social.relationships.bernard)}`, 'hint');
  line(`- ${socialStandingLine('Cyra', state.social.relationships.cyra)}`, 'hint');
  line(`- ${behaviouralReputationLine(state.social.behaviouralLog)}`, 'hint');
  if ((state.agents.porter.memorySignals?.governancePush ?? 0) >= 2.5) {
    line('- People are beginning to expect you to press decisions before consensus.', 'hint');
  } else if ((state.agents.porter.memorySignals?.governanceCalm ?? 0) >= 2.5) {
    line('- People increasingly expect you to mediate before lines harden.', 'hint');
  }
  if ((state.governanceUi.lowRelevanceStreak ?? 0) >= 2) {
    line('- Your attention is being noticed, though not always for the right problem.', 'hint');
  }
  line(`- ${institutionalEffectLine(state.system)}`, 'hint');
  line(`- ${legitimacyStatusLine()}`, 'hint');
  line(`- ${currentConcernLine(ensureObjectives())}`, 'hint');
  line(`- ${scoreIdentityComparison(state.player.identity, ensureGhostState())}`, 'hint');
  const latestMemory = state.governance.committeeMemory[0];
  line(
    latestMemory
      ? `- Most recent committee memory: ${renderCommitteeMemory(latestMemory)}`
      : '- Committee memory has not accepted or rejected anything yet.',
    'hint',
  );
}

function refreshSidebar() {
  const roomObj = state.world.rooms[state.player.currentRoom];
  ensurePlayerIdentity(state.player);
  dom.room.textContent = roomObj.name;
  if (dom.identity) dom.identity.textContent = state.player.identity.name;
  dom.exits.textContent = Object.keys(roomObj.exits).join(', ');
  dom.inventory.textContent = state.player.inventory.map(itemDisplayLabel).join(', ') || 'empty';
  dom.norms.textContent = tagsFromObject(state.governance.norms);
  const mood = moodDescriptor(state.system);
  dom.tension.textContent = `${mood.title}\n${mood.reflection}`;
  const concernLine = currentConcernLine(ensureObjectives());
  dom.memory.textContent = state.governance.committeeMemory[0]
    ? `Most recent entry: ${renderCommitteeMemory(state.governance.committeeMemory[0])}\n${concernLine}`
    : `Nothing has settled into institutional memory yet.\n${concernLine}`;
}

function renderRoom(turnPresence = null) {
  ensureGhostState();
  const roomId = state.player.currentRoom;
  updatePorterVisibility(state.agents, roomId);
  const pacing = getRoomPacing(state.world, roomId);
  const roomPresence = turnPresence && turnPresence.roomId === roomId
    ? turnPresence
    : capturePresenceSnapshot(roomId);
  const presentAgents = presentAgentsForRoom(roomId, roomPresence);
  state.player.visitCounts[roomId] = (state.player.visitCounts[roomId] ?? 0) + 1;
  const visits = state.player.visitCounts[roomId];
  emitNarrativeLine(
    describeRoom(state.world, roomId, state.system.state, {
      visitCount: visits,
      lastTensionDirection: state.narrative?.context?.lastTensionDirection ?? 'flat',
      recentDecisions: state.governance.committeeMemory.slice(0, 3),
      recentNarrativeLines: state.narrative?.recentLines ?? [],
      weather: state.weather,
    }),
    { cls: 'system', priority: narrativePriority.P1 },
  );
  if (Math.random() < pacing.ambientNarrativeChance) {
    emitNarrativeLine(atmosphereNarrative(state.system.state, state.narrative), {
      priority: narrativePriority.P3,
    });
  }
  const residueLine = roomGhostResidueLine(roomId);
  if (residueLine) {
    emitNarrativeLine(residueLine, {
      priority: narrativePriority.P3,
      cooldownKey: `ghost-residue-${roomId}`,
      cooldownTurns: 4,
    });
  }
  if (Math.random() < 0.14) {
    const concernNote = maybeConcernHint(ensureObjectives(), 'ambient');
    if (concernNote) emitNarrativeLine(concernNote, { priority: narrativePriority.P3, cls: 'hint' });
  }
  const autonomyLine = roomAutonomyConsequence(roomId, ensureAutonomy());
  if (autonomyLine) {
    emitNarrativeLine(autonomyLine, {
      priority: narrativePriority.P2,
      cooldownKey: `autonomy-${roomId}`,
      cooldownTurns: 5,
    });
  }
  const roomGhost = maybeDirectionalGhostGlimpse(state.narrative);
  if (roomGhost) emitNarrativeLine(roomGhost, { priority: narrativePriority.P3 });
  if (visits === 1) {
    const firstVisitLine = pacing.ambientNarrativeChance <= 0.1
      ? 'This space accepts your presence without comment.'
      : 'You are here for the first time; the place feels more observed than empty.';
    emitNarrativeLine(firstVisitLine, { priority: narrativePriority.P3 });
  } else if (visits > 2) {
    if (Math.random() < pacing.roomEventChance) {
      emitNarrativeLine('On return, familiar details have shifted by a degree you cannot quite prove.', {
        priority: narrativePriority.P3,
      });
    }
  }
  const roomObj = state.world.rooms[state.player.currentRoom];
  if (roomObj.items.length) {
    emitNarrativeLine(`Items here: ${roomObj.items.map(itemDisplayLabel).join(', ')}.`, {
      priority: narrativePriority.P1,
    });
  }
  if (presentAgents.length) {
    const names = presentAgents.map((agent) => agent.name).join(', ');
    setTurnVisibleNpcs(presentAgents.map((agent) => agent.id), roomId);
    notePresentHere(presentAgents.map((agent) => agent.id), roomId);
    emitNarrativeLine(`Present here: ${names}.`, {
      priority: narrativePriority.P1,
    });
  } else if (Math.random() < 0.75) {
    setTurnVisibleNpcs([], roomId);
    emitNarrativeLine('No one is here right now; the room keeps its own counsel.', {
      priority: narrativePriority.P1,
    });
  } else {
    setTurnVisibleNpcs([], roomId);
  }
}

function save() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  line('The record is set down. Memory should hold through the next turning.', 'good');
}

function load() {
  const raw = localStorage.getItem(SAVE_KEY) || localStorage.getItem(LEGACY_SAVE_KEY);
  if (!raw) {
    line('No prior record is found.', 'warn');
    return;
  }
  state = JSON.parse(raw);
  if (!state.narrative) {
    state.narrative = createNarrativeState();
  }
  if (!state.governanceUi) {
    state.governanceUi = {
      suggestionStreak: 0,
      lastDecisionFailed: false,
      lowRelevanceStreak: 0,
    };
  }
  state.governanceUi.lowRelevanceStreak ??= 0;
  if (!state.weather) {
    state.weather = createWeatherState();
  }
  if (!state.player) {
    state.player = createGameState().player;
  }
  if (!state.player.recentDeparturesByRoom) {
    state.player.recentDeparturesByRoom = {};
  }
  ensureArchiveInvestigationState();
  if (!Array.isArray(state.turnVisibleNpcs)) {
    state.turnVisibleNpcs = [];
  }
  if (!Object.prototype.hasOwnProperty.call(state, 'turnVisibleNpcRoomId')) {
    state.turnVisibleNpcRoomId = null;
  }
  ensurePlayerIdentity(state.player);
  ensureGhostState();
  ensureAutonomy();
  ensureObjectives();
  ensureGovernanceAccessState();
  if (state.agents?.porter && !Object.prototype.hasOwnProperty.call(state.agents.ada ?? {}, 'roomId')) {
    state.agents.ada.roomId = 'hall';
    state.agents.bernard.roomId = 'eastCorridor';
    state.agents.cyra.roomId = 'courtyard';
  }
  line('The record is recalled.', 'good');
  refreshSidebar();
  renderRoom();
}

function move(direction) {
  const roomObj = state.world.rooms[state.player.currentRoom];
  const target = roomObj.exits[direction];
  if (!target) {
    line('No way opens there.', 'warn');
    return;
  }

  if (state.player.currentRoom === 'hall' && direction === 'east') {
    const gate = eastGateState();
    const hasKey = state.player.inventory.includes('iron key');
    const legitimacy = legitimacyStandingScore();
    const porterPresent = isAgentPresentInRoom('porter', 'hall');
    if (gate.status === 'locked') {
      line(
        porterPresent
          ? "The porter places a hand on the brass plate. 'Not now. The refusal has hardened into policy.'"
          : 'The refusal has settled into the lock; the mechanism does not answer.',
        'warn',
      );
      return;
    }
    if (gate.status === 'socially blocked' && !hasKey) {
      line(
        porterPresent
          ? "The porter taps the keyhole. 'Mechanisms still matter.'"
          : 'The lock remains shut; without the key, process does not proceed.',
        'warn',
      );
      return;
    }
    if (gate.status === 'socially blocked' && hasKey) {
      if (legitimacy.ready) {
        line(
          porterPresent
            ? 'The porter watches, says nothing, and does not stop you.'
            : 'The lock turns cleanly; no one contests your passage.',
          'good',
        );
        gate.status = 'open';
      } else {
      line(
        porterPresent
          ? "The porter says, 'You have the key, not the standing. Secure clearance first.'"
          : 'The mechanism yields halfway, then stops as if waiting for social clearance.',
        'warn',
      );
      return;
      }
    }
    if (gate.status === 'provisionally approved' && !hasKey) {
      line(
        porterPresent
          ? "The porter checks the ledger, then opens the door. 'Approved provisionally. I will witness entry.'"
          : 'A facilities runner appears with a temporary release order and opens the east door for one passage.',
        'good',
      );
    }
  }

  state.player.currentRoom = target;
  if (target === 'lockedRoom') {
    applyObjectiveEvent('entered-east-chamber');
  }
  renderRoom();
}

function takeItem(itemRaw) {
  const roomObj = state.world.rooms[state.player.currentRoom];
  const { matchedName, pronounFailed, suggestion } = resolveItemReference(itemRaw, [roomObj.items]);
  if (pronounFailed) {
    line('You pause. It is not clear what "it" refers to.', 'warn');
    return;
  }
  if (!matchedName) {
    line(
      suggestion
        ? `That item is not here. Did you mean ${itemDisplayLabel(suggestion)}?`
        : 'That item is not here.',
      'warn',
    );
    return;
  }
  removeItemFromRoom(state.world, state.player.currentRoom, matchedName);
  state.player.inventory.push(matchedName);
  rememberReferencedItem(matchedName);
  line(`You take ${itemDisplayLabel(matchedName)}.`, 'good');

  if (matchedName === 'iron key') {
    if (porterIsHere()) {
      maybeLinePorter("The porter notes that you took it without pocketing ceremony. 'Practical,' he says.");
      applyRelationship(state.social, 'porter', 1);
      shiftPorterTrust(state.agents, 1);
      recordPorterMemory(state.agents, 'Player acquired the hall key responsibly.');
    }
  }
}

function useItem(itemRaw) {
  const {
    matchedName: invExact,
    pronounFailed,
    suggestion,
  } = resolveItemReference(itemRaw, [state.player.inventory]);
  if (pronounFailed) {
    line('You pause. It is not clear what "it" refers to.', 'warn');
    return;
  }
  if (!invExact) {
    line(
      suggestion
        ? `You are not carrying that. Did you mean ${itemDisplayLabel(suggestion)}?`
        : 'You are not carrying that.',
      'warn',
    );
    return;
  }

  rememberReferencedItem(invExact);
  const itemDef = getItemDefinition(state.world, invExact);
  let contextual = itemDef?.useTextByRoom?.[state.player.currentRoom];
  if (invExact === 'iron key' && state.player.currentRoom === 'hall') {
    const gate = eastGateState();
    const legitimacy = legitimacyStandingScore();
    if (gate.status === 'socially blocked') {
      contextual = legitimacy.ready
        ? 'You test the key in the brass lock. It turns fully; nobody contests the motion.'
        : 'You test the key in the brass lock. The mechanism turns, then waits for social clearance.';
    } else if (gate.status === 'provisionally approved') {
      contextual = 'The key turns this time. Provisional approval has already loosened the mechanism.';
    } else if (gate.status === 'open') {
      contextual = 'The key turns freely. Facilities already released east access after the vote.';
    } else if (gate.status === 'locked') {
      contextual = 'The key bites, but the lock refuses to complete the turn. The refusal has become institutional.';
    }
  }
  line(
    contextual
      ?? itemDef?.useText
      ?? `You use ${itemDisplayLabel(invExact)}, but the world answers with professional ambiguity.`,
    'hint',
  );
}

const npcIds = ['porter', 'ada', 'bernard', 'cyra'];
const npcTargetAliases = {
  porter: ['porter', 'the porter'],
  ada: ['ada'],
  bernard: ['bernard'],
  cyra: ['cyra'],
};
const npcInteractionVerbs = new Set([
  'hi',
  'hello',
  'hey',
  'greet',
  'talk',
  'chat',
  'speak',
  'ask',
  'question',
  'inquire',
  'thank',
  'thanks',
  'praise',
  'poke',
  'slap',
  'kick',
  'insult',
  'mock',
  'observe',
  'give',
  'hand',
  'offer',
  'pass',
]);
const ambientCommands = new Set([
  'smile',
  'giggle',
  'cough',
  'wink',
  'shrug',
  'sigh',
  'listen',
  'fart',
  'nod',
  'wave',
  'laugh',
]);

function normalizeCommandInput(textRaw = '') {
  return textRaw
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function resolveNpcTarget(textRaw = '') {
  const lower = normalizeCommandInput(textRaw);
  if (!lower) return null;
  return npcIds.find((id) => (npcTargetAliases[id] ?? [id]).some((alias) => (
    lower === alias || lower.endsWith(` ${alias}`) || lower.startsWith(`${alias} `)
  ))) ?? null;
}

function parseNpcInteraction(textRaw) {
  const text = normalizeCommandInput(textRaw);
  if (!text) return null;

  let match = text.match(/^(?:hello|hi|hey|greet)\s+(?:to\s+)?(.+)$/);
  if (match) return { action: 'hello', targetText: match[1] };
  match = text.match(/^(?:talk|chat|speak)(?:\s+to)?\s+(.+)$/);
  if (match) return { action: 'talk', targetText: match[1] };
  match = text.match(/^say\s+(?:hello|hi|hey|greetings?)(?:\s+to)?\s+(.+)$/);
  if (match) return { action: 'hello', targetText: match[1] };
  match = text.match(/^(?:ask|question|inquire)\s+(.+?)(?:\s+about\s+(.+))?$/);
  if (match) return { action: 'ask', targetText: match[1], topic: match[2] ?? '' };
  match = text.match(/^(?:give|hand|offer|pass)\s+(.+?)\s+to\s+(.+)$/);
  if (match) return { action: 'give', item: match[1], targetText: match[2] };
  match = text.match(/^(?:thank|thanks|praise)\s+(.+)$/);
  if (match) return { action: 'thank', targetText: match[1] };
  match = text.match(/^(?:insult|mock)\s+(.+)$/);
  if (match) return { action: 'insult', targetText: match[1] };
  match = text.match(/^observe\s+(.+)$/);
  if (match) return { action: 'observe', targetText: match[1] };
  match = text.match(/^(poke|slap|kick)\s+(.+)$/);
  if (match) return { action: match[1], targetText: match[2] };
  return null;
}

function resolveNpcPresenceForInteraction(targetId, turnPresence = null) {
  const roomId = state.player.currentRoom;
  const inCurrentTurnSnapshot = Boolean(turnPresence?.presentIds?.has(targetId));
  const inRenderedPresentHereThisTurn = Boolean(
    npcTurnInvariant
      && npcTurnInvariant.roomId === roomId
      && npcTurnInvariant.presentHereIds.has(targetId),
  );
  const inArrivalNarrationThisTurn = Boolean(
    npcTurnInvariant
      && npcTurnInvariant.roomId === roomId
      && npcTurnInvariant.arrivedIds.has(targetId),
  );
  const inCanonicalRoomPresence = isAgentPresentInRoom(targetId, roomId, turnPresence);
  const visibleThisTurn = getTurnVisibleNpcSet(roomId);
  const inTurnVisibleNpcs = visibleThisTurn.has(targetId);
  if (inTurnVisibleNpcs || inCurrentTurnSnapshot || inRenderedPresentHereThisTurn || inArrivalNarrationThisTurn || inCanonicalRoomPresence) {
    return {
      present: true,
      justMissed: false,
      inCurrentTurnSnapshot,
      inPresentHereThisTurn: inRenderedPresentHereThisTurn,
      inArrivalNarrationThisTurn,
      inTurnVisibleNpcs,
      inAmbientSpeechThisTurn: false,
      recentDeparture: false,
      lastSeenRoom: state.agents[targetId]?.lastSeenRoom ?? null,
      turnsSinceSeen: state.agents[targetId]?.turnsSinceSeen ?? null,
    };
  }

  const inAmbientSpeechThisTurn = Boolean(
    npcTurnInvariant
      && npcTurnInvariant.roomId === roomId
      && npcTurnInvariant.ambientSpeakerIds.has(targetId),
  );
  if (inAmbientSpeechThisTurn) {
    return {
      present: true,
      justMissed: false,
      inCurrentTurnSnapshot,
      inPresentHereThisTurn: inRenderedPresentHereThisTurn,
      inArrivalNarrationThisTurn,
      inTurnVisibleNpcs,
      inAmbientSpeechThisTurn,
      recentDeparture: false,
      lastSeenRoom: state.agents[targetId]?.lastSeenRoom ?? null,
      turnsSinceSeen: state.agents[targetId]?.turnsSinceSeen ?? null,
    };
  }

  const recentDeparture = wasRecentlyPresent(targetId, roomId);
  return {
    present: false,
    justMissed: recentDeparture,
    inCurrentTurnSnapshot,
    inPresentHereThisTurn: inRenderedPresentHereThisTurn,
    inArrivalNarrationThisTurn,
    inTurnVisibleNpcs,
    inAmbientSpeechThisTurn,
    recentDeparture,
    lastSeenRoom: state.agents[targetId]?.lastSeenRoom ?? null,
    turnsSinceSeen: state.agents[targetId]?.turnsSinceSeen ?? null,
  };
}

function interactNpc(parsed, turnPresence = null) {
  const targetId = resolveNpcTarget(parsed.targetText);
  if (!targetId) {
    line('Nobody by that name answers here.', 'warn');
    return;
  }

  let exactItem = null;
  if (parsed.action === 'give') {
    const giveResolution = resolveItemReference(parsed.item ?? '', [state.player.inventory]);
    exactItem = giveResolution.matchedName;
    if (giveResolution.pronounFailed) {
      line('You pause. It is not clear what "it" refers to.', 'warn');
      return;
    }
    if (!exactItem) {
      line(
        giveResolution.suggestion
          ? `You are not carrying that item to give. Did you mean ${itemDisplayLabel(giveResolution.suggestion)}?`
          : 'You are not carrying that item to give.',
        'warn',
      );
      return;
    }
    rememberReferencedItem(exactItem);
  }

  const presence = resolveNpcPresenceForInteraction(targetId, turnPresence);
  if (!presence.present) {
    if (
      presence.inTurnVisibleNpcs
      || presence.inCurrentTurnSnapshot
      || presence.inPresentHereThisTurn
      || presence.inArrivalNarrationThisTurn
      || presence.inAmbientSpeechThisTurn
    ) {
      console.error('Presence contradiction:', state.agents[targetId].name);
    }
    if (presence.justMissed) {
      const roomId = state.player.currentRoom;
      if (getTurnVisibleNpcSet(roomId).has(targetId)) {
        console.error(`[npc-invariant] impossible near-miss for ${targetId}; target is in state.turnVisibleNpcs.`);
      }
      line(`You just missed ${state.agents[targetId].name}.`, 'warn');
    } else {
      line('They are not here.', 'warn');
    }
    return;
  }

  if (parsed.action === 'talk' && targetId === 'porter') {
    line(talkToPorter(state.agents, state.system.state, state.social));
    const nearMiss = maybePorterNearMissDialogue();
    if (nearMiss) maybeLinePorter(nearMiss, 1);
    applyRelationship(state.social, 'porter', 1);
    applyStandingDelta('porter', 1, 'continuity');
    shiftPorterTrust(state.agents, 1);
    notePorterSocialMemory(state.agents, 'help', 0.6);
    recordPorterMemory(state.agents, 'Player initiated civil conversation.');
    applyObjectiveEvent('talk-porter');
    if (Math.random() < 0.5) maybeLinePorter(maybeConcernHint(ensureObjectives(), 'porter'), 1, 'hint');
    return;
  }

  const effectiveAction = parsed.action === 'talk' ? 'hello' : parsed.action;

  const outcome = interpretAgentInteraction(state.agents, state.social, {
    targetId,
    action: effectiveAction,
    topic: parsed.topic ?? '',
    item: exactItem ?? '',
  });
  line(outcome.text, outcome.css ?? 'hint');
  if (parsed.action === 'give') {
    const itemDef = getItemDefinition(state.world, exactItem);
    const specific = itemDef?.giveResponses?.[targetId];
    if (specific?.text) line(specific.text, 'hint');
    const relDelta = specific?.relationshipDelta ?? (targetId === 'porter' ? 1 : 0);
    if (relDelta) applyRelationship(state.social, targetId, relDelta);
    const trustDelta = specific?.trustDelta ?? 0;
    if (targetId === 'porter' && trustDelta) shiftPorterTrust(state.agents, trustDelta);
    if (targetId === 'porter' && specific) {
      notePorterSocialMemory(state.agents, 'gift', 1.2);
      if ((specific.relationshipDelta ?? 0) > 0 || (specific.trustDelta ?? 0) > 0) {
        notePorterSocialMemory(state.agents, 'help', 0.9);
      }
    }
    if (specific?.memory && targetId === 'porter') recordPorterMemory(state.agents, specific.memory);
    if (specific && exactItem === 'ledger fragment' && ['porter', 'bernard'].includes(targetId)) {
      applyStandingDelta(targetId, 2, 'record');
      if (targetId === 'porter') applyStandingDelta('bernard', 1, 'record');
    }
    if (specific && (specific.relationshipDelta || specific.trustDelta)) {
      state.governance.committeeMemory.unshift(`gifted:${exactItem}->${targetId}`);
      state.governance.committeeMemory = state.governance.committeeMemory.slice(0, 8);
    }
    if (specific) {
      state.player.inventory = state.player.inventory.filter((item) => item !== exactItem);
    } else {
      line(`${state.agents[targetId].name} leaves it with you for now; it seems more useful in your hands.`, 'hint');
    }
  }
  if (targetId === 'porter') {
    const topic = (parsed.topic ?? '').toLowerCase();
    if (parsed.action === 'ask' && /\b(missing minute|item 7|item7|ledger)\b/.test(topic)) {
      line('Porter: "Minutes disappear by being recorded too correctly."', 'hint');
      line('Porter: "It was never missing. Only filed where nobody wanted to look."', 'hint');
      applyStandingDelta('porter', 1, 'record');
      applyStandingDelta('bernard', 1, 'record');
    }
    if (topic.includes('m. cole') || topic.includes('m cole') || /\bcole\b/.test(topic)) {
      applyObjectiveEvent('asked-m-cole');
    }
    recordPorterMemory(state.agents, `Player used ${effectiveAction} with porter.`);
  } else if (parsed.action === 'ask' && targetId === 'bernard') {
    const topic = (parsed.topic ?? '').toLowerCase();
    if (/\b(missing minute|item 7|item7|minute)\b/.test(topic)) {
      line('Bernard says, "It was never missing. Only filed where nobody wanted to look."', 'hint');
      line('Bernard says, "Try deferred actions, not contested actions. People hide decisions in sequence."', 'hint');
      applyStandingDelta('bernard', 1, 'process');
    }
  } else if (parsed.action === 'ask' && targetId === 'cyra') {
    const topic = (parsed.topic ?? '').toLowerCase();
    if (/\b(missing minute|item 7|item7|minute)\b/.test(topic)) {
      line('Cyra says, "People hide decisions in sequence, not in secrecy."', 'hint');
      line('Cyra adds, "Check what was carried over, not what was redacted."', 'hint');
      applyStandingDelta('cyra', 1, 'mediation');
    }
  }
}

function archiveDiscoveryReady(archiveState) {
  const steps = [
    archiveState.latchChecked,
    archiveState.cabinetOpened,
    archiveState.boxMoved,
    archiveState.shelvesExamined,
    archiveState.ledgersChecked,
  ].filter(Boolean).length;
  return steps >= 3 || archiveState.clueCount >= 4;
}

function discoverMissingMinute() {
  const archiveState = ensureArchiveInvestigationState();
  if (archiveState.minuteDiscovered) return false;
  archiveState.minuteDiscovered = true;
  addItemToRoom(state.world, 'archive', 'minute of deferred actions');
  line('Behind a shifted ledger stack, you find a minute filed under deferred maintenance actions.', 'good');
  line('The signature block is complete. The agenda header is wrong by one sequence.', 'hint');
  line('Nothing was hidden; it was indexed under the prior norm template.', 'hint');
  state.governance.committeeMemory.unshift('recovered:minute-item7');
  state.governance.committeeMemory = state.governance.committeeMemory.slice(0, 8);
  applyStandingDelta('porter', 2, 'record');
  applyStandingDelta('bernard', 1, 'record');
  applyStandingDelta('cyra', 1, 'record');
  const gate = eastGateState();
  if (gate.status === 'socially blocked') {
    gate.status = 'provisionally approved';
  }
  applyObjectiveEvent('minute-recovered');
  return true;
}

function handleArchiveInvestigationCommand(verb, arg, normalizedText) {
  const roomId = state.player.currentRoom;
  const archiveState = ensureArchiveInvestigationState();
  const text = `${verb} ${arg}`.trim();
  const isArchiveSearch = (
    normalizedText === 'search archive'
    || normalizedText === 'inspect folders'
    || normalizedText === 'review files'
    || normalizedText === 'examine shelves'
    || normalizedText === 'read minutes'
    || normalizedText === 'check latch'
    || normalizedText === 'open cabinet'
    || normalizedText === 'move box'
    || normalizedText === 'look behind ledgers'
    || normalizedText === 'latch'
  );
  const cueMentions = /\b(latch|warm chair|fresh initials|shifted file|chair|initials|file)\b/.test(normalizedText);

  if (!isArchiveSearch && !cueMentions) return false;
  if (roomId !== 'archive') {
    if (normalizedText.includes('archive')) {
      line('The archive is upstairs to the east from the upper landing.', 'hint');
      return true;
    }
    line('You scan the area, but the procedural traces you want are stronger in the archive.', 'hint');
    return true;
  }

  if (verb === 'search' || /inspect folders|review files/.test(text)) {
    archiveState.clueCount += 1;
    line('You review archive folders by sequence. One file is shifted into deferred actions without cross-reference.', 'hint');
  } else if (normalizedText === 'read minutes') {
    if (archiveState.minuteDiscovered) {
      readItem('minute');
    } else {
      archiveState.clueCount += 1;
      line('Most minute books are routine. One index card points to "Deferred Actions, Porter Records".', 'hint');
    }
  } else if (normalizedText === 'check latch' || normalizedText === 'latch') {
    archiveState.latchChecked = true;
    archiveState.clueCount += 1;
    line('The latch gives slightly. Someone used this recently.', 'hint');
  } else if (normalizedText === 'open cabinet') {
    archiveState.cabinetOpened = true;
    archiveState.clueCount += 1;
    line('The cabinet opens to porter transfer binders and a warm chair pulled half clear.', 'hint');
  } else if (normalizedText === 'move box') {
    archiveState.boxMoved = true;
    archiveState.clueCount += 1;
    line('You move a mislabeled box. Fresh initials mark the underside: "P.R. carry-over".', 'hint');
  } else if (normalizedText === 'examine shelves') {
    archiveState.shelvesExamined = true;
    archiveState.clueCount += 1;
    line('The shelves are orderly except for one shifted file tucked after older norm assumptions.', 'hint');
  } else if (normalizedText === 'look behind ledgers') {
    archiveState.ledgersChecked = true;
    archiveState.clueCount += 1;
    line('Behind the ledgers, the dust line breaks where a document was recently replaced.', 'hint');
  } else if (normalizedText.includes('warm chair')) {
    line('The chair is warm enough to suggest recent filing, not long-term storage.', 'hint');
  } else if (normalizedText.includes('fresh initials') || normalizedText.includes('initials')) {
    line('The initials are recent and practical: routing marks, not signatures for credit.', 'hint');
  } else if (normalizedText.includes('shifted file') || normalizedText.includes('file')) {
    line('The shifted file sits under deferred actions rather than disputed agenda items.', 'hint');
  } else if (normalizedText.includes('chair')) {
    line('A warm chair in a cold archive usually means someone was filing, not debating.', 'hint');
  }

  if (archiveDiscoveryReady(archiveState)) discoverMissingMinute();
  return true;
}

function forceDoor() {
  if (state.player.currentRoom !== 'hall') {
    line('There is no institutional door to force here.', 'warn');
    return;
  }
  state.player.attemptedForceDoor = true;
  shiftPorterTrust(state.agents, -2);
  applyRelationship(state.social, 'porter', -2);
  applyStandingDelta('porter', -2, 'manipulation');
  applyStandingDelta('bernard', -1, 'manipulation');
  recordPorterMemory(state.agents, 'Player attempted to brute-force access.');
  if (porterIsHere()) {
    maybeLinePorter("You shoulder the door. The porter sighs: 'Velocity is not legitimacy.'", 1, 'danger');
    return;
  }
  line('You shoulder the door. It holds, and nobody answers.', 'danger');
}

function showStatus() {
  ensurePlayerIdentity(state.player);
  const eastGate = eastGateState();
  line(`System: tension ${state.system.tension}, state ${state.system.state}.`, 'system');
  line(`Record: ${state.player.identity.name}.`, 'hint');
  line(`Weather: ${weatherPhaseLabel(state.weather)}.`, 'hint');
  describeNorms(state.governance.norms).forEach((normLine) => line(`Norm: ${normLine}`, 'hint'));
  line(interpretiveMessage(state.system), 'hint');
  line(derivePhaseSummary(state.system, state.governance.committeeMemory), 'hint');
  line(phaseNarrative(state.system, state.governance.committeeMemory, state.narrative), 'hint');
  line(getInfluenceHint(state.agents), 'hint');
  line(`Access east: ${eastGate.status} (resistance ${eastGate.resistance}).`, 'hint');
  line(`Legitimacy: ${legitimacyStatusLine()}`, 'hint');
  line(agentExchangeHint(state.system.state, state.governance, state.social, state.system.alignment), 'hint');
  line(currentConcernLine(ensureObjectives()), 'hint');
  line(inferIdentity(state.social, state.system), 'hint');
  const latestMemory = state.governance.committeeMemory[0];
  if (latestMemory) {
    line(`Institutional memory: ${renderCommitteeMemory(latestMemory)}`, 'hint');
  } else {
    line('Institutional memory: Nothing has settled into shared consequence yet.', 'hint');
  }
  if (state.system.recentRipples.length) {
    line(`Recent ripple: ${state.system.recentRipples[0]}`, 'hint');
  }
}

function showWeather() {
  line('Institutional weather:', 'system');
  line(describeInstitutionalWeather(state.weather), 'hint');
}

function maybeNormChangeHint(lastVerb, turnPresence = null) {
  if (['suggest', 'propose', 'decide', 'vote', 'status', 'weather', 'help'].includes(lastVerb)) return;
  if (Math.random() >= 0.11) return;

  const roomId = state.player.currentRoom;
  const presence = turnPresence && turnPresence.roomId === roomId
    ? turnPresence
    : capturePresenceSnapshot(roomId);
  const present = Object.values(state.agents).filter((agent) => presence.presentIds.has(agent.id));
  if (!present.length) return;

  const hintsByAgent = {
    porter: [
      "The porter says, 'You could change how decisions happen here.'",
      "The porter murmurs, 'Norms are policy with dust on them. They still move.'",
    ],
    ada: [
      "Ada says, 'If the pace is wrong, change the rule instead of complaining about it.'",
    ],
    bernard: [
      "Bernard says, 'If consensus is miscalibrated, propose a different norm explicitly.'",
    ],
    cyra: [
      "Cyra says, 'Institutions are habits wearing badges. Habits can be edited.'",
    ],
  };

  const speaker = present[Math.floor(Math.random() * present.length)];
  const options = hintsByAgent[speaker.id] ?? hintsByAgent.porter;
  const chosen = options[Math.floor(Math.random() * options.length)];
  noteAmbientSpeech(speaker.id, roomId);
  if (speaker.id === 'porter') maybeLinePorter(chosen, 1);
  else line(chosen, 'hint');
}

function inspect(itemRaw) {
  const roomObj = state.world.rooms[state.player.currentRoom];
  const {
    matchedName,
    pronounFailed,
    suggestion,
  } = resolveItemReference(itemRaw, [state.player.inventory, roomObj.items]);
  if (pronounFailed) {
    line('You pause. It is not clear what "it" refers to.', 'warn');
    return;
  }
  if (!matchedName) {
    line(
      suggestion
        ? `You find little to inspect. Did you mean ${itemDisplayLabel(suggestion)}?`
        : 'You find little to inspect.',
      'warn',
    );
    return;
  }
  rememberReferencedItem(matchedName);
  const itemDef = getItemDefinition(state.world, matchedName);
  const inspectText = itemDef?.inspectText ?? state.world.itemDescriptions?.[matchedName];
  line(inspectText ?? 'It appears ordinary until you decide otherwise.');
}

function readItem(itemRaw) {
  const roomObj = state.world.rooms[state.player.currentRoom];
  const {
    matchedName,
    pronounFailed,
    suggestion,
  } = resolveItemReference(itemRaw, [state.player.inventory, roomObj.items]);
  if (pronounFailed) {
    line('You pause. It is not clear what "it" refers to.', 'warn');
    return;
  }
  if (!matchedName) {
    line(
      suggestion
        ? `There is nothing by that name here to read. Did you mean ${itemDisplayLabel(suggestion)}?`
        : 'There is nothing by that name here to read.',
      'warn',
    );
    return;
  }
  rememberReferencedItem(matchedName);
  const itemDef = getItemDefinition(state.world, matchedName);
  if (!itemDef?.readable || !itemDef?.readText) {
    line(`You study ${itemDisplayLabel(matchedName)}. It offers texture, not text.`, 'hint');
    return;
  }
  line(itemDef.readText, 'hint');
  if (matchedName === 'minute of deferred actions') {
    applyObjectiveEvent('minute-recovered');
  }
  state.governance.committeeMemory.unshift(`read:${matchedName}`);
  state.governance.committeeMemory = state.governance.committeeMemory.slice(0, 8);
}

function drop(itemRaw) {
  const { matchedName, pronounFailed, suggestion } = resolveItemReference(itemRaw, [state.player.inventory]);
  if (pronounFailed) {
    line('You pause. It is not clear what "it" refers to.', 'warn');
    return;
  }
  if (!matchedName) {
    line(
      suggestion
        ? `You do not have that item. Did you mean ${itemDisplayLabel(suggestion)}?`
        : 'You do not have that item.',
      'warn',
    );
    return;
  }
  state.player.inventory = state.player.inventory.filter((i) => i !== matchedName);
  addItemToRoom(state.world, state.player.currentRoom, matchedName);
  line(`You leave ${itemDisplayLabel(matchedName)}.`);
}

function handleAmbientSocialCommand(verb, turnPresence = null) {
  const presentAgents = presentAgentsForRoom(state.player.currentRoom, turnPresence);
  const visibleIds = new Set(presentAgents.map((agent) => agent.id));
  const porterPresent = visibleIds.has('porter');

  const ambientByVerb = {
    smile: 'You smile, and the room agrees not to overinterpret it.',
    giggle: 'A brief giggle escapes before protocol can classify it.',
    cough: 'You cough into your sleeve; decorum survives.',
    wink: 'You wink at no one in particular, which may have been the point.',
    shrug: 'You shrug. Institutional ambiguity accepts the gesture as native.',
    sigh: 'You sigh quietly, like a memo losing urgency.',
    listen: 'You go still and listen. Even the corridor sounds mildly procedural.',
    fart: 'A discreet trumpet of dissent escapes into the air.',
    nod: 'You nod once, as if ratifying a private amendment.',
    wave: 'You wave with clerical restraint.',
    laugh: 'You laugh softly. The sound is tolerated as a temporary exception.',
  };

  const baseLine = ambientByVerb[verb];
  if (!baseLine) return false;
  line(baseLine, 'system');

  if (verb === 'smile' && porterPresent && Math.random() < 0.45) {
    maybeLinePorter("The porter notices. 'Morale is not forbidden,' he says.");
    applyRelationship(state.social, 'porter', 1);
  } else if (verb === 'cough') {
    if (porterPresent && Math.random() < 0.75) {
      maybeLinePorter("The porter inclines his head. 'Blessings, in the secular sense.'");
      applyRelationship(state.social, 'porter', 1);
      shiftPorterTrust(state.agents, 1);
      notePorterSocialMemory(state.agents, 'cough', 1);
      recordPorterMemory(state.agents, 'Player coughed; porter offered ritual courtesy.');
    } else if (presentAgents.length && Math.random() < 0.35) {
      line(`${presentAgents[Math.floor(Math.random() * presentAgents.length)].name} glances over, then returns to procedure.`, 'hint');
    }
  } else if (verb === 'fart') {
    if (porterPresent && Math.random() < 0.8) {
      maybeLinePorter("The porter says, 'Not minuted, unless it becomes precedent.'", 1, 'hint');
      applyRelationship(state.social, 'porter', -1);
      shiftPorterTrust(state.agents, -1);
      recordPorterMemory(state.agents, 'Player introduced atmospheric disruption in public.');
    } else if (presentAgents.length && Math.random() < 0.5) {
      line(`${presentAgents[Math.floor(Math.random() * presentAgents.length)].name} studies the ceiling with new professionalism.`, 'hint');
    }
  } else if (verb === 'listen' && presentAgents.length && Math.random() < 0.4) {
    line(`${presentAgents[Math.floor(Math.random() * presentAgents.length)].name} seems to notice you noticing. Nothing is said.`, 'hint');
  } else if ((verb === 'wink' || verb === 'giggle' || verb === 'laugh') && porterPresent && Math.random() < 0.28) {
    maybeLinePorter("The porter files the moment under 'informal confidence.'", 1, 'hint');
    applyRelationship(state.social, 'porter', 1);
  } else if (verb === 'shrug' || verb === 'sigh' || verb === 'nod' || verb === 'wave') {
    if (presentAgents.length && Math.random() < 0.25) {
      line(`${presentAgents[Math.floor(Math.random() * presentAgents.length)].name} acknowledges the gesture with almost no expression.`, 'hint');
    }
  }

  if (verb === 'listen' || verb === 'smile' || verb === 'nod') {
    logBehaviour(state.social, 'mediate');
  } else if (verb === 'fart') {
    logBehaviour(state.social, 'challenge');
  }

  return true;
}

function processCommand(input) {
  const text = input.trim();
  if (!text) return;
  const normalizedText = normalizeCommandInput(text);
  beginNarrativeTurn();
  ensureGhostState();

  line(`> ${text}`, 'input');
  const turnPresence = capturePresenceSnapshot();

  const npcParsed = parseNpcInteraction(normalizedText);
  const [verbRaw, ...rest] = normalizedText.split(' ');
  const verb = verbRaw.toLowerCase();
  const arg = rest.join(' ').trim();
  const tensionBefore = state.system.tension;
  const systemStateBefore = state.system.state;
  const priorTransitionTurn = state.system.lastTransition?.turn;
  const governanceVerbs = new Set(['suggest', 'decide', 'push', 'calm', 'shift', 'propose', 'vote', 'challenge', 'mediate', 'reset']);
  let queuedAmbientEvent = null;
  let lastVoteResult = null;

  const dirAliases = { n: 'north', s: 'south', e: 'east', w: 'west' };
  if (!governanceVerbs.has(verb)) {
    state.governanceUi.suggestionStreak = Math.max(0, state.governanceUi.suggestionStreak - 1);
    state.governanceUi.lowRelevanceStreak = Math.max(0, (state.governanceUi.lowRelevanceStreak ?? 0) - 1);
  }

  if (handleArchiveInvestigationCommand(verb, arg, normalizedText)) {
    // handled by archive investigation parser
  } else if (ambientCommands.has(verb)) {
    handleAmbientSocialCommand(verb, turnPresence);
  } else if (npcParsed) {
    interactNpc(npcParsed, turnPresence);
  } else if (npcInteractionVerbs.has(verb)) {
    line('Who do you mean?', 'warn');
  } else if (dirAliases[verb]) {
    move(dirAliases[verb]);
  } else if (['north', 'south', 'east', 'west'].includes(verb)) {
    move(verb);
  } else if (verb === 'go') {
    move(arg.toLowerCase());
  } else if (verb === 'look') {
    renderRoom(turnPresence);
  } else if (verb === 'take' || verb === 'get') {
    takeItem(arg);
  } else if (verb === 'drop') {
    drop(arg);
  } else if (verb === 'use') {
    useItem(arg);
  } else if (verb === 'inspect') {
    inspect(arg);
  } else if (verb === 'examine' || verb === 'x') {
    inspect(arg);
  } else if (verb === 'read') {
    readItem(arg);
    applyObjectiveEvent('read-item', { item: arg.toLowerCase() });
  } else if (verb === 'talk') {
    const parsedTalk = parseNpcInteraction(`talk ${arg}`) ?? { action: 'talk', targetText: arg.toLowerCase() };
    interactNpc(parsedTalk, turnPresence);
  } else if (verb === 'force') {
    forceDoor();
    notePorterGovernancePattern(state.agents, 'bypass');
  } else if (verb === 'suggest' || verb === 'propose') {
    if (verb === 'propose') line('Tip: "propose" is now "suggest".', 'hint');
    const ruleText = arg || 'blessOnSneeze=true';
    const relevance = assessProposalRelevance(ruleText, governanceRelevanceContext());
    state.governanceUi.suggestionStreak += 1;
    line(`You suggest a direction: "${ruleText}".`, 'system');
    line(proposeRule(state.governance, state.social, ruleText, relevance), 'hint');
    if (relevance.tier === 'mostly procedural drift') {
      applyStandingDelta('bernard', -1, 'drift');
      applyStandingDelta('porter', -1, 'drift');
      state.governanceUi.lowRelevanceStreak = (state.governanceUi.lowRelevanceStreak ?? 0) + 1;
      const streak = state.governanceUi.lowRelevanceStreak;
      if (porterIsHere()) maybeLinePorter(governanceRedirectionLine(streak, 'porter'), 1, 'hint');
      else if (streak >= 2) line(governanceRedirectionLine(streak, 'bernard'), 'hint');
    } else {
      if (relevance.tier === 'directly relevant') {
        applyStandingDelta('bernard', 1, 'process');
      } else if (relevance.tier === 'adjacent') {
        applyStandingDelta('cyra', 1, 'mediation');
      }
      state.governanceUi.lowRelevanceStreak = Math.max(0, (state.governanceUi.lowRelevanceStreak ?? 0) - 1);
    }
    if (relevance.tier === 'directly relevant') {
      line('It lands as directly tied to the active institutional concern.', 'good');
    } else if (relevance.tier === 'adjacent') {
      line('It is heard as adjacent: useful, but not the center file.', 'hint');
    } else {
      line('It is heard as procedural drift unless tied back to the active file.', 'hint');
    }
    notePorterGovernancePattern(state.agents, 'propose');
    const needed = suggestionThreshold(state.player.currentRoom);
    if (state.governanceUi.suggestionStreak < needed) {
      line('The room notes it, but momentum has not built yet.', 'hint');
    } else {
      line('The idea has enough weight to decide now with "decide".', 'hint');
    }
  } else if (verb === 'decide' || verb === 'vote') {
    if (verb === 'vote') line('Tip: "vote" is now "decide".', 'hint');
    const needed = suggestionThreshold(state.player.currentRoom);
    if (!state.governance.pendingProposal) {
      line('There is nothing active to decide yet. Try "suggest <idea>".', 'warn');
    } else if (state.governanceUi.suggestionStreak < needed) {
      line(
        governancePresence(state.player.currentRoom) === 'background'
          ? 'Out here, decisions rarely stick quickly. Repeat the suggestion or return to the hall.'
          : 'The room needs a little more buildup before deciding. Suggest it again.',
        'warn',
      );
    } else {
      line('You call for a decision.', 'system');
      const pendingRelevance = state.governance.pendingProposal?.relevance;
      if (pendingRelevance?.tier === 'mostly procedural drift') {
        applyStandingDelta('bernard', -1, 'drift');
        state.governanceUi.lowRelevanceStreak = (state.governanceUi.lowRelevanceStreak ?? 0) + 1;
      }
      const proposalSource = state.governance.pendingProposal?.source ?? null;
      const result = vote(
        state.governance,
        state.agents,
        state.social,
        state.system,
        { hasHallKey: state.player.inventory.includes('iron key') },
      );
      lastVoteResult = result;
      markNarrativePriority(narrativePriority.P2);
      line(result.text, result.ok ? 'good' : 'warn');
      const depth = governanceNarrativeDepth(state.player.currentRoom);
      if (depth >= 1 && result.detail) line(result.detail, 'hint');
      if (depth >= 1 && result.narrative) line(result.narrative, 'hint');
      if (depth >= 2 && result.coalitionHint) line(result.coalitionHint, 'hint');
      if (depth >= 3 && result.stanceScene) line(result.stanceScene, 'hint');
      if (depth >= 2 && result.ambiguity) line(result.ambiguity, 'hint');
      if ((state.governanceUi.lowRelevanceStreak ?? 0) >= 2 && pendingRelevance?.tier === 'mostly procedural drift') {
        if (porterIsHere()) maybeLinePorter(governanceRedirectionLine(state.governanceUi.lowRelevanceStreak, 'porter'), 1, 'hint');
        else line(governanceRedirectionLine(state.governanceUi.lowRelevanceStreak, 'room'), 'hint');
      }
      if (result.normChange) {
        line(`Norm updated: ${result.normChange.summary}`, 'good');
        line(`Gameplay impact: ${result.normChange.gameplay}`, 'hint');
      }
      if (result.accessOutcome) {
        line(result.accessOutcome, result.ok ? 'good' : 'warn');
      }
      if (result.ok) {
        applyStandingDelta('ada', 1, 'decisive');
        applyStandingDelta('porter', 1, 'consistency');
      } else {
        applyStandingDelta('ada', -1, 'decisive');
      }
      if (['lockedRoom', 'archive'].includes(state.player.currentRoom) && (result.ok || result.yesVotes >= 1)) {
        applyObjectiveEvent('vote-resolved-ledger');
      }
      if (proposalSource === 'institutional-trace') {
        applyObjectiveEvent('edited-proposal-seen');
        applyObjectiveEvent('edited-proposal-voted');
      }
      line(voteNarrative(result.ok, result.yesVotes ?? 0, state.narrative), 'hint');
      const votePositioning = result.ok
        ? (result.yesVotes === 2 ? 'mediation' : 'alignment')
        : (result.yesVotes === 1 ? 'disagreement' : 'unclear');
      if (depth >= 2) line(positioningNarrative(votePositioning, state.narrative), 'hint');
      if (depth >= 2) line(derivePhaseSummary(state.system, state.governance.committeeMemory), 'hint');
      if (depth >= 2) line(phaseNarrative(state.system, state.governance.committeeMemory, state.narrative), 'hint');
      if (depth >= 2) maybeLinePorter(porterReflection(state.system.state, state.social, state.narrative), 0.28);
      if (depth >= 1) maybeLinePorter(porterOutcomeReflection(porterContextSystem(), state.governance, state.social), 0.32);
      if (depth >= 3) {
        const scene = maybeComposedScene(state.system.state, state.social, votePositioning, state.narrative);
        scene.forEach((sceneLine, index) => {
          if (index === 0) maybeLinePorter(sceneLine, 0.2);
          else line(sceneLine, 'hint');
        });
      }
      state.governanceUi.lastDecisionFailed = !result.ok;
      state.governanceUi.suggestionStreak = 0;
    }
  } else if (verb === 'calm' || verb === 'mediate') {
    if (verb === 'mediate') line('Tip: "mediate" is now "calm".', 'hint');
    logBehaviour(state.social, 'mediate');
    notePorterGovernancePattern(state.agents, 'calm');
    const drift = behaviouralDrift(state.social, 'mediate');
    const result = mediate(state.system, drift.modifier);
    markNarrativePriority(narrativePriority.P2);
    line('You let things settle.', 'system');
    if (drift.hint) line(drift.hint, 'hint');
    line(result.text, result.ok ? 'good' : 'warn');
    line(result.ripple, 'hint');
    applyStandingDelta('cyra', result.ok ? 1 : -1, 'mediation');
    if (result.ok && (state.social.repeatedCommandStreak.command === 'mediate' && state.social.repeatedCommandStreak.count >= 3)) {
      applyStandingDelta('porter', 1, 'consistency');
    }
    if (governanceNarrativeDepth(state.player.currentRoom) >= 2) {
      line(interventionNarrative('mediate', state.narrative), 'hint');
      line(positioningNarrative('mediation', state.narrative), 'hint');
      maybeLinePorter(porterReflection(state.system.state, state.social, state.narrative), 0.22);
    }
    maybeLinePorter(porterOutcomeReflection(porterContextSystem(), state.governance, state.social), 0.28);
    if (governanceNarrativeDepth(state.player.currentRoom) >= 3) {
      const scene = maybeComposedScene(state.system.state, state.social, 'mediation', state.narrative);
      scene.forEach((sceneLine, index) => {
        if (index === 0) maybeLinePorter(sceneLine, 0.2);
        else line(sceneLine, 'hint');
      });
    }
  } else if (verb === 'push' || verb === 'challenge') {
    if (verb === 'challenge') line('Tip: "challenge" is now "push".', 'hint');
    logBehaviour(state.social, 'challenge');
    notePorterGovernancePattern(state.agents, 'push');
    const drift = behaviouralDrift(state.social, 'challenge');
    const result = challenge(state.system, drift.modifier);
    markNarrativePriority(narrativePriority.P2);
    line('You push the idea forward.', 'system');
    if (drift.hint) line(drift.hint, 'hint');
    line(result.text, result.ok ? 'good' : 'warn');
    line(result.ripple, 'hint');
    applyStandingDelta('ada', result.ok ? 1 : -1, 'decisive');
    if (result.ok && (state.social.repeatedCommandStreak.command === 'challenge' && state.social.repeatedCommandStreak.count >= 3)) {
      applyStandingDelta('porter', 1, 'consistency');
    }
    if ((state.governanceUi.lowRelevanceStreak ?? 0) >= 2 && Math.random() < 0.75) {
      if (porterIsHere()) maybeLinePorter(governanceRedirectionLine(state.governanceUi.lowRelevanceStreak, 'porter'), 1, 'hint');
      else line(governanceRedirectionLine(state.governanceUi.lowRelevanceStreak, 'bernard'), 'hint');
    }
    if (governanceNarrativeDepth(state.player.currentRoom) >= 2) {
      line(interventionNarrative('challenge', state.narrative), 'hint');
      line(positioningNarrative('disagreement', state.narrative), 'hint');
      maybeLinePorter(porterReflection(state.system.state, state.social, state.narrative), 0.22);
    }
    maybeLinePorter(porterOutcomeReflection(porterContextSystem(), state.governance, state.social), 0.28);
    if (governanceNarrativeDepth(state.player.currentRoom) >= 3) {
      const scene = maybeComposedScene(state.system.state, state.social, 'disagreement', state.narrative);
      scene.forEach((sceneLine, index) => {
        if (index === 0) maybeLinePorter(sceneLine, 0.2);
        else line(sceneLine, 'hint');
      });
    }
  } else if (verb === 'shift' || verb === 'reset') {
    if (verb === 'reset') line('Tip: "reset" is now "shift".', 'hint');
    logBehaviour(state.social, 'reset');
    const drift = behaviouralDrift(state.social, 'reset');
    const result = resetNormAttempt(state.system, drift.modifier);
    markNarrativePriority(narrativePriority.P2);
    line('You try to shift the routine people are following.', 'system');
    if (drift.hint) line(drift.hint, 'hint');
    line(result.text, result.ok ? 'good' : 'warn');
    line(result.ripple, 'hint');
    applyStandingDelta('bernard', result.ok ? 1 : -1, 'process');
    if (governanceNarrativeDepth(state.player.currentRoom) >= 2) {
      line(interventionNarrative('reset', state.narrative), 'hint');
      maybeLinePorter(porterReflection(state.system.state, state.social, state.narrative), 0.2);
    }
    if (result.ok) {
      state.governance.norms.consensusFirst = !state.governance.norms.consensusFirst;
      const normChange = describeNormChange('consensusFirst', state.governance.norms.consensusFirst);
      line(`Norm updated: ${normChange.summary}`, 'system');
      line(`Gameplay impact: ${normChange.gameplay}`, 'hint');
    }
    maybeLinePorter(porterOutcomeReflection(porterContextSystem(), state.governance, state.social), 0.25);
  } else if (verb === 'status') {
    showStatus();
  } else if (verb === 'weather') {
    showWeather();
  } else if (verb === 'score' || verb === 'sc') {
    showScore();
  } else if (verb === 'history') {
    const renderedMemory = renderCommitteeMemoryHistory(state.governance.committeeMemory);
    line(
      renderedMemory.length
        ? `Committee memory: ${renderedMemory.join(' | ')}.`
        : 'Nothing has settled into institutional memory yet.',
      'hint',
    );
    if (porterIsHere() && Math.random() < 0.4) {
      maybeLinePorter("The porter says, 'People remember the argument longer than the vote.'", 1, 'hint');
    }
  } else if (verb === 'sneeze') {
    state.social.playerCold = true;
    state.social.sneezeCount += 1;
    const porterHere = isAgentPresentInRoom('porter', state.player.currentRoom, turnPresence);
    const response = porterHere ? porterSneezeResponse(state.agents, state.social) : null;
    if (response) {
      emitNarrativeLine(`You sneeze. ${response}`, {
        priority: narrativePriority.P3,
        cooldownKey: 'sneeze-direct',
        cooldownTurns: 3,
      });
      shiftPorterTrust(state.agents, 1);
      applyRelationship(state.social, 'porter', 1);
      notePorterSocialMemory(state.agents, 'sneeze', 1);
      recordPorterMemory(state.agents, 'Player sneezed directly; porter responded.');
    } else if (state.social.sneezeCount > 2) {
      emitNarrativeLine('You sneeze again. No one comments.', {
        priority: narrativePriority.P3,
        cooldownKey: 'sneeze-no-comment',
        cooldownTurns: 4,
      });
    } else {
      emitNarrativeLine('You sneeze. The room lets the moment pass.', {
        priority: narrativePriority.P3,
        cooldownKey: 'sneeze-room-pass',
        cooldownTurns: 4,
      });
    }
  } else if (verb === 'save') {
    save();
  } else if (verb === 'load') {
    load();
  } else if (verb === 'restart') {
    state = createGameState();
    line('The scene resets. The institution forgets, mostly.', 'system');
    const openingProposal = maybeSeedGhostProposal(true);
    if (openingProposal) line(openingProposal, 'hint');
    renderRoom();
  } else if (verb === 'help') {
    line('Explore with: look, n/s/e/w, go <dir>, take/get/drop/use/read/inspect/examine/x <item>, talk porter, force.');
    line('Archive investigation: search archive, inspect folders, read minutes, check latch, open cabinet, move box, examine shelves, review files, look behind ledgers.', 'hint');
    line('NPC interaction: hi/hello/greet <name>, say hello to <name>, ask <name> about <topic>, give <item> to <name>, thank <name>, insult/mock <name>, observe <name>, poke/slap/kick <name>.');
    line('Examples: hi porter, hello porter, greet porter, say hello to porter, ask porter about key, give ledger fragment to porter.', 'hint');
    line('Utility: sneeze, smile, giggle, cough, wink, shrug, sigh, listen, fart, nod, wave, laugh, weather, status, score/sc, history, save, load, restart.');
    line('Governance prompts appear in context (suggest, decide, push, calm, shift).', 'hint');
  } else {
    line('The command is not understood. Try "help".', 'warn');
  }

  if (verb !== 'talk' && porterIsHere() && Math.random() < 0.05) {
    if (Math.random() < 0.28) maybeLinePorter(porterIdentityLine(ensurePlayerIdentity(state.player)));
    maybeLinePorter(talkToPorter(state.agents, state.system.state, state.social), 1);
    maybeLinePorter(maybePorterNearMissDialogue(), 0.35);
    maybeLinePorter(porterReflection(state.system.state, state.social, state.narrative), 0.18);
    if (Math.random() < 0.4) line(agentExchangeHint(state.system.state, state.governance, state.social, state.system.alignment), 'hint');
  }
  maybeNormChangeHint(verb, turnPresence);
  if ((verb === 'wink' || verb === 'giggle' || verb === 'laugh' || verb === 'fart') && porterIsHere()) {
    applyStandingDelta('porter', -1, 'manipulation');
    applyStandingDelta('bernard', -1, 'manipulation');
  }

  tickSystem(state.system);
  if (state.system.state === 'stagnant') {
    applyObjectiveEvent('state-stagnant');
  }
  if (systemStateBefore === 'stagnant' && state.system.state !== 'stagnant') {
    applyObjectiveEvent('state-not-stagnant');
  }
  maybeAdvanceGhostPresence();
  maybeAdvanceInstitutionalAutonomy({
    autonomy: ensureAutonomy(),
    world: state.world,
    governance: state.governance,
    system: state.system,
    agents: state.agents,
    ghost: ensureGhostState(),
    player: state.player,
  });
  if (
    eastGateState().status === 'open'
    && state.agents.porter.trust >= 2
    && state.governance.committeeMemory.length >= 3
    && state.system.state !== 'stagnant'
  ) {
    applyObjectiveEvent('movement-restored');
  }
  tickWeather(state.weather);
  state.social.porterSignals = { ...(state.agents.porter.memorySignals ?? {}) };
  decayAgentMemories(state.agents);
  const previousAgentRooms = moveAgents(state.agents, state.system.state);
  rememberRecentDepartures(previousAgentRooms, state.player.currentRoom);
  const continuity = narrateAgentContinuity(
    state.agents,
    previousAgentRooms,
    state.player.currentRoom,
  );
  if (continuity?.line) {
    if (continuity.kind === 'arrival') {
      noteArrivals(continuity.agentIds ?? [], state.player.currentRoom);
      notePresentHere(continuity.agentIds ?? [], state.player.currentRoom);
      setTurnVisibleNpcs([
        ...new Set([
          ...Array.from(getTurnVisibleNpcSet(state.player.currentRoom)),
          ...(continuity.agentIds ?? []),
        ]),
      ], state.player.currentRoom);
    }
    emitNarrativeLine(continuity.line, { priority: narrativePriority.P2 });
  }
  const tensionLine = tensionShiftNarrative(tensionBefore, state.system.tension, state.narrative);
  if (tensionLine) emitNarrativeLine(tensionLine, { priority: narrativePriority.P2 });
  if (state.system.lastTransition && state.system.lastTransition.turn !== priorTransitionTurn) {
    markNarrativePriority(narrativePriority.P2);
    line(transitionMessage(state.system), 'system');
  }
  const echo = behaviourEcho(state.social);
  if (echo) {
    emitNarrativeLine(echo, {
      priority: narrativePriority.P3,
      cooldownKey: `behaviour-echo-${state.social.repeatedCommandStreak.command ?? 'general'}`,
      cooldownTurns: 6,
    });
  }
  const coldStart = maybeTriggerCold(state.social);
  if (coldStart) emitNarrativeLine(coldStart, { priority: narrativePriority.P3, cooldownKey: 'cold-start', cooldownTurns: 8 });
  const sneeze = maybeSneeze(state.social, state.agents, state.player.currentRoom);
  if (sneeze && state.governance.norms.blessOnSneeze) {
    emitNarrativeLine(sneeze, {
      priority: narrativePriority.P3,
      cooldownKey: 'ambient-sneeze-player',
      cooldownTurns: 4,
    });
  }
  const ambientSneezeLines = maybeAmbientSneezeNarrative(
    { porterNearby: isAgentPresentInRoom('porter', state.player.currentRoom, turnPresence) },
    state.narrative,
  );
  ambientSneezeLines.forEach((ambientLine, index) => {
    emitNarrativeLine(ambientLine, {
      priority: narrativePriority.P3,
      cooldownKey: index === 0 ? 'ambient-sneeze-event' : 'ambient-sneeze-reply',
      cooldownTurns: 5,
    });
  });
  queuedAmbientEvent = maybeAmbientWorldEvent(state.narrative);
  if (queuedAmbientEvent && !queuedAmbientEvent.delayed) {
    emitNarrativeLine(queuedAmbientEvent.line, {
      priority: narrativePriority.P3,
      cooldownKey: 'ambient-world-event',
      cooldownTurns: 3,
    });
    queuedAmbientEvent = null;
  }
  const ghostTrace = maybeGhostTraceNarrative(state.narrative);
  if (ghostTrace) emitNarrativeLine(ghostTrace, {
    priority: narrativePriority.P3,
    cooldownKey: 'ghost-trace',
    cooldownTurns: 4,
  });
  const porterAbsentLine = maybePorterAbsenceLine(state.agents);
  if (porterAbsentLine) emitNarrativeLine(porterAbsentLine, {
    priority: narrativePriority.P3,
    cooldownKey: 'porter-absence',
    cooldownTurns: 7,
  });
  if (porterIsHere()) {
    const witness = takePorterWitnessLine(ensureAutonomy());
    if (witness) emitNarrativeLine(witness, {
      priority: narrativePriority.P2,
      cooldownKey: 'porter-autonomy-witness',
      cooldownTurns: 4,
    });
  }
  maybeShowGovernanceHints(verb);
  maybeShowTensionWarning(verb, tensionBefore);
  const weatherChange = weatherShiftLine(state.weather);
  if (weatherChange) emitNarrativeLine(weatherChange, {
    priority: narrativePriority.P2,
    cooldownKey: 'weather-shift',
    cooldownTurns: 3,
  });
  const rareGovernanceWeather = maybeWeatherGovernanceMoment(state.weather, lastVoteResult);
  if (rareGovernanceWeather) emitNarrativeLine(rareGovernanceWeather, {
    priority: narrativePriority.P2,
    cooldownKey: 'weather-governance-moment',
    cooldownTurns: 6,
  });
  const weatherSocialLine = weatherSocialTexture(state.weather);
  if (weatherSocialLine) emitNarrativeLine(weatherSocialLine, {
    priority: narrativePriority.P3,
    cooldownKey: 'weather-social',
    cooldownTurns: 5,
  });

  if (queuedAmbientEvent?.delayed) {
    const delayedLine = queuedAmbientEvent.line;
    window.setTimeout(() => {
      emitNarrativeLine(delayedLine, {
        priority: narrativePriority.P3,
        cooldownKey: 'ambient-world-event',
        cooldownTurns: 3,
      });
      refreshSidebar();
    }, 250 + Math.floor(Math.random() * 250));
  }

  refreshSidebar();
}

function boot() {
  ensurePlayerIdentity(state.player);
  line('The Essex chamber stirs awake.', 'system');
  if (Math.random() < 0.6) maybeLinePorter(porterIdentityLine(state.player.identity), 1);
  line('Type help for commands.');
  const openingProposal = maybeSeedGhostProposal(true);
  if (openingProposal) line(openingProposal, 'hint');
  renderRoom();
  refreshSidebar();

  dom.form.addEventListener('submit', (e) => {
    e.preventDefault();
    processCommand(dom.input.value);
    dom.input.value = '';
  });

  document.getElementById('saveBtn').addEventListener('click', save);
  document.getElementById('loadBtn').addEventListener('click', load);
  document.getElementById('restartBtn').addEventListener('click', () => {
    state = createGameState();
    line('The scene resets.');
    const openingProposal = maybeSeedGhostProposal(true);
    if (openingProposal) line(openingProposal, 'hint');
    renderRoom();
    refreshSidebar();
  });
}

boot();
