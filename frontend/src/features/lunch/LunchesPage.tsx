import {
  Badge,
  Button,
  Container,
  Group,
  Modal,
  NumberInput,
  Select,
  ScrollArea,
  Table,
  Text,
  Title,
  TextInput,
  Tooltip,
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
import "dayjs/locale/pt-br";
import { createLunch, deleteLunch, fetchLunches, markLunchPaid, updateLunch, Lunch } from "./api";
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

const typeLabels: Record<string, string> = {
  AVULSO: "Avulso",
  PACOTE: "Pacote",
};

export function LunchesPage() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpened, modalHandlers] = useDisclosure(false);
  const [editing, setEditing] = useState<Lunch | null>(null);
  const [formState, setFormState] = useState<Partial<Lunch>>({
    member: undefined,
    value_cents: 0,
    date: new Date().toISOString().slice(0, 10),
    lunch_type: "AVULSO",
    payment_status: "EM_ABERTO",
  });
  const [valueReais, setValueReais] = useState<string>("");
  const [dateValue, setDateValue] = useState<DateValue>(new Date());
  const [filters, setFilters] = useState<{
    member: string | null;
    payment_status: string | null;
    lunch_type: string | null;
    date_from: DateValue;
    date_to: DateValue;
  }>({
    member: null,
    payment_status: null,
    lunch_type: null,
    date_from: null,
    date_to: null,
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const processedNovoRef = useRef(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "lunches",
      filters.member,
      filters.payment_status,
      filters.lunch_type,
      toIsoDate(filters.date_from) ?? null,
      toIsoDate(filters.date_to) ?? null,
    ],
    queryFn: () =>
      fetchLunches({
        member: filters.member ? Number(filters.member) : undefined,
        payment_status: filters.payment_status || undefined,
        lunch_type: filters.lunch_type || undefined,
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
    mutationFn: (payload: Partial<Lunch>) => createLunch(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lunches"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["financial"] });
      notifications.show({ message: "Almoço criado.", color: "green" });
      modalHandlers.close();
    },
    onError: () => notifications.show({ message: "Erro ao criar almoço.", color: "red" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Lunch> }) => updateLunch(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lunches"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["financial"] });
      notifications.show({ message: "Almoço atualizado.", color: "green" });
      modalHandlers.close();
    },
    onError: () => notifications.show({ message: "Erro ao atualizar almoço.", color: "red" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteLunch(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lunches"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["financial"] });
      notifications.show({ message: "Almoço removido.", color: "green" });
    },
    onError: () => notifications.show({ message: "Erro ao remover almoço.", color: "red" }),
  });

  const handleSubmit = () => {
    if (!formState.member || !valueReais || !dateValue || !formState.lunch_type) {
      notifications.show({ message: "Preencha integrante, valor, data e tipo.", color: "red" });
      return;
    }
    const parsedValue = parseFloat(valueReais.replace(/\./g, "").replace(",", "."));
    const dateIso = toIsoDate(dateValue) || "";
    const packageExpirationIso =
      formState.package_expiration ||
      (formState.lunch_type === "PACOTE" ? toIsoDate(formState.package_expiration as DateValue) : undefined);
    if (formState.lunch_type === "PACOTE") {
      if (!packageExpirationIso) {
        notifications.show({ message: "Informe a validade do pacote.", color: "red" });
        return;
      }
      const baseDate = parseIsoAsLocalDate(dateIso);
      const expDate = parseIsoAsLocalDate(packageExpirationIso);
      if (baseDate && expDate && expDate < baseDate) {
        notifications.show({ message: "Validade do pacote não pode ser anterior à data do almoço.", color: "red" });
        return;
      }
    }
    const payload: Partial<Lunch> = {
      ...formState,
      value_cents: Number.isNaN(parsedValue) ? 0 : Math.round(parsedValue * 100),
      date: dateIso,
      package_expiration: packageExpirationIso ?? formState.package_expiration,
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
      lunch_type: "AVULSO",
      payment_status: "EM_ABERTO",
      quantity: undefined,
      package_expiration: undefined,
      package_status: undefined,
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
      lunch_type: item.lunch_type,
      payment_status: item.payment_status,
      quantity: item.quantity ?? undefined,
      package_expiration: item.package_expiration ?? undefined,
      package_status: item.package_status ?? undefined,
    });
    setValueReais((item.value_cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
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

  const memberOptions = membersQuery.data.map((m: MemberOption) => ({
    value: m.id.toString(),
    label: m.full_name,
  }));

  const clearFilters = () =>
    setFilters({
      member: null,
      payment_status: null,
      lunch_type: null,
      date_from: null,
      date_to: null,
    });

  return (
    <Container size="xl" py="md">
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
            { value: "AVULSO", label: "Avulso" },
            { value: "PACOTE", label: "Pacote" },
          ]}
          clearable
          value={filters.lunch_type}
          onChange={(val) => setFilters((prev) => ({ ...prev, lunch_type: val }))}
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
              <Table.Th>Data</Table.Th>
              <Table.Th>Tipo</Table.Th>
              <Table.Th>Integrante</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th ta="right">Valor</Table.Th>
              <Table.Th ta="right">Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.map((item) => (
              <Table.Tr key={item.id}>
                <Table.Td>{formatPtDate(item.date)}</Table.Td>
                <Table.Td>
                  <Badge color={item.lunch_type === "PACOTE" ? "grape" : "blue"}>
                    {typeLabels[item.lunch_type] || item.lunch_type}
                  </Badge>
                </Table.Td>
                <Table.Td>{item.member_name || `#${item.member}`}</Table.Td>
                <Table.Td>
                  <Badge color={item.payment_status === "PAGO" ? "green" : "orange"}>
                    {paymentLabels[item.payment_status] || item.payment_status}
                  </Badge>
                </Table.Td>
                <Table.Td ta="right">{formatCents(item.value_cents)}</Table.Td>
                <Table.Td ta="right">
                  <Group gap="xs" justify="flex-end">
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
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
      <Modal
        opened={modalOpened}
        onClose={modalHandlers.close}
        title={editing ? "Editar almoço" : "Novo almoço"}
      >
        <div className="flex flex-col gap-3">
          <Select
            label="Integrante"
            data={memberOptions}
            searchable
            nothingFoundMessage="Nenhum Integrante"
            value={formState.member ? formState.member.toString() : null}
            onChange={(val) => setFormState((prev) => ({ ...prev, member: val ? Number(val) : undefined }))}
          />
          <TextInput
            label="Valor (R$)"
            value={valueReais}
            onChange={(e) => setValueReais(e.currentTarget.value)}
            placeholder="Ex: 35,00"
          />
          <DateInput
            label="Data"
            value={dateValue}
            onChange={(val) => setDateValue(val ?? null)}
            valueFormat="DD/MM/YYYY"
            locale="pt-br"
          />
          <Select
            label="Tipo"
            data={[
              { value: "AVULSO", label: "Avulso" },
              { value: "PACOTE", label: "Pacote" },
            ]}
            value={formState.lunch_type}
            onChange={(val) => setFormState((prev) => ({ ...prev, lunch_type: val || "AVULSO" }))}
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
          {formState.lunch_type === "PACOTE" && (
            <>
              <NumberInput
                label="Quantidade (pacote)"
                value={formState.quantity ?? undefined}
                onChange={(val) =>
                  setFormState((prev) => ({ ...prev, quantity: Number(val) || undefined }))
                }
              />
              <DateInput
                label="Validade do pacote"
                value={formState.package_expiration ? parseIsoAsLocalDate(formState.package_expiration) : null}
                onChange={(val) =>
                  setFormState((prev) => ({
                    ...prev,
                    package_expiration: val ? toIsoDate(val) : undefined,
                  }))
                }
                valueFormat="DD/MM/YYYY"
                locale="pt-br"
              />
              <Select
                label="Status do pacote"
                data={[
                  { value: "VALIDO", label: "Válido" },
                  { value: "EXPIRADO", label: "Expirado" },
                ]}
                value={formState.package_status ?? undefined}
                onChange={(val) =>
                  setFormState((prev) => ({ ...prev, package_status: val || undefined }))
                }
              />
            </>
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
