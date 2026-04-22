import {
  Badge,
  Button,
  Container,
  Box,
  Group,
  Modal,
  ScrollArea,
  Select,
  Table,
  Text,
  Title,
  TextInput,
  Tooltip,
  Pagination,
  Switch,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import type { DateValue } from "@mantine/dates";
import { IconSoup, IconCheck, IconPencil, IconTrash, IconPlus } from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SummaryCard } from "../../components/SummaryCard";
import { useAuth } from "../../context/AuthContext";
import { fetchCreditSummaries } from "../credits/api";
import { API_BASE_URL } from "../../shared/api";
import { accentInsensitiveOptionsFilter } from "../../shared/comboboxFilters";
import { formatCents, formatCentsInput, parseReaisToCents } from "../../shared/currency";
import { extractErrorMessage } from "../../shared/errors";
import "dayjs/locale/pt-br";
import {
  createLunch,
  deleteLunch,
  fetchLunches,
  fetchLunchSummary,
  markLunchPaid,
  updateLunch,
  Lunch,
} from "./api";
import { fetchMembers, MemberOption } from "./membersApi";

const toIsoDate = (val: DateValue) => {
  if (!val) return undefined;
  if (typeof val === "string") return val;
  // use local date to avoid timezone shifts
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

const paymentLabels: Record<string, string> = {
  PAGO: "Pago",
  EM_ABERTO: "Em aberto",
};

const paymentModeLabels: Record<string, string> = {
  PIX: "Pix",
  CARTAO: "Cartão",
  DINHEIRO: "Dinheiro",
  TROCA: "Troca",
};

const creditOwnerPageSize = 500;

export function LunchesPage() {
  const actionResponsiveStyles = `
    .lunch-actions {
        display: flex;
        flex-wrap: nowrap;
        gap: 8px;
        justify-content: flex-end;
        align-items: center;
        overflow-x: auto;
      }
    .lunch-actions .lunch-actions-block {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: nowrap;
      }
  `;
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpened, modalHandlers] = useDisclosure(false);
  const [editing, setEditing] = useState<Lunch | null>(null);
  const [formState, setFormState] = useState<Partial<Lunch> & { use_package?: boolean }>({
    member: undefined,
    credit_owner: undefined,
    value_cents: 0,
    date: new Date().toISOString().slice(0, 10),
    payment_status: "EM_ABERTO",
    payment_mode: "PIX",
    use_package: false,
    package: undefined,
  });
  const [valueReais, setValueReais] = useState<string>("");
  const [dateValue, setDateValue] = useState<DateValue>(new Date());
  const [filters, setFilters] = useState<{
    member: string | null;
    payment_status: string | null;
    has_package: boolean | null;
    value: string;
    date_from: DateValue;
    date_to: DateValue;
  }>({
    member: null,
    payment_status: null,
    has_package: null,
    value: "",
    date_from: null,
    date_to: null,
  });
  const [valueInput, setValueInput] = useState<string>("" );
  const [searchParams, setSearchParams] = useSearchParams();
  const processedNovoRef = useRef(false);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const { data: summary } = useQuery({
    queryKey: [
      "lunch-summary",
      filters.member,
      filters.payment_status,
      filters.has_package,
      filters.value,
      toIsoDate(filters.date_from) ?? null,
      toIsoDate(filters.date_to) ?? null,
    ],
    queryFn: () =>
      fetchLunchSummary({
        member: filters.member ? Number(filters.member) : undefined,
        payment_status: filters.payment_status || undefined,
        has_package:
          filters.has_package === null ? undefined : filters.has_package ? "true" : "false",
        value_cents: filters.value
          ? Math.round(parseFloat(filters.value.replace(/\./g, "").replace(",", ".")) * 100)
          : undefined,
        date_from: toIsoDate(filters.date_from),
        date_to: toIsoDate(filters.date_to),
      }),
    enabled: isAuthenticated,
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "lunches",
      page,
      pageSize,
      filters.member,
      filters.payment_status,
      filters.has_package,
      filters.value,
      toIsoDate(filters.date_from) ?? null,
      toIsoDate(filters.date_to) ?? null,
    ],
    queryFn: () =>
      fetchLunches({
        page,
        page_size: pageSize,
        member: filters.member ? Number(filters.member) : undefined,
        payment_status: filters.payment_status || undefined,
        has_package:
          filters.has_package === null ? undefined : filters.has_package ? "true" : "false",
        value_cents: filters.value
          ? Math.round(parseFloat(filters.value.replace(/\./g, "").replace(",", ".")) * 100)
          : undefined,
        date_from: toIsoDate(filters.date_from),
        date_to: toIsoDate(filters.date_to),
      }),
    enabled: isAuthenticated,
  });

  const membersQuery = useQuery({
    queryKey: ["members"],
    queryFn: () => fetchMembers(),
    enabled: isAuthenticated,
  });

  const creditOwnersQuery = useQuery({
    queryKey: ["lunch-credit-owners"],
    queryFn: () => fetchCreditSummaries({ page_size: creditOwnerPageSize }),
    enabled: isAuthenticated,
  });

  const mutation = useMutation({
    mutationFn: (id: number) => markLunchPaid(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lunches"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["financial"] });
      notifications.show({ message: "Pagamento marcado.", color: "green" });
    },
    onError: () => notifications.show({ message: "Erro ao marcar pago.", color: "red" }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: Partial<Lunch> & { use_package?: boolean }) => createLunch(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lunches"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["financial"] });
      notifications.show({ message: "Almoço criado.", color: "green" });
      modalHandlers.close();
    },
    onError: (err: unknown) =>
      notifications.show({ message: extractErrorMessage(err, "Erro ao criar almoço."), color: "red" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Lunch> & { use_package?: boolean } }) =>
      updateLunch(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lunches"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["financial"] });
      notifications.show({ message: "Almoço atualizado.", color: "green" });
      modalHandlers.close();
    },
    onError: (err: unknown) =>
      notifications.show({ message: extractErrorMessage(err, "Erro ao atualizar almoço."), color: "red" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteLunch(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lunches"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["financial"] });
      notifications.show({ message: "Almoço removido.", color: "green" });
    },
    onError: (err: unknown) =>
      notifications.show({ message: extractErrorMessage(err, "Erro ao remover almoço."), color: "red" }),
  });

  const usingCredit = formState.payment_mode === "TROCA" && !formState.use_package;

  const handleSubmit = () => {
    if (!formState.member || !dateValue) {
      notifications.show({ message: "Preencha integrante e data.", color: "red" });
      return;
    }
    if (usingCredit && !formState.credit_owner) {
      notifications.show({ message: "Selecione o banco de trocas.", color: "red" });
      return;
    }
    const parsedValueCents = parseReaisToCents(valueReais);
    if (!Number.isFinite(parsedValueCents)) {
      notifications.show({ message: "Informe um valor válido.", color: "red" });
      return;
    }
    const dateIso = toIsoDate(dateValue) || "";

    const payload: Partial<Lunch> & { use_package?: boolean } = {
      ...formState,
      value_cents: parsedValueCents,
      date: dateIso,
      use_package: formState.use_package ? true : undefined,
      package: formState.use_package ? formState.package : null,
      credit_owner: usingCredit ? formState.credit_owner : null,
      payment_status: formState.use_package || usingCredit ? "PAGO" : formState.payment_status,
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const openNew = useCallback(() => {
    setEditing(null);
    setFormState({
      member: undefined,
      credit_owner: undefined,
      value_cents: 0,
      date: new Date().toISOString().slice(0, 10),
      payment_status: "EM_ABERTO",
      payment_mode: "PIX",
      use_package: false,
      package: undefined,
    });
    setValueReais("");
    setDateValue(new Date());
    modalHandlers.open();
  }, [modalHandlers]);

  const openEdit = (item: Lunch) => {
    setEditing(item);
    setFormState({
      member: item.member,
      credit_owner: item.credit_owner ?? undefined,
      value_cents: item.value_cents,
      date: item.date,
      payment_status: item.payment_status,
      payment_mode: item.payment_mode ?? "PIX",
      use_package: !!item.package,
      package: item.package ?? undefined,
    });
    setValueReais(formatCentsInput(item.value_cents));
    setDateValue(parseIsoAsLocalDate(item.date));
    modalHandlers.open();
  };

  useEffect(() => {
    if (processedNovoRef.current) return;
    if (!isAuthenticated) return;
    if (searchParams.get("novo") === "1") {
      processedNovoRef.current = true;
      openNew();
      const next = new URLSearchParams(searchParams);
      next.delete("novo");
      setSearchParams(next, { replace: true });
    }
  }, [isAuthenticated, searchParams, setSearchParams, openNew]);

  const lunches = data?.results ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  useEffect(() => {
    setPage(1);
  }, [
    filters.member,
    filters.payment_status,
    filters.has_package,
    filters.value,
    filters.date_from,
    filters.date_to,
  ]);

  useEffect(() => {
    setValueInput(filters.value);
  }, [filters.value]);

  useEffect(() => {
    if (!data) return;
    setPage((prev) => Math.min(prev, totalPages));
  }, [data, totalPages]);

  if (!isAuthenticated) {
    return (
      <Container size="xl" py="md">
        <Group mb="md">
          <IconSoup size={20} />
          <Title order={3}>Almoços</Title>
        </Group>
        <Text mb="sm">Autenticação necessária para visualizar e gerenciar almoços.</Text>
        <Button component={Link} to="/login">
          Ir para login
        </Button>
      </Container>
    );
  }

  if (isLoading || membersQuery.isLoading || creditOwnersQuery.isLoading) return <Text>Carregando...</Text>;
  if (isError || !data || membersQuery.isError || !membersQuery.data || creditOwnersQuery.isError)
    return <Text c="red">Erro ao carregar almoços.</Text>;

  const canMarkPaid = (lunch: Lunch) => lunch.payment_status !== "PAGO";
  const isFilterActive =
    !!filters.member ||
    !!filters.payment_status ||
    filters.has_package !== null ||
    !!filters.value ||
    !!filters.date_from ||
    !!filters.date_to;

  const members = membersQuery.data ?? [];
  const memberOptions = members.map((m: MemberOption) => ({
    value: m.id.toString(),
    label: m.full_name,
  }));
  const creditOwnerResults = creditOwnersQuery.data?.results ?? [];
  const creditOwnerBalanceById = new Map(
    creditOwnerResults.map((summary) => [summary.owner, summary.balance_cents])
  );
  const creditOwnerOptions = creditOwnerResults.map((summary) => ({
    value: summary.owner.toString(),
    label: `${summary.owner_name} • ${formatCents(summary.balance_cents)}`,
  }));
  const selectedCreditOwner =
    formState.credit_owner != null
      ? members.find((member) => member.id === formState.credit_owner)
      : undefined;
  const creditOwnerOptionsForForm =
    selectedCreditOwner &&
    !creditOwnerOptions.some((option) => option.value === selectedCreditOwner.id.toString())
        ? [
          ...creditOwnerOptions,
          {
            value: selectedCreditOwner.id.toString(),
            label: `${selectedCreditOwner.full_name} • ${formatCents(
              creditOwnerBalanceById.get(selectedCreditOwner.id) ?? 0
            )}`,
          },
        ]
      : creditOwnerOptions;
  const packageMembers = members.filter((m) => m.has_package);
  const memberOptionsForForm = formState.use_package ? packageMembers : members;
  const memberOptionsSelect = memberOptionsForForm.map((m: MemberOption) => ({
    value: m.id.toString(),
    label: m.full_name,
  }));

  const clearFilters = () =>
    setFilters({
      member: null,
      payment_status: null,
      has_package: null,
      value: "",
      date_from: null,
      date_to: null,
    });

  return (
    <Container size="xl" py="md">
      <style>{actionResponsiveStyles}</style>
      <Group mb="md">
        <IconSoup size={20} />
        <Title order={3}>Almoços</Title>
        <Group ml="auto">
          <Button
            component="a"
            href={`${API_BASE_URL}/api/lunch/lunches/export/`}
            target="_blank"
            rel="noreferrer"
            variant="outline"
          >
            Exportar
          </Button>
          <Button onClick={openNew} leftSection={<IconPlus size={16} />}>
            Novo
          </Button>
        </Group>
      </Group>
      {isFilterActive && (
        <Box mb="md">
          <SummaryCard
            title="Valor total recebido"
            value={formatCents(summary?.received_cents ?? 0)}
            subtitle={`Quantidade: ${summary?.count ?? 0} almoço(s) | Valor em aberto: ${formatCents(summary?.open_cents ?? 0)}`}
            icon={<IconSoup size={20} />}
          />
        </Box>
      )}
      <Group gap="sm" align="flex-end" mb="md">
        <Select
          label="Integrante"
          data={memberOptions}
          searchable
          filter={accentInsensitiveOptionsFilter}
          clearable
          value={filters.member}
          onChange={(val) => setFilters((prev) => ({ ...prev, member: val }))}
        />
        <Select
          label="Pagamento"
          data={[
            { value: "PAGO", label: "Pago" },
            { value: "EM_ABERTO", label: "Em aberto" },
          ]}
          clearable
          value={filters.payment_status}
          onChange={(val) => setFilters((prev) => ({ ...prev, payment_status: val }))}
        />
        <Select
          label="Tipo"
          data={[
            { value: "PACOTE", label: "Pacote" },
            { value: "AVULSO", label: "Avulso" },
          ]}
          clearable
          value={filters.has_package === null ? null : filters.has_package ? "PACOTE" : "AVULSO"}
          onChange={(val) =>
            setFilters((prev) => ({
              ...prev,
              has_package: val === "PACOTE" ? true : val === "AVULSO" ? false : null,
            }))
          }
        />
        <TextInput
          label="Valor (R$)"
          value={valueInput}
          onChange={(e) => setValueInput(e.currentTarget.value)}
          onBlur={() => setFilters((prev) => ({ ...prev, value: valueInput.trim() }))}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              setFilters((prev) => ({ ...prev, value: valueInput.trim() }));
            }
          }}
          placeholder="Ex: 28,00"
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
              <Table.Th style={{ minWidth: 160 }}>Integrante</Table.Th>
              <Table.Th style={{ minWidth: 120 }}>Status</Table.Th>
              <Table.Th style={{ minWidth: 120 }}>Pagamento</Table.Th>
              <Table.Th style={{ minWidth: 110 }} ta="right">
                Valor
              </Table.Th>
              <Table.Th style={{ minWidth: 160 }} ta="right">
                Ações
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {lunches.map((item) => (
              <Table.Tr key={item.id}>
                <Table.Td>{formatPtDate(item.date)}</Table.Td>
                <Table.Td>
                  <Badge color={item.package ? "grape" : "blue"}>
                    {item.package ? "Pacote" : "Avulso"}
                  </Badge>
                </Table.Td>
                <Table.Td>{item.member_name || `#${item.member}`}</Table.Td>
                <Table.Td>
                  <Badge color={item.payment_status === "PAGO" ? "green" : "orange"}>
                    {paymentLabels[item.payment_status] || item.payment_status}
                  </Badge>
                </Table.Td>
                <Table.Td>{paymentModeLabels[item.payment_mode || ""] || "-"}</Table.Td>
                <Table.Td ta="right">{formatCents(item.value_cents)}</Table.Td>
                <Table.Td ta="right">
                  <div className="lunch-actions">
                    <div className="lunch-actions-block" style={{ justifyContent: "flex-end" }}>
                      {canMarkPaid(item) && (
                        <Tooltip label="Marcar pago">
                          <Button
                            size="xs"
                            variant="light"
                            loading={mutation.isPending && mutation.variables === item.id}
                            onClick={() => mutation.mutate(item.id)}
                            leftSection={<IconCheck size={16} />}
                            aria-label="Marcar pago"
                          >
                            PG
                          </Button>
                        </Tooltip>
                      )}
                      <Tooltip label="Editar">
                        <Button size="xs" variant="subtle" onClick={() => openEdit(item)} aria-label="Editar">
                          <IconPencil size={16} />
                        </Button>
                      </Tooltip>
                      <Tooltip label="Remover">
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
                      </Tooltip>
                    </div>
                  </div>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
      {totalCount > 0 && (
        <Group justify="center" mt="md">
          <Pagination total={totalPages} value={page} onChange={setPage} size="sm" />
        </Group>
      )}
      <Modal
        opened={modalOpened}
        onClose={modalHandlers.close}
        title={editing ? "Editar almoço" : "Novo almoço"}
      >
        <div className="flex flex-col gap-3">
            <Switch
              label="Usar pacote"
              checked={!!formState.use_package}
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  use_package: e.currentTarget.checked,
                  member: e.currentTarget.checked ? undefined : prev.member,
                  credit_owner: e.currentTarget.checked ? undefined : prev.credit_owner,
                  payment_mode: e.currentTarget.checked ? "PIX" : prev.payment_mode,
                  payment_status: e.currentTarget.checked ? "PAGO" : prev.payment_status,
                }))
              }
            />
          <Select
            label="Integrante"
            data={memberOptionsSelect}
            searchable
            filter={accentInsensitiveOptionsFilter}
            nothingFoundMessage={formState.use_package ? "Nenhum integrante com pacote" : "Nenhum integrante"}
            value={formState.member ? formState.member.toString() : null}
            onChange={(val) => setFormState((prev) => ({ ...prev, member: val ? Number(val) : undefined }))}
          />
          <TextInput
            label="Valor (R$)"
            value={valueReais}
            onChange={(e) => setValueReais(e.currentTarget.value)}
            placeholder="Ex: 35,00"
            disabled={!!formState.use_package}
          />
          <DateInput
            label="Data"
            value={dateValue}
            onChange={(val) => setDateValue(val ?? null)}
            valueFormat="DD/MM/YYYY"
            locale="pt-br"
          />
          <Select
            label="Status de pagamento"
            data={[
              { value: "PAGO", label: "Pago" },
              { value: "EM_ABERTO", label: "Em aberto" },
            ]}
            value={formState.payment_status}
            disabled={!!formState.use_package || usingCredit}
            onChange={(val) => setFormState((prev) => ({ ...prev, payment_status: val || "EM_ABERTO" }))}
          />
          <Select
            label="Modo de pagamento"
            data={[
              { value: "PIX", label: "Pix" },
              { value: "CARTAO", label: "Cartão" },
              { value: "DINHEIRO", label: "Dinheiro" },
              { value: "TROCA", label: "Troca" },
            ]}
            value={formState.payment_mode}
            disabled={!!formState.use_package}
            onChange={(val) =>
              setFormState((prev) => ({
                ...prev,
                payment_mode: val || "PIX",
                payment_status: val === "TROCA" ? "PAGO" : prev.payment_status,
                credit_owner: val === "TROCA" ? prev.credit_owner : undefined,
              }))
            }
          />
          {usingCredit && (
            <Select
              label="Banco de trocas de"
              data={creditOwnerOptionsForForm}
              searchable
              filter={accentInsensitiveOptionsFilter}
              nothingFoundMessage="Nenhum integrante com trocas disponíveis"
              value={formState.credit_owner ? formState.credit_owner.toString() : null}
              onChange={(val) =>
                setFormState((prev) => ({
                  ...prev,
                  credit_owner: val ? Number(val) : undefined,
                }))
              }
            />
          )}
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
