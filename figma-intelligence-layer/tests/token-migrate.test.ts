import { translateCanonicalName } from "../src/tools/phase5-governance/token-migrate";

describe("token migrate planner", () => {
  test("translates expanded primitives into compact schema", () => {
    const result = translateCanonicalName("color/primitive/brand/500", "compact");

    expect(result.suggestedName).toBe("color/brand/500");
  });

  test("translates compact typography names into expanded schema", () => {
    const result = translateCanonicalName("typography/font-size/md", "expanded");

    expect(result.suggestedName).toBe("typography/size/md");
  });

  test("keeps typo cleanup and singular component prefix", () => {
    const result = translateCanonicalName("Components/typogrpahy/label/md", "compact");

    expect(result.suggestedName).toBe("component/typography/label/md");
  });
});
