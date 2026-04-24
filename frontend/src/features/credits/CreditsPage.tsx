import {
  Badge,
  Button,
  Container,
  Group,
  Modal,
  Pagination,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconCashBanknote, IconEye, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FieldLabelWithCounter } from "../../components/FieldLabelWithCounter";
import { SummaryCard } from "../../components/SummaryCard";
import { useAuth } from "../../context/AuthContext";
import { accentInsensitiveOptionsFilter } from "../../shared/comboboxFilters";
import { formatCents, parseReaisToCents } from "../../shared/currency";
import { extractErrorMessage } from "../../shared/errors";
import { formatCharacterCounter, TEXT_FIELD_MAX_LENGTH } from "../../shared/formLimits";
import { fetchMembers, type Member } from "../members/api";
import {
  createManualCredit,
  createManualDebit,
  fetchCreditEntries,
  fetchCreditSummaries,
  fetchCreditSummary,
  type CreditEntry,
} from "./api";

const creditsPageSize = 15;
const historyPageSize = 10;

const memberRoleLabels: Record<Exclude<Member["role"], null>, string> = {
  SUSTENTADOR: "Sustentador",
  MENSALISTA: "Mensalista",
  AVULSO: "Avulso",
};

const creditEntryTypeLabels: Record<CreditEntry["entry_type"], string> = {
  CREDITO: "Crédito",
  DEBITO: "Débito",
};

const creditOriginLabels: Record<CreditEntry["origin"], string> = {
  AGENDA: "Agenda",
  MANUAL: "Manual",
  LUNCH: "Almoço",
  ESTORNO: "Estorno",
};

const creditEntryTypeColors: Record<CreditEntry["entry_type"], string> = {
  CREDITO: "green",
  DEBITO: "red",
};

const getBalanceColor = (balanceCents: number) => {
  if (balanceCents < 0) return "red";
  if (balanceCents > 0) return "green";
  return "gray";
};

const formatBalanceLabel = (balanceCents: number) => {
  if (balanceCents < 0) return `Dívida ${formatCents(Math.abs(balanceCents))}`;
  if (balanceCents > 0) return `Saldo ${formatCents(balanceCents)}`;
  return "Saldo R$ 0,00";
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

type ModalContext = "view" | "new";
type AdjustmentType = CreditEntry["entry_type"];

export function CreditsPage() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpened, modalHandlers] = useDisclosure(false);

  const [page, setPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [search, setSearch] = useState("");
  const [modalContext, setModalContext] = useState<ModalContext>("new");
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>("CREDITO");
  const [valueReais, setValueReais] = useState("");
  const [description, setDescription] = useState("");

  const creditSummariesQuery = useQuery({
    queryKey: ["credit-summaries", search, page, creditsPageSize],
    queryFn: () =>
      fetchCreditSummaries({
        search: search || undefined,
        page,
        page_size: creditsPageSize,
      }),
    enabled: isAuthenticated,
  });

  const memberOptionsQuery = useQuery({
    queryKey: ["credit-member-options"],
    queryFn: () => fetchMembers(),
    enabled: isAuthenticated,
  });

  const selectedSummaryQuery = useQuery({
    queryKey: ["credit-summary", selectedOwnerId],
    queryFn: () => fetchCreditSummary(selectedOwnerId as number),
    enabled: isAuthenticated && modalOpened && selectedOwnerId !== null,
  });

  const creditHistoryQuery = useQuery({
    queryKey: ["credit-entries", selectedOwnerId, historyPage, historyPageSize],
    queryFn: () =>
      fetchCreditEntries({
        owner: selectedOwnerId as number,
        page: historyPage,
        page_size: historyPageSize,
      }),
    enabled: isAuthenticated && modalOpened && selectedOwnerId !== null,
  });

  const submitAdjustmentMutation = useMutation({
    mutationFn: (payload: {
      type: AdjustmentType;
      owner: number;
      value_cents: number;
      description: string;
    }) =>
      payload.type === "CREDITO"
        ? createManualCredit(payload)
        : createManualDebit(payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["credit-summaries"] });
      queryClient.invalidateQueries({ queryKey: ["credit-summary"] });
      queryClient.invalidateQueries({ queryKey: ["credit-entries"] });
      notifications.show({
        message:
          variables.type === "CREDITO" ? "Troca adicionada." : "Troca removida com sucesso.",
        color: "green",
      });
      setValueReais("");
      setDescription("");
    },
    onError: (error: unknown) => {
      notifications.show({
        message: extractErrorMessage(error, "Erro ao salvar ajuste de trocas."),
        color: "red",
      });
    },
  });

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (!creditSummariesQuery.data) return;
    const totalPages = Math.max(1, Math.ceil(creditSummariesQuery.data.count / creditsPageSize));
    setPage((prev) => Math.min(prev, totalPages));
  }, [creditSummariesQuery.data]);

  useEffect(() => {
    setHistoryPage(1);
  }, [selectedOwnerId]);

  const summaryRows = creditSummariesQuery.data?.results ?? [];
  const totalCount = creditSummariesQuery.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / creditsPageSize));
  const historyResults = creditHistoryQuery.data?.results ?? [];
  const historyCount = creditHistoryQuery.data?.count ?? 0;
  const historyTotalPages = Math.max(1, Math.ceil(historyCount / historyPageSize));

  const memberById = useMemo(() => {
    return new Map((memberOptionsQuery.data ?? []).map((member) => [member.id, member]));
  }, [memberOptionsQuery.data]);

  const ownerOptions = (memberOptionsQuery.data ?? []).map((member) => ({
    value: String(member.id),
    label: member.full_name,
  }));

  const selectedMember = selectedOwnerId ? memberById.get(selectedOwnerId) ?? null : null;
  const selectedSummaryRow =
    selectedOwnerId !== null
      ? summaryRows.find((summary) => summary.owner === selectedOwnerId) ?? null
      : null;

  const openNewCreditsModal = () => {
    setModalContext("new");
    setSelectedOwnerId(null);
    setAdjustmentType("CREDITO");
    setValueReais("");
    setDescription("");
    modalHandlers.open();
  };

  const openOwnerModal = (ownerId: number) => {
    setModalContext("view");
    setSelectedOwnerId(ownerId);
    setAdjustmentType("CREDITO");
    setValueReais("");
    setDescription("");
    modalHandlers.open();
  };

  const handleSubmitAdjustment = () => {
    if (!selectedOwnerId) {
      notifications.show({ message: "Selecione o integrante.", color: "red" });
      return;
    }

    const valueCents = parseReaisToCents(valueReais);
    if (!Number.isFinite(valueCents) || valueCents <= 0) {
      notifications.show({ message: "Informe um valor válido maior que zero.", color: "red" });
      return;
    }

    const normalizedDescription = description.trim();
    if (!normalizedDescription) {
      notifications.show({ message: "Descreva o ajuste de trocas.", color: "red" });
      return;
    }

    submitAdjustmentMutation.mutate({
      type: adjustmentType,
      owner: selectedOwnerId,
      value_cents: valueCents,
      description: normalizedDescription,
    });
  };

  if (!isAuthenticated) {
    return (
      <Container size="xl" py="md">
        <Group mb="md">
          <IconCashBanknote size={20} />
          <Title order={3}>Trocas</Title>
        </Group>
        <Text mb="sm">Autenticação necessária para visualizar e gerenciar trocas.</Text>
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
          <IconCashBanknote size={20} />
          <Title order={3}>Trocas</Title>
        </Group>
        <Button onClick={openNewCreditsModal} leftSection={<IconPlus size={16} />}>
          Nova troca
        </Button>
      </Group>

      <Group gap="sm" align="flex-end" mb="md">
        <TextInput
          label="Buscar"
          placeholder="Nome do integrante"
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />
        <Button variant="outline" onClick={() => setSearch("")}>
          Limpar
        </Button>
      </Group>

      {creditSummariesQuery.isLoading && <Text size="sm">Carregando...</Text>}
      {creditSummariesQuery.isError && <Text c="red">Erro ao carregar trocas.</Text>}

      {!creditSummariesQuery.isLoading && !creditSummariesQuery.isError && (
        <>
          <ScrollArea>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ minWidth: 220 }}>Integrante</Table.Th>
                  <Table.Th style={{ minWidth: 140 }}>Categoria</Table.Th>
                  <Table.Th style={{ minWidth: 140 }} ta="right">
                    Entradas
                  </Table.Th>
                  <Table.Th style={{ minWidth: 140 }} ta="right">
                    Débitos
                  </Table.Th>
                  <Table.Th style={{ minWidth: 140 }} ta="right">
                    Saldo
                  </Table.Th>
                  <Table.Th style={{ minWidth: 140 }} ta="right">
                    Ações
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {summaryRows.map((summary) => {
                  const member = memberById.get(summary.owner);
                  return (
                    <Table.Tr key={summary.owner}>
                      <Table.Td>{summary.owner_name}</Table.Td>
                      <Table.Td>
                        {member?.role ? memberRoleLabels[member.role] : "-"}
                      </Table.Td>
                      <Table.Td ta="right">{formatCents(summary.credits_cents)}</Table.Td>
                      <Table.Td ta="right">{formatCents(summary.debits_cents)}</Table.Td>
                      <Table.Td ta="right">
                        <Text fw={600} c={getBalanceColor(summary.balance_cents)}>
                          {summary.balance_cents < 0
                            ? formatBalanceLabel(summary.balance_cents)
                            : formatCents(summary.balance_cents)}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Button
                          size="xs"
                          variant="subtle"
                          leftSection={<IconEye size={14} />}
                          onClick={() => openOwnerModal(summary.owner)}
                        >
                          Ver
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
                {summaryRows.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={6}>
                      <Text c="dimmed">Nenhum integrante com saldo de trocas.</Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea>

          {totalCount > 0 && (
            <Group justify="center" mt="md">
              <Pagination total={totalPages} value={page} onChange={setPage} size="sm" />
            </Group>
          )}
        </>
      )}

      <Modal
        opened={modalOpened}
        onClose={modalHandlers.close}
        title={modalContext === "view" ? "Detalhes das trocas" : "Nova troca"}
        size="xl"
      >
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <div>
              <Title order={4}>
                {selectedSummaryQuery.data?.owner_name ||
                  selectedSummaryRow?.owner_name ||
                  selectedMember?.full_name ||
                  "Selecionar integrante"}
              </Title>
              <Text size="sm" c="dimmed">
                {selectedMember?.role
                  ? memberRoleLabels[selectedMember.role]
                  : "Defina um integrante para ver saldo e histórico."}
              </Text>
            </div>
            {selectedOwnerId && selectedSummaryQuery.data && (
              <Badge
                size="lg"
                color={getBalanceColor(selectedSummaryQuery.data.balance_cents)}
              >
                {formatBalanceLabel(selectedSummaryQuery.data.balance_cents)}
              </Badge>
            )}
          </Group>

          <Select
            label="Integrante"
            searchable
            filter={accentInsensitiveOptionsFilter}
            data={ownerOptions}
            value={selectedOwnerId ? String(selectedOwnerId) : null}
            onChange={(value) => setSelectedOwnerId(value ? Number(value) : null)}
            placeholder="Selecione quem receberá o ajuste"
            nothingFoundMessage="Nenhum integrante encontrado"
            disabled={modalContext === "view"}
          />

          {selectedOwnerId && selectedSummaryQuery.data && (
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
              <SummaryCard
                title="Total de entradas"
                value={formatCents(selectedSummaryQuery.data.credits_cents)}
              />
              <SummaryCard
                title="Total de saídas"
                value={formatCents(selectedSummaryQuery.data.debits_cents)}
              />
              <SummaryCard
                title="Saldo atual"
                value={formatCents(selectedSummaryQuery.data.balance_cents)}
              />
            </SimpleGrid>
          )}

          <Stack gap="xs">
            <Text fw={600}>Ajuste manual</Text>
            <Group gap="sm">
              <Button
                variant={adjustmentType === "CREDITO" ? "filled" : "outline"}
                onClick={() => setAdjustmentType("CREDITO")}
              >
                Adicionar crédito
              </Button>
              <Button
                color="red"
                variant={adjustmentType === "DEBITO" ? "filled" : "outline"}
                onClick={() => setAdjustmentType("DEBITO")}
              >
                Remover crédito
              </Button>
            </Group>
            <TextInput
              label="Valor (R$)"
              value={valueReais}
              onChange={(event) => setValueReais(event.currentTarget.value)}
              placeholder="Ex: 28,00"
            />
            <Textarea
              label={
                <FieldLabelWithCounter
                  label="Descrição"
                  counter={formatCharacterCounter(description)}
                />
              }
              value={description}
              onChange={(event) => setDescription(event.currentTarget.value)}
              maxLength={TEXT_FIELD_MAX_LENGTH}
              minRows={3}
              styles={{ label: { width: "100%" } }}
            />
            <Group justify="flex-end">
              <Button
                onClick={handleSubmitAdjustment}
                loading={submitAdjustmentMutation.isPending}
              >
                {adjustmentType === "CREDITO" ? "Salvar crédito" : "Salvar débito"}
              </Button>
            </Group>
          </Stack>

          {selectedOwnerId && (
            <div>
              <Title order={5} mb="xs">
                Histórico
              </Title>
              {creditHistoryQuery.isLoading && <Text size="sm">Carregando histórico...</Text>}
              {creditHistoryQuery.isError && (
                <Text size="sm" c="red">
                  Erro ao carregar o histórico de trocas.
                </Text>
              )}
              {!creditHistoryQuery.isLoading && !creditHistoryQuery.isError && (
                <>
                  <ScrollArea>
                    <Table highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th style={{ minWidth: 150 }}>Data</Table.Th>
                          <Table.Th style={{ minWidth: 120 }}>Tipo</Table.Th>
                          <Table.Th style={{ minWidth: 120 }}>Origem</Table.Th>
                          <Table.Th style={{ minWidth: 180 }}>Beneficiário</Table.Th>
                          <Table.Th style={{ minWidth: 220 }}>Descrição</Table.Th>
                          <Table.Th style={{ minWidth: 120 }} ta="right">
                            Valor
                          </Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {historyResults.map((entry) => (
                          <Table.Tr key={entry.id}>
                            <Table.Td>{formatPtDateTime(entry.created_at)}</Table.Td>
                            <Table.Td>
                              <Badge color={creditEntryTypeColors[entry.entry_type]}>
                                {creditEntryTypeLabels[entry.entry_type]}
                              </Badge>
                            </Table.Td>
                            <Table.Td>{creditOriginLabels[entry.origin]}</Table.Td>
                            <Table.Td>{entry.beneficiary_name || "-"}</Table.Td>
                            <Table.Td>{entry.description || "-"}</Table.Td>
                            <Table.Td ta="right">{formatCents(entry.value_cents)}</Table.Td>
                          </Table.Tr>
                        ))}
                        {historyResults.length === 0 && (
                          <Table.Tr>
                            <Table.Td colSpan={6}>
                              <Text c="dimmed">
                                Nenhum lançamento encontrado para este integrante.
                              </Text>
                            </Table.Td>
                          </Table.Tr>
                        )}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>

                  {historyCount > 0 && (
                    <Group justify="center" mt="md">
                      <Pagination
                        total={historyTotalPages}
                        value={historyPage}
                        onChange={setHistoryPage}
                        size="sm"
                      />
                    </Group>
                  )}
                </>
              )}
            </div>
          )}
        </Stack>
      </Modal>
    </Container>
  );
}
