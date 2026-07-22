import {
  Alert,
  Anchor,
  Badge,
  Button,
  Container,
  Grid,
  Group,
  Modal,
  Pagination,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconFileInvoice, IconPlus, IconRefresh } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { formatCents } from "../../shared/currency";
import { extractErrorMessage } from "../../shared/errors";
import { fetchLunches, fetchPackages } from "../lunch/api";
import {
  emitFiscalDocument,
  fetchFiscalConfiguration,
  fetchFiscalDocuments,
  refreshFiscalDocument,
  type FiscalDocument,
  type FiscalEmissionPayload,
  type FiscalRecipient,
} from "./api";

const statusLabels: Record<string, string> = {
  PENDING: "Pendente",
  PROCESSING: "Processando",
  AUTHORIZED: "Autorizada",
  REJECTED: "Rejeitada",
  CANCELLED: "Cancelada",
};

const statusColors: Record<string, string> = {
  PENDING: "gray",
  PROCESSING: "blue",
  AUTHORIZED: "green",
  REJECTED: "red",
  CANCELLED: "orange",
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = value.slice(0, 10).split("-");
  return date.length === 3 ? `${date[2]}/${date[1]}/${date[0]}` : value;
};

const emptyRecipient: FiscalRecipient = {
  name: "",
  tax_id: "",
  email: "",
  state_registration_indicator: "9",
  state_registration: "",
};

const stateOptions = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
].map((state) => ({ value: state, label: state }));

export function FiscalDocumentsPage() {
  const queryClient = useQueryClient();
  const [opened, handlers] = useDisclosure(false);
  const [page, setPage] = useState(1);
  const [documentType, setDocumentType] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<"LUNCH" | "PACKAGE">("LUNCH");
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [buyerType, setBuyerType] = useState<"CONSUMER" | "COMPANY">("CONSUMER");
  const [presence, setPresence] = useState<string>("1");
  const [recipient, setRecipient] = useState<FiscalRecipient>(emptyRecipient);
  const pageSize = 15;

  const documentsQuery = useQuery({
    queryKey: ["fiscal-documents", page, pageSize, documentType, status],
    queryFn: () =>
      fetchFiscalDocuments({
        page,
        page_size: pageSize,
        document_type: documentType || undefined,
        status: status || undefined,
      }),
  });

  const configurationQuery = useQuery({
    queryKey: ["fiscal-configuration"],
    queryFn: fetchFiscalConfiguration,
  });

  const lunchesQuery = useQuery({
    queryKey: ["fiscal-source-lunches"],
    queryFn: () =>
      fetchLunches({ page: 1, page_size: 200, payment_status: "PAGO", has_package: "false" }),
    enabled: opened,
  });

  const packagesQuery = useQuery({
    queryKey: ["fiscal-source-packages"],
    queryFn: () => fetchPackages({ page: 1, page_size: 200, payment_status: "PAGO" }),
    enabled: opened,
  });

  const sourceOptions = useMemo(() => {
    if (sourceType === "LUNCH") {
      return (lunchesQuery.data?.results ?? [])
        .filter((item) => item.value_cents > 0 && item.payment_mode !== "TROCA" && !item.package)
        .map((item) => ({
          value: String(item.id),
          label: `${formatDate(item.date)} · ${item.member_name ?? `Almoço #${item.id}`} · ${formatCents(item.value_cents)}`,
        }));
    }
    return (packagesQuery.data?.results ?? [])
      .filter((item) => item.value_cents > 0 && item.payment_mode !== "TROCA")
      .map((item) => ({
        value: String(item.id),
        label: `${formatDate(item.date)} · ${item.member_name ?? `Pacote #${item.id}`} · ${item.quantity} refeições · ${formatCents(item.value_cents)}`,
      }));
  }, [lunchesQuery.data, packagesQuery.data, sourceType]);

  useEffect(() => {
    setPage(1);
  }, [documentType, status]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["fiscal-documents"] });
  };

  const emitMutation = useMutation({
    mutationFn: emitFiscalDocument,
    onSuccess: (document) => {
      invalidate();
      notifications.show({
        message:
          document.status === "AUTHORIZED"
            ? `${document.document_type === "NFE" ? "NF-e" : "NFC-e"} autorizada.`
            : "Documento enviado para processamento.",
        color: "green",
      });
      handlers.close();
    },
    onError: (error) =>
      notifications.show({
        message: extractErrorMessage(error, "Não foi possível emitir o documento fiscal."),
        color: "red",
      }),
  });

  const refreshMutation = useMutation({
    mutationFn: refreshFiscalDocument,
    onSuccess: () => invalidate(),
    onError: (error) =>
      notifications.show({
        message: extractErrorMessage(error, "Não foi possível consultar a Focus."),
        color: "red",
      }),
  });

  const updateRecipient = (field: keyof FiscalRecipient, value: string) => {
    setRecipient((current) => ({ ...current, [field]: value }));
  };

  const updateAddress = (field: string, value: string) => {
    setRecipient((current) => ({
      ...current,
      address: {
        street: current.address?.street ?? "",
        number: current.address?.number ?? "",
        complement: current.address?.complement ?? "",
        district: current.address?.district ?? "",
        city: current.address?.city ?? "",
        state: current.address?.state ?? "GO",
        postal_code: current.address?.postal_code ?? "",
        [field]: value,
      },
    }));
  };

  const openEmission = () => {
    setSourceType("LUNCH");
    setSourceId(null);
    setBuyerType("CONSUMER");
    setPresence("1");
    setRecipient(emptyRecipient);
    handlers.open();
  };

  const submit = () => {
    if (!sourceId) {
      notifications.show({ message: "Selecione a venda que será faturada.", color: "red" });
      return;
    }
    if (buyerType === "COMPANY" && !recipient.tax_id) {
      notifications.show({ message: "Informe o CNPJ do destinatário.", color: "red" });
      return;
    }
    const payload: FiscalEmissionPayload = {
      source_type: sourceType,
      source_id: Number(sourceId),
      recipient:
        buyerType === "COMPANY"
          ? recipient
          : {
              name: recipient.name,
              tax_id: recipient.tax_id,
              email: recipient.email,
            },
      presence: Number(presence) as FiscalEmissionPayload["presence"],
    };
    emitMutation.mutate(payload);
  };

  const documents = documentsQuery.data?.results ?? [];
  const totalPages = Math.max(1, Math.ceil((documentsQuery.data?.count ?? 0) / pageSize));
  const configuration = configurationQuery.data;
  const isProduction = configuration?.environment === "production";

  return (
    <Container size="xl" py="md">
      <Group mb="md" align="center">
        <IconFileInvoice size={22} />
        <Title order={3}>Notas fiscais</Title>
        <Button ml="auto" leftSection={<IconPlus size={16} />} onClick={openEmission}>
          Emitir nota
        </Button>
      </Group>

      <Alert mb="md" color={isProduction ? "red" : "blue"} title="Ambiente fiscal">
        {isProduction
          ? "O backend está configurado para PRODUÇÃO. Documentos autorizados possuem validade fiscal."
          : "O backend está em homologação. Os documentos emitidos são testes sem validade fiscal."}
        {configuration && !configuration.ready && (
          <Text size="sm" mt="xs">
            Emissão bloqueada: configuração fiscal incompleta ou produção ainda não liberada no
            servidor.
          </Text>
        )}
      </Alert>

      <Group mb="md" align="flex-end">
        <Select
          label="Documento"
          placeholder="Todos"
          clearable
          data={[
            { value: "NFE", label: "NF-e" },
            { value: "NFCE", label: "NFC-e" },
          ]}
          value={documentType}
          onChange={setDocumentType}
        />
        <Select
          label="Situação"
          placeholder="Todas"
          clearable
          data={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))}
          value={status}
          onChange={setStatus}
        />
      </Group>

      {documentsQuery.isLoading ? (
        <Text>Carregando documentos...</Text>
      ) : documentsQuery.isError ? (
        <Text c="red">Não foi possível carregar os documentos fiscais.</Text>
      ) : (
        <ScrollArea>
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Venda</Table.Th>
                <Table.Th>Documento</Table.Th>
                <Table.Th>Ambiente</Table.Th>
                <Table.Th>Situação</Table.Th>
                <Table.Th>Número</Table.Th>
                <Table.Th>Destinatário</Table.Th>
                <Table.Th>Ações</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {documents.map((document: FiscalDocument) => (
                <Table.Tr key={document.id}>
                  <Table.Td>{formatDate(document.sale_date)}</Table.Td>
                  <Table.Td>{document.document_type === "NFE" ? "NF-e" : "NFC-e"}</Table.Td>
                  <Table.Td>
                    <Badge color={document.environment === "PRODUCTION" ? "red" : "gray"}>
                      {document.environment === "PRODUCTION" ? "Produção" : "Homologação"}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={statusColors[document.status] ?? "gray"}>
                      {statusLabels[document.status] ?? document.status}
                    </Badge>
                    {document.error_message && (
                      <Text size="xs" c="red" mt={4} maw={280}>
                        {document.error_message}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {document.number ? `${document.number} / série ${document.series}` : "—"}
                  </Table.Td>
                  <Table.Td>{document.recipient.name || "Consumidor não identificado"}</Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      {(document.status === "PENDING" || document.status === "PROCESSING") && (
                        <Button
                          size="xs"
                          variant="subtle"
                          loading={
                            refreshMutation.isPending && refreshMutation.variables === document.id
                          }
                          onClick={() => refreshMutation.mutate(document.id)}
                          aria-label="Consultar situação"
                        >
                          <IconRefresh size={16} />
                        </Button>
                      )}
                      {document.danfe_url && (
                        <Anchor
                          href={document.danfe_url}
                          target="_blank"
                          rel="noreferrer"
                          size="sm"
                        >
                          DANFE
                        </Anchor>
                      )}
                      {document.xml_url && (
                        <Anchor href={document.xml_url} target="_blank" rel="noreferrer" size="sm">
                          XML
                        </Anchor>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {!documents.length && (
                <Table.Tr>
                  <Table.Td colSpan={7}>
                    <Text ta="center" c="dimmed" py="lg">
                      Nenhum documento fiscal emitido.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}

      {(documentsQuery.data?.count ?? 0) > 0 && (
        <Group justify="center" mt="md">
          <Pagination total={totalPages} value={page} onChange={setPage} size="sm" />
        </Group>
      )}

      <Modal opened={opened} onClose={handlers.close} title="Emitir documento fiscal" size="lg">
        <Stack gap="md">
          <Grid>
            <Grid.Col span={{ base: 12, sm: 5 }}>
              <Select
                label="Origem da venda"
                data={[
                  { value: "LUNCH", label: "Almoço avulso" },
                  ...(configuration?.package_emission_allowed
                    ? [{ value: "PACKAGE", label: "Pacote de refeições" }]
                    : []),
                ]}
                value={sourceType}
                allowDeselect={false}
                onChange={(value) => {
                  setSourceType((value as "LUNCH" | "PACKAGE") || "LUNCH");
                  setSourceId(null);
                }}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 7 }}>
              <Select
                label="Venda paga"
                placeholder="Selecione a venda"
                searchable
                data={sourceOptions}
                value={sourceId}
                onChange={setSourceId}
                nothingFoundMessage="Nenhuma venda elegível encontrada"
              />
            </Grid.Col>
          </Grid>

          <Grid>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Select
                label="Destinatário"
                data={[
                  { value: "CONSUMER", label: "Consumidor final — NFC-e" },
                  { value: "COMPANY", label: "Empresa — NF-e" },
                ]}
                value={buyerType}
                allowDeselect={false}
                onChange={(value) => {
                  setBuyerType((value as "CONSUMER" | "COMPANY") || "CONSUMER");
                  setRecipient(emptyRecipient);
                }}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Select
                label="Presença do comprador"
                data={[
                  { value: "1", label: "Venda presencial" },
                  { value: "2", label: "Internet" },
                  { value: "3", label: "Teleatendimento" },
                  { value: "4", label: "Entrega em domicílio" },
                  { value: "9", label: "Outra operação não presencial" },
                ]}
                value={presence}
                allowDeselect={false}
                onChange={(value) => setPresence(value || "1")}
              />
            </Grid.Col>
          </Grid>

          <Grid>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label={buyerType === "COMPANY" ? "Razão social" : "Nome (opcional)"}
                required={buyerType === "COMPANY"}
                value={recipient.name ?? ""}
                onChange={(event) => updateRecipient("name", event.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label={buyerType === "COMPANY" ? "CNPJ" : "CPF (opcional)"}
                required={buyerType === "COMPANY"}
                value={recipient.tax_id ?? ""}
                onChange={(event) => updateRecipient("tax_id", event.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="E-mail (opcional)"
                type="email"
                value={recipient.email ?? ""}
                onChange={(event) => updateRecipient("email", event.currentTarget.value)}
              />
            </Grid.Col>
          </Grid>

          {buyerType === "COMPANY" && (
            <>
              <Grid>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Select
                    label="Indicador de inscrição estadual"
                    data={[
                      { value: "1", label: "Contribuinte de ICMS" },
                      { value: "2", label: "Contribuinte isento" },
                      { value: "9", label: "Não contribuinte" },
                    ]}
                    value={recipient.state_registration_indicator ?? "9"}
                    allowDeselect={false}
                    onChange={(value) => {
                      const indicator = value || "9";
                      setRecipient((current) => ({
                        ...current,
                        state_registration_indicator: indicator as "1" | "2" | "9",
                        state_registration:
                          indicator === "2" ? "" : current.state_registration,
                      }));
                    }}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    label="Inscrição estadual"
                    required={recipient.state_registration_indicator === "1"}
                    disabled={recipient.state_registration_indicator === "2"}
                    description={
                      recipient.state_registration_indicator === "9"
                        ? "Opcional para não contribuinte; informe somente se existir."
                        : undefined
                    }
                    value={recipient.state_registration ?? ""}
                    onChange={(event) =>
                      updateRecipient("state_registration", event.currentTarget.value)
                    }
                  />
                </Grid.Col>
              </Grid>
              <Grid>
                <Grid.Col span={{ base: 12, sm: 8 }}>
                  <TextInput
                    label="Logradouro"
                    required
                    value={recipient.address?.street ?? ""}
                    onChange={(event) => updateAddress("street", event.currentTarget.value)}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <TextInput
                    label="Número"
                    required
                    value={recipient.address?.number ?? ""}
                    onChange={(event) => updateAddress("number", event.currentTarget.value)}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    label="Complemento"
                    value={recipient.address?.complement ?? ""}
                    onChange={(event) => updateAddress("complement", event.currentTarget.value)}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    label="Bairro"
                    required
                    value={recipient.address?.district ?? ""}
                    onChange={(event) => updateAddress("district", event.currentTarget.value)}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 8 }}>
                  <TextInput
                    label="Município"
                    required
                    value={recipient.address?.city ?? ""}
                    onChange={(event) => updateAddress("city", event.currentTarget.value)}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <Select
                    label="UF"
                    required
                    searchable
                    data={stateOptions}
                    value={recipient.address?.state ?? "GO"}
                    allowDeselect={false}
                    onChange={(value) => updateAddress("state", value || "GO")}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    label="CEP"
                    required
                    value={recipient.address?.postal_code ?? ""}
                    onChange={(event) => updateAddress("postal_code", event.currentTarget.value)}
                  />
                </Grid.Col>
              </Grid>
            </>
          )}

          <Group justify="flex-end">
            <Button variant="default" onClick={handlers.close}>
              Cancelar
            </Button>
            <Button
              onClick={submit}
              loading={emitMutation.isPending}
              disabled={!configuration?.ready}
              color={isProduction ? "red" : undefined}
            >
              {isProduction ? "Emitir em produção" : "Emitir em homologação"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
