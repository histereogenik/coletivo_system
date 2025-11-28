import { Badge, Button, Container, Group, ScrollArea, Table, Text, Title } from "@mantine/core";
import { IconSoup } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchLunches, markLunchPaid, Lunch } from "./api";

const paymentLabels: Record<string, string> = {
  PAGO: "Pago",
  EM_ABERTO: "Em aberto",
};

const typeLabels: Record<string, string> = {
  AVULSO: "Avulso",
  PACOTE: "Pacote",
};

export function LunchesPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["lunches"],
    queryFn: () => fetchLunches(),
  });

  const mutation = useMutation({
    mutationFn: (id: number) => markLunchPaid(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lunches"] });
    },
  });

  if (isLoading) return <Text>Carregando...</Text>;
  if (isError || !data) return <Text c="red">Erro ao carregar almoços.</Text>;

  const formatCents = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const canMarkPaid = (lunch: Lunch) => lunch.payment_status !== "PAGO";

  return (
    <Container size="xl" py="md">
      <Group mb="md">
        <IconSoup size={20} />
        <Title order={3}>Almoços</Title>
      </Group>
      <ScrollArea>
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Data</Table.Th>
              <Table.Th>Tipo</Table.Th>
              <Table.Th>Membro</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th ta="right">Valor</Table.Th>
              <Table.Th ta="right">Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.map((item) => (
              <Table.Tr key={item.id}>
                <Table.Td>{item.date}</Table.Td>
                <Table.Td>{typeLabels[item.lunch_type] || item.lunch_type}</Table.Td>
                <Table.Td>{item.member_name || `#${item.member}`}</Table.Td>
                <Table.Td>
                  <Badge color={item.payment_status === "PAGO" ? "green" : "orange"}>
                    {paymentLabels[item.payment_status] || item.payment_status}
                  </Badge>
                </Table.Td>
                <Table.Td ta="right">{formatCents(item.value_cents)}</Table.Td>
                <Table.Td ta="right">
                  {canMarkPaid(item) && (
                    <Button
                      size="xs"
                      variant="light"
                      loading={mutation.isPending && mutation.variables === item.id}
                      onClick={() => mutation.mutate(item.id)}
                    >
                      Marcar pago
                    </Button>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Container>
  );
}
