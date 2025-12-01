import { Button, Card, Container, SimpleGrid, Text, Title } from "@mantine/core";
import { IconChartBar, IconCurrencyDollar, IconSoup, IconUsers, IconUserPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { SummaryCard } from "../../components/SummaryCard";
import { useAuth } from "../../context/AuthContext";
import { fetchDashboardSummary } from "./api";

function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: fetchDashboardSummary,
  });
}

export function DashboardPage() {
  const { data, isLoading, isError } = useDashboardSummary();
  const { isAuthenticated } = useAuth();

  if (isLoading) return <Text>Carregando...</Text>;
  if (isError || !data) return <Text c="red">Erro ao carregar dashboard.</Text>;

  const formatCents = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Container size="xl" py="md">
      {isAuthenticated && (
        <SimpleGrid cols={2} spacing="md" mb="md">
          <Button
            component={Link}
            to="/integrantes?novo=1"
            leftSection={<IconUserPlus size={18} />}
            fullWidth
            size="lg"
            color="indigo"
            radius="md"
            variant="gradient"
            gradient={{ from: "indigo", to: "cyan" }}
            style={{ height: "100%" }}
          >
            + Novo integrante
          </Button>
          <Button
            component={Link}
            to="/lunches?novo=1"
            leftSection={<IconSoup size={18} />}
            fullWidth
            size="lg"
            color="teal"
            radius="md"
            variant="gradient"
            gradient={{ from: "teal", to: "green" }}
            style={{ height: "100%" }}
          >
            + Novo almoço
          </Button>
        </SimpleGrid>
      )}
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
