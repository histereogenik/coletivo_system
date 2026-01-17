import {
  Badge,
  Button,
  Container,
  Group,
  Modal,
  NumberInput,
  ScrollArea,
  Select,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
  Pagination,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import type { DateValue } from "@mantine/dates";
import { IconPackage, IconPencil, IconTrash, IconPlus } from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { extractErrorMessage } from "../../shared/errors";
import "dayjs/locale/pt-br";
import {
  createPackage,
  deletePackage,
  fetchPackages,
  updatePackage,
  decrementPackage,
  incrementPackage,
  Package,
} from "./api";
import { fetchMembers, MemberOption } from "./membersApi";

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

const paymentLabels: Record<string, string> = {
  PAGO: "Pago",
  EM_ABERTO: "Em aberto",
};

const statusLabels: Record<string, string> = {
  VALIDO: "Válido",
  EXPIRADO: "Expirado",
};

export function PackagesPage() {
  const actionResponsiveStyles = `
    .package-actions {
        display: flex;
        flex-wrap: nowrap;
        gap: 8px;
        justify-content: flex-end;
        align-items: center;
        overflow-x: auto;
      }
    .package-actions .package-actions-block {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: nowrap;
      }
  `;
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpened, modalHandlers] = useDisclosure(false);
  const [editing, setEditing] = useState<Package | null>(null);
  const [formState, setFormState] = useState<Partial<Package>>({
    member: undefined,
    value_cents: 0,
    date: new Date().toISOString().slice(0, 10),
    payment_status: "EM_ABERTO",
    payment_mode: "PIX",
    quantity: 1,
    remaining_quantity: undefined,
    expiration: new Date().toISOString().slice(0, 10),
    status: "VALIDO",
  });
  const [valueReais, setValueReais] = useState<string>("");
  const [dateValue, setDateValue] = useState<DateValue>(new Date());
  const [expirationValue, setExpirationValue] = useState<DateValue>(new Date());
  const [filters, setFilters] = useState<{
    member: string | null;
    payment_status: string | null;
    status: string | null;
    date_from: DateValue;
    date_to: DateValue;
  }>({
    member: null,
    payment_status: null,
    status: null,
    date_from: null,
    date_to: null,
  });
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "packages",
      filters.member,
      filters.payment_status,
      filters.status,
      toIsoDate(filters.date_from) ?? null,
      toIsoDate(filters.date_to) ?? null,
    ],
    queryFn: () =>
      fetchPackages({
        member: filters.member ? Number(filters.member) : undefined,
        payment_status: filters.payment_status || undefined,
        status: filters.status || undefined,
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

  const createMutation = useMutation({
    mutationFn: (payload: Partial<Package>) => createPackage(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      notifications.show({ message: "Pacote criado.", color: "green" });
      modalHandlers.close();
    },
    onError: (err: unknown) =>
      notifications.show({ message: extractErrorMessage(err, "Erro ao criar pacote."), color: "red" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Package> }) => updatePackage(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      notifications.show({ message: "Pacote atualizado.", color: "green" });
      modalHandlers.close();
    },
    onError: (err: unknown) =>
      notifications.show({ message: extractErrorMessage(err, "Erro ao atualizar pacote."), color: "red" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deletePackage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      notifications.show({ message: "Pacote removido.", color: "green" });
    },
    onError: (err: unknown) =>
      notifications.show({ message: extractErrorMessage(err, "Erro ao remover pacote."), color: "red" }),
  });

  const decrementMutation = useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) => decrementPackage(id, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      notifications.show({ message: "Pacote atualizado.", color: "green" });
    },
    onError: (err: unknown) => {
      const msg = extractErrorMessage(err, "Erro ao atualizar pacote.");
      notifications.show({ message: msg, color: "red" });
    },
  });

  const incrementMutation = useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) => incrementPackage(id, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      notifications.show({ message: "Pacote ajustado.", color: "green" });
    },
    onError: (err: unknown) => {
      const msg = extractErrorMessage(err, "Erro ao ajustar pacote.");
      notifications.show({ message: msg, color: "red" });
    },
  });

  const handleSubmit = () => {
    if (!formState.member || !dateValue || !expirationValue) {
      notifications.show({ message: "Preencha integrante, data e validade.", color: "red" });
      return;
    }
    const parsedValue = valueReais
      ? parseFloat(valueReais.replace(/\./g, "").replace(",", "."))
      : 0;
    const dateIso = toIsoDate(dateValue) || "";
    const expirationIso = toIsoDate(expirationValue) || "";

    const payload: Partial<Package> = {
      ...formState,
      value_cents: Number.isNaN(parsedValue) ? 0 : Math.round(parsedValue * 100),
      date: dateIso,
      expiration: expirationIso,
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
      quantity: 1,
      remaining_quantity: undefined,
      expiration: new Date().toISOString().slice(0, 10),
      status: "VALIDO",
    });
    setValueReais("");
    setDateValue(new Date());
    setExpirationValue(new Date());
    modalHandlers.open();
  }, [modalHandlers]);

  const openEdit = (item: Package) => {
    setEditing(item);
    setFormState({
      ...item,
      member: item.member,
      payment_mode: item.payment_mode ?? "PIX",
    });
    setValueReais(
      (item.value_cents / 100).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
    setDateValue(parseIsoAsLocalDate(item.date));
    setExpirationValue(parseIsoAsLocalDate(item.expiration));
    modalHandlers.open();
  };

  const members = membersQuery.data ?? [];
  const memberOptions = members.map((m: MemberOption) => ({
    value: m.id.toString(),
    label: m.full_name,
  }));

  const dataLength = data?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(dataLength / pageSize));

  useEffect(() => {
    setPage(1);
  }, [filters.member, filters.payment_status, filters.status, filters.date_from, filters.date_to, dataLength]);

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const clearFilters = () =>
    setFilters({
      member: null,
      payment_status: null,
      status: null,
      date_from: null,
      date_to: null,
    });

  if (!isAuthenticated) {
    return (
      <Container size="xl" py="md">
        <Group mb="md">
          <IconPackage size={20} />
          <Title order={3}>Pacotes</Title>
        </Group>
        <Text mb="sm">Autenticação necessária para visualizar e gerenciar pacotes.</Text>
        <Button component={Link} to="/login">
          Ir para login
        </Button>
      </Container>
    );
  }

  if (isLoading || membersQuery.isLoading) return <Text>Carregando...</Text>;
  if (isError || !data || membersQuery.isError || !membersQuery.data)
    return <Text c="red">Erro ao carregar pacotes.</Text>;

  const formatCents = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Container size="xl" py="md">
      <style>{actionResponsiveStyles}</style>
      <Group mb="md">
        <IconPackage size={20} />
        <Title order={3}>Pacotes</Title>
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
          label="Status"
          data={[
            { value: "VALIDO", label: "Válido" },
            { value: "EXPIRADO", label: "Expirado" },
          ]}
          clearable
          value={filters.status}
          onChange={(val) => setFilters((prev) => ({ ...prev, status: val }))}
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
              <Table.Th style={{ minWidth: 110 }}>Compra</Table.Th>
              <Table.Th style={{ minWidth: 160 }}>Integrante</Table.Th>
              <Table.Th style={{ minWidth: 120 }}>Status</Table.Th>
              <Table.Th style={{ minWidth: 120 }}>Pagamento</Table.Th>
              <Table.Th style={{ minWidth: 120 }}>Validade</Table.Th>
              <Table.Th style={{ minWidth: 140 }} ta="right">
                Quantidade
              </Table.Th>
              <Table.Th style={{ minWidth: 110 }} ta="right">
                Valor
              </Table.Th>
              <Table.Th style={{ minWidth: 200 }} ta="right">
                Ações
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.slice((page - 1) * pageSize, page * pageSize).map((item) => (
              <Table.Tr key={item.id}>
                <Table.Td>{formatPtDate(item.date)}</Table.Td>
                <Table.Td>{item.member_name || `#${item.member}`}</Table.Td>
                <Table.Td>
                  <Badge color={item.status === "VALIDO" ? "green" : "red"}>
                    {statusLabels[item.status] || item.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge color={item.payment_status === "PAGO" ? "green" : "orange"}>
                    {paymentLabels[item.payment_status] || item.payment_status}
                  </Badge>
                </Table.Td>
                <Table.Td>{formatPtDate(item.expiration)}</Table.Td>
                <Table.Td ta="right">
                  {item.remaining_quantity}/{item.quantity}
                </Table.Td>
                <Table.Td ta="right">{formatCents(item.value_cents)}</Table.Td>
                <Table.Td ta="right">
                  <div className="package-actions">
                    <div className="package-actions-block">
                      <Button
                        size="xs"
                        variant="light"
                        color="orange"
                        onClick={() => decrementMutation.mutate({ id: item.id, amount: 1 })}
                        loading={decrementMutation.isPending}
                        aria-label="Deduzir 1"
                      >
                        -1
                      </Button>
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() => incrementMutation.mutate({ id: item.id, amount: 1 })}
                        loading={incrementMutation.isPending}
                        aria-label="Adicionar 1"
                      >
                        +1
                      </Button>
                    </div>
                    <div className="package-actions-block" style={{ justifyContent: "flex-end" }}>
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
        title={editing ? "Editar pacote" : "Novo pacote"}
      >
        <div className="flex flex-col gap-3">
          <Select
            label="Integrante"
            data={memberOptions}
            searchable
            nothingFoundMessage="Nenhum integrante"
            value={formState.member ? formState.member.toString() : null}
            onChange={(val) => setFormState((prev) => ({ ...prev, member: val ? Number(val) : undefined }))}
          />
          <TextInput
            label="Valor (R$)"
            value={valueReais}
            onChange={(e) => setValueReais(e.currentTarget.value)}
            placeholder="Ex: 120,00"
          />
          <DateInput
            label="Data da compra"
            value={dateValue}
            onChange={(val) => setDateValue(val ?? null)}
            valueFormat="DD/MM/YYYY"
            locale="pt-br"
          />
          <NumberInput
            label="Quantidade"
            value={formState.quantity ?? undefined}
            onChange={(val) => setFormState((prev) => ({ ...prev, quantity: Number(val) || undefined }))}
            min={1}
          />
          <DateInput
            label="Validade"
            value={expirationValue}
            onChange={(val) => setExpirationValue(val ?? null)}
            valueFormat="DD/MM/YYYY"
            locale="pt-br"
          />
          <Select
            label="Status"
            data={[
              { value: "VALIDO", label: "Válido" },
              { value: "EXPIRADO", label: "Expirado" },
            ]}
            value={formState.status ?? undefined}
            onChange={(val) => setFormState((prev) => ({ ...prev, status: val || "VALIDO" }))}
          />
          <Select
            label="Status de pagamento"
            data={[
              { value: "PAGO", label: "Pago" },
              { value: "EM_ABERTO", label: "Em aberto" },
            ]}
            value={formState.payment_status}
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

