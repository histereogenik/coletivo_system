import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Card,
  Container,
  Divider,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCheck, IconHeartHandshake, IconPlus, IconTrash, IconUsers } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PublicHeader } from "../../components/PublicHeader";
import { extractErrorMessage } from "../../shared/errors";
import { fetchPublicRegistrationMeta, submitPublicRegistration } from "./api";
import type {
  PublicRegistrationChildInput,
  PublicRegistrationFormValues,
  PublicRegistrationPayload,
} from "./types";

type AdultErrorFields = Partial<Record<"full_name" | "role" | "diet", string>>;
type ChildErrorFields = Partial<Record<"full_name" | "diet", string>>;

const createEmptyChild = (): PublicRegistrationChildInput => ({
  full_name: "",
  diet: null,
  observations: "",
});

const createEmptyForm = (): PublicRegistrationFormValues => ({
  full_name: "",
  phone: "",
  email: "",
  address: "",
  heard_about: "",
  role: null,
  diet: null,
  observations: "",
  children: [],
});

export function PublicRegistrationPage() {
  const [formValues, setFormValues] = useState<PublicRegistrationFormValues>(createEmptyForm);
  const [adultErrors, setAdultErrors] = useState<AdultErrorFields>({});
  const [childErrors, setChildErrors] = useState<ChildErrorFields[]>([]);
  const [submitErrorMessage, setSubmitErrorMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const metaQuery = useQuery({
    queryKey: ["public-registration-meta"],
    queryFn: fetchPublicRegistrationMeta,
  });

  const submitMutation = useMutation({
    mutationFn: (payload: PublicRegistrationPayload) => submitPublicRegistration(payload),
    onSuccess: (data) => {
      setSubmitted(true);
      setSuccessMessage(data.detail || "Cadastro enviado com sucesso.");
      setSubmitErrorMessage("");
      notifications.show({ message: "Cadastro enviado com sucesso.", color: "green" });
    },
    onError: (err: unknown) => {
      const message = extractErrorMessage(err, "Não foi possível enviar o cadastro.");
      setSubmitErrorMessage(message);
      notifications.show({ message, color: "red" });
    },
  });

  const dietOptions = metaQuery.data?.diet ?? [];
  const roleOptions = metaQuery.data?.role ?? [];

  const childCards = useMemo(
    () =>
      formValues.children.map((child, index) => ({
        ...child,
        index,
        errors: childErrors[index] ?? {},
      })),
    [childErrors, formValues.children]
  );

  const updateAdultField = <K extends keyof PublicRegistrationFormValues>(
    field: K,
    value: PublicRegistrationFormValues[K]
  ) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
    if (field === "full_name" || field === "role" || field === "diet") {
      setAdultErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    if (submitErrorMessage) setSubmitErrorMessage("");
  };

  const updateChildField = <K extends keyof PublicRegistrationChildInput>(
    index: number,
    field: K,
    value: PublicRegistrationChildInput[K]
  ) => {
    setFormValues((prev) => ({
      ...prev,
      children: prev.children.map((child, childIndex) =>
        childIndex === index ? { ...child, [field]: value } : child
      ),
    }));
    setChildErrors((prev) =>
      prev.map((errors, childIndex) =>
        childIndex === index ? { ...errors, [field]: undefined } : errors
      )
    );
    if (submitErrorMessage) setSubmitErrorMessage("");
  };

  const addChild = () => {
    setFormValues((prev) => ({ ...prev, children: [...prev.children, createEmptyChild()] }));
    setChildErrors((prev) => [...prev, {}]);
  };

  const removeChild = (index: number) => {
    setFormValues((prev) => ({
      ...prev,
      children: prev.children.filter((_, childIndex) => childIndex !== index),
    }));
    setChildErrors((prev) => prev.filter((_, childIndex) => childIndex !== index));
  };

  const resetForm = () => {
    setFormValues(createEmptyForm());
    setAdultErrors({});
    setChildErrors([]);
    setSubmitErrorMessage("");
    setSuccessMessage("");
    setSubmitted(false);
  };

  const validateForm = () => {
    const nextAdultErrors: AdultErrorFields = {};
    const nextChildErrors: ChildErrorFields[] = formValues.children.map(() => ({}));

    if (!formValues.full_name.trim()) {
      nextAdultErrors.full_name = "Informe seu nome completo.";
    }
    if (!formValues.role) {
      nextAdultErrors.role = "Selecione a categoria.";
    }
    if (!formValues.diet) {
      nextAdultErrors.diet = "Selecione a dieta.";
    }

    formValues.children.forEach((child, index) => {
      if (!child.full_name.trim()) {
        nextChildErrors[index].full_name = "Informe o nome da criança.";
      }
      if (!child.diet) {
        nextChildErrors[index].diet = "Selecione a dieta.";
      }
    });

    setAdultErrors(nextAdultErrors);
    setChildErrors(nextChildErrors);

    const hasAdultErrors = Object.values(nextAdultErrors).some(Boolean);
    const hasChildErrors = nextChildErrors.some((error) => Object.values(error).some(Boolean));
    return !(hasAdultErrors || hasChildErrors);
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      setSubmitErrorMessage("Revise os campos obrigatórios antes de enviar.");
      notifications.show({
        message: "Revise os campos obrigatórios antes de enviar.",
        color: "red",
      });
      return;
    }

    const payload: PublicRegistrationPayload = {
      full_name: formValues.full_name.trim(),
      phone: formValues.phone.trim() || undefined,
      email: formValues.email.trim() || undefined,
      address: formValues.address.trim(),
      heard_about: formValues.heard_about.trim(),
      role: formValues.role as string,
      diet: formValues.diet as string,
      observations: formValues.observations.trim(),
      children: formValues.children.map((child) => ({
        full_name: child.full_name.trim(),
        diet: child.diet as string,
        observations: child.observations.trim(),
      })),
    };

    submitMutation.mutate(payload);
  };

  return (
    <Box
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, rgba(239,246,255,1) 0%, rgba(255,255,255,1) 35%, rgba(247,250,252,1) 100%)",
      }}
    >
      <Container size="md" py={{ base: "lg", sm: "xl" }}>
        <PublicHeader subtitle="Cadastro público para participar do projeto." mode="back" />

        <Paper withBorder shadow="sm" radius="xl" p={{ base: "lg", sm: "xl" }}>
          <Stack gap="lg">
            <Group gap="sm" align="center">
              <ThemeIcon size={48} radius="xl" color="teal" variant="light">
                <IconHeartHandshake size={26} />
              </ThemeIcon>
              <div>
                <Title order={2}>Cadastro para o Almoço Coletivo</Title>
                <Text c="dimmed" mt={4}>
                  Preencha seus dados e, se quiser, já inclua o cadastro das crianças no mesmo envio.
                </Text>
              </div>
            </Group>

            {metaQuery.isLoading && <Text>Carregando formulário...</Text>}

            {metaQuery.isError && (
              <Alert color="red" title="Não foi possível carregar o formulário.">
                <Stack gap="sm">
                  <Text size="sm">
                    Tente novamente em instantes. Se o problema continuar, peça ajuda à equipe do coletivo.
                  </Text>
                  <Group>
                    <Button variant="outline" onClick={() => metaQuery.refetch()}>
                      Tentar novamente
                    </Button>
                  </Group>
                </Stack>
              </Alert>
            )}

            {!metaQuery.isLoading && !metaQuery.isError && submitted && (
              <Card withBorder radius="lg" padding="xl">
                <Stack align="center" ta="center" gap="md">
                  <ThemeIcon size={56} radius="xl" color="green">
                    <IconCheck size={28} />
                  </ThemeIcon>
                  <Title order={3}>Cadastro enviado com sucesso</Title>
                  <Text c="dimmed">
                    {successMessage ||
                      "Recebemos seu cadastro. Agora ele ficará pendente de revisão pela equipe."}
                  </Text>
                  <Button onClick={resetForm}>Fazer novo cadastro</Button>
                </Stack>
              </Card>
            )}

            {!metaQuery.isLoading && !metaQuery.isError && !submitted && (
              <Stack gap="lg">
                {submitErrorMessage && (
                  <Alert color="red" title="Não foi possível enviar o cadastro.">
                    {submitErrorMessage}
                  </Alert>
                )}

                <div>
                  <Title order={4} mb="xs">
                    Seus dados
                  </Title>
                  <Text c="dimmed" size="sm">
                    Os campos de categoria e dieta são obrigatórios. Os demais ajudam a equipe a conhecer melhor você.
                  </Text>
                </div>

                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <TextInput
                    label="Nome completo"
                    placeholder="Seu nome completo"
                    value={formValues.full_name}
                    onChange={(event) => updateAdultField("full_name", event.currentTarget.value)}
                    error={adultErrors.full_name}
                  />
                  <TextInput
                    label="Telefone"
                    placeholder="+5511999999999"
                    value={formValues.phone}
                    onChange={(event) => updateAdultField("phone", event.currentTarget.value)}
                  />
                  <TextInput
                    label="E-mail"
                    placeholder="voce@exemplo.com"
                    value={formValues.email}
                    onChange={(event) => updateAdultField("email", event.currentTarget.value)}
                  />
                  <TextInput
                    label="Endereço"
                    placeholder="Rua, número, bairro"
                    value={formValues.address}
                    onChange={(event) => updateAdultField("address", event.currentTarget.value)}
                  />
                  <TextInput
                    label="Como conheceu o coletivo"
                    placeholder="Ex.: indicação, Instagram, amigos"
                    value={formValues.heard_about}
                    onChange={(event) => updateAdultField("heard_about", event.currentTarget.value)}
                  />
                  <Select
                    label="Categoria"
                    placeholder="Selecione"
                    data={roleOptions}
                    value={formValues.role}
                    onChange={(value) => updateAdultField("role", value)}
                    error={adultErrors.role}
                    nothingFoundMessage="Nenhuma opção encontrada"
                  />
                  <Select
                    label="Dieta"
                    placeholder="Selecione"
                    data={dietOptions}
                    value={formValues.diet}
                    onChange={(value) => updateAdultField("diet", value)}
                    error={adultErrors.diet}
                    nothingFoundMessage="Nenhuma opção encontrada"
                  />
                </SimpleGrid>

                <Textarea
                  label="Observações"
                  placeholder="Se quiser, conte algo importante para a equipe."
                  minRows={4}
                  value={formValues.observations}
                  onChange={(event) => updateAdultField("observations", event.currentTarget.value)}
                />

                <Divider label="Crianças" labelPosition="left" />

                <Group justify="space-between" align="center">
                  <div>
                    <Title order={4}>Cadastrar criança</Title>
                    <Text size="sm" c="dimmed">
                      Se quiser, você pode incluir uma ou mais crianças junto com o seu cadastro.
                    </Text>
                  </div>
                  <Button variant="outline" leftSection={<IconPlus size={16} />} onClick={addChild}>
                    Adicionar criança
                  </Button>
                </Group>

                {childCards.length === 0 && (
                  <Card withBorder radius="lg" padding="lg">
                    <Group gap="sm" align="flex-start">
                      <ThemeIcon color="blue" variant="light" radius="xl">
                        <IconUsers size={18} />
                      </ThemeIcon>
                      <div>
                        <Text fw={600}>Nenhuma criança adicionada.</Text>
                        <Text size="sm" c="dimmed">
                          Use o botão acima se quiser enviar os cadastros das crianças no mesmo formulário.
                        </Text>
                      </div>
                    </Group>
                  </Card>
                )}

                <Stack gap="md">
                  {childCards.map((child) => (
                    <Card key={child.index} withBorder radius="lg" padding="lg">
                      <Stack gap="md">
                        <Group justify="space-between" align="center">
                          <div>
                            <Text fw={600}>Criança {child.index + 1}</Text>
                            <Text size="sm" c="dimmed">
                              Preencha os dados básicos para o cadastro.
                            </Text>
                          </div>
                          <ActionIcon
                            color="red"
                            variant="light"
                            aria-label={`Remover criança ${child.index + 1}`}
                            onClick={() => removeChild(child.index)}
                          >
                            <IconTrash size={18} />
                          </ActionIcon>
                        </Group>

                        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                          <TextInput
                            label="Nome completo"
                            placeholder="Nome da criança"
                            value={child.full_name}
                            onChange={(event) =>
                              updateChildField(child.index, "full_name", event.currentTarget.value)
                            }
                            error={child.errors.full_name}
                          />
                          <Select
                            label="Dieta"
                            placeholder="Selecione"
                            data={dietOptions}
                            value={child.diet}
                            onChange={(value) => updateChildField(child.index, "diet", value)}
                            error={child.errors.diet}
                            nothingFoundMessage="Nenhuma opção encontrada"
                          />
                        </SimpleGrid>

                        <Textarea
                          label="Observações"
                          placeholder="Se quiser, conte algo importante sobre a criança."
                          minRows={3}
                          value={child.observations}
                          onChange={(event) =>
                            updateChildField(child.index, "observations", event.currentTarget.value)
                          }
                        />
                      </Stack>
                    </Card>
                  ))}
                </Stack>

                <Group justify="flex-end">
                  <Button size="md" loading={submitMutation.isPending} onClick={handleSubmit}>
                    Enviar cadastro
                  </Button>
                </Group>
              </Stack>
            )}
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
