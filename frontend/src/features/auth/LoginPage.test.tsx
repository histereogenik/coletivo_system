import { MantineProvider } from "@mantine/core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "./LoginPage";

const mocks = vi.hoisted(() => ({
  auth: {
    isAuthenticated: false,
    isAuthResolved: true,
    user: null as null | {
      id: number;
      username: string;
      display_name: string;
      is_superuser: boolean;
      capabilities: string[];
    },
    login: vi.fn(),
  },
  post: vi.fn(),
  ensureCsrfCookie: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("../../shared/api", () => ({
  api: { post: mocks.post },
  ensureCsrfCookie: mocks.ensureCsrfCookie,
}));

vi.mock("@mantine/notifications", () => ({
  notifications: { show: mocks.notify },
}));

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{`${location.pathname}${location.search}`}</span>;
}

function renderLogin(initialEntry: { pathname: string; state?: unknown } = { pathname: "/login" }) {
  return render(
    <MantineProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    mocks.auth.isAuthenticated = false;
    mocks.auth.isAuthResolved = true;
    mocks.auth.user = null;
    mocks.auth.login.mockReset();
    mocks.post.mockReset();
    mocks.ensureCsrfCookie.mockReset().mockResolvedValue("csrf");
  });

  it("preserves the requested deep link for an already authenticated user", async () => {
    mocks.auth.isAuthenticated = true;
    mocks.auth.user = {
      id: 1,
      username: "operador",
      display_name: "Operador",
      is_superuser: false,
      capabilities: ["packages"],
    };

    renderLogin({
      pathname: "/login",
      state: { from: { pathname: "/painel/pacotes", search: "?page=2" } },
    });

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/painel/pacotes?page=2"),
    );
  });

  it("does not report valid credentials as invalid when loading the session fails", async () => {
    mocks.post.mockResolvedValue({});
    mocks.auth.login.mockRejectedValue(new Error("status unavailable"));
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText("Usuário"), "operador");
    await user.type(screen.getByLabelText("Senha"), "senha-segura");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("As credenciais foram aceitas");
    expect(alert).not.toHaveTextContent("Usuário ou senha inválidos");
    expect(mocks.post).toHaveBeenNthCalledWith(
      2,
      "/api/auth/logout/",
      {},
      { withCredentials: true },
    );
  });
});
