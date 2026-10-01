import { AppShell, Box, Burger, Button, Group, Image, Text } from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { CapabilityKey } from "../shared/authStatus";

const navItems: Array<{
  label: string;
  to: string;
  capability?: CapabilityKey;
  superuserOnly?: boolean;
}> = [
  { label: "Dashboard", to: "/painel", superuserOnly: true },
  { label: "Agenda", to: "/painel/agenda", capability: "agenda" },
  { label: "Financeiro", to: "/painel/financeiro", capability: "financial" },
  { label: "Notas fiscais", to: "/painel/notas-fiscais", capability: "fiscal" },
  { label: "Trocas", to: "/painel/creditos", capability: "credits" },
  { label: "Almoços", to: "/painel/almocos", capability: "lunches" },
  { label: "Pacotes", to: "/painel/pacotes", capability: "packages" },
  { label: "Integrantes", to: "/painel/integrantes", capability: "members" },
  { label: "Funções", to: "/painel/funcoes", capability: "duties" },
  { label: "Contas", to: "/painel/contas", superuserOnly: true },
  { label: "Auditoria", to: "/painel/auditoria", superuserOnly: true },
];

const isActivePath = (pathname: string, itemPath: string) => {
  if (itemPath === "/painel") {
    return pathname === itemPath;
  }
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
};

export function Layout() {
  const [opened, { toggle, close }] = useDisclosure();
  const isMobile = useMediaQuery("(max-width: 640px)");
  const location = useLocation();
  const { isAuthenticated, logout, user, hasCapability } = useAuth();
  const visibleNavItems = navItems.filter((item) =>
    item.superuserOnly
      ? user?.is_superuser
      : item.capability
        ? hasCapability(item.capability)
        : true
  );

  return (
    <AppShell
      header={{ height: 68 }}
      navbar={{
        width: 220,
        breakpoint: "sm",
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header className="app-header-gradient">
        <Group h="100%" px="md" justify="space-between" gap="sm" wrap="wrap">
          <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Box
              component={Link}
              to={isAuthenticated ? "/painel" : "/"}
              aria-label={isAuthenticated ? "Ir para o dashboard" : "Ir para a página inicial"}
              style={{
                display: "flex",
                alignItems: "center",
                alignSelf: "stretch",
                paddingInline: "14px 36px",
                marginLeft: "-14px",
                textDecoration: "none",
              }}
            >
              <Image
                src="/almologo.png"
                alt="Almoço Coletivo"
                h={isMobile ? 46 : 56}
                w="auto"
                fit="contain"
              />
            </Box>
          </Group>
          <Group gap={isMobile ? "xs" : "sm"} wrap="wrap">
            {isAuthenticated ? (
              <>
                {!isMobile && (
                  <Text size="sm" c="dimmed">
                    {user?.display_name ?? "Logado"}
                  </Text>
                )}
                <Button variant="light" size={isMobile ? "xs" : "sm"} onClick={logout} miw={72}>
                  Sair
                </Button>
              </>
            ) : (
              <Button
                component={Link}
                to="/login"
                variant="light"
                size={isMobile ? "xs" : "sm"}
                miw={72}
              >
                Entrar
              </Button>
            )}
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <nav className="flex flex-col gap-2">
          {visibleNavItems.map((item) => {
            const active = isActivePath(location.pathname, item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={`sliding-underline rounded px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "text-blue-700" : "text-slate-700 hover:text-blue-700"
                }`}
                onClick={close}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
