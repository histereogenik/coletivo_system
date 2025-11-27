import { Badge, Container, Group, ScrollArea, Table, Text, Title } from "@mantine/core";
import { IconCurrencyDollar } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { fetchFinancialEntries } from "./api";

const categoryLabels: Record<string, string> = {
  ALMOCO: "Almoço",
  DOACAO: "Doação",
  NOTA: "Nota",
  STAFF: "Equipe",
  DESPESA: "Despesa",
  ESTORNO: "Estorno",
};

export function FinancialPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["financial-entries"],
    queryFn: () => fetchFinancialEntries(),
  });

  if (isLoading) return <Text>Carregando...</Text>;
  if (isError || !data) return <Text c="red">Erro ao carregar financeiro.</Text>;

  const formatCents = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Container size="xl" py="md">
      <Group mb="md">
        <IconCurrencyDollar size={20} />
        <Title order={3}>Financeiro</Title>
      </Group>
      <ScrollArea>
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Data</Table.Th>
              <Table.Th>Tipo</Table.Th>
              <Table.Th>Categoria</Table.Th>
              <Table.Th>Descrição</Table.Th>
              <Table.Th ta="right">Valor</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.map((item) => (
              <Table.Tr key={item.id}>
                <Table.Td>{item.date}</Table.Td>
                <Table.Td>
                  <Badge color={item.entry_type === "ENTRADA" ? "green" : "red"}>
                    {item.entry_type}
                  </Badge>
                </Table.Td>
                <Table.Td>{categoryLabels[item.category] || item.category}</Table.Td>
                <Table.Td>{item.description}</Table.Td>
                <Table.Td ta="right">{formatCents(item.value_cents)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Container>
  );
}
