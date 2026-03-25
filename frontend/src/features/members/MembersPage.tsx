import {
  Badge,
  Button,
  Container,
  Group,
  Modal,
  Pagination,
  ScrollArea,
  Select,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconCheck,
  IconEye,
  IconPencil,
  IconPlus,
  IconTrash,
  IconUserCheck,
  IconUserX,
  IconUsers,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FieldLabelWithCounter } from "../../components/FieldLabelWithCounter";
import { useAuth } from "../../context/AuthContext";
import { API_BASE_URL } from "../../shared/api";
import { extractErrorMessage } from "../../shared/errors";
import {
  formatCharacterCounter,
  NAME_FIELD_MAX_LENGTH,
  TEXT_FIELD_MAX_LENGTH,
} from "../../shared/formLimits";
import {
  approvePublicRegistration,
  createMember,
  deleteMember,
  fetchMembers,
  fetchMembersPage,
  fetchPublicRegistration,
  fetchPublicRegistrations,
  rejectPublicRegistration,
  updateMember,
  type Member,
  type PublicRegistration,
} from "./api";

const memberRoleOptions = [
  { value: "SUSTENTADOR", label: "Sustentador" },
  { value: "MENSALISTA", label: "Mensalista" },
  { value: "AVULSO", label: "Avulso" },
] as const;

const memberDietOptions = [
  { value: "VEGANO", label: "Vegano" },
  { value: "VEGETARIANO", label: "Vegetariano" },
  { value: "CARNIVORO", label: "Carnívoro" },
] as const;

const registrationStatusOptions = [
  { value: "PENDENTE", label: "Pendente" },
  { value: "APROVADO", label: "Aprovado" },
  { value: "REJEITADO", label: "Rejeitado" },
] as const;

const memberRoleLabels: Record<NonNullable<Member["role"]>, string> = {
  SUSTENTADOR: "Sustentador",
  MENSALISTA: "Mensalista",
  AVULSO: "Avulso",
};

const memberDietLabels: Record<Member["diet"], string> = {
  VEGANO: "Vegano",
  VEGETARIANO: "Vegetariano",
  CARNIVORO: "Carnívoro",
};

const registrationStatusLabels: Record<PublicRegistration["status"], string> = {
  PENDENTE: "Pendente",
  APROVADO: "Aprovado",
  REJEITADO: "Rejeitado",
};

const registrationStatusColors: Record<PublicRegistration["status"], string> = {
  PENDENTE: "yellow",
  APROVADO: "green",
  REJEITADO: "red",
};

const memberPageSize = 15;
const registrationPageSize = 15;

const defaultMemberFormState: Partial<Member> = {
  full_name: "",
  is_child: false,
  responsible: null,
  phone: "",
  email: "",
  address: "",
  heard_about: "",
  role: "AVULSO",
  diet: "CARNIVORO",
  observations: "",
};

const formatPtDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

type MemberTabValue = "integrantes" | "novos-cadastros";

export function MembersPage() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: MemberTabValue =
    searchParams.get("tab") === "novos-cadastros" ? "novos-cadastros" : "integrantes";

  const [memberModalOpened, memberModalHandlers] = useDisclosure(false);
  const [registrationModalOpened, registrationModalHandlers] = useDisclosure(false);
  const [rejectModalOpened, rejectModalHandlers] = useDisclosure(false);

  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [memberFormState, setMemberFormState] = useState<Partial<Member>>(defaultMemberFormState);
  const [membersPage, setMembersPage] = useState(1);
  const [memberFilters, setMemberFilters] = useState<{
    search: string;
    role: Member["role"];
    diet: Member["diet"] | null;
  }>({
    search: "",
    role: null,
    diet: null,
  });

  const [registrationPage, setRegistrationPage] = useState(1);
  const [registrationFilters, setRegistrationFilters] = useState<{
    search: string;
    status: PublicRegistration["status"] | null;
  }>({
    search: "",
    status: "PENDENTE",
  });
  const [selectedRegistrationId, setSelectedRegistrationId] = useState<number | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");

  const membersQuery = useQuery({
    queryKey: [
      "members",
      memberFilters.search,
      memberFilters.role,
      memberFilters.diet,
      membersPage,
      memberPageSize,
    ],
    queryFn: () =>
      fetchMembersPage({
        search: memberFilters.search || undefined,
        role: memberFilters.role || undefined,
        diet: memberFilters.diet || undefined,
        page: membersPage,
        page_size: memberPageSize,
      }),
    enabled: isAuthenticated && activeTab === "integrantes",
  });

  const memberOptionsQuery = useQuery({
    queryKey: ["members-options"],
    queryFn: () => fetchMembers(),
    enabled: isAuthenticated,
  });

  const publicRegistrationsQuery = useQuery({
    queryKey: [
      "public-registrations-admin",
      registrationFilters.search,
      registrationFilters.status,
      registrationPage,
      registrationPageSize,
    ],
    queryFn: () =>
      fetchPublicRegistrations({
        search: registrationFilters.search || undefined,
        status: registrationFilters.status || undefined,
        page: registrationPage,
        page_size: registrationPageSize,
      }),
    enabled: isAuthenticated && activeTab === "novos-cadastros",
  });

  const publicRegistrationDetailQuery = useQuery({
    queryKey: ["public-registration-detail", selectedRegistrationId],
    queryFn: () => fetchPublicRegistration(selectedRegistrationId as number),
    enabled: isAuthenticated && registrationModalOpened && selectedRegistrationId !== null,
  });

  const invalidateMembers = () => {
    queryClient.invalidateQueries({ queryKey: ["members"] });
    queryClient.invalidateQueries({ queryKey: ["members-options"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
  };

  const invalidateRegistrations = () => {
    queryClient.invalidateQueries({ queryKey: ["public-registrations-admin"] });
    queryClient.invalidateQueries({ queryKey: ["public-registration-detail"] });
    queryClient.invalidateQueries({ queryKey: ["public-registrations-dashboard"] });
    invalidateMembers();
  };

  const createMemberMutation = useMutation({
    mutationFn: (payload: Partial<Member>) => createMember(payload),
    onSuccess: () => {
      invalidateMembers();
      notifications.show({ message: "Integrante criado.", color: "green" });
      memberModalHandlers.close();
    },
    onError: (err: unknown) => {
      notifications.show({
        message: extractErrorMessage(err, "Erro ao criar integrante."),
        color: "red",
      });
    },
  });

  const updateMemberMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Member> }) => updateMember(id, payload),
    onSuccess: () => {
      invalidateMembers();
      notifications.show({ message: "Integrante atualizado.", color: "green" });
      memberModalHandlers.close();
    },
    onError: (err: unknown) => {
      notifications.show({
        message: extractErrorMessage(err, "Erro ao atualizar integrante."),
        color: "red",
      });
    },
  });

  const deleteMemberMutation = useMutation({
    mutationFn: (id: number) => deleteMember(id),
    onSuccess: () => {
      invalidateMembers();
      notifications.show({ message: "Integrante removido.", color: "green" });
    },
    onError: (err: unknown) => {
      notifications.show({
        message: extractErrorMessage(err, "Erro ao remover integrante."),
        color: "red",
      });
    },
  });

  const approveRegistrationMutation = useMutation({
    mutationFn: (id: number) => approvePublicRegistration(id),
    onSuccess: () => {
      invalidateRegistrations();
      notifications.show({ message: "Cadastro aprovado.", color: "green" });
      registrationModalHandlers.close();
    },
    onError: (err: unknown) => {
      notifications.show({
        message: extractErrorMessage(err, "Erro ao aprovar cadastro."),
        color: "red",
      });
    },
  });

  const rejectRegistrationMutation = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) =>
      rejectPublicRegistration(id, { review_notes: notes }),
    onSuccess: () => {
      invalidateRegistrations();
      notifications.show({ message: "Cadastro rejeitado.", color: "green" });
      rejectModalHandlers.close();
      registrationModalHandlers.close();
      setRejectNotes("");
    },
    onError: (err: unknown) => {
      notifications.show({
        message: extractErrorMessage(err, "Erro ao rejeitar cadastro."),
        color: "red",
      });
    },
  });

  const memberResults = membersQuery.data?.results ?? [];
  const memberTotalCount = membersQuery.data?.count ?? 0;
  const memberTotalPages = Math.max(1, Math.ceil(memberTotalCount / memberPageSize));

  const registrationResults = publicRegistrationsQuery.data?.results ?? [];
  const registrationTotalCount = publicRegistrationsQuery.data?.count ?? 0;
  const registrationTotalPages = Math.max(1, Math.ceil(registrationTotalCount / registrationPageSize));

  const selectedRegistration =
    publicRegistrationDetailQuery.data ??
    registrationResults.find((item) => item.id === selectedRegistrationId) ??
    null;

  const responsibleOptions = useMemo(
    () =>
      (memberOptionsQuery.data ?? [])
        .filter((member) => !member.is_child && member.id !== editingMember?.id)
        .map((member) => ({ value: String(member.id), label: member.full_name })),
    [editingMember?.id, memberOptionsQuery.data]
  );

  useEffect(() => {
    setMembersPage(1);
  }, [memberFilters.search, memberFilters.role, memberFilters.diet]);

  useEffect(() => {
    if (!membersQuery.data) return;
    setMembersPage((prev) => Math.min(prev, memberTotalPages));
  }, [memberTotalPages, membersQuery.data]);

  useEffect(() => {
    setRegistrationPage(1);
  }, [registrationFilters.search, registrationFilters.status]);

  useEffect(() => {
    if (!publicRegistrationsQuery.data) return;
    setRegistrationPage((prev) => Math.min(prev, registrationTotalPages));
  }, [publicRegistrationsQuery.data, registrationTotalPages]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (searchParams.get("novo") !== "1") return;

    setEditingMember(null);
    setMemberFormState(defaultMemberFormState);
    memberModalHandlers.open();

    const next = new URLSearchParams(searchParams);
    next.delete("novo");
    next.delete("tab");
    setSearchParams(next, { replace: true });
  }, [isAuthenticated, memberModalHandlers, searchParams, setSearchParams]);

  const openNewMember = () => {
    setEditingMember(null);
    setMemberFormState(defaultMemberFormState);
    memberModalHandlers.open();
  };

  const openEditMember = (member: Member) => {
    setEditingMember(member);
    setMemberFormState({
      full_name: member.full_name,
      is_child: member.is_child,
      responsible: member.responsible ?? null,
      phone: member.phone ?? "",
      email: member.email ?? "",
      address: member.address ?? "",
      heard_about: member.heard_about ?? "",
      role: member.role,
      diet: member.diet,
      observations: member.observations ?? "",
    });
    memberModalHandlers.open();
  };

  const handleSubmitMember = () => {
    if (!memberFormState.full_name?.trim()) {
      notifications.show({ message: "Preencha o nome completo.", color: "red" });
      return;
    }

    if (!memberFormState.diet) {
      notifications.show({ message: "Selecione a dieta.", color: "red" });
      return;
    }

    if (memberFormState.is_child && !memberFormState.responsible) {
      notifications.show({ message: "Selecione um responsável.", color: "red" });
      return;
    }

    const payload: Partial<Member> = {
      full_name: memberFormState.full_name.trim(),
      is_child: Boolean(memberFormState.is_child),
      responsible: memberFormState.is_child ? (memberFormState.responsible ?? null) : null,
      phone: memberFormState.is_child ? null : memberFormState.phone?.trim() || null,
      email: memberFormState.is_child ? null : memberFormState.email?.trim() || null,
      address: memberFormState.is_child ? "" : memberFormState.address?.trim() || "",
      heard_about: memberFormState.is_child ? "" : memberFormState.heard_about?.trim() || "",
      role: memberFormState.is_child ? null : memberFormState.role ?? null,
      diet: memberFormState.diet,
      observations: memberFormState.observations?.trim() || "",
    };

    if (editingMember) {
      updateMemberMutation.mutate({ id: editingMember.id, payload });
      return;
    }

    createMemberMutation.mutate(payload);
  };

  const openRegistrationDetail = (registrationId: number) => {
    setSelectedRegistrationId(registrationId);
    registrationModalHandlers.open();
  };

  const openRejectRegistration = (registration: PublicRegistration) => {
    setSelectedRegistrationId(registration.id);
    setRejectNotes(registration.review_notes ?? "");
    registrationModalHandlers.close();
    rejectModalHandlers.open();
  };

  const closeRejectRegistration = () => {
    setRejectNotes("");
    rejectModalHandlers.close();
  };

  const handleApproveRegistration = (registrationId: number) => {
    approveRegistrationMutation.mutate(registrationId);
  };

  const handleRejectRegistration = () => {
    if (selectedRegistrationId === null) return;
    rejectRegistrationMutation.mutate({
      id: selectedRegistrationId,
      notes: rejectNotes.trim(),
    });
  };

  const handleTabChange = (value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value === "novos-cadastros") {
      next.set("tab", "novos-cadastros");
    } else {
      next.delete("tab");
    }
    setSearchParams(next, { replace: true });
  };

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

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="md">
        <Group>
          <IconUsers size={20} />
          <Title order={3}>Integrantes</Title>
        </Group>
        {activeTab === "integrantes" && (
          <Group>
            <Button
              component="a"
              href={`${API_BASE_URL}/api/users/members/export/`}
              target="_blank"
              rel="noreferrer"
              variant="outline"
            >
              Exportar
            </Button>
            <Button onClick={openNewMember} leftSection={<IconPlus size={16} />}>
              Novo
            </Button>
          </Group>
        )}
      </Group>

      <Tabs value={activeTab} onChange={handleTabChange} keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="integrantes">Integrantes</Tabs.Tab>
          <Tabs.Tab value="novos-cadastros">Novos cadastros</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="integrantes">
          <Group gap="sm" align="flex-end" mb="md">
            <TextInput
              label="Buscar"
              placeholder="Nome do integrante"
              value={memberFilters.search}
              onChange={(event) =>
                setMemberFilters((prev) => ({ ...prev, search: event.currentTarget.value }))
              }
            />
            <Select
              label="Categoria"
              data={memberRoleOptions}
              clearable
              value={memberFilters.role}
              onChange={(value) =>
                setMemberFilters((prev) => ({
                  ...prev,
                  role: (value as Member["role"]) ?? null,
                }))
              }
            />
            <Select
              label="Dieta"
              data={memberDietOptions}
              clearable
              value={memberFilters.diet}
              onChange={(value) =>
                setMemberFilters((prev) => ({
                  ...prev,
                  diet: (value as Member["diet"] | null) ?? null,
                }))
              }
            />
            <Button
              variant="outline"
              onClick={() =>
                setMemberFilters({
                  search: "",
                  role: null,
                  diet: null,
                })
              }
            >
              Limpar
            </Button>
          </Group>

          {membersQuery.isLoading && <Text size="sm">Carregando...</Text>}
          {membersQuery.isError && <Text c="red">Erro ao carregar integrantes.</Text>}

          {!membersQuery.isLoading && !membersQuery.isError && (
            <>
              <ScrollArea>
                <Table highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th style={{ minWidth: 220 }}>Nome</Table.Th>
                      <Table.Th style={{ minWidth: 110 }}>Tipo</Table.Th>
                      <Table.Th style={{ minWidth: 120 }}>Responsável</Table.Th>
                      <Table.Th style={{ minWidth: 160 }}>Telefone</Table.Th>
                      <Table.Th style={{ minWidth: 190 }}>E-mail</Table.Th>
                      <Table.Th style={{ minWidth: 140 }}>Categoria</Table.Th>
                      <Table.Th style={{ minWidth: 110 }}>Dieta</Table.Th>
                      <Table.Th style={{ minWidth: 130 }} ta="right">
                        Ações
                      </Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {memberResults.map((member) => (
                      <Table.Tr key={member.id}>
                        <Table.Td>{member.full_name}</Table.Td>
                        <Table.Td>
                          <Badge color={member.is_child ? "grape" : "blue"}>
                            {member.is_child ? "Criança" : "Adulto"}
                          </Badge>
                        </Table.Td>
                        <Table.Td>{member.responsible_name || "-"}</Table.Td>
                        <Table.Td>{member.phone || "-"}</Table.Td>
                        <Table.Td>{member.email || "-"}</Table.Td>
                        <Table.Td>{member.role ? memberRoleLabels[member.role] : "-"}</Table.Td>
                        <Table.Td>{memberDietLabels[member.diet]}</Table.Td>
                        <Table.Td ta="right">
                          <Group gap="xs" justify="flex-end">
                            <Button size="xs" variant="subtle" onClick={() => openEditMember(member)}>
                              <IconPencil size={16} />
                            </Button>
                            <Button
                              size="xs"
                              variant="outline"
                              color="red"
                              loading={
                                deleteMemberMutation.isPending && deleteMemberMutation.variables === member.id
                              }
                              onClick={() => deleteMemberMutation.mutate(member.id)}
                            >
                              <IconTrash size={16} />
                            </Button>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                    {memberResults.length === 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={8}>
                          <Text c="dimmed">Nenhum integrante encontrado.</Text>
                        </Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </ScrollArea>

              {memberTotalCount > 0 && (
                <Group justify="center" mt="md">
                  <Pagination total={memberTotalPages} value={membersPage} onChange={setMembersPage} size="sm" />
                </Group>
              )}
            </>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="novos-cadastros">
          <Group gap="sm" align="flex-end" mb="md">
            <TextInput
              label="Buscar"
              placeholder="Nome ou e-mail"
              value={registrationFilters.search}
              onChange={(event) =>
                setRegistrationFilters((prev) => ({
                  ...prev,
                  search: event.currentTarget.value,
                }))
              }
            />
            <Select
              label="Status"
              data={registrationStatusOptions}
              clearable
              value={registrationFilters.status}
              onChange={(value) =>
                setRegistrationFilters((prev) => ({
                  ...prev,
                  status: (value as PublicRegistration["status"] | null) ?? null,
                }))
              }
            />
            <Button
              variant="outline"
              onClick={() =>
                setRegistrationFilters({
                  search: "",
                  status: "PENDENTE",
                })
              }
            >
              Limpar
            </Button>
          </Group>

          {publicRegistrationsQuery.isLoading && <Text size="sm">Carregando...</Text>}
          {publicRegistrationsQuery.isError && <Text c="red">Erro ao carregar novos cadastros.</Text>}

          {!publicRegistrationsQuery.isLoading && !publicRegistrationsQuery.isError && (
            <>
              <ScrollArea>
                <Table highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th style={{ minWidth: 220 }}>Nome</Table.Th>
                      <Table.Th style={{ minWidth: 220 }}>E-mail</Table.Th>
                      <Table.Th style={{ minWidth: 160 }}>Telefone</Table.Th>
                      <Table.Th style={{ minWidth: 100 }}>Crianças</Table.Th>
                      <Table.Th style={{ minWidth: 120 }}>Status</Table.Th>
                      <Table.Th style={{ minWidth: 160 }}>Data</Table.Th>
                      <Table.Th style={{ minWidth: 220 }} ta="right">
                        Ações
                      </Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {registrationResults.map((registration) => (
                      <Table.Tr key={registration.id}>
                        <Table.Td>{registration.full_name}</Table.Td>
                        <Table.Td>{registration.email || "-"}</Table.Td>
                        <Table.Td>{registration.phone || "-"}</Table.Td>
                        <Table.Td>{registration.children.length}</Table.Td>
                        <Table.Td>
                          <Badge color={registrationStatusColors[registration.status]}>
                            {registrationStatusLabels[registration.status]}
                          </Badge>
                        </Table.Td>
                        <Table.Td>{formatPtDateTime(registration.created_at)}</Table.Td>
                        <Table.Td ta="right">
                          <Group gap="xs" justify="flex-end" wrap="nowrap">
                            <Button
                              size="xs"
                              variant="subtle"
                              leftSection={<IconEye size={14} />}
                              onClick={() => openRegistrationDetail(registration.id)}
                            >
                              Ver
                            </Button>
                            {registration.status === "PENDENTE" && (
                              <>
                                <Button
                                  size="xs"
                                  variant="light"
                                  color="green"
                                  leftSection={<IconCheck size={14} />}
                                  loading={
                                    approveRegistrationMutation.isPending &&
                                    approveRegistrationMutation.variables === registration.id
                                  }
                                  onClick={() => handleApproveRegistration(registration.id)}
                                >
                                  Aprovar
                                </Button>
                                <Button
                                  size="xs"
                                  variant="light"
                                  color="red"
                                  leftSection={<IconUserX size={14} />}
                                  onClick={() => openRejectRegistration(registration)}
                                >
                                  Rejeitar
                                </Button>
                              </>
                            )}
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                    {registrationResults.length === 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={7}>
                          <Text c="dimmed">Nenhum cadastro encontrado.</Text>
                        </Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </ScrollArea>

              {registrationTotalCount > 0 && (
                <Group justify="center" mt="md">
                  <Pagination
                    total={registrationTotalPages}
                    value={registrationPage}
                    onChange={setRegistrationPage}
                    size="sm"
                  />
                </Group>
              )}
            </>
          )}
        </Tabs.Panel>
      </Tabs>

      <Modal
        opened={memberModalOpened}
        onClose={memberModalHandlers.close}
        title={editingMember ? "Editar integrante" : "Novo integrante"}
        size="lg"
      >
        <Stack gap="sm">
          <TextInput
            label="Nome completo"
            value={memberFormState.full_name ?? ""}
            onChange={(event) =>
              setMemberFormState((prev) => ({ ...prev, full_name: event.currentTarget.value }))
            }
            maxLength={NAME_FIELD_MAX_LENGTH}
          />
          <Switch
            label="Cadastrar criança"
            checked={Boolean(memberFormState.is_child)}
            onChange={(event) => {
              const nextIsChild = event.currentTarget.checked;
              setMemberFormState((prev) => ({
                ...prev,
                is_child: nextIsChild,
                responsible: nextIsChild ? prev.responsible ?? null : null,
                phone: nextIsChild ? "" : prev.phone ?? "",
                email: nextIsChild ? "" : prev.email ?? "",
                address: nextIsChild ? "" : prev.address ?? "",
                heard_about: nextIsChild ? "" : prev.heard_about ?? "",
                role: nextIsChild ? null : prev.role ?? "AVULSO",
              }));
            }}
          />
          {memberFormState.is_child && (
            <Select
              label="Responsável"
              searchable
              data={responsibleOptions}
              value={memberFormState.responsible ? String(memberFormState.responsible) : null}
              onChange={(value) =>
                setMemberFormState((prev) => ({
                  ...prev,
                  responsible: value ? Number(value) : null,
                }))
              }
              placeholder="Digite para buscar"
              nothingFoundMessage="Nenhum responsável encontrado"
            />
          )}
          <Select
            label="Categoria"
            data={memberRoleOptions}
            disabled={Boolean(memberFormState.is_child)}
            value={memberFormState.role}
            onChange={(value) =>
              setMemberFormState((prev) => ({
                ...prev,
                role: (value as Member["role"]) ?? null,
              }))
            }
          />
          <Select
            label="Dieta"
            data={memberDietOptions}
            value={memberFormState.diet ?? null}
            onChange={(value) =>
              setMemberFormState((prev) => ({
                ...prev,
                diet: (value as Member["diet"] | null) ?? undefined,
              }))
            }
          />
          <TextInput
            label="Telefone"
            value={memberFormState.phone ?? ""}
            disabled={Boolean(memberFormState.is_child)}
            onChange={(event) =>
              setMemberFormState((prev) => ({ ...prev, phone: event.currentTarget.value }))
            }
            placeholder="+5511999999999"
          />
          <TextInput
            label="E-mail"
            value={memberFormState.email ?? ""}
            disabled={Boolean(memberFormState.is_child)}
            onChange={(event) =>
              setMemberFormState((prev) => ({ ...prev, email: event.currentTarget.value }))
            }
            placeholder="nome@exemplo.com"
          />
          <TextInput
            label="Endereço"
            value={memberFormState.address ?? ""}
            disabled={Boolean(memberFormState.is_child)}
            onChange={(event) =>
              setMemberFormState((prev) => ({ ...prev, address: event.currentTarget.value }))
            }
            maxLength={TEXT_FIELD_MAX_LENGTH}
          />
          <TextInput
            label="Como conheceu"
            value={memberFormState.heard_about ?? ""}
            disabled={Boolean(memberFormState.is_child)}
            onChange={(event) =>
              setMemberFormState((prev) => ({ ...prev, heard_about: event.currentTarget.value }))
            }
            maxLength={TEXT_FIELD_MAX_LENGTH}
          />
          <Textarea
            label={
              <FieldLabelWithCounter
                label="Observações"
                counter={formatCharacterCounter(memberFormState.observations)}
              />
            }
            value={memberFormState.observations ?? ""}
            onChange={(event) =>
              setMemberFormState((prev) => ({ ...prev, observations: event.currentTarget.value }))
            }
            minRows={3}
            maxLength={TEXT_FIELD_MAX_LENGTH}
            styles={{ label: { width: "100%" } }}
          />
          <Group justify="flex-end">
            <Button onClick={handleSubmitMember} loading={createMemberMutation.isPending || updateMemberMutation.isPending}>
              {editingMember ? "Salvar" : "Criar"}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={registrationModalOpened}
        onClose={registrationModalHandlers.close}
        title="Detalhes do cadastro"
        size="lg"
      >
        {publicRegistrationDetailQuery.isLoading && <Text size="sm">Carregando...</Text>}
        {publicRegistrationDetailQuery.isError && (
          <Text size="sm" c="red">
            Erro ao carregar os detalhes do cadastro.
          </Text>
        )}
        {!publicRegistrationDetailQuery.isLoading && selectedRegistration && (
          <Stack gap="sm">
            <Group justify="space-between" align="flex-start">
              <div>
                <Title order={4}>{selectedRegistration.full_name}</Title>
                <Text size="sm" c="dimmed">
                  Enviado em {formatPtDateTime(selectedRegistration.created_at)}
                </Text>
              </div>
              <Badge color={registrationStatusColors[selectedRegistration.status]}>
                {registrationStatusLabels[selectedRegistration.status]}
              </Badge>
            </Group>

            <Text size="sm">
              <strong>E-mail:</strong> {selectedRegistration.email || "-"}
            </Text>
            <Text size="sm">
              <strong>Telefone:</strong> {selectedRegistration.phone || "-"}
            </Text>
            <Text size="sm">
              <strong>Endereço:</strong> {selectedRegistration.address || "-"}
            </Text>
            <Text size="sm">
              <strong>Como conheceu:</strong> {selectedRegistration.heard_about || "-"}
            </Text>
            <Text size="sm">
              <strong>Categoria:</strong> {memberRoleLabels[selectedRegistration.role]}
            </Text>
            <Text size="sm">
              <strong>Dieta:</strong> {memberDietLabels[selectedRegistration.diet]}
            </Text>
            <Text size="sm">
              <strong>Observações:</strong> {selectedRegistration.observations || "-"}
            </Text>

            <div>
              <Title order={5} mb="xs">
                Crianças cadastradas
              </Title>
              {selectedRegistration.children.length > 0 ? (
                <ScrollArea>
                  <Table highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={{ minWidth: 200 }}>Nome</Table.Th>
                        <Table.Th style={{ minWidth: 140 }}>Dieta</Table.Th>
                        <Table.Th style={{ minWidth: 220 }}>Observações</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {selectedRegistration.children.map((child) => (
                        <Table.Tr key={child.id}>
                          <Table.Td>{child.full_name}</Table.Td>
                          <Table.Td>{memberDietLabels[child.diet]}</Table.Td>
                          <Table.Td>{child.observations || "-"}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              ) : (
                <Text size="sm" c="dimmed">
                  Nenhuma criança vinculada a este cadastro.
                </Text>
              )}
            </div>

            {selectedRegistration.review_notes && (
              <Text size="sm">
                <strong>Notas da revisão:</strong> {selectedRegistration.review_notes}
              </Text>
            )}

            {selectedRegistration.status === "PENDENTE" && (
              <Group justify="flex-end">
                <Button
                  color="red"
                  variant="light"
                  leftSection={<IconUserX size={16} />}
                  onClick={() => openRejectRegistration(selectedRegistration)}
                >
                  Rejeitar
                </Button>
                <Button
                  color="green"
                  leftSection={<IconUserCheck size={16} />}
                  loading={
                    approveRegistrationMutation.isPending &&
                    approveRegistrationMutation.variables === selectedRegistration.id
                  }
                  onClick={() => handleApproveRegistration(selectedRegistration.id)}
                >
                  Aprovar
                </Button>
              </Group>
            )}
          </Stack>
        )}
      </Modal>

      <Modal
        opened={rejectModalOpened}
        onClose={closeRejectRegistration}
        title="Rejeitar cadastro"
        size="md"
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Se quiser, registre uma observação para a revisão deste cadastro.
          </Text>
          <Textarea
            label={
              <FieldLabelWithCounter
                label="Notas da revisão"
                counter={formatCharacterCounter(rejectNotes)}
              />
            }
            value={rejectNotes}
            onChange={(event) => setRejectNotes(event.currentTarget.value)}
            minRows={4}
            maxLength={TEXT_FIELD_MAX_LENGTH}
            styles={{ label: { width: "100%" } }}
          />
          <Group justify="flex-end">
            <Button variant="outline" onClick={closeRejectRegistration}>
              Cancelar
            </Button>
            <Button color="red" onClick={handleRejectRegistration} loading={rejectRegistrationMutation.isPending}>
              Confirmar rejeição
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
