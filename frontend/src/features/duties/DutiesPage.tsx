import {
  Button,
  Container,
  Group,
  Modal,
  MultiSelect,
  Pagination,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconTools, IconPlus, IconPencil, IconTrash } from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { fetchMembers } from "../lunch/membersApi";
import { createDuty, deleteDuty, fetchDuties, updateDuty, type Duty } from "./api";

export function DutiesPage() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpened, modalHandlers] = useDisclosure(false);
  const [editing, setEditing] = useState<Duty | null>(null);
  const [formState, setFormState] = useState<Partial<Duty> & { member_ids?: number[] }>({
    name: "",
    remuneration_cents: 0,
    member_ids: [],
  });
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const dutiesQuery = useQuery({
    queryKey: ["duties"],
    queryFn: () => fetchDuties(),
    enabled: isAuthenticated,
  });

  const membersQuery = useQuery({
    queryKey: ["members-for-duties"],
    queryFn: () => fetchMembers(),
    enabled: isAuthenticated,
  });

  const invalidateDuties = () =>
    queryClient.invalidateQueries({
      predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "duties",
    });

  const createMutation = useMutation({
    mutationFn: (payload: Partial<Duty> & { member_ids?: number[] }) => createDuty(payload),
    onSuccess: () => {
      invalidateDuties();
      notifications.show({ message: "Função criada.", color: "green" });
      modalHandlers.close();
    },
    onError: (err: unknown) => {
      const data = (err as { response?: { data?: unknown } })?.response?.data;
      notifications.show({ message: data ? JSON.stringify(data) : "Erro ao criar função.", color: "red" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Duty> & { member_ids?: number[] } }) =>
      updateDuty(id, payload),
    onSuccess: () => {
      invalidateDuties();
      notifications.show({ message: "Função atualizada.", color: "green" });
      modalHandlers.close();
    },
    onError: (err: unknown) => {
      const data = (err as { response?: { data?: unknown } })?.response?.data;
      notifications.show({ message: data ? JSON.stringify(data) : "Erro ao atualizar função.", color: "red" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteDuty(id),
    onSuccess: () => {
      invalidateDuties();
      notifications.show({ message: "Função removida.", color: "green" });
    },
    onError: (err: unknown) => {
      const data = (err as { response?: { data?: unknown } })?.response?.data;
      notifications.show({ message: data ? JSON.stringify(data) : "Erro ao remover função.", color: "red" });
    },
  });

  const openNew = () => {
    setEditing(null);
    setFormState({
      name: "",
      remuneration_cents: 0,
      member_ids: [],
    });
    modalHandlers.open();
  };

  const openEdit = (duty: Duty) => {
    setEditing(duty);
    setFormState({
      name: duty.name,
      remuneration_cents: duty.remuneration_cents ?? 0,
      member_ids: duty.members?.map((m) => m.id) ?? [],
    });
    modalHandlers.open();
  };

  const handleSubmit = () => {
    if (!formState.name) {
      notifications.show({ message: "Preencha o nome da função.", color: "red" });
      return;
    }
    const payload = { ...formState, member_ids: formState.member_ids ?? [] };
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const duties = dutiesQuery.data ?? [];
  const dutiesLength = duties.length;
  const totalPages = Math.max(1, Math.ceil(dutiesLength / pageSize));

  useEffect(() => {
    setPage(1);
  }, [dutiesLength]);

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const visibleDuties = duties.slice((page - 1) * pageSize, page * pageSize);


  if (!isAuthenticated) {
    return (
      <Container size="xl" py="md">
        <Group mb="md">
          <IconTools size={20} />
          <Title order={3}>Funções</Title>
        </Group>
        <Text mb="sm">Autenticação necessária para visualizar e gerenciar funções.</Text>
        <Button component={Link} to="/login">
          Ir para login
        </Button>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      <Group mb="md" justify="space-between">
        <Group>
          <IconTools size={20} />
          <Title order={3}>Funções</Title>
        </Group>
        <Button onClick={openNew} leftSection={<IconPlus size={16} />}>
          Nova
        </Button>
      </Group>

      {dutiesQuery.isLoading && <Text size="sm">Carregando...</Text>}
      {dutiesQuery.isError && <Text c="red">Erro ao carregar funções.</Text>}

      <Table highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ minWidth: 180 }}>Nome</Table.Th>
            <Table.Th style={{ minWidth: 140 }}>Remuneração</Table.Th>
            <Table.Th style={{ minWidth: 180 }}>Integrantes</Table.Th>
            <Table.Th style={{ minWidth: 140 }} ta="right">
              Ações
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {visibleDuties.map((duty) => (
            <Table.Tr key={duty.id}>
              <Table.Td>{duty.name}</Table.Td>
              <Table.Td>
                {((duty.remuneration_cents ?? 0) / 100).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </Table.Td>
              <Table.Td>
                {duty.members && duty.members.length > 0
                  ? duty.members.map((m) => m.full_name).join(", ")
                  : "—"}
              </Table.Td>
              <Table.Td ta="right">
                <Group gap="xs" justify="flex-end">
                  <Button size="xs" variant="subtle" onClick={() => openEdit(duty)} aria-label="Editar">
                    <IconPencil size={16} />
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    color="red"
                    loading={deleteMutation.isPending && deleteMutation.variables === duty.id}
                    onClick={() => deleteMutation.mutate(duty.id)}
                    aria-label="Remover"
                  >
                    <IconTrash size={16} />
                  </Button>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {duties.length > 0 && (
        <Group justify="center" mt="md">
          <Pagination total={totalPages} value={page} onChange={setPage} size="sm" />
        </Group>
      )}

      <Modal opened={modalOpened} onClose={modalHandlers.close} title={editing ? "Editar função" : "Nova função"}>
        <div className="flex flex-col gap-3">
          <TextInput
            label="Nome"
            value={formState.name ?? ""}
            onChange={(e) => setFormState((prev) => ({ ...prev, name: e.currentTarget.value }))}
          />
          <TextInput
            label="Remuneração (R$)"
            value={((formState.remuneration_cents ?? 0) / 100).toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
            onChange={(e) => {
              const parsed = parseFloat(e.currentTarget.value.replace(/\./g, "").replace(",", "."));
              setFormState((prev) => ({
                ...prev,
                remuneration_cents: Number.isNaN(parsed) ? 0 : Math.round(parsed * 100),
              }));
            }}
            placeholder="Opcional"
          />
          <MultiSelect
            label="Integrantes"
            data={(membersQuery.data || []).map((m) => ({ value: m.id.toString(), label: m.full_name }))}
            value={(formState.member_ids || []).map((id) => id.toString())}
            onChange={(vals) => setFormState((prev) => ({ ...prev, member_ids: vals.map((v) => Number(v)) }))}
            searchable
            placeholder="Selecione integrantes"
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
