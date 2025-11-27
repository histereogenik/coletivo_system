import { Card, Container, MantineProvider, SimpleGrid, Text, Title } from "@mantine/core";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import { Notifications } from "@mantine/notifications";
import { IconChartBar, IconCurrencyDollar, IconUsers } from "@tabler/icons-react";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Route, Routes } from "react-router-dom";
import "./App.css";
import { Layout } from "./components/Layout";
import { SummaryCard } from "./components/SummaryCard";
import { api } from "./lib/api";
import { queryClient } from "./lib/queryClient";
import { theme } from "./lib/theme";

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
  return (
    <MantineProvider defaultColorScheme="light" theme={theme}>
      <Notifications />
      <QueryClientProvider client={queryClient}>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/agenda" element={<Text>Agenda (em breve)</Text>} />
            <Route path="/financeiro" element={<Text>Financeiro (em breve)</Text>} />
            <Route path="*" element={<Text>Página não encontrada.</Text>} />
          </Routes>
        </Layout>
      </QueryClientProvider>
    </MantineProvider>
  );
}

export default App;
