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
      },
      hall: {
        id: 'hall',
        name: 'Hall of Proceedings',
        description:
          'A long hall with a varnished table and a brass-plated door to the east. The porter keeps one eye on the lock and the other on your manners.',
        exits: { south: 'foyer', east: 'lockedRoom' },
        items: ['iron key'],
      },
      lockedRoom: {
        id: 'lockedRoom',
        name: 'Deliberation Chamber',
        description:
          'Lantern-light pools over proposal minutes, redacted charters, and a patient clock. This room feels less discovered than granted.',
        exits: { west: 'hall' },
        items: ['committee seal'],
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

export function describeRoom(world, roomId, systemState) {
  const room = world.rooms[roomId];
  const exits = Object.keys(room.exits).join(', ');
  return [room.name, room.description, world.roomFlavour[systemState], `Exits: ${exits}.`].join('\n');
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
