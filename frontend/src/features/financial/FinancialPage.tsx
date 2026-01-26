import {
  Badge,
  Button,
  Container,
  SimpleGrid,
  Group,
  Modal,
  Pagination,
  ScrollArea,
  Select,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { DateInput, type DateValue } from "@mantine/dates";
import {
  IconCurrencyDollar,
  IconPencil,
  IconPlus,
  IconTrash,
  IconWallet,
} from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SummaryCard } from "../../components/SummaryCard";
import { useAuth } from "../../context/AuthContext";
import {
  createFinancialEntry,
  deleteFinancialEntry,
  fetchFinancialEntries,
  fetchFinancialSummary,
  updateFinancialEntry,
  type FinancialEntry,
} from "./api";

const categoryLabels: Record<string, string> = {
  ALMOCO: "Almoço",
  DOACAO: "Doação",
  NOTA: "Nota",
  STAFF: "Equipe",
  DESPESA: "Despesa",
  ESTORNO: "Estorno",
};

const categories = [
  { value: "ALMOCO", label: "Almoço" },
  { value: "DOACAO", label: "Doação" },
  { value: "NOTA", label: "Nota" },
  { value: "STAFF", label: "Equipe" },
  { value: "DESPESA", label: "Despesa" },
  { value: "ESTORNO", label: "Estorno" },
];

const toIsoDate = (val: DateValue) => {
  if (!val) return undefined;
  if (typeof val === "string") return val;
  return val.toLocaleDateString("en-CA");
};

const parseIsoAsLocalDate = (value?: string | null) => {
  if (!value) return null;
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

const formatPtDate = (value?: string | null) => {
  if (!value) return "";
  const parts = value.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  }
  return value;
};

export function FinancialPage() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpened, modalHandlers] = useDisclosure(false);
  const [editing, setEditing] = useState<FinancialEntry | null>(null);
  const [formState, setFormState] = useState<Partial<FinancialEntry>>({
    entry_type: "ENTRADA",
    category: "ALMOCO",
    description: "",
    value_cents: 0,
    date: new Date().toISOString().slice(0, 10),
  });
  const [valueReais, setValueReais] = useState<string>("");
  const [dateValue, setDateValue] = useState<DateValue>(new Date());
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [filters, setFilters] = useState<{
    entry_type: "ENTRADA" | "SAIDA" | null;
    category: string | null;
    date_from: DateValue;
    date_to: DateValue;
  }>({
    entry_type: null,
    category: null,
    date_from: null,
    date_to: null,
  });

  const { data: summary } = useQuery({
    queryKey: [
      "financial-summary",
      filters.entry_type,
      filters.category,
      toIsoDate(filters.date_from) ?? null,
      toIsoDate(filters.date_to) ?? null,
    ],
    queryFn: () =>
      fetchFinancialSummary({
        entry_type: filters.entry_type || undefined,
        category: filters.category || undefined,
        date_from: toIsoDate(filters.date_from),
        date_to: toIsoDate(filters.date_to),
      }),
    enabled: isAuthenticated,
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "financial",
      filters.entry_type,
      filters.category,
      toIsoDate(filters.date_from) ?? null,
      toIsoDate(filters.date_to) ?? null,
    ],
    queryFn: () =>
      fetchFinancialEntries({
        entry_type: filters.entry_type || undefined,
        category: filters.category || undefined,
        date_from: toIsoDate(filters.date_from),
        date_to: toIsoDate(filters.date_to),
      }),
    enabled: isAuthenticated,
  });

  const invalidateRelated = () => {
    queryClient.invalidateQueries({ queryKey: ["financial"] });
    queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: Partial<FinancialEntry>) => createFinancialEntry(payload),
    onSuccess: () => {
      invalidateRelated();
      notifications.show({ message: "Lançamento criado.", color: "green" });
      modalHandlers.close();
    },
    onError: () => notifications.show({ message: "Erro ao criar lançamento.", color: "red" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<FinancialEntry> }) =>
      updateFinancialEntry(id, payload),
    onSuccess: () => {
      invalidateRelated();
      notifications.show({ message: "Lançamento atualizado.", color: "green" });
      modalHandlers.close();
    },
    onError: () => notifications.show({ message: "Erro ao atualizar lançamento.", color: "red" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteFinancialEntry(id),
    onSuccess: () => {
      invalidateRelated();
      notifications.show({ message: "Lançamento removido.", color: "green" });
    },
    onError: () => notifications.show({ message: "Erro ao remover lançamento.", color: "red" }),
  });

  const dataLength = data?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(dataLength / pageSize));

  useEffect(() => {
    setPage(1);
  }, [filters.entry_type, filters.category, filters.date_from, filters.date_to, dataLength]);

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const handleSubmit = () => {
    if (!formState.entry_type || !formState.category || !valueReais || !dateValue) {
      notifications.show({ message: "Preencha tipo, categoria, valor e data.", color: "red" });
      return;
    }
    const parsedValue = parseFloat(valueReais.replace(/\./g, "").replace(",", "."));
    const dateIso = toIsoDate(dateValue) || "";
    const payload: Partial<FinancialEntry> = {
      ...formState,
      value_cents: Number.isNaN(parsedValue) ? 0 : Math.round(parsedValue * 100),
      date: dateIso,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const openNew = () => {
    setEditing(null);
    setFormState({
      entry_type: "ENTRADA",
      category: "ALMOCO",
      description: "",
      value_cents: 0,
      date: new Date().toISOString().slice(0, 10),
    });
    setValueReais("");
    setDateValue(new Date());
    modalHandlers.open();
  };

  const openEdit = (item: FinancialEntry) => {
    setEditing(item);
    setFormState({
      entry_type: item.entry_type,
      category: item.category,
      description: item.description,
      value_cents: item.value_cents,
      date: item.date,
    });
    setValueReais(
      (item.value_cents / 100).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
    setDateValue(parseIsoAsLocalDate(item.date));
    modalHandlers.open();
  };

  const clearFilters = () =>
    setFilters({
      entry_type: null,
      category: null,
      date_from: null,
      date_to: null,
    });

  if (!isAuthenticated) {
    return (
      <Container size="xl" py="md">
        <Group mb="md">
          <IconCurrencyDollar size={20} />
          <Title order={3}>Financeiro</Title>
        </Group>
        <Text mb="sm">Autenticação necessária para visualizar o financeiro.</Text>
        <Button component={Link} to="/login">
          Ir para login
        </Button>
      </Container>
    );
  }

  if (isLoading) return <Text>Carregando...</Text>;
  if (isError || !data) return <Text c="red">Erro ao carregar financeiro.</Text>;

  const formatCents = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const summaryStats = summary ?? {
    month: { entradas_cents: 0, saidas_cents: 0, saldo_cents: 0 },
    total: { entradas_cents: 0, saidas_cents: 0, saldo_cents: 0 },
  };

  return (
    <Container size="xl" py="md">
      <Group mb="md">
        <IconCurrencyDollar size={20} />
        <Title order={3}>Financeiro</Title>
        {isAuthenticated && (
          <Button onClick={openNew} leftSection={<IconPlus size={16} />} ml="auto">
            Novo
          </Button>
        )}
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mb="md">
        {summaryStats.filtered &&
        (filters.entry_type || filters.category || filters.date_from || filters.date_to) ? (
          <SummaryCard
            title="Balanço do filtro"
            value={formatCents(summaryStats.filtered.saldo_cents)}
            subtitle={`Entradas ${formatCents(summaryStats.filtered.entradas_cents)} · Saídas ${formatCents(
              summaryStats.filtered.saidas_cents
            )}`}
            icon={<IconWallet size={20} />}
          />
        ) : (
          <SummaryCard
            title="Balanço mensal"
            value={formatCents(summaryStats.month.saldo_cents)}
            subtitle={`Entradas ${formatCents(summaryStats.month.entradas_cents)} · Saídas ${formatCents(
              summaryStats.month.saidas_cents
            )}`}
            icon={<IconWallet size={20} />}
          />
        )}
        <SummaryCard
          title="Balanço total"
          value={formatCents(summaryStats.total.saldo_cents)}
          subtitle={`Entradas ${formatCents(summaryStats.total.entradas_cents)} · Saídas ${formatCents(
            summaryStats.total.saidas_cents
          )}`}
          icon={<IconCurrencyDollar size={20} />}
        />
      </SimpleGrid>

      <Group gap="sm" align="flex-end" mb="md">
        <Select
          label="Tipo"
          data={[
            { value: "ENTRADA", label: "Entrada" },
            { value: "SAIDA", label: "Saída" },
          ]}
          clearable
          value={filters.entry_type}
          onChange={(val) =>
            setFilters((prev) => ({
              ...prev,
              entry_type: (val as "ENTRADA" | "SAIDA" | null) ?? null,
            }))
          }
        />
        <Select
          label="Categoria"
          data={categories}
          clearable
          value={filters.category}
          onChange={(val) => setFilters((prev) => ({ ...prev, category: val }))}
        />
        <DateInput
          label="De"
          value={filters.date_from}
          onChange={(val) => setFilters((prev) => ({ ...prev, date_from: val }))}
          valueFormat="DD/MM/YYYY"
          locale="pt-br"
        />
        <DateInput
          label="Até"
          value={filters.date_to}
          onChange={(val) => setFilters((prev) => ({ ...prev, date_to: val }))}
          valueFormat="DD/MM/YYYY"
          locale="pt-br"
        />
        <Button variant="outline" onClick={clearFilters}>
          Limpar
        </Button>
      </Group>

      <ScrollArea>
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ minWidth: 110 }}>Data</Table.Th>
              <Table.Th style={{ minWidth: 110 }}>Tipo</Table.Th>
              <Table.Th style={{ minWidth: 140 }}>Categoria</Table.Th>
              <Table.Th style={{ minWidth: 220 }}>Descrição</Table.Th>
              <Table.Th style={{ minWidth: 120 }} ta="right">
                Valor
              </Table.Th>
              {isAuthenticated && (
                <Table.Th style={{ minWidth: 140 }} ta="right">
                  Ações
                </Table.Th>
              )}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.slice((page - 1) * pageSize, page * pageSize).map((item) => (
              <Table.Tr key={item.id}>
                <Table.Td>{formatPtDate(item.date)}</Table.Td>
                <Table.Td>
                  <Badge color={item.entry_type === "ENTRADA" ? "green" : "red"}>
                    {item.entry_type === "ENTRADA" ? "Entrada" : "Saída"}
                  </Badge>
                </Table.Td>
                <Table.Td>{categoryLabels[item.category] || item.category}</Table.Td>
                <Table.Td>{item.description}</Table.Td>
                <Table.Td ta="right">{formatCents(item.value_cents)}</Table.Td>
                {isAuthenticated && (
                  <Table.Td ta="right">
                    <Group gap="xs" justify="flex-end">
                      <Button size="xs" variant="subtle" onClick={() => openEdit(item)} aria-label="Editar">
                        <IconPencil size={16} />
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        color="red"
                        loading={deleteMutation.isPending && deleteMutation.variables === item.id}
                        onClick={() => deleteMutation.mutate(item.id)}
                        aria-label="Remover"
                      >
                        <IconTrash size={16} />
                      </Button>
                    </Group>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
      {data.length > 0 && (
        <Group justify="center" mt="md">
          <Pagination total={totalPages} value={page} onChange={setPage} size="sm" />
        </Group>
      )}

      <Modal
        opened={modalOpened}
        onClose={modalHandlers.close}
        title={editing ? "Editar lançamento" : "Novo lançamento"}
      >
        <div className="flex flex-col gap-3">
          <Select
            label="Tipo"
            data={[
              { value: "ENTRADA", label: "Entrada" },
              { value: "SAIDA", label: "Saída" },
            ]}
            value={formState.entry_type ?? undefined}
            onChange={(val) =>
              setFormState((prev) => ({
                ...prev,
                entry_type: (val as "ENTRADA" | "SAIDA" | null) || "ENTRADA",
              }))
            }
          />
          <Select
            label="Categoria"
            data={categories}
            value={formState.category ?? undefined}
            onChange={(val) => setFormState((prev) => ({ ...prev, category: val || "ALMOCO" }))}
          />
          <TextInput
            label="Descrição"
            value={formState.description ?? ""}
            onChange={(e) => setFormState((prev) => ({ ...prev, description: e.currentTarget.value }))}
          />
          <TextInput
            label="Valor (R$)"
            value={valueReais}
            onChange={(e) => setValueReais(e.currentTarget.value)}
            placeholder="Ex: 120,00"
          />
          <DateInput
            label="Data"
            value={dateValue}
            onChange={(val) => setDateValue(val ?? null)}
            valueFormat="DD/MM/YYYY"
            locale="pt-br"
          />
          <Group justify="flex-end" mt="sm">
            <Button onClick={handleSubmit} loading={createMutation.isPending || updateMutation.isPending}>
              {editing ? "Salvar" : "Criar"}
            </Button>
          </Group>
        </div>
      </Modal>
    </Container>
  );
}


