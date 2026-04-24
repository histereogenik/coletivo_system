import { Button, Group, Modal, Text } from "@mantine/core";

type ConfirmDeleteModalProps = {
  opened: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function ConfirmDeleteModal({
  opened,
  title = "Confirmar exclusão",
  message,
  confirmLabel = "Excluir",
  loading = false,
  onClose,
  onConfirm,
}: ConfirmDeleteModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title={title} centered>
      <Text size="sm">{message}</Text>
      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button color="red" onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </Group>
    </Modal>
  );
}
