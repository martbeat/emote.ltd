function pick(list, rng = Math.random) {
  if (!Array.isArray(list) || !list.length) return '';
  return list[Math.floor(rng() * list.length)];
}

function rotate(list, step = 1, phase = 0) {
  if (!Array.isArray(list) || !list.length) return '';
  const index = Math.max(0, step + phase) % list.length;
  return list[index];
}

const weatherPhases = [
  {
    id: 'rainApproaching',
    label: 'rain approaching',
    minDuration: 5,
    maxDuration: 9,
    driftBias: { to: 'steadyRain', chance: 0.56 },
    roomLines: {
      outside: [
        'Cloud-edge pressure gathers above the open stone.',
        'The air feels preoccupied, as if rain has begun elsewhere and is en route.',
      ],
      windowed: [
        'High panes carry a dim metallic light that suggests incoming rain.',
        'Windows hold a slight darkening, the kind that arrives before sound.',
      ],
      interior: [
        'A damp expectancy rides in on coats and paperwork.',
        'Someone has brought in the smell of wet stone before the weather itself.',
      ],
    },
    directional: 'a light pressure of weather from beyond the walls',
    social: [
      'Porters speak as if conserving dry paper.',
      'Conversations shorten by a sentence, then resume.',
    ],
  },
  {
    id: 'steadyRain',
    label: 'steady rain',
    minDuration: 7,
    maxDuration: 12,
    driftBias: { to: 'clearAfterRain', chance: 0.34 },
    roomLines: {
      outside: [
        'Rain settles into a patient rhythm across paving and hedge.',
        'Water threads the courtyard stone into a single low sheen.',
      ],
      windowed: [
        'Rain presses lightly at the high windows.',
        'Window glass carries the soft percussion of ordinary rain.',
      ],
      interior: [
        'Umbrellas drip somewhere out of sight; the floor remembers.',
        'Damp hems and quieter steps carry the rain inward by trace.',
      ],
    },
    directional: 'rain-muted movement in the connecting spaces',
    social: [
      'A clerk coughs once and receives two absent-minded blessings.',
      'The porter keeps his remarks short, as if preserving warmth for later.',
    ],
  },
  {
    id: 'brightColdMorning',
    label: 'bright cold morning',
    minDuration: 5,
    maxDuration: 8,
    driftBias: { to: 'dryAdministrativeSunlight', chance: 0.48 },
    roomLines: {
      outside: [
        'Sunlight is clear and unsentimental across the stone.',
        'Cold brightness sharpens edges, benches, and hesitation alike.',
      ],
      windowed: [
        'Light reaches the windows cleanly, with no softness to negotiate.',
        'Pale brightness slips through the glass and keeps to itself.',
      ],
      interior: [
        'Cold air lingers in the corridor margins, carried in by early arrivals.',
        'Inside, brightness arrives only as a cleaner outline on paper stacks.',
      ],
    },
    directional: 'clear light cutting across adjacent thresholds',
    social: [
      'Morning voices are brisk, almost charitable.',
      'Someone sneezes and apologises to no one in particular.',
    ],
  },
  {
    id: 'staleWarmAfternoon',
    label: 'stale warm afternoon',
    minDuration: 6,
    maxDuration: 10,
    driftBias: { to: 'windyUnsettledDay', chance: 0.3 },
    roomLines: {
      outside: [
        'Warmth gathers without relief, turning open paths a shade slower.',
        'The grounds hold a tired heat that discourages urgency.',
      ],
      windowed: [
        'Window light feels thick, as if the afternoon has stopped editing itself.',
        'The panes brighten but do not freshen the room.',
      ],
      interior: [
        'Paper and wool hold the day longer than anyone requested.',
        'Interior air sits heavy, as if stacked with unfiled decisions.',
      ],
    },
    directional: 'a slow warm drag in the passages',
    social: [
      'Several conversations lose momentum at the same time.',
      'A yawn is rebranded as strategic patience.',
    ],
  },
  {
    id: 'windyUnsettledDay',
    label: 'windy unsettled day',
    minDuration: 5,
    maxDuration: 9,
    driftBias: { to: 'stillHeavyWeather', chance: 0.26 },
    roomLines: {
      outside: [
        'Wind keeps rewriting the courtyard before anyone can agree on it.',
        'Gusts move through the open grounds like revisions with deadlines.',
      ],
      windowed: [
        'Drafts trouble the window seams in brief argumentative bursts.',
        'The windows answer the wind with quick, unsettled chatter.',
      ],
      interior: [
        'Doors report the wind indirectly: latch, hush, latch.',
        'Air shifts find their way in and then pretend they never did.',
      ],
    },
    directional: 'wind-skewed signals from nearby rooms',
    social: [
      'People pause mid-sentence as doors speak for the weather.',
      'The porter glances toward the hinges before answering anyone.',
    ],
  },
  {
    id: 'stillHeavyWeather',
    label: 'still heavy weather',
    minDuration: 6,
    maxDuration: 11,
    driftBias: { to: 'rainApproaching', chance: 0.22 },
    roomLines: {
      outside: [
        'The open air sits under a quiet weight that does not announce itself.',
        'Stone seems to hold yesterday and tomorrow at once.',
      ],
      windowed: [
        'Windows carry a soft pressure, as if weather is leaning rather than moving.',
        'The glass reflects more room than sky, and the effect is slightly stern.',
      ],
      interior: [
        'Even deep inside, coats feel slower to shed.',
        'A muted heaviness follows people in and stays near the doors.',
      ],
    },
    directional: 'a held atmospheric weight in nearby corridors',
    social: [
      'Coughs travel farther than usual and then stop abruptly.',
      'Jokes arrive drier than intended and are accepted anyway.',
    ],
  },
  {
    id: 'clearAfterRain',
    label: 'clear after rain',
    minDuration: 4,
    maxDuration: 7,
    driftBias: { to: 'brightColdMorning', chance: 0.24 },
    roomLines: {
      outside: [
        'The courtyard holds yesterday’s weather in the stone.',
        'Paving still shines in patches while the air turns newly clear.',
      ],
      windowed: [
        'The windows brighten over rain-marked glass.',
        'A cleaner light arrives through panes still patterned by water.',
      ],
      interior: [
        'Drying coats and fresher voices suggest the rain has moved on.',
        'The inside air lifts slightly, though the floor keeps a damp memory.',
      ],
    },
    directional: 'freshened air moving through connected spaces',
    social: [
      'People speak half a step more generously than an hour ago.',
      'The porter sounds almost optimistic, then quickly procedural.',
    ],
  },
  {
    id: 'dryAdministrativeSunlight',
    label: 'dry administrative sunlight',
    minDuration: 6,
    maxDuration: 10,
    driftBias: { to: 'staleWarmAfternoon', chance: 0.28 },
    roomLines: {
      outside: [
        'Sunlight lies across the grounds with bureaucratic confidence.',
        'Dry light clarifies everything and resolves almost nothing.',
      ],
      windowed: [
        'The windows admit a tidy, report-like sunlight.',
        'Light falls in rectangular certainty across benches and files.',
      ],
      interior: [
        'Even inside, a dry brightness arrives as stricter contrast.',
        'The day filters inward as orderly light and faint dust.',
      ],
    },
    directional: 'clean sunlight reflecting off stone beyond the rooms',
    social: [
      'Clerical tone improves while empathy remains optional.',
      'Someone sneezes; someone else calls it seasonal governance.',
    ],
  },
];

function phaseById(id) {
  return weatherPhases.find((entry) => entry.id === id) ?? weatherPhases[0];
}

function randomDuration(phase, rng = Math.random) {
  return phase.minDuration + Math.floor(rng() * (phase.maxDuration - phase.minDuration + 1));
}

export function createWeatherState(rng = Math.random) {
  const seed = pick(['rainApproaching', 'brightColdMorning', 'dryAdministrativeSunlight'], rng);
  const phase = phaseById(seed);
  return {
    phaseId: phase.id,
    turnsInPhase: 0,
    phaseDuration: randomDuration(phase, rng),
    history: [phase.id],
    changedThisTurn: false,
  };
}

export function tickWeather(weather, rng = Math.random) {
  if (!weather) return;
  weather.changedThisTurn = false;
  const current = phaseById(weather.phaseId);
  weather.turnsInPhase += 1;

  if (weather.turnsInPhase < weather.phaseDuration) return;

  const canDrift = rng() < 0.34;
  if (!canDrift) {
    weather.phaseDuration += 1 + Math.floor(rng() * 2);
    return;
  }

  const preferred = current.driftBias && rng() < current.driftBias.chance
    ? current.driftBias.to
    : pick(weatherPhases.filter((p) => p.id !== current.id).map((p) => p.id), rng);
  const next = phaseById(preferred);
  weather.phaseId = next.id;
  weather.turnsInPhase = 0;
  weather.phaseDuration = randomDuration(next, rng);
  weather.history.unshift(next.id);
  weather.history = weather.history.slice(0, 8);
  weather.changedThisTurn = true;
}

export function weatherExposureForRoom(roomProfile = {}, roomId = '') {
  const exteriorRooms = new Set(['quadrangle', 'courtyard', 'perimeterPath', 'garden']);
  const windowedRooms = new Set(['westPassage', 'gallery', 'upperLanding', 'stairwell']);
  if (exteriorRooms.has(roomId) || roomProfile.spatialTone?.includes('exterior')) return 'outside';
  if (windowedRooms.has(roomId) || roomProfile.spatialTone?.includes('semi-open')) return 'windowed';
  return 'interior';
}

export function weatherRoomLine(weather, roomProfile, roomId, visitCount = 1) {
  if (!weather) return '';
  const phase = phaseById(weather.phaseId);
  const exposure = weatherExposureForRoom(roomProfile, roomId);
  const lines = phase.roomLines[exposure] ?? phase.roomLines.interior;
  return rotate(lines, visitCount + weather.turnsInPhase, roomId.length % 2);
}

export function weatherDirectionalModifier(weather) {
  if (!weather) return '';
  return phaseById(weather.phaseId).directional;
}

export function weatherSocialTexture(weather, rng = Math.random, chance = 0.2) {
  if (!weather || rng() > chance) return null;
  const line = pick(phaseById(weather.phaseId).social, rng);
  return line || null;
}

export function weatherPhaseLabel(weather) {
  return phaseById(weather?.phaseId).label;
}

const institutionalWeatherBriefs = {
  rainApproaching: {
    pressure: [
      'The day is holding its breath.',
      'Rain is near, but still negotiating terms.',
    ],
    dayState: [
      'Windows brighten and then reconsider.',
      'The building listens for rain before admitting it expects any.',
    ],
    seasonal: [
      'A shoulder-season patience settles into the corridors.',
      'The season feels undecided, and so does everyone else.',
    ],
    social: [
      'People keep remarks shorter, as if saving dry margins.',
      'Even confident voices leave themselves an exit clause.',
    ],
  },
  steadyRain: {
    pressure: [
      'Rain settles in and keeps to its work.',
      'The weather becomes procedural: continuous, unpersuaded, exact.',
    ],
    dayState: [
      'Stone, steps, and coats all keep separate rain memories.',
      'The room sounds padded, as if each sentence arrives through cloth.',
    ],
    seasonal: [
      'The season feels fully present and mildly supervisory.',
      'Cold edges soften, but resolve does not.',
    ],
    social: [
      'People speak more quietly, though not more kindly.',
      'Minor disagreements are postponed rather than withdrawn.',
    ],
  },
  brightColdMorning: {
    pressure: [
      'Clear light sharpens every edge.',
      'Cold brightness keeps everyone briefly honest about distance.',
    ],
    dayState: [
      'Corridor margins stay cold even after the doors begin moving.',
      'The morning arrives precise enough to make hesitation visible.',
    ],
    seasonal: [
      'Seasonal signals read as alertness rather than comfort.',
      'The air has that early-term crispness that rewards brisk voices.',
    ],
    social: [
      'People sound more certain than they are.',
      'Greeting rituals are quick, almost efficient.',
    ],
  },
  staleWarmAfternoon: {
    pressure: [
      'Warmth thickens into the sort of afternoon that slows declarations.',
      'The day presses down without raising its voice.',
    ],
    dayState: [
      'The windows brighten, but do not freshen the room.',
      'Paper edges curl into a slower tempo.',
    ],
    seasonal: [
      'Late-season heaviness lingers in cloth, wood, and patience.',
      'The season behaves like a long committee meeting after lunch.',
    ],
    social: [
      'People restart sentences they might have finished this morning.',
      'Even urgency arrives with a yawn behind it.',
    ],
  },
  windyUnsettledDay: {
    pressure: [
      'The day keeps changing its emphasis.',
      'Wind pressure moves faster than institutional certainty.',
    ],
    dayState: [
      'Drafts keep editing the room before anyone can finalise tone.',
      'Doorframes report the weather in clipped interruptions.',
    ],
    seasonal: [
      'Seasonal change feels active, not negotiated.',
      'It has the edge of an in-between month refusing to settle.',
    ],
    social: [
      'People stop mid-claim, then resume with narrower wording.',
      'The room checks hinges as often as faces.',
    ],
  },
  stillHeavyWeather: {
    pressure: [
      'Air pressure leans in and waits.',
      'The day carries weight without offering explanation.',
    ],
    dayState: [
      'Silence deepens at the thresholds first.',
      'Even light seems to arrive carefully, as if not to disturb a verdict.',
    ],
    seasonal: [
      'Seasonal signals feel suspended between two decisions.',
      'It reads like pre-storm season, even when no storm is announced.',
    ],
    social: [
      'People keep jokes dry and close to the table.',
      'Agreement sounds easier than disagreement, but less sincere.',
    ],
  },
  clearAfterRain: {
    pressure: [
      'Pressure lifts, but does not leave entirely.',
      'The day exhales in measured installments.',
    ],
    dayState: [
      'Clean light arrives over glass still marked by rain.',
      'Floors retain a damp memory while voices recover speed.',
    ],
    seasonal: [
      'The season turns practical: cleaner air, unchanged tasks.',
      'Post-rain clarity reads as temporary reprieve, not reset.',
    ],
    social: [
      'People sound a little more generous and pretend not to notice.',
      'Minor courtesies return before major trust does.',
    ],
  },
  dryAdministrativeSunlight: {
    pressure: [
      'Dry administrative sunlight takes over.',
      'The day is clear, exact, and faintly prosecutorial.',
    ],
    dayState: [
      'Rectangular light files itself across desks and benches.',
      'Clear brightness sharpens outlines without softening outcomes.',
    ],
    seasonal: [
      'Seasonal tone is late-term austerity: bright, dry, unromantic.',
      'It feels like the part of the season that audits promises.',
    ],
    social: [
      'People phrase certainty as policy and doubt as procedure.',
      'Voices are crisp; empathy remains a discretionary expense.',
    ],
  },
};

export function describeInstitutionalWeather(weather, rng = Math.random) {
  const phase = phaseById(weather?.phaseId);
  const brief = institutionalWeatherBriefs[phase.id] ?? institutionalWeatherBriefs.rainApproaching;
  const lines = [
    pick(brief.pressure, rng),
    `Day-state: ${pick(brief.dayState, rng)}`,
    `Seasonal tone: ${pick(brief.seasonal, rng)}`,
  ];
  if (rng() < 0.72) {
    lines.push(`Social weather: ${pick(brief.social, rng)}`);
  }
  return lines.join('\n');
}

export function weatherShiftLine(weather) {
  if (!weather?.changedThisTurn) return null;
  const phase = phaseById(weather.phaseId);
  const shifts = {
    rainApproaching: 'The day leans toward rain without committing out loud.',
    steadyRain: 'Rain settles in and keeps to its work.',
    brightColdMorning: 'The light turns clear and cold enough to sharpen every edge.',
    staleWarmAfternoon: 'Warmth thickens into the sort of afternoon that slows declarations.',
    windyUnsettledDay: 'A restless wind starts editing the open spaces sentence by sentence.',
    stillHeavyWeather: 'The weather turns still and weighted, as if holding a long breath.',
    clearAfterRain: 'The rain passes; stone keeps the memory while the air clears.',
    dryAdministrativeSunlight: 'A dry administrative sunlight takes over, neat and faintly judgmental.',
  };
  return shifts[phase.id] ?? null;
}

export function maybeWeatherGovernanceMoment(weather, voteResult, rng = Math.random) {
  if (!weather?.changedThisTurn || !voteResult || rng() > 0.12) return null;
  const phaseLabel = weatherPhaseLabel(weather);
  if (voteResult.ok) {
    return `A vote settles just as ${phaseLabel} arrives. Nobody says this means anything, which helps.`;
  }
  return `The motion fails as ${phaseLabel} takes hold; objections suddenly sound climatological.`;
}
