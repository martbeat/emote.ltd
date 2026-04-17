const roomProfiles = {
  foyer: { interaction: 'medium', spatialTone: 'enclosed-threshold', ambience: 'transitional' },
  hall: { interaction: 'high', spatialTone: 'civic-interior', ambience: 'active' },
  lockedRoom: { interaction: 'high', spatialTone: 'enclosed-deliberative', ambience: 'active' },
  westPassage: { interaction: 'low', spatialTone: 'narrow-transitional', ambience: 'quiet' },
  quadrangle: { interaction: 'sparse', spatialTone: 'open-exterior', ambience: 'quiet' },
  courtyard: { interaction: 'low', spatialTone: 'open-exterior', ambience: 'quiet' },
  eastCorridor: { interaction: 'medium', spatialTone: 'long-transitional', ambience: 'transitional' },
  stairwell: { interaction: 'sparse', spatialTone: 'vertical-transitional', ambience: 'quiet' },
  upperLanding: { interaction: 'low', spatialTone: 'semi-open-threshold', ambience: 'quiet' },
  archive: { interaction: 'sparse', spatialTone: 'enclosed-storage', ambience: 'quiet' },
  perimeterPath: { interaction: 'sparse', spatialTone: 'open-exterior', ambience: 'quiet' },
  gallery: { interaction: 'medium', spatialTone: 'open-interior', ambience: 'quiet' },
  garden: { interaction: 'low', spatialTone: 'open-exterior', ambience: 'quiet' },
};

const roomPacing = {
  high: { ambientNarrativeChance: 0.35, roomEventChance: 0.28 },
  medium: { ambientNarrativeChance: 0.2, roomEventChance: 0.15 },
  low: { ambientNarrativeChance: 0.08, roomEventChance: 0.04 },
  sparse: { ambientNarrativeChance: 0.06, roomEventChance: 0.02 },
};

export function createWorld() {
  return {
    rooms: {
      foyer: {
        id: 'foyer',
        name: 'Foyer of Drafts',
        description:
          'A stone antechamber with old noticeboards and damp woollen air. Chalk marks near the archway suggest prior committees preferred argument to maps.',
        exits: { north: 'hall', west: 'westPassage' },
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
          'A long hall with a varnished table and a brass-plated door to the east. Sightlines run the full length of the chamber, making each interruption visible from far away.',
        exits: { south: 'foyer', east: 'lockedRoom', north: 'eastCorridor' },
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
        exits: { west: 'hall', north: 'archive' },
        items: ['committee seal'],
        stateDescriptions: {
          balanced: 'Fresh notes lie atop older minutes, suggesting revision without denial.',
          chaotic: 'Recent annotations overwrite prior conclusions in urgent handwriting.',
          stagnant: 'The minutes are immaculate and untouched; even the ink seems resigned.',
        },
      },
      westPassage: {
        id: 'westPassage',
        name: 'West Passage',
        description:
          'A long brick passage where light arrives in strips through high windows. Footsteps stretch and then disappear before reaching the far end.',
        exits: { east: 'foyer', north: 'quadrangle' },
        items: [],
        stateDescriptions: {
          balanced: 'The corridor holds a cool, workable quiet.',
          chaotic: 'Sound from distant meetings arrives in uneven pulses, then drops away.',
          stagnant: 'Air and dust seem to settle at exactly the same pace.',
        },
      },
      quadrangle: {
        id: 'quadrangle',
        name: 'Inner Quadrangle',
        description:
          'An open rectangle of pale stone with low grass plots and long sightlines. People pass through without needing to explain themselves.',
        exits: { south: 'westPassage', east: 'courtyard', north: 'perimeterPath' },
        items: [],
        stateDescriptions: {
          balanced: 'The open air makes every pause feel proportionate.',
          chaotic: 'Crosswinds pull distant voices apart before they become argument.',
          stagnant: 'The wide space sits still enough to make movement feel optional.',
        },
      },
      courtyard: {
        id: 'courtyard',
        name: 'Inner Courtyard',
        description:
          'A broad courtyard of worn paving and rain barrels, open to a high rectangle of sky. The institution feels smaller and larger here at once.',
        exits: { south: 'quadrangle', east: 'eastCorridor', north: 'garden' },
        items: [],
        stateDescriptions: {
          balanced: 'Rainwater gathers in calm basins and reflects moving clouds.',
          chaotic: 'A door somewhere keeps knocking against its frame in restless bursts.',
          stagnant: 'Even wind crosses slowly, as though reluctant to disturb the square.',
        },
      },
      eastCorridor: {
        id: 'eastCorridor',
        name: 'East Corridor',
        description:
          'A broad corridor linking offices and committee spaces, lined with closed doors and brass nameplates turned inward.',
        exits: { south: 'hall', west: 'courtyard', north: 'stairwell', east: 'gallery' },
        items: [],
        stateDescriptions: {
          balanced: 'Distant doors open and close in an orderly rhythm.',
          chaotic: 'Conversations leak through panels and collide in the corridor.',
          stagnant: 'Most doors stay shut long enough to look permanent.',
        },
      },
      stairwell: {
        id: 'stairwell',
        name: 'North Stairwell',
        description:
          'A high stairwell with chipped railings and landings that briefly frame other wings. It feels built for movement, not debate.',
        exits: { south: 'eastCorridor', north: 'upperLanding' },
        items: [],
        stateDescriptions: {
          balanced: 'Footsteps rise and fall in clean sequence, then clear away.',
          chaotic: 'Echoes ricochet between floors and arrive out of order.',
          stagnant: 'The landings hold a hush that lingers after each step.',
        },
      },
      upperLanding: {
        id: 'upperLanding',
        name: 'Upper Landing',
        description:
          'An open landing with a tall balustrade overlooking the courtyard. From here, governance rooms feel like one district among many.',
        exits: { south: 'stairwell', east: 'archive', west: 'gallery' },
        items: [],
        stateDescriptions: {
          balanced: 'The view gives scale without urgency.',
          chaotic: 'The building seems busy in several directions at once.',
          stagnant: 'The whole complex looks paused, as if awaiting a cue.',
        },
      },
      archive: {
        id: 'archive',
        name: 'Silent Archive',
        description:
          'Rows of boxed minutes, retired signage, and bound ledgers vanish into dim shelves. Memory has more mass here than voice.',
        exits: { south: 'lockedRoom', west: 'upperLanding' },
        items: [],
        stateDescriptions: {
          balanced: 'Recent folders sit beside old decisions without accusation.',
          chaotic: 'Several bundles stand open, as though recollection became urgent.',
          stagnant: 'Dust outlines where hands used to reach, and no longer do.',
        },
      },
      perimeterPath: {
        id: 'perimeterPath',
        name: 'Perimeter Path',
        description:
          'A narrow gravel path skirting the outer wall where committee noise arrives only as faint weather. Systems are sensed here by delay.',
        exits: { south: 'quadrangle', east: 'garden' },
        items: [],
        stateDescriptions: {
          balanced: 'Distant activity reaches you as soft, delayed pulses.',
          chaotic: 'Far-off commotion arrives in broken waves with no clear source.',
          stagnant: 'Even outside signals thin into long, indifferent pauses.',
        },
      },
      gallery: {
        id: 'gallery',
        name: 'Public Gallery',
        description:
          'A long gallery with benches and high windows facing the garden wall. The chamber sounds distant from here, almost optional.',
        exits: { west: 'eastCorridor', east: 'upperLanding', south: 'garden' },
        items: [],
        stateDescriptions: {
          balanced: 'The benches sit unused but not abandoned.',
          chaotic: 'Murmurs carry up from below, then dissolve into drafty space.',
          stagnant: 'The windows show the same still view for what feels like hours.',
        },
      },
      garden: {
        id: 'garden',
        name: 'Outer Garden',
        description:
          'A gravel garden beyond the main halls, with low hedges, weathered stone seats, and a gate that opens to the street beyond institutional hearing.',
        exits: { south: 'courtyard', north: 'gallery' },
        items: [],
        stateDescriptions: {
          balanced: 'Birdsong threads quietly through the hedge line.',
          chaotic: 'Even outside, the air carries unresolved urgency from within.',
          stagnant: 'Stillness deepens until even distant traffic sounds suspended.',
        },
      },
    },
    roomProfiles,
    roomPacing,
    roomFlavour: {
      balanced:
        'The building seems to breathe in even measure, as if friction and purpose are currently compatible.',
      chaotic:
        'Voices echo from nowhere in particular. Doors stick, chairs scrape, and consensus feels expensive.',
      stagnant:
        'Dust settles on active debates. Every mechanism still works, but only after a pause long enough to doubt it.',
    },
    ambientEffects: {
      interior: {
        balanced: [
          'Somewhere deep in the structure, a routine continues without fanfare.',
          'A distant cadence of work carries through walls, steady and low.',
        ],
        chaotic: [
          'From far off, a sudden burst of raised voices arrives and then disperses.',
          'A remote door slams, then the corridors pretend it did not.',
        ],
        stagnant: [
          'The distant wings of the building seem unusually mute.',
          'Even far-off activity has the stillness of a paused hearing.',
        ],
      },
      exterior: {
        balanced: [
          'Beyond the walls, city noise moves at an ordinary, forgiving distance.',
          'The outside world continues without needing this room to decide first.',
        ],
        chaotic: [
          'Street sounds arrive in broken fragments, as if the day itself is interrupting.',
          'Even the open air carries an unsettled edge from the chambers behind you.',
        ],
        stagnant: [
          'Outside motion feels far away, almost softened into static.',
          'The grounds hold a deep pause, as though waiting for a delayed verdict.',
        ],
      },
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
  eastCorridor: {
    balanced: [
      'Doorframes mark distance in clean, repeatable intervals.',
      'The corridor feels like infrastructure rather than pressure.',
    ],
    chaotic: [
      'Footsteps from several directions cross without resolving into a crowd.',
      'Announcements begin behind doors and end before the handle turns.',
    ],
    stagnant: [
      'The corridor becomes a line of waiting thresholds.',
      'Even nameplates seem to have chosen silence over revision.',
    ],
  },
  courtyard: {
    balanced: [
      'Open sky widens every pause into something usable.',
      'Distance between walls gives arguments room to cool on their own.',
    ],
    chaotic: [
      'Wind catches scraps of sound and spins them across stone.',
      'The square amplifies unrest by scattering it in all directions.',
    ],
    stagnant: [
      'The open space feels held in suspension rather than rest.',
      'Even weather seems to hesitate over the paving.',
    ],
  },
  quadrangle: {
    balanced: [
      'Open ground gives each motion a beginning and an end.',
      'The square absorbs urgency and returns it as proportion.',
    ],
    chaotic: [
      'Crossing lines of movement break before they become collisions.',
      'The openness scatters tension into fragments that cannot cluster.',
    ],
    stagnant: [
      'Wide space turns pause into habit.',
      'Nothing blocks movement, yet little insists on it.',
    ],
  },
  stairwell: {
    balanced: [
      'The stair keeps people moving before positions can calcify.',
      'Each landing offers perspective, then asks you to continue.',
    ],
    chaotic: [
      'Footsteps and echoes overtake one another between floors.',
      'Voices arrive a level early and leave a level late.',
    ],
    stagnant: [
      'The rail feels polished by older urgency, not current use.',
      'Landings hold stillness longer than transit should allow.',
    ],
  },
  archive: {
    balanced: [
      'Records sit like ballast: heavy, quiet, and useful when consulted.',
      'Old minutes and new annotations share shelf space without drama.',
    ],
    chaotic: [
      'Open boxes read like memory interrupted mid-sentence.',
      'Recent handling leaves the past looking abruptly unfinished.',
    ],
    stagnant: [
      'Catalog cards imply motion that no one is currently making.',
      'The shelves keep decisions long after their urgency has thinned.',
    ],
  },
  perimeterPath: {
    balanced: [
      'Signals from inside arrive softened, enough to orient without enclosing you.',
      'Distance turns institutional noise into manageable weather.',
    ],
    chaotic: [
      'Unclear bursts from within reach the wall as irregular pressure.',
      'The path receives conflict only as vibration and delay.',
    ],
    stagnant: [
      'Silence stretches long enough to make governance feel hypothetical.',
      'From here, unchanged rhythms become almost inaudible.',
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

function pick(list, rng = Math.random) {
  if (!Array.isArray(list) || list.length === 0) return '';
  return list[Math.floor(rng() * list.length)];
}

function pickFresh(list, recent = [], rng = Math.random, window = 6) {
  const blocked = recent.slice(-window);
  const options = list.filter((line) => !blocked.includes(line));
  return pick(options.length ? options : list, rng);
}

const directionalImpressions = {
  balanced: {
    open: [
      'open stone and measured movement',
      'air that carries readable activity',
      'space that feels navigable, not exposed',
    ],
    enclosed: [
      'contained work in a steady rhythm',
      'low voices that hold shape through the walls',
      'a settled room with clear edges',
    ],
    transitional: [
      'a corridor pulse, calm but active',
      'footsteps arriving in orderly intervals',
      'movement that feels deliberate, not urgent',
    ],
  },
  chaotic: {
    open: [
      'cross-currents of motion and clipped voices',
      'overlapping signals scattered by wind',
      'too many threads moving at once',
    ],
    enclosed: [
      'stacked voices with no clean source',
      'a room where interruptions outrun conclusions',
      'fragmented sound pressing through the seams',
    ],
    transitional: [
      'uneven traffic and unfinished remarks',
      'quick motion that never resolves into flow',
      'bursts of noise, then sharp drop-offs',
    ],
  },
  stagnant: {
    open: [
      'still air stretched across the space',
      'quiet ground with almost no drift',
      'an open pause that does not break',
    ],
    enclosed: [
      'muffled silence and static fixtures',
      'a held room with little sign of use',
      'slow, sealed quiet',
    ],
    transitional: [
      'a passage settled into near-silence',
      'long gaps between any sign of motion',
      'a threshold that feels paused',
    ],
  },
};

const directionalGhostTemplates = [
  'a figure in the next room, already turning out of view',
  'movement that vanishes before you can fix its source',
  'someone crossing an adjacent threshold, then gone',
  'a partial silhouette that dissolves into corridor light',
  'a brief shift of presence with no one left in frame',
];

const systemBleedTemplates = {
  balanced: [
    'a distant voice resolves, then fades cleanly',
    'committee murmur arrives as soft background weather',
    'unresolved work hums at the edge of hearing',
  ],
  chaotic: [
    'voices overlap and split before meaning lands',
    'a clipped argument bleeds through, then cuts out',
    'remote activity collides into static fragments',
  ],
  stagnant: [
    'stillness holds longer than expected',
    'far-off halls answer with almost nothing',
    'unresolved silence lingers in the structure',
  ],
};

function inferDirectionalTexture(world, targetRoomId) {
  const profile = world.roomProfiles?.[targetRoomId];
  const tone = profile?.spatialTone ?? '';
  if (tone.includes('open')) return 'open';
  if (tone.includes('transitional') || tone.includes('threshold')) return 'transitional';
  return 'enclosed';
}

function buildExitGlimpses(world, room, systemState, context = {}) {
  const rng = context.rng ?? Math.random;
  const recent = context.recentNarrativeLines ?? [];
  const directions = Object.entries(room.exits);
  return directions.map(([direction, targetRoomId]) => {
    const texture = inferDirectionalTexture(world, targetRoomId);
    const impression = pickFresh(directionalImpressions[systemState]?.[texture] ?? [], recent, rng, 8);
    const maybeGhost = rng() < 0.16 ? pickFresh(directionalGhostTemplates, recent, rng, 8) : '';
    const maybeBleed = rng() < 0.28 ? pickFresh(systemBleedTemplates[systemState] ?? [], recent, rng, 8) : '';
    const clauses = [impression, maybeGhost, maybeBleed].filter(Boolean);
    return `- ${direction}: ${clauses.join('; ')}.`;
  });
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
  const profile = world.roomProfiles?.[roomId] ?? { interaction: 'medium', spatialTone: 'enclosed', ambience: 'transitional' };
  const visitCount = context.visitCount ?? 1;
  const tensionDirection = context.lastTensionDirection ?? 'flat';
  const decisionTag = inferDecisionTag(context.recentDecisions);
  const localTexture = room.stateDescriptions?.[systemState] ?? '';
  const environmentalMetaphor = rotateVariant(roomMetaphors[roomId]?.[systemState], visitCount);
  const tensionEcho = rotateVariant(tensionEchoByState[systemState]?.[tensionDirection], visitCount, 1);
  const decisionEcho =
    decisionTag && visitCount % 2 === 0 ? rotateVariant(decisionEchoes[decisionTag], visitCount, 2) : '';
  const ambientScope = profile.spatialTone.includes('exterior') ? 'exterior' : 'interior';
  const ambientSignal = rotateVariant(world.ambientEffects?.[ambientScope]?.[systemState], visitCount, 2);
  const sensory = {
    balanced: 'Somewhere nearby, a pen scratches steadily across paper.',
    chaotic: 'You hear overlapping voices, then a sudden shared silence.',
    stagnant: 'Even footsteps seem to wait before committing to the floor.',
  }[systemState];
  const exitGlimpses = buildExitGlimpses(world, room, systemState, context);
  return [
    room.name,
    room.description,
    localTexture,
    environmentalMetaphor,
    ambientSignal,
    world.roomFlavour[systemState],
    tensionEcho,
    decisionEcho,
    sensory,
    'Exits:',
    ...exitGlimpses,
  ]
    .filter(Boolean)
    .join('\n');
}

export function getRoomPacing(world, roomId) {
  const interactionBand = world.roomProfiles?.[roomId]?.interaction ?? 'medium';
  return world.roomPacing?.[interactionBand] ?? world.roomPacing.medium;
}

export function roomAllowsAmbientOutput(world, roomId) {
  const interactionBand = world.roomProfiles?.[roomId]?.interaction ?? 'medium';
  return interactionBand !== 'low';
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
