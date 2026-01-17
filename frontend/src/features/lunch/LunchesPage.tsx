import {
  Badge,
  Button,
  Container,
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
import { useAuth } from "../../context/AuthContext";
import { extractErrorMessage } from "../../shared/errors";
import "dayjs/locale/pt-br";
import {
  createLunch,
  deleteLunch,
  fetchLunches,
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
};

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
    date_from: DateValue;
    date_to: DateValue;
  }>({
    member: null,
    payment_status: null,
    has_package: null,
    date_from: null,
    date_to: null,
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const processedNovoRef = useRef(false);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "lunches",
      filters.member,
      filters.payment_status,
      filters.has_package,
      toIsoDate(filters.date_from) ?? null,
      toIsoDate(filters.date_to) ?? null,
    ],
    queryFn: () =>
      fetchLunches({
        member: filters.member ? Number(filters.member) : undefined,
        payment_status: filters.payment_status || undefined,
        has_package:
          filters.has_package === null ? undefined : filters.has_package ? "true" : "false",
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

  const handleSubmit = () => {
    if (!formState.member || !dateValue) {
      notifications.show({ message: "Preencha integrante e data.", color: "red" });
      return;
    }
    const parsedValue = valueReais
      ? parseFloat(valueReais.replace(/\./g, "").replace(",", "."))
      : 0;
    const dateIso = toIsoDate(dateValue) || "";

    const payload: Partial<Lunch> & { use_package?: boolean } = {
      ...formState,
      value_cents: Number.isNaN(parsedValue) ? 0 : Math.round(parsedValue * 100),
      date: dateIso,
      use_package: formState.use_package ? true : undefined,
      package: formState.use_package ? formState.package : null,
      payment_status: formState.use_package ? "PAGO" : formState.payment_status,
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
      value_cents: item.value_cents,
      date: item.date,
      payment_status: item.payment_status,
      payment_mode: item.payment_mode ?? "PIX",
      use_package: !!item.package,
      package: item.package ?? undefined,
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

  const dataLength = data?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(dataLength / pageSize));

  useEffect(() => {
    setPage(1);
  }, [filters.member, filters.payment_status, filters.has_package, filters.date_from, filters.date_to, dataLength]);

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

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

  if (isLoading || membersQuery.isLoading) return <Text>Carregando...</Text>;
  if (isError || !data || membersQuery.isError || !membersQuery.data)
    return <Text c="red">Erro ao carregar almoços.</Text>;

  const formatCents = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const canMarkPaid = (lunch: Lunch) => lunch.payment_status !== "PAGO";

  const members = membersQuery.data ?? [];
  const memberOptions = members.map((m: MemberOption) => ({
    value: m.id.toString(),
    label: m.full_name,
  }));
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
      date_from: null,
      date_to: null,
    });

  return (
    <Container size="xl" py="md">
      <style>{actionResponsiveStyles}</style>
      <Group mb="md">
        <IconSoup size={20} />
        <Title order={3}>Almoços</Title>
        <Button onClick={openNew} leftSection={<IconPlus size={16} />} ml="auto">
          Novo
        </Button>
      </Group>
      <Group gap="sm" align="flex-end" mb="md">
        <Select
          label="Integrante"
          data={memberOptions}
          searchable
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
            {data.slice((page - 1) * pageSize, page * pageSize).map((item) => (
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
      {data.length > 0 && (
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
                payment_status: e.currentTarget.checked ? "PAGO" : prev.payment_status,
              }))
            }
          />
          <Select
            label="Integrante"
            data={memberOptionsSelect}
            searchable
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
            disabled={!!formState.use_package}
            onChange={(val) => setFormState((prev) => ({ ...prev, payment_status: val || "EM_ABERTO" }))}
          />
          <Select
            label="Modo de pagamento"
            data={[
              { value: "PIX", label: "Pix" },
              { value: "CARTAO", label: "Cartão" },
              { value: "DINHEIRO", label: "Dinheiro" },
            ]}
            value={formState.payment_mode}
            disabled={!!formState.use_package}
            onChange={(val) => setFormState((prev) => ({ ...prev, payment_mode: val || "PIX" }))}
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
