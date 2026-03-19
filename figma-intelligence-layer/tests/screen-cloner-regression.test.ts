import fs from "fs/promises";
import os from "os";
import path from "path";
import sharp from "sharp";
import { resolveLogPath } from "../src/shared/decision-log.js";
import { resolveImage } from "../src/tools/phase1-vision/screen-cloner/index.js";

describe("screen cloner regressions", () => {
  const originalCodexHome = process.env.CODEX_HOME;
  const originalDecisionLogPath = process.env.DECISION_LOG_PATH;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "figma-cloner-test-"));
    delete process.env.DECISION_LOG_PATH;
    process.env.CODEX_HOME = tempDir;
  });

  afterEach(async () => {
    if (originalCodexHome === undefined) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = originalCodexHome;
    }

    if (originalDecisionLogPath === undefined) {
      delete process.env.DECISION_LOG_PATH;
    } else {
      process.env.DECISION_LOG_PATH = originalDecisionLogPath;
    }

    await fs.rm(tempDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  test("resolveLogPath falls back to CODEX_HOME when cwd is not writable", async () => {
    jest.spyOn(process, "cwd").mockReturnValue("/");

    const resolved = await resolveLogPath();

    expect(resolved).toBe(path.join(tempDir, "figma-intelligence-layer", ".decision-log.json"));
  });

  test("resolveImage converts local webp files into a real png data URI", async () => {
    const webpPath = path.join(tempDir, "sample.webp");
    await sharp({
      create: {
        width: 6,
        height: 4,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 },
      },
    })
      .webp()
      .toFile(webpPath);

    const resolved = await resolveImage(webpPath);

    expect(resolved.startsWith("data:image/png;base64,")).toBe(true);

    const metadata = await sharp(
      Buffer.from(resolved.replace(/^data:image\/png;base64,/, ""), "base64")
    ).metadata();

    expect(metadata.format).toBe("png");
    expect(metadata.width).toBe(6);
    expect(metadata.height).toBe(4);
  });
});
