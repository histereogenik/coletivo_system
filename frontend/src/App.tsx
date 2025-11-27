import {
  AppShell,
  Burger,
  Card,
  Container,
  Group,
  MantineProvider,
  SimpleGrid,
  Text,
  Title,
} from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { IconChartBar, IconCurrencyDollar, IconUsers } from "@tabler/icons-react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useDisclosure } from "@mantine/hooks";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./App.css";
import { api } from "./lib/api";

const queryClient = new QueryClient();

type DashboardSummary = {
  monthly_balance_cents: number;
  entradas_cents: number;
  saidas_cents: number;
  members: {
    total: number;
    sustentadores: number;
    mensalistas: number;
    avulsos: number;
  };
  lunches: {
    average_daily_last_30_days: number;
    total_last_30_days: number;
    total_em_aberto: number;
    total: number;
  };
};

function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => {
      const { data } = await api.get<DashboardSummary>("/api/dashboard/summary/");
      return data;
    },
  });
}

function SummaryCard({
  title,
  value,
  icon,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card withBorder shadow="sm" padding="lg" radius="md">
      <Group justify="space-between" mb="sm">
        <Text size="sm" c="dimmed">
          {title}
        </Text>
        {icon}
      </Group>
      <Title order={3}>{value}</Title>
      {subtitle && (
        <Text size="sm" c="dimmed" mt="xs">
          {subtitle}
        </Text>
      )}
    </Card>
  );
}

function Dashboard() {
  const { data, isLoading, isError } = useDashboardSummary();

  if (isLoading) return <Text>Carregando...</Text>;
  if (isError || !data) return <Text c="red">Erro ao carregar dashboard.</Text>;

  const formatCents = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Container size="xl" py="md">
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md" mb="md">
        <SummaryCard
          title="Balanço mensal"
          value={formatCents(data.monthly_balance_cents)}
          subtitle={`Entradas ${formatCents(data.entradas_cents)} • Saídas ${formatCents(data.saidas_cents)}`}
          icon={<IconCurrencyDollar size={20} />}
        />
        <SummaryCard
          title="Membros"
          value={`${data.members.total}`}
          subtitle={`Sustentadores ${data.members.sustentadores} • Mensalistas ${data.members.mensalistas} • Avulsos ${data.members.avulsos}`}
          icon={<IconUsers size={20} />}
        />
        <SummaryCard
          title="Almoços (30d)"
          value={`${data.lunches.total_last_30_days}`}
          subtitle={`Média diária ${data.lunches.average_daily_last_30_days.toFixed(1)} • Em aberto ${data.lunches.total_em_aberto}`}
          icon={<IconChartBar size={20} />}
        />
      </SimpleGrid>
      <Card withBorder shadow="xs" padding="lg">
        <Title order={4} mb="sm">
          Total de almoços
        </Title>
        <Text size="lg">{data.lunches.total}</Text>
      </Card>
    </Container>
  );
}

function App() {
  const [opened, { toggle }] = useDisclosure();

  return (
    <MantineProvider defaultColorScheme="light">
      <Notifications />
      <QueryClientProvider client={queryClient}>
        <AppShell
          header={{ height: 60 }}
          navbar={{
            width: 0,
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
            </Group>
          </AppShell.Header>
          <AppShell.Main>
            <Dashboard />
          </AppShell.Main>
        </AppShell>
      </QueryClientProvider>
    </MantineProvider>
  );
}

export default App;
