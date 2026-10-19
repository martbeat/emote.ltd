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
