import { AppShell, Burger, Button, Group, Text, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type LayoutProps = {
  children: React.ReactNode;
};

const navItems = [
  { label: "Dashboard", to: "/" },
  { label: "Agenda", to: "/agenda" },
  { label: "Financeiro", to: "/financeiro" },
  { label: "Almoços", to: "/lunches" },
];

export function Layout({ children }: LayoutProps) {
  const [opened, { toggle }] = useDisclosure();
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 220,
        breakpoint: "sm",
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Title order={3}>Coletivo Dashboard</Title>
          </Group>
          <Group gap="sm">
            {isAuthenticated ? (
              <>
                <Text size="sm" c="dimmed">
                  Logado
                </Text>
                <Button variant="light" onClick={logout}>
                  Sair
                </Button>
              </>
            ) : (
              <Button component={Link} to="/login" variant="light">
                Entrar
              </Button>
            )}
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <nav className="flex flex-col gap-2">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`rounded px-3 py-2 text-sm font-medium ${
                  active ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
