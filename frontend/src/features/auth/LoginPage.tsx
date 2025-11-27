import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Card, Container, PasswordInput, TextInput, Title } from "@mantine/core";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { api } from "../../shared/api";
import { useAuth } from "../../context/AuthContext";

const schema = z.object({
  username: z.string().min(3, "Informe o usuário"),
  password: z.string().min(3, "Informe a senha"),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    try {
      const { data } = await api.post<{ access: string; refresh: string }>(
        "/api/auth/token/",
        values
      );
      login(data.access);
      navigate("/");
    } catch (err) {
      setError("password", { message: "Usuário ou senha inválidos" });
    }
  };

  return (
    <Container size="xs" py="xl">
      <Card withBorder shadow="sm" radius="md" padding="lg">
        <Title order={3} mb="md">
          Login
        </Title>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <div>
            <TextInput
              label="Usuário"
              placeholder="admin"
              {...register("username")}
              error={errors.username?.message}
            />
          </div>
          <div>
            <PasswordInput
              label="Senha"
              placeholder="Sua senha"
              {...register("password")}
              error={errors.password?.message}
            />
          </div>
          <Button type="submit" loading={isSubmitting} mt="sm">
            Entrar
          </Button>
        </form>
      </Card>
    </Container>
  );
}
