import { describe, expect, it } from "vitest";

import { toEsmModuleSpecifier } from "../agent-worker-module-specifier.mjs";

describe("toEsmModuleSpecifier", () => {
  it("converts a Windows drive path with spaces into a file URL", () => {
    expect(
      toEsmModuleSpecifier(
        "K:\\originos\\OriginOS CE\\resources\\app.asar\\dist-electron\\core\\src\\lib\\paths.js",
        "win32",
      ),
    ).toBe(
      "file:///K:/originos/OriginOS%20CE/resources/app.asar/dist-electron/core/src/lib/paths.js",
    );
  });

  it("encodes Unicode characters in Windows paths", () => {
    expect(
      toEsmModuleSpecifier("C:\\用户\\OriginOS CE\\模块.js", "win32"),
    ).toBe("file:///C:/%E7%94%A8%E6%88%B7/OriginOS%20CE/%E6%A8%A1%E5%9D%97.js");
  });

  it("detects a Windows drive path even when the test host is POSIX", () => {
    expect(toEsmModuleSpecifier("D:\\apps\\worker.js", "linux")).toBe(
      "file:///D:/apps/worker.js",
    );
  });

  it("converts a POSIX absolute path", () => {
    expect(toEsmModuleSpecifier("/opt/OriginOS CE/worker.js", "linux")).toBe(
      "file:///opt/OriginOS%20CE/worker.js",
    );
  });

  it.each([
    "file:///K:/OriginOS/worker.js",
    "data:text/javascript,export default 1",
    "node:fs",
    "electron:renderer",
  ])("keeps an existing supported ESM specifier unchanged: %s", (specifier) => {
    expect(toEsmModuleSpecifier(specifier, "win32")).toBe(specifier);
  });
});
