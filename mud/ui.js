import {
  createWorld,
  describeRoom,
  removeItemFromRoom,
  addItemToRoom,
} from './world.js';
import {
  createAgents,
  talkToPorter,
  getInfluenceHint,
  agentExchangeHint,
  metaphoricalPositioningCue,
  porterOutcomeReflection,
  shiftPorterTrust,
  recordPorterMemory,
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
  tensionNarrative,
  transitionMessage,
  mediate,
  challenge,
  resetNormAttempt,
} from './system.js';

function createGameState() {
  return {
    world: createWorld(),
    agents: createAgents(),
    social: createSocialState(),
    governance: createGovernanceState(),
    system: createSystemState(),
    player: {
      currentRoom: 'foyer',
      inventory: [],
      attemptedForceDoor: false,
      visitCounts: {},
    },
  };
}

const SAVE_KEY = 'essexMudGovV1';
let state = createGameState();

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
  state.player.visitCounts[roomId] = (state.player.visitCounts[roomId] ?? 0) + 1;
  const visits = state.player.visitCounts[roomId];
  line(describeRoom(state.world, roomId, state.system.state), 'system');
  if (visits === 1) {
    line('You are here for the first time; the place feels more observed than empty.', 'hint');
  } else if (visits > 2) {
    line('On return, familiar details have shifted by a degree you cannot quite prove.', 'hint');
  }
  const roomObj = state.world.rooms[state.player.currentRoom];
  if (roomObj.items.length) line(`Items here: ${roomObj.items.join(', ')}.`, 'hint');
  if (state.player.currentRoom === 'hall') line('The porter stands by the east door, politely immovable.', 'hint');
  maybeArrivalNarrativeHook(roomId);
}

function atmosphericCueForState(systemState) {
  if (systemState === 'chaotic') return 'The air feels less shared than negotiated.';
  if (systemState === 'stagnant') return 'The air feels preserved, as if waiting for someone else to begin.';
  return 'The air feels… negotiable.';
}

function maybeArrivalNarrativeHook(roomId) {
  const keyRoom = roomId === 'hall' || roomId === 'lockedRoom';
  if (!keyRoom || Math.random() >= 0.28) return;

  const porterLine = talkToPorter(state.agents, state.system.state, state.social);
  const positionCue = metaphoricalPositioningCue(state.system.state, state.governance);
  const atmospheric = atmosphericCueForState(state.system.state);

  line(porterLine, 'hint');
  line(positionCue, 'hint');
  line(atmospheric, 'hint');
}

function maybeComposedTransitionBundle() {
  if (Math.random() >= 0.35) return;
  line(porterOutcomeReflection(state.system, state.governance, state.social), 'hint');
  line(metaphoricalPositioningCue(state.system.state, state.governance), 'hint');
  line(atmosphericCueForState(state.system.state), 'hint');
}

function save() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  line('State saved locally. Institutional memory now survives page refresh.', 'good');
}

function load() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    line('No save found.', 'warn');
    return;
  }
  state = JSON.parse(raw);
  line('State loaded.', 'good');
  refreshSidebar();
  renderRoom();
}

function move(direction) {
  const roomObj = state.world.rooms[state.player.currentRoom];
  const target = roomObj.exits[direction];
  if (!target) {
    line('No exit that way.', 'warn');
    return;
  }

  if (state.player.currentRoom === 'hall' && direction === 'east') {
    const hasKey = state.player.inventory.includes('iron key');
    const trust = state.agents.porter.trust;
    if (!hasKey) {
      line("The porter taps the keyhole. 'Mechanisms still matter.'", 'warn');
      return;
    }
    if (trust < 2) {
      line("The porter says, 'Not yet. You have the key, not the standing.'", 'warn');
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
  line(`Taken: ${exact}.`, 'good');

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
  if (target !== 'porter' || state.player.currentRoom !== 'hall') {
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
  line(getInfluenceHint(state.agents), 'hint');
  line(agentExchangeHint(state.system.state, state.governance), 'hint');
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
  line(`Dropped: ${exact}.`);
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

  const dirAliases = { n: 'north', s: 'south', e: 'east', w: 'west' };
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
  } else if (verb === 'propose') {
    line(proposeRule(state.governance, state.social, arg || 'blessOnSneeze=true'), 'system');
    line('Pens pause around the table; someone quietly revises their objections in advance.', 'hint');
  } else if (verb === 'vote') {
    const result = vote(state.governance, state.agents, state.social, state.system);
    line(result.text, result.ok ? 'good' : 'warn');
    if (result.detail) line(result.detail, 'hint');
    if (result.narrative) line(result.narrative, 'hint');
    if (result.coalitionHint) line(result.coalitionHint, 'hint');
    if (result.stanceScene) line(result.stanceScene, 'hint');
    if (result.ambiguity) line(result.ambiguity, 'hint');
    line(derivePhaseSummary(state.system, state.governance.committeeMemory), 'hint');
    line(porterOutcomeReflection(state.system, state.governance, state.social), 'hint');
  } else if (verb === 'mediate') {
    logBehaviour(state.social, 'mediate');
    const drift = behaviouralDrift(state.social, 'mediate');
    const result = mediate(state.system, drift.modifier);
    if (drift.hint) line(drift.hint, 'hint');
    line(result.text, result.ok ? 'good' : 'warn');
    line(result.ripple, 'hint');
    line(porterOutcomeReflection(state.system, state.governance, state.social), 'hint');
  } else if (verb === 'challenge') {
    logBehaviour(state.social, 'challenge');
    const drift = behaviouralDrift(state.social, 'challenge');
    const result = challenge(state.system, drift.modifier);
    if (drift.hint) line(drift.hint, 'hint');
    line(result.text, result.ok ? 'good' : 'warn');
    line(result.ripple, 'hint');
    line(porterOutcomeReflection(state.system, state.governance, state.social), 'hint');
  } else if (verb === 'reset') {
    logBehaviour(state.social, 'reset');
    const drift = behaviouralDrift(state.social, 'reset');
    const result = resetNormAttempt(state.system, drift.modifier);
    if (drift.hint) line(drift.hint, 'hint');
    line(result.text, result.ok ? 'good' : 'warn');
    line(result.ripple, 'hint');
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
    if (!state.social.playerCold) {
      state.social.playerCold = true;
      line('You summon a theatrical sneeze. The porter still says, "Bless you."', 'hint');
    } else {
      line('You sneeze again; etiquette remains the smallest policy with the largest footprint.', 'hint');
    }
    shiftPorterTrust(state.agents, 1);
  } else if (verb === 'save') {
    save();
  } else if (verb === 'load') {
    load();
  } else if (verb === 'restart') {
    state = createGameState();
    line('Simulation reset. The institution forgets, mostly.', 'system');
    renderRoom();
  } else if (verb === 'help') {
    line('Commands: look, n/s/e/w, go <dir>, take/use/drop/inspect <item>, talk porter, force, propose <rule>, vote, mediate, challenge, reset, sneeze, status, history, save, load, restart.');
  } else {
    line('Command not understood. Try "help".', 'warn');
  }

  tickSystem(state.system);
  const tensionLine = tensionNarrative(tensionBefore, state.system.tension, state.system.state);
  if (tensionLine) line(tensionLine, 'hint');
  if (state.system.lastTransition && state.system.lastTransition.turn !== priorTransitionTurn) {
    line(transitionMessage(state.system), 'system');
    maybeComposedTransitionBundle();
  }
  const echo = behaviourEcho(state.social);
  if (echo) line(echo, 'hint');
  const coldStart = maybeTriggerCold(state.social);
  if (coldStart) line(coldStart, 'hint');
  const sneeze = maybeSneeze(state.social, state.agents);
  if (sneeze && state.governance.norms.blessOnSneeze) line(sneeze, 'hint');
  if (verb !== 'talk' && state.player.currentRoom === 'hall' && Math.random() < 0.22) {
    line(talkToPorter(state.agents, state.system.state, state.social), 'hint');
    line(agentExchangeHint(state.system.state, state.governance), 'hint');
  }

  refreshSidebar();
}

function boot() {
  line('Essex-inspired governance simulation online.', 'system');
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
    line('Simulation reset.');
    renderRoom();
    refreshSidebar();
  });
}

boot();
