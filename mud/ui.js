import {
  createWorld,
  describeRoom,
  getRoomPacing,
  removeItemFromRoom,
  addItemToRoom,
} from './world.js?v=build10';
import {
  createAgents,
  moveAgents,
  agentsInRoom,
  talkToPorter,
  getInfluenceHint,
  agentExchangeHint,
  porterOutcomeReflection,
  porterSneezeResponse,
  updatePorterVisibility,
  maybePorterAbsenceLine,
  shiftPorterTrust,
  recordPorterMemory,
  narrateAgentContinuity,
  interpretAgentInteraction,
} from './agents.js?v=build10';
import {
  createSocialState,
  applyRelationship,
  behaviourEcho,
  behaviouralDrift,
  maybeTriggerCold,
  maybeSneeze,
  inferIdentity,
  logBehaviour,
} from './social.js?v=build10';
import {
  createGovernanceState,
  proposeRule,
  vote,
  describeNorms,
  describeNormChange,
} from './governance.js?v=build10';
import {
  createSystemState,
  tickSystem,
  interpretiveMessage,
  derivePhaseSummary,
  transitionMessage,
  mediate,
  challenge,
  resetNormAttempt,
} from './system.js?v=build10';
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
} from './narrative.js?v=build10';

function createGameState() {
  return {
    world: createWorld(),
    agents: createAgents(),
    social: createSocialState(),
    governance: createGovernanceState(),
    system: createSystemState(),
    narrative: createNarrativeState(),
    player: {
      currentRoom: 'foyer',
      inventory: [],
      attemptedForceDoor: false,
      visitCounts: {},
    },
    governanceUi: {
      suggestionStreak: 0,
      lastDecisionFailed: false,
    },
  };
}

const SAVE_KEY = 'essexMudGovV1';
let state = createGameState();
const governanceKeyRooms = new Set(['hall', 'lockedRoom']);
const governanceSupportRooms = new Set(['foyer', 'eastCorridor', 'archive']);

const dom = {
  output: document.getElementById('output'),
  form: document.getElementById('commandForm'),
  input: document.getElementById('commandInput'),
  room: document.getElementById('roomLabel'),
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

function line(text, cls = '') {
  const p = document.createElement('p');
  p.className = `line ${cls}`.trim();
  p.textContent = text;
  dom.output.appendChild(p);
  dom.output.scrollTop = dom.output.scrollHeight;
}

function porterIsHere() {
  return state.agents.porter.roomId === state.player.currentRoom;
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
  return { ...state.system, porterPresent: porterIsHere() };
}

function maybeLinePorter(text, chance = 1, cls = 'hint') {
  if (!text || !porterIsHere() || Math.random() > chance) return false;
  const recent = state.narrative?.recentLines ?? [];
  if (recent.slice(-10).includes(text)) return false;
  line(text, cls);
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

function resolveItemName(inputRaw, candidates) {
  const input = inputRaw.toLowerCase().trim();
  if (!input) return null;
  const exact = candidates.find((candidate) => candidate.toLowerCase() === input);
  if (exact) return exact;

  const ranked = candidates
    .map((candidate) => ({
      candidate,
      distance: levenshteinDistance(input, candidate.toLowerCase()),
    }))
    .filter(({ candidate, distance }) => candidate.length >= 4 && distance <= 2)
    .sort((a, b) => a.distance - b.distance);

  if (!ranked.length) return null;
  if (ranked.length > 1 && ranked[0].distance === ranked[1].distance) return null;
  return ranked[0].candidate;
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

function refreshSidebar() {
  const roomObj = state.world.rooms[state.player.currentRoom];
  dom.room.textContent = roomObj.name;
  dom.exits.textContent = Object.keys(roomObj.exits).join(', ');
  dom.inventory.textContent = state.player.inventory.join(', ') || 'empty';
  dom.norms.textContent = tagsFromObject(state.governance.norms);
  dom.tension.textContent = `${state.system.tension}/10 (${state.system.state})`;
  dom.memory.textContent = state.governance.committeeMemory[0] ?? 'none yet';
}

function renderRoom() {
  const roomId = state.player.currentRoom;
  updatePorterVisibility(state.agents, roomId);
  const pacing = getRoomPacing(state.world, roomId);
  const presentAgents = agentsInRoom(state.agents, roomId);
  state.player.visitCounts[roomId] = (state.player.visitCounts[roomId] ?? 0) + 1;
  const visits = state.player.visitCounts[roomId];
  emitNarrativeLine(
    describeRoom(state.world, roomId, state.system.state, {
      visitCount: visits,
      lastTensionDirection: state.narrative?.context?.lastTensionDirection ?? 'flat',
      recentDecisions: state.governance.committeeMemory.slice(0, 3),
      recentNarrativeLines: state.narrative?.recentLines ?? [],
    }),
    { cls: 'system', priority: narrativePriority.P1 },
  );
  if (Math.random() < pacing.ambientNarrativeChance) {
    emitNarrativeLine(atmosphereNarrative(state.system.state, state.narrative), {
      priority: narrativePriority.P3,
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
    emitNarrativeLine(`Items here: ${roomObj.items.join(', ')}.`, {
      priority: narrativePriority.P1,
    });
  }
  if (presentAgents.length) {
    const names = presentAgents.map((agent) => agent.name).join(', ');
    emitNarrativeLine(`Present here: ${names}.`, {
      priority: narrativePriority.P1,
    });
  } else if (Math.random() < 0.75) {
    emitNarrativeLine('No one is here right now; the room keeps its own counsel.', {
      priority: narrativePriority.P1,
    });
  }
}

function save() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  line('The record is set down. Memory should hold through the next turning.', 'good');
}

function load() {
  const raw = localStorage.getItem(SAVE_KEY);
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
    };
  }
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
    const hasKey = state.player.inventory.includes('iron key');
    const trust = state.agents.porter.trust;
    const porterPresent = state.agents.porter.roomId === 'hall';
    if (!hasKey) {
      line(
        porterPresent
          ? "The porter taps the keyhole. 'Mechanisms still matter.'"
          : 'The lock remains shut; without the key, process does not proceed.',
        'warn',
      );
      return;
    }
    if (trust < 2) {
      line(
        porterPresent
          ? "The porter says, 'Not yet. You have the key, not the standing.'"
          : 'The mechanism yields halfway, then stops as if waiting for social clearance.',
        'warn',
      );
      return;
    }
  }

  state.player.currentRoom = target;
  renderRoom();
}

function takeItem(itemRaw) {
  const roomObj = state.world.rooms[state.player.currentRoom];
  const exact = resolveItemName(itemRaw, roomObj.items);
  if (!exact) {
    line('That item is not here.', 'warn');
    return;
  }
  removeItemFromRoom(state.world, state.player.currentRoom, exact);
  state.player.inventory.push(exact);
  line(`You take ${exact}.`, 'good');

  if (exact === 'iron key') {
    if (porterIsHere()) {
      maybeLinePorter("The porter notes that you took it without pocketing ceremony. 'Practical,' he says.");
      applyRelationship(state.social, 'porter', 1);
      shiftPorterTrust(state.agents, 1);
      recordPorterMemory(state.agents, 'Player acquired the hall key responsibly.');
    }
  }
}

function useItem(itemRaw) {
  const invExact = resolveItemName(itemRaw, state.player.inventory);
  if (!invExact) {
    line('You are not carrying that.', 'warn');
    return;
  }

  if (invExact === 'iron key' && state.player.currentRoom === 'hall') {
    line('The lock turns halfway, then waits for social clearance from the porter.', 'hint');
    return;
  }

  line(`You use ${invExact}, but nothing decisive follows.`, 'hint');
}

function talk(target) {
  const porterInRoom = state.agents.porter.roomId === state.player.currentRoom;
  if (target !== 'porter' || !porterInRoom) {
    line('Nobody by that name answers here.', 'warn');
    return;
  }
  line(talkToPorter(state.agents, state.system.state, state.social));
  applyRelationship(state.social, 'porter', 1);
  shiftPorterTrust(state.agents, 1);
  recordPorterMemory(state.agents, 'Player initiated civil conversation.');
}

const npcIds = ['porter', 'ada', 'bernard', 'cyra'];
const npcInteractionVerbs = new Set([
  'hi',
  'hello',
  'greet',
  'ask',
  'thank',
  'poke',
  'slap',
  'kick',
  'insult',
  'mock',
  'observe',
  'give',
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
  return npcIds.find((id) => lower === id || lower.endsWith(` ${id}`) || lower.startsWith(`${id} `)) ?? null;
}

function parseNpcInteraction(textRaw) {
  const text = normalizeCommandInput(textRaw);
  if (!text) return null;

  let match = text.match(/^(?:hello|hi|hey|greet)\s+(?:to\s+)?(.+)$/);
  if (match) return { action: 'hello', targetText: match[1] };
  match = text.match(/^say\s+(?:hello|hi|hey|greetings?)(?:\s+to)?\s+(.+)$/);
  if (match) return { action: 'hello', targetText: match[1] };
  match = text.match(/^(?:ask|question)\s+(.+?)(?:\s+about\s+(.+))?$/);
  if (match) return { action: 'ask', targetText: match[1], topic: match[2] ?? '' };
  match = text.match(/^give\s+(.+?)\s+to\s+(.+)$/);
  if (match) return { action: 'give', item: match[1], targetText: match[2] };
  match = text.match(/^(?:thank|praise)\s+(.+)$/);
  if (match) return { action: 'thank', targetText: match[1] };
  match = text.match(/^(?:insult|mock)\s+(.+)$/);
  if (match) return { action: 'insult', targetText: match[1] };
  match = text.match(/^observe\s+(.+)$/);
  if (match) return { action: 'observe', targetText: match[1] };
  match = text.match(/^(poke|slap|kick)\s+(.+)$/);
  if (match) return { action: match[1], targetText: match[2] };
  return null;
}

function interactNpc(parsed) {
  const targetId = resolveNpcTarget(parsed.targetText);
  if (!targetId) {
    line('Nobody by that name answers here.', 'warn');
    return;
  }
  const present = state.agents[targetId]?.roomId === state.player.currentRoom;
  if (!present) {
    line('They are not here.', 'warn');
    return;
  }

  let exactItem = null;
  if (parsed.action === 'give') {
    exactItem = resolveItemName(parsed.item ?? '', state.player.inventory);
    if (!exactItem) {
      line('You are not carrying that item to give.', 'warn');
      return;
    }
    state.player.inventory = state.player.inventory.filter((item) => item !== exactItem);
  }

  const outcome = interpretAgentInteraction(state.agents, state.social, {
    targetId,
    action: parsed.action,
    topic: parsed.topic ?? '',
    item: exactItem ?? '',
  });
  line(outcome.text, outcome.css ?? 'hint');
  if (targetId === 'porter') {
    recordPorterMemory(state.agents, `Player used ${parsed.action} with porter.`);
  }
}

function forceDoor() {
  if (state.player.currentRoom !== 'hall') {
    line('There is no institutional door to force here.', 'warn');
    return;
  }
  state.player.attemptedForceDoor = true;
  shiftPorterTrust(state.agents, -2);
  applyRelationship(state.social, 'porter', -2);
  recordPorterMemory(state.agents, 'Player attempted to brute-force access.');
  if (porterIsHere()) {
    maybeLinePorter("You shoulder the door. The porter sighs: 'Velocity is not legitimacy.'", 1, 'danger');
    return;
  }
  line('You shoulder the door. It holds, and nobody answers.', 'danger');
}

function showStatus() {
  line(`System: tension ${state.system.tension}, state ${state.system.state}.`, 'system');
  describeNorms(state.governance.norms).forEach((normLine) => line(`Norm: ${normLine}`, 'hint'));
  line(interpretiveMessage(state.system), 'hint');
  line(derivePhaseSummary(state.system, state.governance.committeeMemory), 'hint');
  line(phaseNarrative(state.system, state.governance.committeeMemory, state.narrative), 'hint');
  line(getInfluenceHint(state.agents), 'hint');
  line(agentExchangeHint(state.system.state, state.governance, state.social, state.system.alignment), 'hint');
  line(inferIdentity(state.social, state.system), 'hint');
  if (state.system.recentRipples.length) {
    line(`Recent ripple: ${state.system.recentRipples[0]}`, 'hint');
  }
}

function maybeNormChangeHint(lastVerb) {
  if (['suggest', 'propose', 'decide', 'vote', 'status', 'help'].includes(lastVerb)) return;
  if (Math.random() >= 0.11) return;

  const roomId = state.player.currentRoom;
  const present = Object.values(state.agents).filter((agent) => agent.roomId === roomId);
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
  if (speaker.id === 'porter') maybeLinePorter(chosen, 1);
  else line(chosen, 'hint');
}

function inspect(itemRaw) {
  const names = Object.keys(state.world.itemDescriptions);
  const matchedName = resolveItemName(itemRaw, names);
  const found = matchedName ? [matchedName, state.world.itemDescriptions[matchedName]] : null;
  if (!found) {
    line('You find little to inspect.', 'warn');
    return;
  }
  line(found[1]);
}

function drop(itemRaw) {
  const exact = resolveItemName(itemRaw, state.player.inventory);
  if (!exact) {
    line('You do not have that item.', 'warn');
    return;
  }
  state.player.inventory = state.player.inventory.filter((i) => i !== exact);
  addItemToRoom(state.world, state.player.currentRoom, exact);
  line(`You leave ${exact}.`);
}

function processCommand(input) {
  const text = input.trim();
  if (!text) return;
  const normalizedText = normalizeCommandInput(text);
  beginNarrativeTurn();

  line(`> ${text}`, 'input');

  const npcParsed = parseNpcInteraction(normalizedText);
  const [verbRaw, ...rest] = normalizedText.split(' ');
  const verb = verbRaw.toLowerCase();
  const arg = rest.join(' ').trim();
  const tensionBefore = state.system.tension;
  const priorTransitionTurn = state.system.lastTransition?.turn;
  const governanceVerbs = new Set(['suggest', 'decide', 'push', 'calm', 'shift', 'propose', 'vote', 'challenge', 'mediate', 'reset']);
  let queuedAmbientEvent = null;

  const dirAliases = { n: 'north', s: 'south', e: 'east', w: 'west' };
  if (!governanceVerbs.has(verb)) {
    state.governanceUi.suggestionStreak = Math.max(0, state.governanceUi.suggestionStreak - 1);
  }

  if (npcParsed) {
    interactNpc(npcParsed);
  } else if (npcInteractionVerbs.has(verb)) {
    line('Who do you mean?', 'warn');
  } else if (dirAliases[verb]) {
    move(dirAliases[verb]);
  } else if (['north', 'south', 'east', 'west'].includes(verb)) {
    move(verb);
  } else if (verb === 'go') {
    move(arg.toLowerCase());
  } else if (verb === 'look') {
    renderRoom();
  } else if (verb === 'take') {
    takeItem(arg);
  } else if (verb === 'drop') {
    drop(arg);
  } else if (verb === 'use') {
    useItem(arg);
  } else if (verb === 'inspect') {
    inspect(arg);
  } else if (verb === 'talk') {
    talk(arg.toLowerCase());
  } else if (verb === 'force') {
    forceDoor();
  } else if (verb === 'suggest' || verb === 'propose') {
    if (verb === 'propose') line('Tip: "propose" is now "suggest".', 'hint');
    const ruleText = arg || 'blessOnSneeze=true';
    state.governanceUi.suggestionStreak += 1;
    line(`You suggest a direction: "${ruleText}".`, 'system');
    line(proposeRule(state.governance, state.social, ruleText), 'hint');
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
      const result = vote(state.governance, state.agents, state.social, state.system);
      markNarrativePriority(narrativePriority.P2);
      line(result.text, result.ok ? 'good' : 'warn');
      const depth = governanceNarrativeDepth(state.player.currentRoom);
      if (depth >= 1 && result.detail) line(result.detail, 'hint');
      if (depth >= 1 && result.narrative) line(result.narrative, 'hint');
      if (depth >= 2 && result.coalitionHint) line(result.coalitionHint, 'hint');
      if (depth >= 3 && result.stanceScene) line(result.stanceScene, 'hint');
      if (depth >= 2 && result.ambiguity) line(result.ambiguity, 'hint');
      if (result.normChange) {
        line(`Norm updated: ${result.normChange.summary}`, 'good');
        line(`Gameplay impact: ${result.normChange.gameplay}`, 'hint');
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
    const drift = behaviouralDrift(state.social, 'mediate');
    const result = mediate(state.system, drift.modifier);
    markNarrativePriority(narrativePriority.P2);
    line('You let things settle.', 'system');
    if (drift.hint) line(drift.hint, 'hint');
    line(result.text, result.ok ? 'good' : 'warn');
    line(result.ripple, 'hint');
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
    const drift = behaviouralDrift(state.social, 'challenge');
    const result = challenge(state.system, drift.modifier);
    markNarrativePriority(narrativePriority.P2);
    line('You push the idea forward.', 'system');
    if (drift.hint) line(drift.hint, 'hint');
    line(result.text, result.ok ? 'good' : 'warn');
    line(result.ripple, 'hint');
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
  } else if (verb === 'history') {
    line(`Committee memory: ${state.governance.committeeMemory.join(' | ') || 'none'}.`, 'hint');
  } else if (verb === 'sneeze') {
    state.social.playerCold = true;
    state.social.sneezeCount += 1;
    const porterHere = state.agents.porter.roomId === state.player.currentRoom;
    const response = porterHere ? porterSneezeResponse(state.agents, state.social) : null;
    if (response) {
      emitNarrativeLine(`You sneeze. ${response}`, {
        priority: narrativePriority.P3,
        cooldownKey: 'sneeze-direct',
        cooldownTurns: 3,
      });
      shiftPorterTrust(state.agents, 1);
      applyRelationship(state.social, 'porter', 1);
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
    renderRoom();
  } else if (verb === 'help') {
    line('Explore with: look, n/s/e/w, go <dir>, take/use/drop/inspect <item>, talk porter, force.');
    line('NPC interaction: hi/hello/greet <name>, say hello to <name>, ask <name> about <topic>, give <item> to <name>, thank <name>, insult/mock <name>, observe <name>, poke/slap/kick <name>.');
    line('Examples: hi porter, hello porter, greet porter, say hello to porter, ask porter about key, give ledger fragment to porter.', 'hint');
    line('Utility: sneeze, status, history, save, load, restart.');
    line('Governance prompts appear in context (suggest, decide, push, calm, shift).', 'hint');
  } else {
    line('The command is not understood. Try "help".', 'warn');
  }

  tickSystem(state.system);
  const previousAgentRooms = moveAgents(state.agents, state.system.state);
  const continuityLine = narrateAgentContinuity(
    state.agents,
    previousAgentRooms,
    state.player.currentRoom,
  );
  if (continuityLine) emitNarrativeLine(continuityLine, { priority: narrativePriority.P2 });
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
    { porterNearby: state.agents.porter.roomId === state.player.currentRoom },
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
  if (verb !== 'talk' && porterIsHere() && Math.random() < 0.05) {
    maybeLinePorter(talkToPorter(state.agents, state.system.state, state.social), 1);
    maybeLinePorter(porterReflection(state.system.state, state.social, state.narrative), 0.18);
    if (Math.random() < 0.4) line(agentExchangeHint(state.system.state, state.governance, state.social, state.system.alignment), 'hint');
  }
  maybeShowGovernanceHints(verb);
  maybeShowTensionWarning(verb, tensionBefore);
  maybeNormChangeHint(verb);

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
  line('The Essex chamber stirs awake.', 'system');
  line('Type help for commands.');
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
    renderRoom();
    refreshSidebar();
  });
}

boot();
