import {
  Badge,
  Button,
  Container,
  Group,
  Modal,
  Pagination,
  ScrollArea,
  Select,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconUsers, IconPencil, IconPlus, IconTrash, IconEye } from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { API_BASE_URL } from "../../shared/api";
import { extractErrorMessage } from "../../shared/errors";
import { createMember, deleteMember, fetchMembers, updateMember, type Member } from "./api";

const roleLabels: Record<Exclude<Member["role"], null | undefined>, string> = {
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
  if (!digits.replace(/\D/g, "")) return "";
  // Formata de forma simples para visualização (+CC DDDDD DDDD)
  const cleaned = digits.startsWith("+") ? digits.slice(1) : digits;
  const withPlus = digits.startsWith("+");
  const parts = [];
  if (cleaned.length > 0) parts.push(cleaned.slice(0, 2)); // código do país
  if (cleaned.length > 2) parts.push(cleaned.slice(2, 4)); // DDD (aprox)
  if (cleaned.length > 4) parts.push(cleaned.slice(4, 9)); // prefixo
  if (cleaned.length > 9) parts.push(cleaned.slice(9, 13)); // sufixo
  const formatted = parts.filter(Boolean).join(" ");
  if (!formatted.trim()) return "";
  return (withPlus ? "+" : "+") + formatted.trim();
};

const formatPhoneDisplay = (value?: string | null) => {
  if (!value) return "";
  const digits = value.replace(/[^\d]/g, "");
  if (digits.length < 10) return value;
  const cc = digits.slice(0, 2);
  const ddd = digits.slice(2, 4);
  const part1 = digits.slice(4, digits.length - 4);
  const part2 = digits.slice(-4);
  return `+${cc} ${ddd} ${part1}-${part2}`.replace(/\s+/g, " ").trim();
};

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email.trim());

const normalizePhoneForSubmit = (value: string) => {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return "";
  return digits.startsWith("+") ? digits : `+${digits}`;
};

const formatDateReadable = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString("pt-BR");
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
    is_child: false,
    responsible: undefined,
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
    search: string;
  }>({
    role: null,
    diet: null,
    search: "",
  });
  const [selected, setSelected] = useState<Member | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const processedNovoRef = useRef(false);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "members",
      filters.role,
      filters.diet,
      filters.search,
    ],
    queryFn: () =>
      fetchMembers({
        role: filters.role || undefined,
        diet: filters.diet || undefined,
        search: filters.search || undefined,
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
    onError: (err: unknown) => notifications.show({ message: extractErrorMessage(err, "Erro ao criar integrante."), color: "red" }),
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
    onError: (err: unknown) => notifications.show({ message: extractErrorMessage(err, "Erro ao atualizar integrante."), color: "red" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteMember(id),
    onSuccess: () => {
      invalidateMembers();
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      notifications.show({ message: "Integrante removido.", color: "green" });
    },
    onError: (err: unknown) => notifications.show({ message: extractErrorMessage(err, "Erro ao remover integrante."), color: "red" }),
  });

  const handleSubmit = () => {
    if (!formState.full_name) {
      notifications.show({ message: "Preencha o nome.", color: "red" });
      return;
    }
    const trimmedEmail = formState.email?.trim() || "";
    let phoneNormalized: string | undefined = undefined;

    if (!formState.is_child) {
      if (trimmedEmail && !isValidEmail(trimmedEmail)) {
        notifications.show({ message: "Email inválido.", color: "red" });
        return;
      }
      if (formState.phone) {
        phoneNormalized = normalizePhoneForSubmit(formState.phone);
        if (phoneNormalized === "+") {
          phoneNormalized = undefined;
        } else if (!phoneNormalized.startsWith("+") || phoneNormalized.length < 10) {
          notifications.show({
            message: "Telefone inválido. Use o formato internacional com código do país.",
            color: "red",
          });
          return;
        }
      }
    }

    const payload: Partial<Member> = {
      ...formState,
      phone: formState.is_child ? undefined : phoneNormalized,
      email: formState.is_child ? undefined : trimmedEmail || undefined,
      heard_about: formState.is_child ? undefined : formState.heard_about,
      role: formState.is_child ? null : formState.role,
      responsible: formState.is_child ? formState.responsible : undefined,
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
      full_name: "",
      is_child: false,
      responsible: undefined,
      phone: "",
      email: "",
      address: "",
      heard_about: "",
      role: "AVULSO",
      diet: "CARNIVORO",
      observations: "",
    });
    modalHandlers.open();
  }, [modalHandlers]);

  const openEdit = (item: Member) => {
    setEditing(item);
    setFormState({
      ...item,
      is_child: item.is_child ?? false,
      responsible: item.responsible ?? undefined,
      phone: item.phone ?? "",
      email: item.email ?? "",
      heard_about: item.heard_about ?? "",
      role: item.is_child ? null : item.role ?? "AVULSO",
    });
    modalHandlers.open();
  };

  const clearFilters = () =>
    setFilters({
      role: null,
      diet: null,
      search: "",
    });

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

  const membersLength = data?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(membersLength / pageSize));

  useEffect(() => {
    setPage(1);
  }, [filters.role, filters.diet, filters.search]);

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

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

  const members = data ? [...data].sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR")) : [];
  const visibleMembers = members.slice((page - 1) * pageSize, page * pageSize);
  const responsibleOptions = members
    .filter((m) => !m.is_child && (!editing || m.id !== editing.id))
    .map((m) => ({ value: m.id.toString(), label: m.full_name }));

  return (
    <Container size="xl" py="md">
      <Group mb="md">
        <IconUsers size={20} />
        <Title order={3}>Integrantes</Title>
        {isLoading && <Text size="sm" c="dimmed">Carregando...</Text>}
        {isError && <Text c="red" size="sm">Erro ao carregar integrantes.</Text>}
        <Group ml="auto">
        <Button
          component="a"
          href={`${API_BASE_URL}/api/users/members/export/`}
          target="_blank"
          rel="noreferrer"
          variant="outline"
        >
            Exportar
          </Button>
          <Button onClick={openNew} leftSection={<IconPlus size={16} />} ml="auto">
            Novo
          </Button>
        </Group>
      </Group>

      <Group gap="sm" align="flex-end" mb="md">
        <TextInput
          label="Busca por nome"
          value={filters.search}
          onChange={(e) => setFilters((prev) => ({ ...prev, search: e.currentTarget.value }))}
          placeholder="Digite o nome"
        />
        <Select
          label="Categoria"
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
        <Button variant="outline" onClick={clearFilters}>
          Limpar
        </Button>
      </Group>

      <ScrollArea>
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ minWidth: 160 }}>Nome</Table.Th>
              <Table.Th style={{ minWidth: 160 }}>Telefone</Table.Th>
              <Table.Th style={{ minWidth: 160 }}>Categoria</Table.Th>
              <Table.Th style={{ minWidth: 120 }}>Dieta</Table.Th>
              <Table.Th style={{ minWidth: 180 }} ta="right">
                Ações
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
        <Table.Tbody>
        {visibleMembers.map((item) => (
          <Table.Tr key={item.id}>
                <Table.Td>{item.full_name}</Table.Td>
                <Table.Td>
                  {formatPhoneDisplay(item.phone)}
                  {item.responsible_name ? (
                    <Text size="xs" c="dimmed">
                      Resp.: {item.responsible_name}
                    </Text>
                  ) : null}
                </Table.Td>
                <Table.Td>
                  {item.is_child ? (
                    <div className="flex flex-col gap-1">
                      <Badge color="pink">Criança</Badge>
                    </div>
                  ) : (
                    <Badge
                      color={
                        item.role === "SUSTENTADOR"
                          ? "indigo"
                          : item.role === "MENSALISTA"
                          ? "cyan"
                          : "gray"
                      }
                    >
                      {item.role ? roleLabels[item.role] || item.role : "Sem categoria"}
                    </Badge>
                  )}
                </Table.Td>
                <Table.Td>
                  <Badge
                    color={
                      item.diet === "VEGANO" ? "green" : item.diet === "VEGETARIANO" ? "yellow" : "orange"
                    }
                  >
                    {dietLabels[item.diet] || item.diet}
                  </Badge>
                </Table.Td>
                <Table.Td ta="right">
                  <Group gap="xs" justify="flex-end">
                    <Button
                      size="xs"
                      variant="light"
                      onClick={() => setSelected(item)}
                      aria-label="Ver detalhes"
                    >
                      <IconEye size={16} />
                    </Button>
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

      {members.length > 0 && (
        <Group justify="center" mt="md">
          <Pagination total={totalPages} value={page} onChange={setPage} size="sm" />
        </Group>
      )}

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
          <Switch
            label="Criança"
            checked={!!formState.is_child}
            onChange={(e) => {
              const next = e.currentTarget.checked;
              setFormState((prev) => ({
                ...prev,
                is_child: next,
                responsible: next ? prev.responsible : undefined,
                email: next ? "" : prev.email ?? "",
                phone: next ? "" : prev.phone ?? "",
                heard_about: next ? "" : prev.heard_about ?? "",
                role: next ? null : prev.role ?? "AVULSO",
              }));
            }}
          />
          {formState.is_child ? (
            <Select
              label="Responsável"
              data={responsibleOptions}
              searchable
              nothingFoundMessage="Nenhum responsável encontrado"
              placeholder="Selecione o responsável"
              value={formState.responsible ? String(formState.responsible) : undefined}
              onChange={(val) =>
                setFormState((prev) => ({
                  ...prev,
                  responsible: val ? Number(val) : undefined,
                }))
              }
            />
          ) : null}
          {!formState.is_child && (
            <>
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
            </>
          )}
          <Select
            label="Categoria"
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

      <Modal opened={!!selected} onClose={() => setSelected(null)} title="Dados do integrante">
        {selected && (
          <div className="flex flex-col gap-2">
            <Text fw={600}>{selected.full_name}</Text>
            <Text size="sm">Telefone: {formatPhoneDisplay(selected.phone)}</Text>
            <Text size="sm">Email: {selected.email}</Text>
            <Text size="sm">Endereço: {selected.address}</Text>
            <Text size="sm">Origem: {selected.heard_about}</Text>
            <Text size="sm">
              Categoria: {selected.role ? roleLabels[selected.role] || selected.role : "Sem categoria"}
            </Text>
            <Text size="sm">Dieta: {dietLabels[selected.diet]}</Text>
            <Text size="sm">Cadastro: {formatDateReadable(selected.created_at)}</Text>
            {selected.observations ? <Text size="sm">Obs: {selected.observations}</Text> : null}
          </div>
        )}
      </Modal>
    </Container>
  );
}

