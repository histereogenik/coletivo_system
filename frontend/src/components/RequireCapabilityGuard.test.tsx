import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RequireCapability, RequireSuperuser } from "./RequireCapability";

const mocks = vi.hoisted(() => ({
  user: {
    is_superuser: false,
    capabilities: [] as string[],
  },
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: mocks.user,
    hasCapability: (capability: string) => mocks.user.capabilities.includes(capability),
  }),
}));

function LocationProbe() {
  return <span data-testid="location">{useLocation().pathname}</span>;
}

function renderGuard(guard: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={["/protegida"]}>
      <Routes>
        <Route path="/protegida" element={guard} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("route permission guards", () => {
  beforeEach(() => {
    mocks.user.is_superuser = false;
    mocks.user.capabilities = [];
  });

  it("sends an account without capabilities to the no-access page", () => {
    renderGuard(<RequireCapability capability="financial">financeiro</RequireCapability>);
    expect(screen.getByTestId("location")).toHaveTextContent("/painel/sem-acesso");
  });

  it("sends a non-superuser to its first allowed area", () => {
    mocks.user.capabilities = ["lunches"];
    renderGuard(<RequireSuperuser>dashboard</RequireSuperuser>);
    expect(screen.getByTestId("location")).toHaveTextContent("/painel/almocos");
  });
});
