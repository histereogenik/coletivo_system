import { Badge, Card, Container, Group, SimpleGrid, Text, Title } from "@mantine/core";
import { IconCalendar } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { fetchAgenda } from "./api";

export function AgendaPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["agenda"],
    queryFn: () => fetchAgenda(),
  });

  if (isLoading) return <Text>Carregando...</Text>;
  if (isError || !data) return <Text c="red">Erro ao carregar agenda.</Text>;

  return (
    <Container size="xl" py="md">
      <Group mb="md">
        <IconCalendar size={20} />
        <Title order={3}>Agenda</Title>
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
        {data.map((entry) => (
          <Card key={entry.id} withBorder shadow="sm" radius="md" padding="md">
            <Group justify="space-between" mb="xs">
              <Text fw={600}>
                {entry.date} • {entry.start_time}
                {entry.end_time ? ` - ${entry.end_time}` : ""}
              </Text>
              <Badge color="blue">{entry.status}</Badge>
            </Group>
            <Text c="dimmed" size="sm">
              {entry.duty_name || `Função #${entry.duty}`}
            </Text>
            <Text size="sm" mt="xs">
              Membros:{" "}
              {entry.members && entry.members.length > 0
                ? entry.members.map((m) => m.full_name).join(", ")
                : "—"}
            </Text>
            {entry.notes && (
              <Text size="xs" c="dimmed" mt="xs">
                {entry.notes}
              </Text>
            )}
          </Card>
        ))}
      </SimpleGrid>
    </Container>
  );
}
