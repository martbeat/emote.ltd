const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const html = fs.readFileSync("stats/index.html", "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const base = {
  general: {
    start_date: "05/Oct/2026",
    end_date: "19/Oct/2026",
    date_time: "2026-10-19 21:00:00 +0100",
    valid_requests: 100,
    unique_visitors: 30,
    bandwidth: 1048576,
  },
  requests: {
    data: [
      {
        data: "/knowledge/",
        method: "GET",
        hits: { count: 10 },
        visitors: { count: 8 },
      },
      { data: "/redactor.html", hits: { count: 5 }, visitors: { count: 8 } },
      { data: "/feed.xml", hits: { count: 60 } },
    ],
  },
  visitors: {
    data: [{ data: "20261019", hits: { count: 40 }, visitors: { count: 20 } }],
  },
};
async function run(overrides = {}) {
  const nodes = new Map();
  const document = {
    getElementById(id) {
      if (!nodes.has(id))
        nodes.set(id, {
          textContent: "",
          innerHTML: "",
          value: "",
          addEventListener() {},
        });
      return nodes.get(id);
    },
  };
  const fixtures = {
    weekly: base,
    pdf: {
      ...base,
      requests: { data: [] },
      static_requests: {
        data: [
          { data: "/test.pdf", hits: { count: 14 }, visitors: { count: 13 } },
        ],
      },
    },
    games: base,
    humans: { ...base, general: { ...base.general, valid_requests: 120 } },
    debug: { ...base, general: { ...base.general, start_date: "19/Oct/2026" } },
    "games-summary": {},
    "blog-articles-summary": {
      "/article.html": { opens: 5, engaged: 3, engagement_rate: 0.6 },
    },
    ...overrides,
  };
  const context = vm.createContext({
    document,
    console: { error() {} },
    Date,
    fetch: async (path, options) => {
      assert.equal(options.cache, "no-store");
      const d = fixtures[path.replace(".json", "")];
      return {
        ok: d !== null,
        status: d === null ? 404 : 200,
        json: async () => d,
      };
    },
  });
  vm.runInContext(script.replace(/init\(\);\s*$/, ""), context);
  await vm.runInContext("init()", context);
  return { nodes, context };
}
test("main counts use one source, no page visitor sums, dates and ratios are honest", async () => {
  const { nodes } = await run();
  assert.equal(nodes.get("requests").textContent, "100");
  assert.equal(nodes.get("visitors").textContent, "30");
  assert.equal(nodes.get("pages").textContent, "15");
  assert.equal(nodes.get("bandwidth").textContent, "1");
  assert.match(
    nodes.get("period").textContent,
    /05\/Oct\/2026 to 19\/Oct\/2026/,
  );
  assert.match(nodes.get("warning-list").innerHTML, /15 calendar days/);
  assert.match(
    nodes.get("warning-list").innerHTML,
    /more requests than the main/,
  );
  assert.match(nodes.get("warning-list").innerHTML, /Debug export covers/);
  assert.match(nodes.get("articles").innerHTML, /60.0%/);
  assert.match(nodes.get("pdf-table").innerHTML, /test.pdf/);
  assert.match(nodes.get("pdf-table").innerHTML, /14/);
  assert.doesNotMatch(nodes.get("page-table").innerHTML, /feed.xml/);
});
test("optional failures do not blank main report or become zeroes", async () => {
  const { nodes } = await run({
    pdf: null,
    debug: null,
    humans: null,
    "games-summary": null,
  });
  assert.equal(nodes.get("requests").textContent, "100");
  assert.match(nodes.get("pdf-table").innerHTML, /unavailable/i);
  assert.match(nodes.get("game-events").innerHTML, /unavailable/i);
  assert.match(
    nodes.get("warning-list").innerHTML,
    /Missing data is not counted as zero/,
  );
  assert.equal(nodes.get("refresh").disabled, false);
});
test("main failure still renders independent article and PDF data", async () => {
  const { nodes } = await run({ weekly: null });
  assert.equal(nodes.get("requests").textContent, "Unavailable");
  assert.equal(nodes.get("pages").textContent, "Unavailable");
  assert.match(nodes.get("articles").innerHTML, /60.0%/);
  assert.match(nodes.get("pdf-table").innerHTML, /test.pdf/);
});
test("helpers preserve missing values, guard periods and reject malformed summaries", async () => {
  const { context } = await run();
  assert.equal(vm.runInContext("num(null)", context), null);
  assert.equal(vm.runInContext('num("")', context), null);
  assert.equal(vm.runInContext('num("n/a")', context), null);
  assert.equal(vm.runInContext("num({count:0})", context), 0);
  assert.equal(
    vm.runInContext(
      'samePeriod({general:{start_date:"-",end_date:"-"}},{general:{start_date:"-",end_date:"-"}})',
      context,
    ),
    false,
  );
  assert.equal(
    vm.runInContext('eventEntries({general:{}},"article")', context),
    null,
  );
});
test("escapes untrusted labels and filters pages without changing totals", async () => {
  const dirty = structuredClone(base);
  dirty.requests.data.push({
    data: "/<img onerror=alert(1)>.html",
    hits: 1,
    visitors: 1,
  });
  const { nodes, context } = await run({ weekly: dirty });
  assert.match(nodes.get("page-table").innerHTML, /&lt;img/);
  assert.doesNotMatch(nodes.get("page-table").innerHTML, /<img/);
  nodes.get("page-search").value = "redactor";
  vm.runInContext("renderPages()", context);
  assert.match(nodes.get("page-table").innerHTML, /redactor/);
  assert.doesNotMatch(nodes.get("page-table").innerHTML, /knowledge/);
  assert.equal(nodes.get("requests").textContent, "100");
});
test("no fabricated rates, overlapping PDF rows or unsupported events", async () => {
  const pdf = {
    ...base,
    requests: { data: [{ data: "/x.pdf", hits: 3, visitors: 2 }] },
    static_requests: {
      data: [
        { data: "/x.pdf", hits: 3, visitors: 2 },
        { data: "/x.pdf?copy=1", hits: 2, visitors: 2 },
      ],
    },
  };
  const { nodes, context } = await run({
    pdf,
    "games-summary": { game: { starts: 1, completes: 3 } },
    "blog-articles-summary": { "/x": { opens: 0, engaged: 1 } },
  });
  assert.equal(
    vm.runInContext(
      'pdfRows({requests:{data:[{data:"/x.pdf",hits:3}]},static_requests:{data:[{data:"/x.pdf",hits:3}]}}).length',
      context,
    ),
    1,
  );
  assert.match(nodes.get("articles").innerHTML, /Check counts/);
  assert.doesNotMatch(nodes.get("game-events").innerHTML, /%/);
  assert.match(nodes.get("pdf-table").innerHTML, /copy=1/);
  const malformed = await run({ "games-summary": { general: {} } });
  assert.match(malformed.nodes.get("game-events").innerHTML, /unsupported/);
});

test("locations aggregate requests by country using each report's own dates", async () => {
  const main = {
    ...base,
    hosts: {
      data: [
        { country: "GB United Kingdom", hits: { count: 12 }, visitors: 5 },
        { country: "GB United Kingdom", hits: 8, visitors: 5 },
        { country: "N/A", hits: 3 },
        { country: "<Country>", hits: 1 },
      ],
    },
  };
  const pdf = {
    ...base,
    general: { ...base.general, start_date: "18/Oct/2026" },
    hosts: { data: [{ country: "MX Mexico", hits: 7 }] },
  };
  const { nodes } = await run({ weekly: main, pdf });
  const overall = nodes.get("traffic-locations").innerHTML;
  assert.match(overall, /GB United Kingdom/);
  assert.match(overall, />20</);
  assert.match(overall, /Unknown country/);
  assert.match(overall, /&lt;Country&gt;/);
  assert.doesNotMatch(overall, /Daily identities|%|MX Mexico/);
  assert.match(nodes.get("pdf-locations").innerHTML, /MX Mexico/);
  assert.match(
    nodes.get("traffic-location-period").textContent,
    /05\/Oct\/2026/,
  );
  assert.match(nodes.get("pdf-location-period").textContent, /18\/Oct\/2026/);
});

test("locations distinguish missing reports, absent host rows and missing counts", async () => {
  const { nodes } = await run({ pdf: null });
  assert.match(nodes.get("traffic-locations").innerHTML, /not supplied/);
  assert.match(nodes.get("pdf-locations").innerHTML, /unavailable/);
  const partial = await run({
    weekly: {
      ...base,
      hosts: { data: [{ country: "GB", hits: 2 }, { country: "GB" }] },
    },
  });
  assert.match(partial.nodes.get("traffic-locations").innerHTML, /Unavailable/);
});

test("debug totals and error share come from the same report without double-counting status children", async () => {
  const debug = {
    ...base,
    general: { ...base.general, valid_requests: 100 },
    status_codes: {
      data: [
        {
          data: "4xx Client Errors",
          hits: 80,
          items: [{ data: "404 - Not Found", hits: 80 }],
        },
        {
          data: "2xx Success",
          hits: 20,
          items: [{ data: "200 - OK", hits: 20 }],
        },
      ],
    },
    visit_time: {
      data: [
        { data: "01", hits: 70 },
        { data: "02", hits: 30 },
      ],
    },
    not_found: {
      data: [
        { data: "/.env", hits: 20 },
        { data: "/<unsafe>", hits: 10 },
      ],
    },
  };
  const { nodes } = await run({ debug });
  assert.equal(nodes.get("debug-analysed").textContent, "100");
  assert.equal(nodes.get("debug-errors").textContent, "80");
  assert.equal(nodes.get("debug-error-share").textContent, "80.0%");
  assert.match(
    nodes.get("debug-insight").textContent,
    /01:00, with 70 requests/,
  );
  assert.match(nodes.get("debug-missing").innerHTML, /&lt;unsafe&gt;/);
  assert.doesNotMatch(nodes.get("debug-missing").innerHTML, /<a /);
  assert.match(nodes.get("debug-hours").innerHTML, /01:00/);
});

test("debug handles incomplete, absent and flat status rows without false percentages", async () => {
  const mismatch = await run({
    debug: {
      ...base,
      status_codes: { data: [{ data: "404 - Not Found", hits: 40 }] },
    },
  });
  assert.equal(mismatch.nodes.get("debug-errors").textContent, "40");
  assert.equal(
    mismatch.nodes.get("debug-error-share").textContent,
    "Unavailable",
  );
  assert.match(mismatch.nodes.get("debug-insight").textContent, /do not match/);
  const missing = await run({ debug: null });
  assert.equal(missing.nodes.get("debug-errors").textContent, "Unavailable");
  assert.equal(missing.nodes.get("requests").textContent, "100");
  assert.match(missing.nodes.get("debug-period").textContent, /unavailable/);
  const empty = await run();
  assert.equal(empty.nodes.get("debug-error-share").textContent, "Unavailable");
});

test("country totals expand into city and region request counts without exposing hosts", async () => {
  const hosts = {
    data: [
      {
        country: "GB United Kingdom",
        city: "Reading, England",
        hits: 4,
        data: "192.0.2.1",
      },
      {
        country: "GB United Kingdom",
        city: "Reading, England",
        hits: 6,
        data: "192.0.2.2",
      },
      {
        country: "GB United Kingdom",
        city: "London",
        region: "England",
        hits: 3,
      },
      { country: "US United States", city: "Reading, Pennsylvania", hits: 2 },
      { country: "GB United Kingdom", city: "N/A City, N/A Region", hits: 1 },
    ],
  };
  const { nodes } = await run({
    weekly: { ...base, hosts },
    pdf: { ...base, hosts },
    debug: { ...base, hosts },
  });
  for (const id of ["traffic-locations", "pdf-locations", "debug-locations"]) {
    const markup = nodes.get(id).innerHTML;
    assert.match(markup, /<summary>GB United Kingdom<\/summary>/);
    assert.match(markup, /Reading, England<\/td><td class="num">10</);
    assert.match(markup, /London, England/);
    assert.match(markup, /Reading, Pennsylvania/);
    assert.match(markup, /City \/ region unknown/);
    assert.match(markup, />14</);
    assert.doesNotMatch(markup, /192\.0\.2|Daily identities/);
  }
});

test("location detail handles partial and structured fields, escaping and missing counts", async () => {
  const { context, nodes } = await run({
    weekly: {
      ...base,
      hosts: {
        data: [
          { country: "GB", city: "<City>", region: "<Region>", hits: 2 },
          { country: "GB", city: "<City>", region: "<Region>" },
          { geoip: { country: "US", city: "N/A City, California" }, hits: 3 },
        ],
      },
    },
  });
  const markup = nodes.get("traffic-locations").innerHTML;
  assert.match(markup, /&lt;City&gt;, &lt;Region&gt;/);
  assert.match(markup, /Unavailable/);
  assert.match(markup, /City unknown, California/);
  assert.doesNotMatch(markup, /<City>/);
  assert.equal(
    vm.runInContext(
      'locationName({location:{city:"Turin",region:"Piedmont"}})',
      context,
    ),
    "Turin, Piedmont",
  );
  assert.equal(
    vm.runInContext('locationName({city:"N/A City, N/A Region"})', context),
    "City / region unknown",
  );
});

test("journey display shows ordered private paths and honest gaps, escaping input", async () => {
  const { context, nodes } = await run();
  context.report = {
    schema_version: 1,
    window_start: "2026-10-25T00:00:00Z",
    window_end: "2026-10-25T13:00:00Z",
    generated_at: "2026-10-25T13:00:00Z",
    inferred_visits: 1,
    included_requests: 2,
    visits: [
      {
        start: "2026-10-25T12:00:00Z",
        end: "2026-10-25T12:01:00Z",
        request_count: 2,
        steps: [
          {
            at: "2026-10-25T12:00:00Z",
            path: "/",
            kind: "Page",
            gap_seconds: 60,
          },
          {
            at: "2026-10-25T12:01:00Z",
            path: "/<script>.pdf",
            kind: "PDF",
            gap_seconds: null,
          },
        ],
      },
    ],
  };
  vm.runInContext("renderJourneys(report)", context);
  assert.match(nodes.get("journeys-list").innerHTML, /60 seconds/);
  assert.match(nodes.get("journeys-list").innerHTML, /Not known/);
  assert.match(nodes.get("journeys-list").innerHTML, /&lt;script&gt;/);
  assert.doesNotMatch(nodes.get("journeys-list").innerHTML, /<script>/);
  context.report.visits[0].steps[0].path = "/secret?name=Martin";
  assert.throws(
    () => vm.runInContext("renderJourneys(report)", context),
    /Unsupported/,
  );
});
