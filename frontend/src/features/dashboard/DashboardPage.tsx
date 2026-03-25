import { Badge, Button, Container, Group, ScrollArea, SimpleGrid, Table, Text, Title } from "@mantine/core";
import { IconPackage, IconSoup, IconUserPlus, IconUsers } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { SummaryCard } from "../../components/SummaryCard";
import { useAuth } from "../../context/AuthContext";
import { fetchPublicRegistrations } from "../members/api";
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
  const pendingRegistrationsQuery = useQuery({
    queryKey: ["public-registrations-dashboard"],
    queryFn: () =>
      fetchPublicRegistrations({
        status: "PENDENTE",
        page: 1,
        page_size: 5,
      }),
    enabled: isAuthenticated,
  });

  if (isLoading) return <Text>Carregando...</Text>;
  if (isError || !data) return <Text c="red">Erro ao carregar dashboard.</Text>;

  const formatCents = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const paymentLabels: Record<string, string> = {
    PAGO: "Pago",
    EM_ABERTO: "Em aberto",
  };

  const todayItems = [...data.lunches.today_items].sort((a, b) => a.id - b.id);
  const pendingRegistrations = pendingRegistrationsQuery.data?.results ?? [];
  const pendingRegistrationsCount = pendingRegistrationsQuery.data?.count ?? 0;

  const quickButtonStyles = {
    root: {
      height: "135.391px",
      justifyContent: "center",
      textAlign: "center",
      alignItems: "center",
    },
    label: {
      display: "flex",
      flexDirection: "column",
      gap: 4,
      alignItems: "center",
      justifyContent: "center",
      lineHeight: 1.2,
      whiteSpace: "normal",
    },
  } as const;

  return (
    <Container size="xl" py="md">
      {isAuthenticated && (
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mb="md">
          <Button
            component={Link}
            to="/painel/integrantes?novo=1"
            fullWidth
            size="lg"
            color="indigo"
            radius="md"
            variant="filled"
            styles={quickButtonStyles}
          >
            <IconUserPlus size={26} />
            <span>+ Novo</span>
            <span>Integrante</span>
          </Button>
          <Button
            component={Link}
            to="/painel/lunches?novo=1"
            fullWidth
            size="lg"
            color="teal"
            radius="md"
            variant="filled"
            styles={quickButtonStyles}
          >
            <IconSoup size={26} />
            <span>+ Novo</span>
            <span>Almoço</span>
          </Button>
          <Button
            component={Link}
            to="/painel/pacotes?novo=1"
            fullWidth
            size="lg"
            color="orange"
            radius="md"
            variant="filled"
            styles={quickButtonStyles}
          >
            <IconPackage size={26} />
            <span>+ Novo</span>
            <span>Pacote</span>
          </Button>
        </SimpleGrid>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mb="md">
        <SummaryCard
          title="Integrantes"
          value={`${data.members.total}`}
          subtitle={`Sustentadores ${data.members.sustentadores} | Mensalistas ${data.members.mensalistas} | Avulsos ${data.members.avulsos}`}
          icon={<IconUsers size={20} />}
        />
        <SummaryCard
          title="Almoços Hoje"
          value={`${data.lunches.today_total}`}
          subtitle={
            <>
              {`Faturamento hoje: ${formatCents(data.lunches.today_paid_cents)}`}
              <br />
              <span style={{ fontSize: "0.75em" }}>*contando os valores de pacotes já pagos</span>
            </>
          }
          icon={<IconSoup size={20} />}
        />
      </SimpleGrid>

      <Title order={4} mb="xs">
        Almoços de hoje
      </Title>
      <ScrollArea mb="md">
        <Table highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>#</Table.Th>
              <Table.Th>Nome</Table.Th>
              <Table.Th>Tipo</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th ta="right">Valor</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {todayItems.map((item, index) => (
              <Table.Tr key={item.id}>
                <Table.Td>{index + 1}</Table.Td>
                <Table.Td>{item.member_name}</Table.Td>
                <Table.Td>{item.has_package ? "Pacote" : "Avulso"}</Table.Td>
                <Table.Td>
                  <Badge color={item.payment_status === "PAGO" ? "green" : "orange"}>
                    {paymentLabels[item.payment_status] || item.payment_status}
                  </Badge>
                </Table.Td>
                <Table.Td ta="right">{formatCents(item.value_cents)}</Table.Td>
              </Table.Tr>
            ))}
            {todayItems.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text c="dimmed">Nenhum almoço registrado hoje.</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea>

      {isAuthenticated && (
        <>
          <Group justify="space-between" align="flex-end" mb="xs">
            <div>
              <Title order={4}>Novos cadastros</Title>
              <Text size="sm" c="dimmed">
                {pendingRegistrationsCount} pendente{pendingRegistrationsCount === 1 ? "" : "s"} aguardando revisão.
              </Text>
            </div>
            <Button component={Link} to="/painel/integrantes?tab=novos-cadastros" variant="outline">
              Gerenciar
            </Button>
          </Group>

          {pendingRegistrationsQuery.isLoading && <Text size="sm">Carregando...</Text>}
          {pendingRegistrationsQuery.isError && (
            <Text size="sm" c="red">
              Erro ao carregar novos cadastros.
            </Text>
          )}

          {!pendingRegistrationsQuery.isLoading && !pendingRegistrationsQuery.isError && (
            <ScrollArea>
              <Table highlightOnHover withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ minWidth: 220 }}>Nome</Table.Th>
                    <Table.Th style={{ minWidth: 220 }}>E-mail</Table.Th>
                    <Table.Th style={{ minWidth: 100 }}>Crianças</Table.Th>
                    <Table.Th style={{ minWidth: 160 }}>Data</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {pendingRegistrations.map((registration) => (
                    <Table.Tr key={registration.id}>
                      <Table.Td>{registration.full_name}</Table.Td>
                      <Table.Td>{registration.email || "-"}</Table.Td>
                      <Table.Td>{registration.children.length}</Table.Td>
                      <Table.Td>
                        {registration.created_at
                          ? new Date(registration.created_at).toLocaleDateString("pt-BR")
                          : "-"}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                  {pendingRegistrations.length === 0 && (
                    <Table.Tr>
                      <Table.Td colSpan={4}>
                        <Text c="dimmed">Nenhum novo cadastro pendente.</Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          )}
        </>
      )}
    </Container>
  );
}
