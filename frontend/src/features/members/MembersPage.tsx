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
  TextInput,
  Title,
} from "@mantine/core";
import { DateInput, type DateValue } from "@mantine/dates";
import { IconUsers, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { createMember, deleteMember, fetchMembers, updateMember, type Member } from "./api";

const roleLabels: Record<Member["role"], string> = {
  SUSTENTADOR: "Sustentador",
  MENSALISTA: "Mensalista",
  AVULSO: "Avulso",
};

const dietLabels: Record<Member["diet"], string> = {
  VEGANO: "Vegano",
  VEGETARIANO: "Vegetariano",
  CARNIVORO: "Carnívoro",
};

const formatPhone = (value: string) => {
  // Mantém apenas dígitos e o sinal de +
  const digits = value.replace(/[^\d+]/g, "");
  // Formata de forma simples para visualização (+CC DDDDD DDDD)
  const cleaned = digits.startsWith("+") ? digits.slice(1) : digits;
  const withPlus = digits.startsWith("+");
  const parts = [];
  if (cleaned.length > 0) parts.push(cleaned.slice(0, 2)); // código do país
  if (cleaned.length > 2) parts.push(cleaned.slice(2, 4)); // DDD (aprox)
  if (cleaned.length > 4) parts.push(cleaned.slice(4, 9)); // prefixo
  if (cleaned.length > 9) parts.push(cleaned.slice(9, 13)); // sufixo
  const formatted = parts.filter(Boolean).join(" ");
  return (withPlus ? "+" : "+") + formatted.trim();
};

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email.trim());

const normalizePhoneForSubmit = (value: string) => {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return "";
  return digits.startsWith("+") ? digits : `+${digits}`;
};

const toIsoDate = (val: DateValue) => {
  if (!val) return undefined;
  if (typeof val === "string") return val;
  return val.toLocaleDateString("en-CA");
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

export function MembersPage() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpened, modalHandlers] = useDisclosure(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [formState, setFormState] = useState<Partial<Member>>({
    full_name: "",
    phone: "",
    email: "",
    address: "",
    heard_about: "",
    role: "AVULSO",
    diet: "CARNIVORO",
    observations: "",
  });
  const [filters, setFilters] = useState<{
    role: Member["role"] | null;
    diet: Member["diet"] | null;
    created_from: DateValue;
    created_to: DateValue;
  }>({
    role: null,
    diet: null,
    created_from: null,
    created_to: null,
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "members",
      filters.role,
      filters.diet,
      toIsoDate(filters.created_from) ?? null,
      toIsoDate(filters.created_to) ?? null,
    ],
    queryFn: () =>
      fetchMembers({
        role: filters.role || undefined,
        diet: filters.diet || undefined,
        created_from: toIsoDate(filters.created_from),
        created_to: toIsoDate(filters.created_to),
      }),
    enabled: isAuthenticated,
  });

  const invalidateMembers = () =>
    queryClient.invalidateQueries({
      predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "members",
    });

  const createMutation = useMutation({
    mutationFn: (payload: Partial<Member>) => createMember(payload),
    onSuccess: () => {
      invalidateMembers();
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      notifications.show({ message: "Integrante criado.", color: "green" });
      modalHandlers.close();
    },
    onError: () => notifications.show({ message: "Erro ao criar integrante.", color: "red" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Member> }) =>
      updateMember(id, payload),
    onSuccess: () => {
      invalidateMembers();
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      notifications.show({ message: "Integrante atualizado.", color: "green" });
      modalHandlers.close();
    },
    onError: () => notifications.show({ message: "Erro ao atualizar integrante.", color: "red" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteMember(id),
    onSuccess: () => {
      invalidateMembers();
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      notifications.show({ message: "Integrante removido.", color: "green" });
    },
    onError: () => notifications.show({ message: "Erro ao remover integrante.", color: "red" }),
  });

  const handleSubmit = () => {
    if (!formState.full_name || !formState.phone || !formState.email) {
      notifications.show({ message: "Preencha nome, telefone e email.", color: "red" });
      return;
    }
    if (!isValidEmail(formState.email)) {
      notifications.show({ message: "Email inválido.", color: "red" });
      return;
    }
    const phoneNormalized = normalizePhoneForSubmit(formState.phone);
    if (!phoneNormalized.startsWith("+") || phoneNormalized.length < 10) {
      notifications.show({ message: "Telefone inválido. Use o formato internacional com código do país.", color: "red" });
      return;
    }
    const payload = { ...formState, phone: phoneNormalized };
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const openNew = () => {
    setEditing(null);
    setFormState({
      full_name: "",
      phone: "",
      email: "",
      address: "",
      heard_about: "",
      role: "AVULSO",
      diet: "CARNIVORO",
      observations: "",
    });
    modalHandlers.open();
  };

  const openEdit = (item: Member) => {
    setEditing(item);
    setFormState({ ...item });
    modalHandlers.open();
  };

  const clearFilters = () =>
    setFilters({
      role: null,
      diet: null,
      created_from: null,
      created_to: null,
    });

  if (!isAuthenticated) {
    return (
      <Container size="xl" py="md">
        <Group mb="md">
          <IconUsers size={20} />
          <Title order={3}>Integrantes</Title>
        </Group>
        <Text mb="sm">Autenticação necessária para visualizar e gerenciar integrantes.</Text>
        <Button component={Link} to="/login">
          Ir para login
        </Button>
      </Container>
    );
  }

  if (isLoading) return <Text>Carregando...</Text>;
  if (isError || !data) return <Text c="red">Erro ao carregar integrantes.</Text>;

  return (
    <Container size="xl" py="md">
      <Group mb="md">
        <IconUsers size={20} />
        <Title order={3}>Integrantes</Title>
        <Button onClick={openNew} leftSection={<IconPlus size={16} />} ml="auto">
          Novo integrante
        </Button>
      </Group>

      <Group gap="sm" align="flex-end" mb="md">
        <Select
          label="Função"
          data={[
            { value: "SUSTENTADOR", label: "Sustentador" },
            { value: "MENSALISTA", label: "Mensalista" },
            { value: "AVULSO", label: "Avulso" },
          ]}
          clearable
          value={filters.role}
          onChange={(val) =>
            setFilters((prev) => ({ ...prev, role: (val as Member["role"] | null) ?? null }))
          }
        />
        <Select
          label="Dieta"
          data={[
            { value: "VEGANO", label: "Vegano" },
            { value: "VEGETARIANO", label: "Vegetariano" },
            { value: "CARNIVORO", label: "Carnívoro" },
          ]}
          clearable
          value={filters.diet}
          onChange={(val) =>
            setFilters((prev) => ({ ...prev, diet: (val as Member["diet"] | null) ?? null }))
          }
        />
        <DateInput
          label="Cadastrado de"
          value={filters.created_from}
          onChange={(val) => setFilters((prev) => ({ ...prev, created_from: val }))}
          valueFormat="DD/MM/YYYY"
          locale="pt-br"
        />
        <DateInput
          label="Cadastrado até"
          value={filters.created_to}
          onChange={(val) => setFilters((prev) => ({ ...prev, created_to: val }))}
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
              <Table.Th>Nome</Table.Th>
              <Table.Th>Telefone</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th>Função</Table.Th>
              <Table.Th>Dieta</Table.Th>
              <Table.Th>Origem</Table.Th>
              <Table.Th>Cadastro</Table.Th>
              <Table.Th>Obs</Table.Th>
              <Table.Th ta="right">Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.map((item) => (
              <Table.Tr key={item.id}>
                <Table.Td>{item.full_name}</Table.Td>
                <Table.Td>{item.phone}</Table.Td>
                <Table.Td>{item.email}</Table.Td>
                <Table.Td>
                  <Badge color="blue">{roleLabels[item.role] || item.role}</Badge>
                </Table.Td>
                <Table.Td>
                  <Badge color="teal">{dietLabels[item.diet] || item.diet}</Badge>
                </Table.Td>
                <Table.Td>{item.heard_about}</Table.Td>
                <Table.Td>{formatPtDate(item.created_at)}</Table.Td>
                <Table.Td>{item.observations}</Table.Td>
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
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>

      <Modal
        opened={modalOpened}
        onClose={modalHandlers.close}
        title={editing ? "Editar integrante" : "Novo integrante"}
      >
        <div className="flex flex-col gap-3">
          <TextInput
            label="Nome completo"
            value={formState.full_name ?? ""}
            onChange={(e) => setFormState((prev) => ({ ...prev, full_name: e.currentTarget.value }))}
          />
          <TextInput
            label="Telefone"
            value={formState.phone ?? ""}
            onChange={(e) =>
              setFormState((prev) => ({
                ...prev,
                phone: formatPhone(e.currentTarget.value),
              }))
            }
            placeholder="+55 11 98888-7777"
          />
          <TextInput
            label="Email"
            value={formState.email ?? ""}
            onChange={(e) => setFormState((prev) => ({ ...prev, email: e.currentTarget.value }))}
          />
          <TextInput
            label="Endereço"
            value={formState.address ?? ""}
            onChange={(e) => setFormState((prev) => ({ ...prev, address: e.currentTarget.value }))}
          />
          <TextInput
            label="Como conheceu?"
            value={formState.heard_about ?? ""}
            onChange={(e) => setFormState((prev) => ({ ...prev, heard_about: e.currentTarget.value }))}
          />
          <Select
            label="Função"
            data={[
              { value: "SUSTENTADOR", label: "Sustentador" },
              { value: "MENSALISTA", label: "Mensalista" },
              { value: "AVULSO", label: "Avulso" },
            ]}
            value={formState.role ?? undefined}
            onChange={(val) => setFormState((prev) => ({ ...prev, role: (val as Member["role"]) || "AVULSO" }))}
          />
          <Select
            label="Dieta"
            data={[
              { value: "VEGANO", label: "Vegano" },
              { value: "VEGETARIANO", label: "Vegetariano" },
              { value: "CARNIVORO", label: "Carnívoro" },
            ]}
            value={formState.diet ?? undefined}
            onChange={(val) =>
              setFormState((prev) => ({ ...prev, diet: (val as Member["diet"]) || "CARNIVORO" }))
            }
          />
          <TextInput
            label="Observações"
            value={formState.observations ?? ""}
            onChange={(e) => setFormState((prev) => ({ ...prev, observations: e.currentTarget.value }))}
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
