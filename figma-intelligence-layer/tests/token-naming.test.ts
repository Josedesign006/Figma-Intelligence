import { analyzeTokenName, analyzeTokenNames } from "../src/shared/token-naming";

describe("token naming convention", () => {
  test("accepts a well-formed primitive token", () => {
    const analysis = analyzeTokenName("color/brand/500");

    expect(analysis.isValid).toBe(true);
    expect(analysis.domain).toBe("primitive");
    expect(analysis.suggestedName).toBeNull();
  });

  test("suggests fixes for typos and plural component prefixes", () => {
    const analyses = analyzeTokenNames([
      "typogrpahy/font-size/md",
      "components/button/primary/background/default",
      "Text/Primary",
    ]);

    expect(analyses[0].suggestedName).toBe("typography/font-size/md");
    expect(analyses[1].suggestedName).toBe("component/button/primary/background/default");
    expect(analyses[2].suggestedName).toBe("semantic/text/primary");
  });

  test("flags invalid characters as errors", () => {
    const analysis = analyzeTokenName("color/brand/@500");

    expect(analysis.isValid).toBe(false);
    expect(analysis.issues.some((issue) => issue.code === "invalid-characters")).toBe(true);
  });
});
