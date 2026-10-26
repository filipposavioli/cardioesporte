import { describe, expect, it } from "vitest";
import { normalizarEmail } from "@/lib/email";

describe("normalizarEmail", () => {
  it("remove espaços e converte para minúsculas", () => {
    expect(normalizarEmail(" Fulano@Gmail.com ")).toBe("fulano@gmail.com");
  });
});
