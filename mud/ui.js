import {
  createWorld,
  describeRoom,
  getRoomPacing,
  removeItemFromRoom,
  addItemToRoom,
} from './world.js';
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
} from './agents.js';
import {
  createSocialState,
  applyRelationship,
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
  vote,
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

function line(text, cls = '') {
  const p = document.createElement('p');
  p.className = `line ${cls}`.trim();
  p.textContent = text;
  dom.output.appendChild(p);
  dom.output.scrollTop = dom.output.scrollHeight;
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
  if (state.governanceUi.lastDecisionFailed && depth >= 2) {
    line('The idea stalls. You can push it forward with "push".', 'hint');
  }
  if (state.system.tension >= 7 && depth >= 1 && !['calm', 'mediate'].includes(lastVerb)) {
    line('The room is getting sharp; you can calm things with "calm".', 'hint');
  }
}

function tagsFromObject(obj) {
  return Object.entries(obj)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');
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
  line(
    describeRoom(state.world, roomId, state.system.state, {
      visitCount: visits,
      lastTensionDirection: state.narrative?.context?.lastTensionDirection ?? 'flat',
      recentDecisions: state.governance.committeeMemory.slice(0, 3),
      recentNarrativeLines: state.narrative?.recentLines ?? [],
    }),
    'system',
  );
  if (Math.random() < pacing.ambientNarrativeChance) {
    line(atmosphereNarrative(state.system.state, state.narrative), 'hint');
  }
  const roomGhost = maybeDirectionalGhostGlimpse(state.narrative);
  if (roomGhost) line(roomGhost, 'hint');
  if (visits === 1) {
    const firstVisitLine = pacing.ambientNarrativeChance <= 0.1
      ? 'This space accepts your presence without comment.'
      : 'You are here for the first time; the place feels more observed than empty.';
    line(firstVisitLine, 'hint');
  } else if (visits > 2) {
    if (Math.random() < pacing.roomEventChance) {
      line('On return, familiar details have shifted by a degree you cannot quite prove.', 'hint');
    }
  }
  const roomObj = state.world.rooms[state.player.currentRoom];
  if (roomObj.items.length) line(`Items here: ${roomObj.items.join(', ')}.`, 'hint');
  if (presentAgents.length) {
    const names = presentAgents.map((agent) => agent.name).join(', ');
    line(`Present here: ${names}.`, 'hint');
  } else if (Math.random() < 0.75) {
    line('No one is here right now; the room keeps its own counsel.', 'hint');
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
  const item = itemRaw.toLowerCase();
  const roomObj = state.world.rooms[state.player.currentRoom];
  const exact = roomObj.items.find((i) => i.toLowerCase() === item);
  if (!exact) {
    line('That item is not here.', 'warn');
    return;
  }
  removeItemFromRoom(state.world, state.player.currentRoom, exact);
  state.player.inventory.push(exact);
  line(`You take ${exact}.`, 'good');

  if (exact === 'iron key') {
    line("The porter notes that you took it without pocketing ceremony. 'Practical,' he says.", 'hint');
    applyRelationship(state.social, 'porter', 1);
    shiftPorterTrust(state.agents, 1);
    recordPorterMemory(state.agents, 'Player acquired the hall key responsibly.');
  }
}

function useItem(itemRaw) {
  const item = itemRaw.toLowerCase();
  const invExact = state.player.inventory.find((i) => i.toLowerCase() === item);
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

function forceDoor() {
  if (state.player.currentRoom !== 'hall') {
    line('There is no institutional door to force here.', 'warn');
    return;
  }
  state.player.attemptedForceDoor = true;
  shiftPorterTrust(state.agents, -2);
  applyRelationship(state.social, 'porter', -2);
  recordPorterMemory(state.agents, 'Player attempted to brute-force access.');
  line("You shoulder the door. The porter sighs: 'Velocity is not legitimacy.'", 'danger');
}

function showStatus() {
  line(`System: tension ${state.system.tension}, state ${state.system.state}.`, 'system');
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

function inspect(itemRaw) {
  const item = itemRaw.toLowerCase();
  const found = Object.entries(state.world.itemDescriptions).find(([name]) => name.toLowerCase() === item);
  if (!found) {
    line('You find little to inspect.', 'warn');
    return;
  }
  line(found[1]);
}

function drop(itemRaw) {
  const item = itemRaw.toLowerCase();
  const exact = state.player.inventory.find((i) => i.toLowerCase() === item);
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

  line(`> ${text}`, 'input');

  const [verbRaw, ...rest] = text.split(' ');
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

  if (dirAliases[verb]) {
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
      line(result.text, result.ok ? 'good' : 'warn');
      const depth = governanceNarrativeDepth(state.player.currentRoom);
      if (depth >= 1 && result.detail) line(result.detail, 'hint');
      if (depth >= 1 && result.narrative) line(result.narrative, 'hint');
      if (depth >= 2 && result.coalitionHint) line(result.coalitionHint, 'hint');
      if (depth >= 3 && result.stanceScene) line(result.stanceScene, 'hint');
      if (depth >= 2 && result.ambiguity) line(result.ambiguity, 'hint');
      line(voteNarrative(result.ok, result.yesVotes ?? 0, state.narrative), 'hint');
      const votePositioning = result.ok
        ? (result.yesVotes === 2 ? 'mediation' : 'alignment')
        : (result.yesVotes === 1 ? 'disagreement' : 'unclear');
      if (depth >= 2) line(positioningNarrative(votePositioning, state.narrative), 'hint');
      if (depth >= 2) line(derivePhaseSummary(state.system, state.governance.committeeMemory), 'hint');
      if (depth >= 2) line(phaseNarrative(state.system, state.governance.committeeMemory, state.narrative), 'hint');
      if (depth >= 2 && Math.random() < 0.78) line(porterReflection(state.system.state, state.social, state.narrative), 'hint');
      if (depth >= 1) line(porterOutcomeReflection(state.system, state.governance, state.social), 'hint');
      if (depth >= 3) {
        maybeComposedScene(state.system.state, state.social, votePositioning, state.narrative)
          .forEach((sceneLine) => line(sceneLine, 'hint'));
      }
      state.governanceUi.lastDecisionFailed = !result.ok;
      state.governanceUi.suggestionStreak = 0;
    }
  } else if (verb === 'calm' || verb === 'mediate') {
    if (verb === 'mediate') line('Tip: "mediate" is now "calm".', 'hint');
    logBehaviour(state.social, 'mediate');
    const drift = behaviouralDrift(state.social, 'mediate');
    const result = mediate(state.system, drift.modifier);
    line('You let things settle.', 'system');
    if (drift.hint) line(drift.hint, 'hint');
    line(result.text, result.ok ? 'good' : 'warn');
    line(result.ripple, 'hint');
    if (governanceNarrativeDepth(state.player.currentRoom) >= 2) {
      line(interventionNarrative('mediate', state.narrative), 'hint');
      line(positioningNarrative('mediation', state.narrative), 'hint');
      if (Math.random() < 0.74) line(porterReflection(state.system.state, state.social, state.narrative), 'hint');
    }
    line(porterOutcomeReflection(state.system, state.governance, state.social), 'hint');
    if (governanceNarrativeDepth(state.player.currentRoom) >= 3) {
      maybeComposedScene(state.system.state, state.social, 'mediation', state.narrative).forEach((sceneLine) => line(sceneLine, 'hint'));
    }
  } else if (verb === 'push' || verb === 'challenge') {
    if (verb === 'challenge') line('Tip: "challenge" is now "push".', 'hint');
    logBehaviour(state.social, 'challenge');
    const drift = behaviouralDrift(state.social, 'challenge');
    const result = challenge(state.system, drift.modifier);
    line('You push the idea forward.', 'system');
    if (drift.hint) line(drift.hint, 'hint');
    line(result.text, result.ok ? 'good' : 'warn');
    line(result.ripple, 'hint');
    if (governanceNarrativeDepth(state.player.currentRoom) >= 2) {
      line(interventionNarrative('challenge', state.narrative), 'hint');
      line(positioningNarrative('disagreement', state.narrative), 'hint');
      if (Math.random() < 0.74) line(porterReflection(state.system.state, state.social, state.narrative), 'hint');
    }
    line(porterOutcomeReflection(state.system, state.governance, state.social), 'hint');
    if (governanceNarrativeDepth(state.player.currentRoom) >= 3) {
      maybeComposedScene(state.system.state, state.social, 'disagreement', state.narrative).forEach((sceneLine) => line(sceneLine, 'hint'));
    }
  } else if (verb === 'shift' || verb === 'reset') {
    if (verb === 'reset') line('Tip: "reset" is now "shift".', 'hint');
    logBehaviour(state.social, 'reset');
    const drift = behaviouralDrift(state.social, 'reset');
    const result = resetNormAttempt(state.system, drift.modifier);
    line('You try to shift the routine people are following.', 'system');
    if (drift.hint) line(drift.hint, 'hint');
    line(result.text, result.ok ? 'good' : 'warn');
    line(result.ripple, 'hint');
    if (governanceNarrativeDepth(state.player.currentRoom) >= 2) {
      line(interventionNarrative('reset', state.narrative), 'hint');
      if (Math.random() < 0.72) line(porterReflection(state.system.state, state.social, state.narrative), 'hint');
    }
    if (result.ok) {
      state.governance.norms.consensusFirst = !state.governance.norms.consensusFirst;
      line(`consensusFirst is now ${state.governance.norms.consensusFirst}.`, 'system');
    }
    line(porterOutcomeReflection(state.system, state.governance, state.social), 'hint');
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
      line(`You sneeze. ${response}`, 'hint');
      shiftPorterTrust(state.agents, 1);
      applyRelationship(state.social, 'porter', 1);
      recordPorterMemory(state.agents, 'Player sneezed directly; porter responded.');
    } else if (state.social.sneezeCount > 2) {
      line('You sneeze again. No one comments.', 'hint');
    } else {
      line('You sneeze. The room lets the moment pass.', 'hint');
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
  if (continuityLine) line(continuityLine, 'hint');
  const tensionLine = tensionShiftNarrative(tensionBefore, state.system.tension, state.narrative);
  if (tensionLine) line(tensionLine, 'hint');
  if (state.system.lastTransition && state.system.lastTransition.turn !== priorTransitionTurn) {
    line(transitionMessage(state.system), 'system');
  }
  const echo = behaviourEcho(state.social);
  if (echo) line(echo, 'hint');
  const coldStart = maybeTriggerCold(state.social);
  if (coldStart) line(coldStart, 'hint');
  const sneeze = maybeSneeze(state.social, state.agents, state.player.currentRoom);
  if (sneeze && state.governance.norms.blessOnSneeze) line(sneeze, 'hint');
  const ambientSneezeLines = maybeAmbientSneezeNarrative(
    { porterNearby: state.agents.porter.roomId === state.player.currentRoom },
    state.narrative,
  );
  ambientSneezeLines.forEach((ambientLine) => line(ambientLine, 'hint'));
  queuedAmbientEvent = maybeAmbientWorldEvent(state.narrative);
  if (queuedAmbientEvent && !queuedAmbientEvent.delayed) {
    line(queuedAmbientEvent.line, 'hint');
    queuedAmbientEvent = null;
  }
  const ghostTrace = maybeGhostTraceNarrative(state.narrative);
  if (ghostTrace) line(ghostTrace, 'hint');
  const porterAbsentLine = maybePorterAbsenceLine(state.agents);
  if (porterAbsentLine) line(porterAbsentLine, 'hint');
  if (verb !== 'talk' && state.agents.porter.roomId === state.player.currentRoom && Math.random() < 0.16) {
    line(talkToPorter(state.agents, state.system.state, state.social), 'hint');
    if (Math.random() < 0.65) line(porterReflection(state.system.state, state.social, state.narrative), 'hint');
    if (Math.random() < 0.62) line(agentExchangeHint(state.system.state, state.governance, state.social, state.system.alignment), 'hint');
  }
  maybeShowGovernanceHints(verb);

  if (queuedAmbientEvent?.delayed) {
    const delayedLine = queuedAmbientEvent.line;
    window.setTimeout(() => {
      line(delayedLine, 'hint');
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
