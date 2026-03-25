import { Button, Card, Container, Group, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { IconArrowRight, IconHeartHandshake, IconSoup, IconUsersGroup } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { PublicHeader } from "../../components/PublicHeader";

const whoWeAreCards = [
  {
    icon: <IconHeartHandshake size={20} />,
    title: "Cuidado e acolhimento",
    description:
      "O Almoço Coletivo nasce do desejo de acolher pessoas e fortalecer vínculos por meio de uma refeição partilhada, feita com atenção e respeito.",
  },
  {
    icon: <IconSoup size={20} />,
    title: "Comida como encontro",
    description:
      "Mais do que servir comida, o projeto cria um espaço de presença, escuta e convivência entre famílias, apoiadores e quem chega para participar.",
  },
  {
    icon: <IconUsersGroup size={20} />,
    title: "Força coletiva",
    description:
      "Cada almoço acontece graças à colaboração de muitas mãos, entre trabalho voluntário, doações, organização e compromisso com a comunidade.",
  },
];

export function LandingPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, rgba(232,245,233,1) 0%, rgba(248,250,252,1) 42%, rgba(255,255,255,1) 100%)",
      }}
    >
      <Container size="lg" py="lg">
        <PublicHeader subtitle="Rede de cuidado, partilha e encontro." />

        <Paper withBorder radius="xl" p={{ base: "xl", sm: "3rem" }} mb="xl">
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
            <Stack justify="center" gap="lg">
              <div>
                <Text fw={700} c="teal" mb="sm">
                  Comunidade à mesa
                </Text>
                <Title order={1} style={{ lineHeight: 1.05 }}>
                  Um espaço de almoço, presença e construção coletiva.
                </Title>
              </div>
              <Text size="lg" c="dimmed">
                O projeto reúne pessoas em torno da comida, do acolhimento e da partilha do
                cotidiano, criando um ambiente onde cada encontro fortalece a vida em comunidade.
              </Text>
              <Group>
                <Button component={Link} to="/cadastro" size="md" rightSection={<IconArrowRight size={16} />}>
                  Fazer cadastro
                </Button>
                <Button component={Link} to="/login" size="md" variant="outline">
                  Acessar o painel
                </Button>
              </Group>
            </Stack>

            <Card withBorder radius="xl" padding="xl" bg="teal.0">
              <Stack gap="md">
                <Text fw={700} c="teal.8">
                  Um convite à participação
                </Text>
                <Text size="lg">
                  “Quando a mesa é compartilhada, o cuidado também se multiplica.”
                </Text>
                <Text c="dimmed">
                  Aqui você pode se aproximar do projeto, conhecer melhor a proposta e iniciar seu
                  cadastro para participar dessa rede de apoio, encontro e convivência.
                </Text>
              </Stack>
            </Card>
          </SimpleGrid>
        </Paper>

        <Stack gap="md" mb="lg">
          <Text fw={700} c="teal">
            Quem somos
          </Text>
          <Title order={2}>Uma iniciativa construída em torno da partilha.</Title>
          <Text c="dimmed" maw={720}>
            O Almoço Coletivo é uma iniciativa comunitária voltada ao encontro entre pessoas,
            famílias e apoiadores, tendo a refeição como ponto de partida para relações mais
            próximas, solidárias e humanas.
          </Text>
        </Stack>

        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
          {whoWeAreCards.map((item) => (
            <Card key={item.title} withBorder radius="lg" padding="lg">
              <Stack gap="sm">
                <Group gap="xs">
                  {item.icon}
                  <Text fw={700}>{item.title}</Text>
                </Group>
                <Text c="dimmed" size="sm">
                  {item.description}
                </Text>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      </Container>
    </div>
  );
}
