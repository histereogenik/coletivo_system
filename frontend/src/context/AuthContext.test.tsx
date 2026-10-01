import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { notifySessionExpired } from "../shared/authSession";
import { AuthProvider, useAuth } from "./AuthContext";

const mocks = vi.hoisted(() => ({
  fetchAuthStatus: vi.fn(),
  ensureCsrfCookie: vi.fn().mockResolvedValue("csrf"),
  post: vi.fn().mockResolvedValue({}),
  clear: vi.fn(),
}));

vi.mock("../shared/authStatus", () => ({
  fetchAuthStatus: mocks.fetchAuthStatus,
}));

vi.mock("../shared/api", () => ({
  api: { post: mocks.post },
  ensureCsrfCookie: mocks.ensureCsrfCookie,
}));

vi.mock("../shared/queryClient", () => ({
  queryClient: { clear: mocks.clear },
}));

function AuthStateProbe() {
  const { isAuthenticated, isAuthResolved, user } = useAuth();
  const location = useLocation();
  return (
    <div>
      <span data-testid="resolved">{String(isAuthResolved)}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="username">{user?.username ?? "anonymous"}</span>
      <span data-testid="location">{location.pathname}</span>
    </div>
  );
}

describe("AuthProvider session expiration", () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem("hasAuth", "true");
    mocks.fetchAuthStatus.mockResolvedValue({
      id: 1,
      username: "operador",
      display_name: "Operador",
      is_superuser: false,
      capabilities: ["lunches"],
    });
  });

  it("clears React auth state, cache and navigation when refresh expires", async () => {
    render(
      <MemoryRouter initialEntries={["/painel/almocos"]}>
        <AuthProvider>
          <AuthStateProbe />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId("authenticated")).toHaveTextContent("true"));
    expect(screen.getByTestId("username")).toHaveTextContent("operador");

    act(() => notifySessionExpired());

    expect(screen.getByTestId("resolved")).toHaveTextContent("true");
    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(screen.getByTestId("username")).toHaveTextContent("anonymous");
    expect(screen.getByTestId("location")).toHaveTextContent("/login");
    expect(sessionStorage.getItem("hasAuth")).toBeNull();
    expect(mocks.clear).toHaveBeenCalled();
  });
});
