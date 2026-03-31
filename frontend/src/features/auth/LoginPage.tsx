import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  Card,
  Container,
  Group,
  Paper,
  PasswordInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconLock, IconSoup, IconUsersGroup } from "@tabler/icons-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { PublicHeader } from "../../components/PublicHeader";
import { useAuth } from "../../context/AuthContext";
import { api, ensureCsrfCookie } from "../../shared/api";

const schema = z.object({
  username: z.string().min(3, "Informe o usuário"),
  password: z.string().min(3, "Informe a senha"),
});

type FormValues = z.infer<typeof schema>;

const highlights = [
  {
    icon: <IconSoup size={18} />,
    title: "Organização do almoço",
    description: "Acesse o painel para acompanhar almoços, pacotes e registros do dia a dia.",
  },
  {
    icon: <IconUsersGroup size={18} />,
    title: "Gestão da comunidade",
    description: "Mantenha integrantes, novos cadastros e funções organizados em um só lugar.",
  },
];

export function LoginPage() {
  const { isAuthenticated, isAuthResolved, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectState = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
  const redirectTo = redirectState ? `${redirectState.pathname ?? "/painel"}${redirectState.search ?? ""}` : "/painel";
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!isAuthResolved || !isAuthenticated) return;
    navigate("/painel", { replace: true });
  }, [isAuthResolved, isAuthenticated, navigate]);

  const onSubmit = async (values: FormValues) => {
    try {
      await ensureCsrfCookie();
      await api.post("/api/auth/cookie/token/", values, {
        withCredentials: true,
      });
      login();
      notifications.show({ message: "Login realizado com sucesso.", color: "green" });
      navigate(redirectTo, { replace: true });
    } catch {
      setError("password", { message: "Usuário ou senha inválidos" });
      notifications.show({ message: "Usuário ou senha inválidos.", color: "red" });
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, rgba(232,245,233,1) 0%, rgba(248,250,252,1) 42%, rgba(255,255,255,1) 100%)",
      }}
    >
      <Container size="lg" py={{ base: "lg", sm: "xl" }}>
        <PublicHeader subtitle="Área interna de organização e acompanhamento." mode="back" />

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
          <Paper withBorder radius="xl" p={{ base: "xl", sm: "2.5rem" }} bg="teal.0">
            <Stack gap="lg">
              <div>
                <Text fw={700} c="teal.8" mb="sm">
                  Acesso ao painel
                </Text>
                <Title order={1} style={{ lineHeight: 1.05 }}>
                  Entre para acompanhar a organização do Almoço Coletivo.
                </Title>
              </div>
              <Text size="lg" c="dimmed">
                Este espaço é voltado para quem cuida da rotina do projeto, registra informações e
                acompanha o funcionamento das atividades e dos cadastros.
              </Text>

              <Stack gap="md">
                {highlights.map((item) => (
                  <Card key={item.title} withBorder radius="lg" padding="lg" bg="white">
                    <Group align="flex-start" wrap="nowrap">
                      <ThemeIcon color="teal" variant="light" radius="xl" mt={2}>
                        {item.icon}
                      </ThemeIcon>
                      <div>
                        <Text fw={700}>{item.title}</Text>
                        <Text c="dimmed" size="sm">
                          {item.description}
                        </Text>
                      </div>
                    </Group>
                  </Card>
                ))}
              </Stack>
            </Stack>
          </Paper>

          <Card withBorder shadow="sm" radius="xl" padding="xl">
            <Stack gap="lg">
              <Group gap="sm">
                <ThemeIcon size={46} radius="xl" color="dark">
                  <IconLock size={22} />
                </ThemeIcon>
                <div>
                  <Title order={3}>Entrar no painel</Title>
                  <Text c="dimmed" size="sm">
                    Use seu usuário e sua senha para acessar a área interna.
                  </Text>
                </div>
              </Group>

              <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
                <TextInput
                  label="Usuário"
                  placeholder="Seu usuário"
                  {...register("username")}
                  error={errors.username?.message}
                />
                <PasswordInput
                  label="Senha"
                  placeholder="Sua senha"
                  {...register("password")}
                  error={errors.password?.message}
                />
                <Button type="submit" loading={isSubmitting} mt="sm">
                  Entrar
                </Button>
              </form>
            </Stack>
          </Card>
        </SimpleGrid>
      </Container>
    </div>
  );
}
