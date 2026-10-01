import {
  Badge,
  Button,
  Checkbox,
  Container,
  Group,
  Modal,
  PasswordInput,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconPencil, IconPlus, IconUsers } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { extractErrorMessage } from "../../shared/errors";
import type { CapabilityKey } from "../../shared/authStatus";
import {
  createOperator,
  fetchCapabilities,
  fetchOperators,
  updateOperator,
  type OperatorAccount,
  type OperatorPayload,
} from "./api";

const emptyForm: OperatorPayload = {
  username: "",
  first_name: "",
  last_name: "",
  password: "",
  is_active: true,
  capabilities: [],
};

export function OperatorsPage() {
  const queryClient = useQueryClient();
  const [opened, handlers] = useDisclosure(false);
  const [editing, setEditing] = useState<OperatorAccount | null>(null);
  const [form, setForm] = useState<OperatorPayload>(emptyForm);
  const operatorsQuery = useQuery({ queryKey: ["operators"], queryFn: fetchOperators });
  const capabilitiesQuery = useQuery({ queryKey: ["capabilities"], queryFn: fetchCapabilities });

  const closeModal = () => {
    handlers.close();
    setEditing(null);
    setForm(emptyForm);
  };

  const saveMutation = useMutation({
    mutationFn: async (payload: OperatorPayload) => {
      const cleanPayload = { ...payload };
      if (!cleanPayload.password) delete cleanPayload.password;
      return editing
        ? updateOperator(editing.id, cleanPayload)
        : createOperator(cleanPayload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["operators"] });
      notifications.show({
        message: editing ? "Conta atualizada." : "Conta administrativa criada.",
        color: "green",
      });
      closeModal();
    },
    onError: (error) =>
      notifications.show({
        message: extractErrorMessage(error, "Não foi possível salvar a conta."),
        color: "red",
      }),
  });

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    handlers.open();
  };

  const openEdit = (operator: OperatorAccount) => {
    setEditing(operator);
    setForm({
      username: operator.username,
      first_name: operator.first_name,
      last_name: operator.last_name,
      password: "",
      is_active: operator.is_active,
      capabilities: operator.granted_capabilities,
    });
    handlers.open();
  };

  const toggleCapability = (key: CapabilityKey, checked: boolean) => {
    setForm((current) => ({
      ...current,
      capabilities: checked
        ? [...new Set([...current.capabilities, key])]
        : current.capabilities.filter((item) => item !== key),
    }));
  };

  const submit = () => {
    if (!form.username.trim() || !form.first_name.trim()) {
      notifications.show({ message: "Informe nome e usuário.", color: "red" });
      return;
    }
    if (!editing && !form.password) {
      notifications.show({ message: "Informe a senha inicial.", color: "red" });
      return;
    }
    if (!form.capabilities.length) {
      notifications.show({ message: "Selecione ao menos uma área.", color: "red" });
      return;
    }
    saveMutation.mutate(form);
  };

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="md">
        <Group>
          <IconUsers size={22} />
          <Title order={3}>Contas administrativas</Title>
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={openNew}>
          Nova conta
        </Button>
      </Group>

      <Text c="dimmed" mb="lg">
        Cada pessoa deve usar sua própria conta. As áreas marcadas definem quais partes do sistema
        ela poderá acessar e alterar.
      </Text>

      <Table highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Nome</Table.Th>
            <Table.Th>Usuário</Table.Th>
            <Table.Th>Áreas liberadas</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th ta="right">Ações</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {(operatorsQuery.data ?? []).map((operator) => (
            <Table.Tr key={operator.id}>
              <Table.Td>{operator.display_name}</Table.Td>
              <Table.Td>{operator.username}</Table.Td>
              <Table.Td>
                <Group gap={6}>
                  {operator.granted_capabilities.map((key) => (
                    <Badge key={key} variant="light">
                      {capabilitiesQuery.data?.find((item) => item.key === key)?.label ?? key}
                    </Badge>
                  ))}
                </Group>
              </Table.Td>
              <Table.Td>
                <Badge color={operator.is_active ? "green" : "gray"}>
                  {operator.is_active ? "Ativa" : "Desativada"}
                </Badge>
              </Table.Td>
              <Table.Td ta="right">
                <Button
                  variant="subtle"
                  size="xs"
                  leftSection={<IconPencil size={15} />}
                  onClick={() => openEdit(operator)}
                >
                  Editar
                </Button>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      {operatorsQuery.isLoading && <Text mt="md">Carregando contas...</Text>}
      {operatorsQuery.isError && <Text c="red">Não foi possível carregar as contas.</Text>}

      <Modal
        opened={opened}
        onClose={closeModal}
        title={editing ? "Editar conta" : "Nova conta administrativa"}
        size="lg"
      >
        <Stack>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              label="Nome"
              required
              value={form.first_name}
              onChange={(event) => setForm({ ...form, first_name: event.currentTarget.value })}
            />
            <TextInput
              label="Sobrenome"
              value={form.last_name}
              onChange={(event) => setForm({ ...form, last_name: event.currentTarget.value })}
            />
          </SimpleGrid>
          <TextInput
            label="Usuário"
            required
            value={form.username}
            onChange={(event) => setForm({ ...form, username: event.currentTarget.value })}
          />
          <PasswordInput
            label={editing ? "Nova senha (opcional)" : "Senha inicial"}
            required={!editing}
            value={form.password ?? ""}
            onChange={(event) => setForm({ ...form, password: event.currentTarget.value })}
          />
          <div>
            <Group justify="space-between" mb="xs">
              <Text fw={600}>Áreas permitidas</Text>
              <Checkbox
                label="Selecionar todas"
                checked={
                  Boolean(capabilitiesQuery.data?.length) &&
                  form.capabilities.length === capabilitiesQuery.data?.length
                }
                onChange={(event) =>
                  setForm({
                    ...form,
                    capabilities: event.currentTarget.checked
                      ? (capabilitiesQuery.data ?? []).map((item) => item.key)
                      : [],
                  })
                }
              />
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              {(capabilitiesQuery.data ?? []).map((capability) => (
                <Checkbox
                  key={capability.key}
                  label={capability.label}
                  checked={form.capabilities.includes(capability.key)}
                  onChange={(event) =>
                    toggleCapability(capability.key, event.currentTarget.checked)
                  }
                />
              ))}
            </SimpleGrid>
          </div>
          <Switch
            label="Conta ativa"
            checked={form.is_active}
            onChange={(event) => setForm({ ...form, is_active: event.currentTarget.checked })}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={closeModal}>
              Cancelar
            </Button>
            <Button loading={saveMutation.isPending} onClick={submit}>
              Salvar
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
