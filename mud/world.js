export function createWorld() {
  return {
    rooms: {
      foyer: {
        id: 'foyer',
        name: 'Foyer of Drafts',
        description:
          'A stone antechamber with old noticeboards and damp woollen air. Chalk marks near the archway suggest prior committees preferred argument to maps.',
        exits: { north: 'hall' },
        items: ['ledger fragment'],
        stateDescriptions: {
          balanced: 'The drafts stop just short of being cold. Someone recently straightened the noticeboard pins.',
          chaotic: 'Loose papers spiral in brief gusts from unseen corridors.',
          stagnant: 'The same agenda appears to have been posted for weeks.',
        },
      },
      hall: {
        id: 'hall',
        name: 'Hall of Proceedings',
        description:
          'A long hall with a varnished table and a brass-plated door to the east. The porter keeps one eye on the lock and the other on your manners.',
        exits: { south: 'foyer', east: 'lockedRoom' },
        items: ['iron key'],
        stateDescriptions: {
          balanced: 'The table is scuffed but orderly; chairs face one another rather than away.',
          chaotic: 'Chairs sit at odd angles, as if arguments ended mid-sentence.',
          stagnant: 'Everything is aligned too neatly, like a room prepared for a meeting that never starts.',
        },
      },
      lockedRoom: {
        id: 'lockedRoom',
        name: 'Deliberation Chamber',
        description:
          'Lantern-light pools over proposal minutes, redacted charters, and a patient clock. This room feels less discovered than granted.',
        exits: { west: 'hall' },
        items: ['committee seal'],
        stateDescriptions: {
          balanced: 'Fresh notes lie atop older minutes, suggesting revision without denial.',
          chaotic: 'Recent annotations overwrite prior conclusions in urgent handwriting.',
          stagnant: 'The minutes are immaculate and untouched; even the ink seems resigned.',
        },
      },
    },
    roomFlavour: {
      balanced:
        'The building seems to breathe in even measure, as if friction and purpose are currently compatible.',
      chaotic:
        'Voices echo from nowhere in particular. Doors stick, chairs scrape, and consensus feels expensive.',
      stagnant:
        'Dust settles on active debates. Every mechanism still works, but only after a pause long enough to doubt it.',
    },
    itemDescriptions: {
      'ledger fragment':
        'A torn agenda sheet: "Item 4 — maintain courtesy rituals even under strain."',
      'iron key':
        'A heavy key with a stamped crest: Committee Access.',
      'committee seal':
        'A wax stamp used to ratify decisions. Warm from recent use.',
    },
  };
}

const roomMetaphors = {
  foyer: {
    balanced: [
      'The noticeboard holds its layers without collapsing into clutter.',
      'Air and paper move together, neither rushed nor stalled.',
      'The chalk marks look argued over, then accepted.',
    ],
    chaotic: [
      'Pinned memos overlap like voices reaching for the same pause.',
      'A draft keeps rearranging loose pages before any sentence can settle.',
      'The archway exhales noise in short, contradictory bursts.',
    ],
    stagnant: [
      'The woollen air sits too still, as if waiting for permission to move.',
      'Old chalk lines outlast relevance and begin to look ceremonial.',
      'Nothing disturbs the posted agenda except time.',
    ],
  },
  hall: {
    balanced: [
      'Chairs keep a measured distance, ready for disagreement without fracture.',
      'The long table carries motion in straight, deliberate lines.',
      'Even the brass plate catches light in controlled intervals.',
    ],
    chaotic: [
      'Chair legs scrape in uneven rhythm, as if several meetings are happening at once.',
      'Sound gathers at the table edge, then spills before it resolves.',
      'The corridor noise leaks in and tangles with half-finished remarks.',
    ],
    stagnant: [
      'The table reflects the same still scene from every angle.',
      'The porter\'s patience has the weight of furniture left unmoved.',
      'Everything is positioned for process, nothing for momentum.',
    ],
  },
  lockedRoom: {
    balanced: [
      'Lantern light tracks across old and new notes in a workable rhythm.',
      'The clock and the minutes keep pace without hurrying each other.',
      'Revisions sit beside precedent like controlled counterweight.',
    ],
    chaotic: [
      'Ink layers cross and recross until intent reads like weather.',
      'The clock ticks through interruptions that never quite end.',
      'Margins crowd with fresh edits that refuse to wait their turn.',
    ],
    stagnant: [
      'The light holds steady on decisions that no longer circulate.',
      'The clock moves, but the room keeps the same posture.',
      'Even the redactions feel settled into habit rather than caution.',
    ],
  },
};

const tensionEchoByState = {
  balanced: {
    up: [
      'A faint edge remains under the calmer pacing.',
      'The room keeps its balance, though the floor remembers recent strain.',
    ],
    down: [
      'The latest easing still lingers in how objects keep their distance.',
      'Calm remains, provisional but usable.',
    ],
    flat: [
      'No new pressure announces itself; the balance holds by attention.',
    ],
  },
  chaotic: {
    up: [
      'The recent rise in pressure still rings through every interruption.',
      'Noise folds over itself, sharpened by what just escalated.',
    ],
    down: [
      'The volume dips, but fragments of the earlier surge keep colliding.',
      'Some strain released, not enough to quiet the overlap.',
    ],
    flat: [
      'Instability persists at the same pitch, busy and unresolved.',
    ],
  },
  stagnant: {
    up: [
      'Even a small increase in pressure feels trapped, not redirected.',
      'Strain rises without finding motion, leaving the room tighter than louder.',
    ],
    down: [
      'Pressure softens into stillness that risks becoming routine.',
      'The easing settles as inertia before it becomes relief.',
    ],
    flat: [
      'The same quiet weight remains, unchanged and increasingly familiar.',
    ],
  },
};

const decisionEchoes = {
  accepted: [
    'Some corners still angle themselves toward the last assent.',
    'The room carries a faint memory of agreement, careful not to trust it.',
  ],
  rejected: [
    'You can feel where the last refusal is still being stepped around.',
    'A recent no remains in the architecture of how people would stand here.',
  ],
};

function rotateVariant(list, visitCount, phase = 0) {
  if (!Array.isArray(list) || list.length === 0) return '';
  const safeVisit = Math.max(1, visitCount ?? 1);
  return list[(safeVisit + phase - 1) % list.length];
}

function inferDecisionTag(recentDecisions = []) {
  const latest = recentDecisions.find(Boolean);
  if (!latest) return null;
  if (latest.startsWith('accepted:')) return 'accepted';
  if (latest.startsWith('rejected:')) return 'rejected';
  return null;
}

export function describeRoom(world, roomId, systemState, context = {}) {
  const room = world.rooms[roomId];
  const exits = Object.keys(room.exits).join(', ');
  const visitCount = context.visitCount ?? 1;
  const tensionDirection = context.lastTensionDirection ?? 'flat';
  const decisionTag = inferDecisionTag(context.recentDecisions);
  const localTexture = room.stateDescriptions?.[systemState] ?? '';
  const environmentalMetaphor = rotateVariant(roomMetaphors[roomId]?.[systemState], visitCount);
  const tensionEcho = rotateVariant(tensionEchoByState[systemState]?.[tensionDirection], visitCount, 1);
  const decisionEcho =
    decisionTag && visitCount % 2 === 0 ? rotateVariant(decisionEchoes[decisionTag], visitCount, 2) : '';
  const sensory = {
    balanced: 'Somewhere nearby, a pen scratches steadily across paper.',
    chaotic: 'You hear overlapping voices, then a sudden shared silence.',
    stagnant: 'Even footsteps seem to wait before committing to the floor.',
  }[systemState];
  return [
    room.name,
    room.description,
    localTexture,
    environmentalMetaphor,
    world.roomFlavour[systemState],
    tensionEcho,
    decisionEcho,
    sensory,
    `Exits: ${exits}.`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function hasItemInRoom(world, roomId, itemName) {
  return world.rooms[roomId].items.includes(itemName);
}

export function removeItemFromRoom(world, roomId, itemName) {
  world.rooms[roomId].items = world.rooms[roomId].items.filter((item) => item !== itemName);
}

export function addItemToRoom(world, roomId, itemName) {
  world.rooms[roomId].items.push(itemName);
}
