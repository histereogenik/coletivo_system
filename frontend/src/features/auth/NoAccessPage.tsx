import { Button, Center, Paper, Stack, Text, Title } from "@mantine/core";
import { useAuth } from "../../context/AuthContext";

export function NoAccessPage() {
  const { logout } = useAuth();

  return (
    <Center py="xl">
      <Paper withBorder radius="lg" p="xl" maw={520}>
        <Stack align="center">
          <Title order={3}>Conta sem áreas liberadas</Title>
          <Text ta="center" c="dimmed">
            Solicite ao administrador principal a liberação das áreas necessárias para esta conta.
          </Text>
          <Button variant="light" onClick={logout}>
            Sair
          </Button>
        </Stack>
      </Paper>
    </Center>
  );
}
