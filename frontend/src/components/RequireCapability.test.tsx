import { describe, expect, it } from "vitest";
import { firstAllowedRoute } from "./RequireCapability";

describe("firstAllowedRoute", () => {
  it("routes an operator without capabilities to a stable authenticated page", () => {
    expect(firstAllowedRoute([])).toBe("/painel/sem-acesso");
  });

  it("routes operators and superusers to their allowed start page", () => {
    expect(firstAllowedRoute(["packages"])).toBe("/painel/pacotes");
    expect(firstAllowedRoute([], true)).toBe("/painel");
  });
});
