// Run after generate_pdf_fixtures.py and while serving the repository at port 8767.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const root = process.env.PDF_FIXTURE_ROOT || "/tmp/emote-pdf-qa";
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  const errors = [],
    requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) =>
    requests.push({ url: r.url(), method: r.method() }),
  );
  page.on("dialog", (d) => d.accept());
  await page.goto("http://127.0.0.1:8767/redactor-rbc.html");
  await page.locator("#pdfFile").setInputFiles(path.join(root, "source.pdf"));
  await page.waitForFunction(
    () =>
      document.querySelector("#sourceInfo").textContent.startsWith("2 pages"),
    {},
    { timeout: 30000 },
  );
  await page.waitForFunction(
    () => !document.querySelector("#pageChecked").disabled,
  );
  assert((await page.locator("#counts").textContent()).includes("1 pending"));
  await page.locator("#areas button").click();
  await page.locator("#reason").fill("Synthetic identifier withheld");
  await page.locator("#redact").click();
  await page.locator("#next").click();
  await page.waitForFunction(
    () =>
      !document.querySelector("#pageChecked").disabled &&
      document.querySelector("#pageNumber").textContent.startsWith("Page 2"),
  );
  for (const [id, value] of Object.entries({
    x: "10",
    y: "10",
    w: "10",
    h: "10",
  }))
    await page.locator("#" + id).fill(value);
  await page.locator("#add").click();
  await page
    .locator("#reason")
    .fill("Blank area retained in synthetic keyboard test");
  await page.locator("#keep").click();
  await page.locator("#overlay").scrollIntoViewIfNeeded();
  const bounds = await page.locator("#overlay").boundingBox();
  await page.mouse.move(
    bounds.x + (80 / 792) * bounds.width,
    bounds.y + (82 / 612) * bounds.height,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + (260 / 792) * bounds.width,
    bounds.y + (162 / 612) * bounds.height,
    { steps: 4 },
  );
  await page.mouse.up();
  await page.locator("#reason").fill("Synthetic image withheld");
  await page.locator("#redact").click();
  for (const [id, value] of Object.entries({
    caseRef: "SYNTHETIC",
    reviewer: "Reviewer A",
    checker: "Reviewer B",
  }))
    await page.locator("#" + id).fill(value);
  await page.locator("#pageChecked").check();
  await page.locator("#prev").click();
  await page.waitForFunction(
    () => !document.querySelector("#pageChecked").disabled,
  );
  await page.locator("#pageChecked").check();
  for (const id of ["imageAccepted", "reviewComplete", "authorised"])
    await page.locator("#" + id).check();
  assert(await page.locator("#prepare").isEnabled());
  const saveEvent = page.waitForEvent("download");
  await page.locator("#save").click();
  const saved = await saveEvent;
  const plan = await fs.readFile(await saved.path());
  assert(!plan.toString().includes("secret.person@example.org"));
  assert(!plan.toString().includes("IMAGE SECRET"));
  await fs.writeFile(path.join(root, "working.json"), plan);
  await page.locator("#prepare").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#finalMode").checked &&
      !document.querySelector("#pageChecked").disabled,
    {},
    { timeout: 60000 },
  );
  assert(await page.locator("#download").isDisabled());
  await page.locator("#pageChecked").check();
  await page.locator("#next").click();
  await page.waitForFunction(
    () => !document.querySelector("#pageChecked").disabled,
  );
  assert(await page.locator("#download").isDisabled());
  await page.locator("#pageChecked").check();
  assert(await page.locator("#download").isEnabled());
  const outputEvent = page.waitForEvent("download");
  await page.locator("#download").click();
  await (await outputEvent).saveAs(path.join(root, "release.pdf"));
  const reportEvent = page.waitForEvent("download");
  await page.locator("#report").click();
  await (await reportEvent).saveAs(path.join(root, "record.json"));
  const engineChecks = await page.evaluate(async () => {
    const e = await import("/js/redactor/pdf-engine.js");
    const dims = [{ width: 612, height: 792 }];
    let rejected = 0;
    for (const rect of [
      { x: -1, y: 1, width: 2, height: 2 },
      { x: 1, y: 1, width: Infinity, height: 2 },
      { x: 610, y: 1, width: 5, height: 2 },
    ])
      try {
        e.validateMarks(
          [{ id: "P1", page: 0, rect, status: "redact", reason: "test" }],
          dims,
        );
      } catch {
        rejected++;
      }
    return rejected;
  });
  assert.equal(engineChecks, 3);
  await page.screenshot({
    path: path.join(root, "final-desktop.png"),
    fullPage: true,
  });
  await page.locator("#return").click();
  await page.waitForFunction(
    () =>
      !document.querySelector("#pageChecked").disabled &&
      !document.querySelector("#finalMode").checked,
  );
  assert(await page.locator("#download").isDisabled());
  assert.equal(await page.locator("#pageChecked").isChecked(), false);
  await page.locator("#areas button").last().click();
  await page.locator("#keep").click();
  const workingPixels = await page.locator("#pageCanvas").evaluate((c) => {
    const d = c.getContext("2d").getImageData(190, 190, 5, 5).data;
    return [...d].some((v, i) => i % 4 !== 3 && v > 0);
  });
  assert.equal(workingPixels, true);
  await page.locator("#resume").setInputFiles({
    name: "working.json",
    mimeType: "application/json",
    buffer: plan,
  });
  await page.waitForFunction(() =>
    document
      .querySelector("#status")
      .textContent.startsWith("Working areas restored"),
  );
  assert((await page.locator("#areas").textContent()).includes("REDACT"));
  assert.equal(await page.locator("#authorised").isChecked(), false);
  assert(await page.locator("#download").isDisabled());
  const wrong = JSON.parse(plan);
  wrong.sourceSha256 = "wrong";
  await page.locator("#resume").setInputFiles({
    name: "wrong.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(wrong)),
  });
  await page.waitForFunction(() =>
    document
      .querySelector("#status")
      .textContent.startsWith("Could not resume"),
  );
  assert(
    (await page.locator("#status").textContent()).includes("does not match"),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: path.join(root, "working-mobile.png"),
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  const rotatedBytes = await fs.readFile(
    path.join(root, "rotated-cropped.pdf"),
  );
  const rotated = await page.evaluate(async (bytes) => {
    const e = await import("/js/redactor/pdf-engine.js");
    const source = await e.openPdf(new Uint8Array(bytes));
    const fragment = source.pages[0].fragments.find((f) =>
      f.text.includes("secret.person@example.org"),
    );
    const mark = {
      id: "P1",
      page: 0,
      rect: fragment.rect,
      status: "redact",
      reason: "Synthetic rotated fixture",
    };
    const output = await e.buildRelease(source, [mark]);
    const before = await e.renderPage(source.doc, 0),
      after = await e.renderPage(output.doc, 0);
    const a = before
        .getContext("2d")
        .getImageData(0, 0, before.width, before.height).data,
      b = after
        .getContext("2d")
        .getImageData(0, 0, after.width, after.height).data;
    const r = e.pixelRect(
      mark.rect,
      source.pages[0].width,
      source.pages[0].height,
      before.width,
      before.height,
    );
    let changedOutside = 0;
    for (let y = 0; y < before.height; y++)
      for (let x = 0; x < before.width; x++)
        if (!(
          x >= r.x &&
          x < r.x + r.width &&
          y >= r.y &&
          y < r.y + r.height
        )) {
          const i = (y * before.width + x) * 4;
          if (
            Math.abs(a[i] - b[i]) > 1 ||
            Math.abs(a[i + 1] - b[i + 1]) > 1 ||
            Math.abs(a[i + 2] - b[i + 2]) > 1
          )
            changedOutside++;
        }
    const result = {
      width: source.pages[0].width,
      height: source.pages[0].height,
      changedOutside,
      bytes: Array.from(output.bytes),
    };
    await output.doc.destroy();
    await source.doc.destroy();
    return result;
  }, Array.from(rotatedBytes));
  assert.equal(rotated.width, 720);
  assert.equal(rotated.height, 560);
  assert.equal(rotated.changedOutside, 0);
  await fs.writeFile(
    path.join(root, "rotated-release.pdf"),
    new Uint8Array(rotated.bytes),
  );
  const passiveBytes = await fs.readFile(path.join(root, "passive-link.pdf"));
  assert.equal(
    await page.evaluate(async (bytes) => {
      const e = await import("/js/redactor/pdf-engine.js");
      const doc = await e.openPdf(new Uint8Array(bytes));
      const count = doc.pages.length;
      await doc.doc.destroy();
      return count;
    }, Array.from(passiveBytes)),
    2,
  );
  for (const [name, expected] of [
    ["attachment.pdf", "attachments"],
    ["script.pdf", "scripts"],
    ["annotation.pdf", "annotations"],
    ["visible-link.pdf", "annotations"],
    ["layered.pdf", "Layered"],
    ["encrypted.pdf", "Cannot open"],
  ]) {
    await page.locator("#pdfFile").setInputFiles(path.join(root, name));
    await page.waitForFunction(
      () => document.querySelector("#status").className === "error",
      {},
      { timeout: 30000 },
    );
    assert((await page.locator("#status").textContent()).includes(expected));
    assert(await page.locator("#download").isDisabled());
  }
  assert.deepEqual(errors, []);
  assert(
    requests.every(
      (r) =>
        r.method === "GET" &&
        (r.url.startsWith("http://127.0.0.1:8767/") ||
          r.url.startsWith("blob:")),
    ),
  );
  console.log(
    "PASS: PDF import, automatic fragment and manual image areas, reasons, page gates, fresh release, saved review, recovery, malformed coordinates, unsupported-content rejection, rotated/cropped geometry and unchanged retained pixels, mobile width and local asset requests only.",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
