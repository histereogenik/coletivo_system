import { Button, Group, Text, Title } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { Link } from "react-router-dom";

type PublicHeaderProps = {
  subtitle: string;
  mode?: "landing" | "back";
};

export function PublicHeader({ subtitle, mode = "landing" }: PublicHeaderProps) {
  return (
    <Group justify="space-between" align="center" mb="xl">
      <div>
        <Title order={3}>Almoço Coletivo</Title>
        <Text c="dimmed" size="sm">
          {subtitle}
        </Text>
      </div>

      {mode === "landing" ? (
        <Group>
          <Button component={Link} to="/login" variant="subtle" color="dark">
            Entrar
          </Button>
          <Button component={Link} to="/cadastro" radius="xl">
            Quero me cadastrar
          </Button>
        </Group>
      ) : (
        <Button component={Link} to="/" variant="subtle" color="dark" leftSection={<IconArrowLeft size={16} />}>
          Voltar para a página inicial
        </Button>
      )}
    </Group>
  );
}
