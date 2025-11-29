import { Card, Container, SimpleGrid, Text, Title } from "@mantine/core";
import { IconChartBar, IconCurrencyDollar, IconUsers } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { SummaryCard } from "../../components/SummaryCard";
import { fetchDashboardSummary } from "./api";

function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: fetchDashboardSummary,
  });
}

export function DashboardPage() {
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
          title="Integrantes"
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
