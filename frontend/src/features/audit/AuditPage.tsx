import {
  Button,
  Code,
  Container,
  Group,
  Modal,
  Pagination,
  Paper,
  Select,
  SimpleGrid,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconEye, IconHistory } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  fetchAuditEvents,
  fetchAuditFilterOptions,
  type AuditEvent,
  type AuditFilters,
} from "./api";

const entityLabels: Record<string, string> = {
  "auth.User": "Conta administrativa",
  "users.Member": "Integrante",
  "duties.Duty": "Função",
  "agenda.AgendaEntry": "Agenda",
  "lunch.Lunch": "Almoço",
  "lunch.Package": "Pacote",
  "financial.FinancialEntry": "Financeiro",
};

const auditPageSize = 15;

export function AuditPage() {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const [filters, setFilters] = useState<AuditFilters>({});
  const [opened, handlers] = useDisclosure(false);
  const filterOptionsQuery = useQuery({
    queryKey: ["audit-filter-options"],
    queryFn: fetchAuditFilterOptions,
  });
  const query = useQuery({
    queryKey: ["audit-events", page, filters],
    queryFn: () => fetchAuditEvents(page, auditPageSize, filters),
  });
  const totalPages = Math.max(1, Math.ceil((query.data?.count ?? 0) / auditPageSize));

  const viewEvent = (event: AuditEvent) => {
    setSelected(event);
    handlers.open();
  };

  const setFilter = (field: keyof AuditFilters, value: string | null) => {
    setPage(1);
    setFilters((current) => ({ ...current, [field]: value || undefined }));
  };

  const entityOptions = (filterOptionsQuery.data?.entity_types ?? []).map((value) => ({
    value,
    label: entityLabels[value] ?? value,
  }));

  return (
    <Container size="xl" py="md">
      <Group mb="md">
        <IconHistory size={22} />
        <Title order={3}>Auditoria</Title>
      </Group>
      <Text c="dimmed" mb="lg">
        Histórico de criações, alterações e exclusões realizadas no painel.
      </Text>

      <Paper withBorder p="md" mb="lg">
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
          <Select
            label="Responsável"
            data={filterOptionsQuery.data?.actors ?? []}
            value={filters.actor ?? null}
            onChange={(value) => setFilter("actor", value)}
            clearable
            searchable
          />
          <Select
            label="Ação"
            data={filterOptionsQuery.data?.actions ?? []}
            value={filters.action ?? null}
            onChange={(value) => setFilter("action", value)}
            clearable
          />
          <Select
            label="Origem"
            data={filterOptionsQuery.data?.sources ?? []}
            value={filters.source ?? null}
            onChange={(value) => setFilter("source", value)}
            clearable
          />
          <Select
            label="Área"
            data={entityOptions}
            value={filters.entity_type ?? null}
            onChange={(value) => setFilter("entity_type", value)}
            clearable
            searchable
          />
          <TextInput
            label="ID do registro"
            value={filters.object_id ?? ""}
            onChange={(event) => setFilter("object_id", event.currentTarget.value)}
          />
          <TextInput
            label="Data inicial"
            type="date"
            value={filters.created_from?.slice(0, 10) ?? ""}
            onChange={(event) =>
              setFilter(
                "created_from",
                event.currentTarget.value ? `${event.currentTarget.value}T00:00:00` : null
              )
            }
          />
          <TextInput
            label="Data final"
            type="date"
            value={filters.created_to?.slice(0, 10) ?? ""}
            onChange={(event) =>
              setFilter(
                "created_to",
                event.currentTarget.value ? `${event.currentTarget.value}T23:59:59` : null
              )
            }
          />
          <Group align="flex-end">
            <Button
              variant="default"
              onClick={() => {
                setFilters({});
                setPage(1);
              }}
              disabled={Object.values(filters).every((value) => !value)}
            >
              Limpar filtros
            </Button>
          </Group>
        </SimpleGrid>
      </Paper>

      <Table highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Data e hora</Table.Th>
            <Table.Th>Responsável</Table.Th>
            <Table.Th>Ação</Table.Th>
            <Table.Th>Área</Table.Th>
            <Table.Th>Registro</Table.Th>
            <Table.Th ta="right">Detalhes</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {(query.data?.results ?? []).map((event) => (
            <Table.Tr key={event.id}>
              <Table.Td>{new Date(event.created_at).toLocaleString("pt-BR")}</Table.Td>
              <Table.Td>{event.actor_name}</Table.Td>
              <Table.Td>{event.action_label}</Table.Td>
              <Table.Td>{entityLabels[event.entity_type] ?? event.entity_type}</Table.Td>
              <Table.Td>{event.object_repr || `#${event.object_id}`}</Table.Td>
              <Table.Td ta="right">
                <Button
                  variant="subtle"
                  size="xs"
                  aria-label="Visualizar detalhes"
                  onClick={() => viewEvent(event)}
                >
                  <IconEye size={16} />
                </Button>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {query.isLoading && <Text mt="md">Carregando histórico...</Text>}
      {query.isError && <Text c="red">Não foi possível carregar a auditoria.</Text>}
      {!query.isLoading && !query.isError && query.data?.count === 0 && (
        <Text mt="md" c="dimmed">
          Nenhum registro encontrado com os filtros selecionados.
        </Text>
      )}
      {totalPages > 1 && <Pagination mt="lg" value={page} onChange={setPage} total={totalPages} />}

      <Modal opened={opened} onClose={handlers.close} title="Detalhes da alteração" size="lg">
        {selected && (
          <Code block style={{ whiteSpace: "pre-wrap" }}>
            {JSON.stringify(selected.changes, null, 2)}
          </Code>
        )}
      </Modal>
    </Container>
  );
}
