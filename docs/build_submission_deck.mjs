import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = path.resolve(process.cwd());
const skillDir = process.env.CODEX_PRESENTATIONS_SKILL_DIR;
if (!skillDir || !path.isAbsolute(skillDir)) {
  throw new Error("Set CODEX_PRESENTATIONS_SKILL_DIR to the absolute Presentations skill directory before building the deck.");
}
const buildDir = path.join(workspaceDir, "docs", ".deck-build");
const stagingDir = path.join(workspaceDir, ".codex-finalizer");
const outputDir = path.join(workspaceDir, "submission");
const finalPath = path.join(outputDir, "mergewitness-deck-final-v2.pptx");
const candidatePath = path.join(stagingDir, "mergewitness-deck-final-v2.pptx");

const { resolvePresentationFont, finalizePresentation } = await import(
  pathToFileURL(path.join(skillDir, "container_tools", "artifact_tool_utils.mjs")).href,
);

await fs.mkdir(buildDir, { recursive: true });
await fs.mkdir(stagingDir, { recursive: true });
await fs.mkdir(outputDir, { recursive: true });

const font = resolvePresentationFont({ fontFamily: "Aptos" });
const deck = Presentation.create({ slideSize: { width: 1280, height: 720 } });

const C = {
  navy: "#081B33",
  navy2: "#102A4B",
  white: "#F8FBFF",
  muted: "#B9C9DC",
  line: "#315476",
  lime: "#B8F56A",
  pink: "#FF6B7A",
  cyan: "#6CE5F5",
  amber: "#FFC85A",
};

function box(slide, x, y, w, h, text = "", opts = {}) {
  const shape = slide.shapes.add({
    geometry: opts.geometry ?? "rect",
    position: { left: x, top: y, width: w, height: h },
    fill: opts.fill ?? "none",
    line: opts.line ?? { fill: "none", width: 0 },
    borderRadius: opts.radius,
  });
  if (text) {
    shape.text = text;
    shape.text.style = {
      typeface: font,
      fontSize: opts.size ?? 22,
      color: opts.color ?? C.white,
      bold: opts.bold ?? false,
      autoFit: "shrinkText",
      ...(opts.align ? { align: opts.align } : {}),
    };
  }
  return shape;
}

function line(slide, x1, y1, x2, y2, color = C.line, width = 2) {
  return slide.shapes.add({
    geometry: "line",
    position: {
      left: Math.min(x1, x2),
      top: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
    },
    fill: "none",
    line: { style: "solid", fill: color, width },
  });
}

function base(slide, n, title, subtitle = "") {
  slide.background.fill = C.navy;
  box(slide, 56, 48, 1168, 2, "", { fill: C.line });
  box(slide, 56, 70, 150, 28, "MERGEWITNESS", { size: 14, bold: true, color: C.lime });
  box(slide, 56, 116, 1080, 58, title, { size: 40, bold: true });
  if (subtitle) box(slide, 56, 180, 1080, 34, subtitle, { size: 19, color: C.muted });
  box(slide, 1158, 668, 66, 22, `0${n} / 06`, { size: 13, color: C.muted, align: "right" });
}

function label(slide, x, y, text, color = C.muted) {
  return box(slide, x, y, 260, 24, text.toUpperCase(), { size: 13, bold: true, color });
}

function status(slide, x, y, text, pass) {
  box(slide, x, y, 18, 18, "", { geometry: "ellipse", fill: pass ? C.lime : C.pink });
  box(slide, x + 28, y - 3, 150, 26, text, { size: 15, color: pass ? C.white : C.pink, bold: !pass });
}

// Slide 1
{
  const s = deck.slides.add();
  s.background.fill = C.navy;
  box(s, 64, 54, 1152, 2, "", { fill: C.line });
  box(s, 64, 100, 650, 180, "MergeWitness", { size: 64, bold: true });
  box(s, 68, 292, 555, 82, "A developer workflow for bugs that appear only when two green changes meet.", { size: 28, color: C.muted });
  box(s, 68, 584, 420, 28, "IBM BOB 2.0 HACKATHON  |  SIGNAL FOUNDRY", { size: 15, bold: true, color: C.lime });
  box(s, 800, 168, 110, 60, "BASE", { fill: C.navy2, line: { style: "solid", fill: C.line, width: 2 }, radius: 14, size: 18, bold: true, align: "center" });
  const a = box(s, 970, 90, 170, 70, "TENANT\nPRICING", { fill: C.navy2, line: { style: "solid", fill: C.lime, width: 2 }, radius: 14, size: 18, bold: true, align: "center" });
  const b = box(s, 970, 250, 170, 70, "PRODUCT\nCACHE", { fill: C.navy2, line: { style: "solid", fill: C.lime, width: 2 }, radius: 14, size: 18, bold: true, align: "center" });
  const c = box(s, 800, 385, 210, 76, "COMBINED\nFAILURE", { fill: C.navy2, line: { style: "solid", fill: C.pink, width: 3 }, radius: 14, size: 19, bold: true, color: C.pink, align: "center" });
  s.shapes.connect(a, c, { kind: "straight", fromSide: "bottom", toSide: "top", line: { style: "solid", fill: C.line, width: 2 }, head: { type: "arrow", width: "sm", length: "sm" } });
  s.shapes.connect(b, c, { kind: "straight", fromSide: "bottom", toSide: "right", line: { style: "solid", fill: C.line, width: 2 }, head: { type: "arrow", width: "sm", length: "sm" } });
  line(s, 910, 228, 970, 125, C.line, 2);
  line(s, 910, 228, 970, 285, C.line, 2);
  box(s, 800, 510, 360, 50, "SYNTHETIC FIXTURE\nInteraction witness verified", { size: 15, color: C.amber });
  s.speakerNotes.textFrame.setText("Measured synthetic fixture. Public evaluation report classifies the result as interaction_witness after three repetitions per snapshot.");
}

// Slide 2
{
  const s = deck.slides.add();
  base(s, 2, "The failure hides behind green tests", "Measured synthetic fixture. Original tests exit with code 0 in all four snapshots.");
  label(s, 56, 250, "Change A");
  box(s, 56, 282, 344, 90, "Tenant-specific prices\nAlpha: $90   Beta: $100", { fill: C.navy2, line: { style: "solid", fill: C.line, width: 2 }, radius: 14, size: 23 });
  label(s, 56, 412, "Change B");
  box(s, 56, 444, 344, 90, "Cache by product\nRepeated requests avoid source calls", { fill: C.navy2, line: { style: "solid", fill: C.line, width: 2 }, radius: 14, size: 23 });
  box(s, 466, 260, 670, 270, "1   Alpha requests SKU-1                         $90\n\n2   Cache stores SKU-1                              $90\n\n3   Beta requests SKU-1                           $90  ✕\n\nExpected for Beta                               $100", { fill: "#0C2543", line: { style: "solid", fill: C.line, width: 2 }, radius: 18, size: 24 });
  box(s, 886, 442, 200, 40, "price[SKU-1] = 90", { fill: "#432535", line: { style: "solid", fill: C.pink, width: 2 }, radius: 10, size: 17, color: C.pink, bold: true, align: "center" });
  box(s, 56, 590, 1080, 36, "The ordinary suite can still pass because it checks each feature alone.", { size: 23, color: C.white, bold: true });
  s.speakerNotes.textFrame.setText("Measured tenant-cache fixture. The combined snapshot observed Beta = 90 where the frozen probe expected 100, three times.");
}

// Slide 3
{
  const s = deck.slides.add();
  base(s, 3, "One invariant across four snapshots", "Measured synthetic fixture. Three repetitions per snapshot; original tests exit with code 0 in all four.");
  box(s, 56, 250, 1120, 64, "Invariant: serving Alpha must not change Beta’s price", { fill: "#15385E", line: { style: "solid", fill: C.cyan, width: 2 }, radius: 12, size: 28, bold: true, align: "center" });
  const cols = [56, 337, 618, 899];
  const labels = ["Base", "Change A", "Change B", "Combined"];
  labels.forEach((name, i) => {
    box(s, cols[i], 360, 238, 68, name, { fill: C.navy2, line: { style: "solid", fill: i === 3 ? C.pink : C.line, width: 2 }, radius: 12, size: 23, bold: true, color: i === 3 ? C.pink : C.white, align: "center" });
    status(s, cols[i] + 28, 458, "Tests: exit 0", true);
    status(s, cols[i] + 28, 500, i === 3 ? "Probe: 3× FAIL" : "Probe: 3× PASS", i !== 3);
  });
  box(s, 56, 590, 1120, 40, "Classification: interaction witness  |  Combined result: expected 100, observed 90", { size: 21, color: C.muted, align: "center" });
  s.speakerNotes.textFrame.setText("Source: reports/tenant-cache-evaluation.public.json and reports/tenant-cache-repair.public.json. Final audit used independently authored strengthened frozen probe hash cbe0359d761a44e8c9387a67e1581a3c8738abb9d5e49b742a55881c2853854a.");
}

// Slide 4
{
  const s = deck.slides.add();
  base(s, 4, "IBM Bob inside the investigation loop", "Both relevant task summaries are recorded in bob_sessions/.");
  const steps = [
    ["1", "Task 1: original probe", "fad890dd…bf59f  |  0.953 Bobcoins"],
    ["2", "Audit derivatives", "Independent strengthened checks"],
    ["3", "Task 2: repair", "Bob-authored nested-Map repair"],
    ["4", "Task 2 evidence", "d093059…6c74  |  0.637 Bobcoins"],
  ];
  steps.forEach(([n, title, detail], i) => {
    const x = 56 + i * 282;
    box(s, x, 302, 62, 62, n, { geometry: "ellipse", fill: C.lime, size: 26, color: C.navy, bold: true, align: "center" });
    box(s, x, 392, 225, 34, title, { size: 23, bold: true });
    box(s, x, 440, 225, 60, detail, { size: 18, color: C.muted });
    if (i < 3) line(s, x + 210, 333, x + 264, 333, C.line, 3);
  });
  box(s, 56, 565, 1120, 52, "Recorded: 01-tenant-cache-probe-summary.png and 02-tenant-cache-repair-summary.png in bob_sessions/.", { fill: "#15385E", radius: 12, size: 19, color: C.white, align: "center" });
  s.speakerNotes.textFrame.setText("Task 1: fad890dd4396030a3cdd86588dbbf59f, 0.953 Bobcoins. Task 2: d09305949f41fdff62b67e8e966d6c74, 0.637 Bobcoins. Both screenshots are recorded in bob_sessions/.");
}

// Slide 5
{
  const s = deck.slides.add();
  base(s, 5, "A repair must keep both features", "Measured synthetic fixture. Final audit passed at 17ed2d8c…d94e.");
  box(s, 56, 258, 444, 196, "Before\n\ncache[sku] = price\n\nBeta receives Alpha’s cached price", { fill: "#432535", line: { style: "solid", fill: C.pink, width: 2 }, radius: 16, size: 26, color: C.white });
  box(s, 684, 258, 444, 196, "Bob-authored repair\n\nNested Map cache\n\nTenant and SKU remain distinct", { fill: "#173C42", line: { style: "solid", fill: C.lime, width: 2 }, radius: 16, size: 26, color: C.white });
  line(s, 530, 356, 648, 356, C.cyan, 4);
  box(s, 566, 326, 48, 48, "?", { geometry: "ellipse", fill: C.cyan, size: 26, bold: true, color: C.navy, align: "center" });
  ["Frozen interaction probe", "Tenant prices remain distinct", "Cache remains effective"].forEach((check, i) => {
    const x = 56 + i * 370;
    box(s, x, 518, 330, 112, "", { fill: C.navy2, line: { style: "solid", fill: C.line, width: 2 }, radius: 12 });
    box(s, x + 22, 540, 286, 28, check, { size: 20, bold: true });
    box(s, x + 22, 584, 16, 16, "", { geometry: "ellipse", fill: C.lime });
    box(s, x + 50, 579, 240, 28, "VERIFIED PASS", { size: 17, bold: true, color: C.lime });
  });
  s.speakerNotes.textFrame.setText("Source: reports/tenant-cache-repair.public.json. Bob authored the nested-Map repair. Final verification used independently authored strengthened derivative probe and cache checks: ordinary tests exit 0, frozen probe pass, tenant-pricing check pass, cache proxy check pass.");
}

// Slide 6
{
  const s = deck.slides.add();
  base(s, 6, "A reproducible release decision", "MergeWitness reports what the executed interaction probe found.");
  box(s, 56, 270, 310, 192, "Run the laboratory\n\nInspect the input sequence\nand the observed result", { fill: C.navy2, line: { style: "solid", fill: C.line, width: 2 }, radius: 16, size: 25 });
  box(s, 486, 270, 310, 192, "Read the report\n\nSee commits, probe hash,\nand reproduction commands", { fill: C.navy2, line: { style: "solid", fill: C.line, width: 2 }, radius: 16, size: 25 });
  box(s, 916, 270, 260, 192, "Review the repair\n\nCheck the frozen probe\nand feature checks", { fill: C.navy2, line: { style: "solid", fill: C.line, width: 2 }, radius: 16, size: 25 });
  line(s, 366, 366, 468, 366, C.line, 3);
  line(s, 796, 366, 898, 366, C.line, 3);
  box(s, 56, 548, 1120, 70, "A passing probe means this probe found no witness. It does not certify every merge as safe.", { fill: "#15385E", line: { style: "solid", fill: C.cyan, width: 2 }, radius: 14, size: 27, bold: true, align: "center" });
  box(s, 56, 638, 800, 24, "Signal Foundry  |  IBM Bob 2.0 Hackathon  |  Public links pending verification", { size: 15, color: C.muted });
  s.speakerNotes.textFrame.setText("Positioning reflects related work: QuietClash, SAM and test-based semantic conflict research, plus merge queues. Cite final public links in the README and submission after they are verified.");
}

await (await PresentationFile.exportPptx(deck)).save(candidatePath);

const requirements = {
  explicitTotalSlideCount: 6,
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [],
};
const result = await finalizePresentation({
  ...requirements,
  workspaceDir,
  candidatePath,
  finalPath,
  pythonExecutable: process.env.RUNTIME_PYTHON,
  integrityValidatorPath: path.join(skillDir, "container_tools", "inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(skillDir, "container_tools", "inspect_presentation_layout_geometry.py"),
  layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-bullet-geometry", "--validate-heading-fit"],
  fontPolicy: { basis: "design", families: [font] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(stagingDir, "mergewitness-deck-final-v2.validation.json"),
});

console.log(JSON.stringify({ finalPath, result }, null, 2));
