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
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import type { DateValue } from "@mantine/dates";
import { IconSoup } from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "dayjs/locale/pt-br";
import { createLunch, deleteLunch, fetchLunches, markLunchPaid, updateLunch, Lunch } from "./api";
import { fetchMembers, MemberOption } from "./membersApi";

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
  const [valueReais, setValueReais] = useState<string>("0");
  const [dateValue, setDateValue] = useState<DateValue>(new Date());

  const { data, isLoading, isError } = useQuery({
    queryKey: ["lunches"],
    queryFn: () => fetchLunches(),
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
      notifications.show({ message: "Pagamento marcado.", color: "green" });
    },
    onError: () => notifications.show({ message: "Erro ao marcar pago.", color: "red" }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: Partial<Lunch>) => createLunch(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lunches"] });
      notifications.show({ message: "Almoço criado.", color: "green" });
      modalHandlers.close();
    },
    onError: () => notifications.show({ message: "Erro ao criar almoço.", color: "red" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Lunch> }) => updateLunch(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lunches"] });
      notifications.show({ message: "Almoço atualizado.", color: "green" });
      modalHandlers.close();
    },
    onError: () => notifications.show({ message: "Erro ao atualizar almoço.", color: "red" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteLunch(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lunches"] });
      notifications.show({ message: "Almoço removido.", color: "green" });
    },
    onError: () => notifications.show({ message: "Erro ao remover almoço.", color: "red" }),
  });

  const handleSubmit = () => {
    if (!formState.member || !valueReais || !dateValue || !formState.lunch_type) {
      notifications.show({ message: "Preencha membro, valor, data e tipo.", color: "red" });
      return;
    }
    const parsedValue = parseFloat(valueReais.replace(/\./g, "").replace(",", "."));
    const dateIso = dateValue ? new Date(dateValue as Date).toISOString().slice(0, 10) : "";
    const payload: Partial<Lunch> = {
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
      member: undefined,
      value_cents: 0,
      date: new Date().toISOString().slice(0, 10),
      lunch_type: "AVULSO",
      payment_status: "EM_ABERTO",
      quantity: undefined,
      package_expiration: undefined,
      package_status: undefined,
    });
    setValueReais("0");
    setDateValue(new Date());
    modalHandlers.open();
  };

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
    setValueReais((item.value_cents / 100).toString());
    setDateValue(item.date ? new Date(item.date) : null);
    modalHandlers.open();
  };

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

  return (
    <Container size="xl" py="md">
      <Group mb="md">
        <IconSoup size={20} />
        <Title order={3}>Almoços</Title>
        <Button onClick={openNew} ml="auto">
          Novo almoço
        </Button>
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
                  <Group gap="xs" justify="flex-end">
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
                    <Button size="xs" variant="subtle" onClick={() => openEdit(item)}>
                      Editar
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      color="red"
                      loading={deleteMutation.isPending && deleteMutation.variables === item.id}
                      onClick={() => deleteMutation.mutate(item.id)}
                    >
                      Remover
                    </Button>
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
            label="Membro"
            data={memberOptions}
            searchable
            nothingFoundMessage="Nenhum membro"
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
                value={formState.package_expiration ? new Date(formState.package_expiration) : null}
                onChange={(val) =>
                  setFormState((prev) => ({
                    ...prev,
                    package_expiration: val ? new Date(val).toISOString().slice(0, 10) : undefined,
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
