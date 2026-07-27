import { Anchor, Box, Container, Group, Image, Stack, Text } from "@mantine/core";

const currentYear = new Date().getFullYear();
const trademark = "\u2122";

const clientInfo = {
  companyName: `Alimento Imperativo${trademark}`,
  email: "alimentoimperativo@gmail.com",
  phone: "+55 62 93618-0116",
};

const developerInfo = {
  companyName: `TUSK Sistemas${trademark}`,
  phone: "+55 62 93618-0408",
};

export function SystemFooter() {
  return (
    <Box
      component="footer"
      style={{
        position: "relative",
        zIndex: 300,
        borderTop: "1px solid var(--mantine-color-gray-3)",
        backgroundColor: "var(--mantine-color-body)",
      }}
    >
      <Container size="xl" py="md">
        <Group justify="space-between" align="center" gap="lg">
          <Group gap="md" wrap="nowrap">
            <Image
              src="/almologo.png"
              alt="Almoço Coletivo"
              w={120}
              h="auto"
              fit="contain"
              style={{ filter: "grayscale(1)", flexShrink: 0 }}
            />
            <Stack gap={2}>
              <Anchor href={`mailto:${clientInfo.email}`} size="sm" c="dimmed">
                {clientInfo.email}
              </Anchor>
              <Anchor href={`tel:${clientInfo.phone.replace(/\s+/g, "")}`} size="sm" c="dimmed">
                {clientInfo.phone}
              </Anchor>
            </Stack>
          </Group>

          <Group gap="sm" wrap="nowrap">
            <Box
              p={4}
              style={{
                backgroundColor: "white",
                flexShrink: 0,
              }}
            >
              <Image src="/tusklogo.png" alt="Logo da TUSK Sistemas" w={70} h={70} />
            </Box>
            <Stack gap={2}>
              <Text fz={10} c="dimmed">
                desenvolvido por {developerInfo.companyName}
              </Text>
              <Anchor
                href={`tel:${developerInfo.phone.replace(/\s+/g, "")}`}
                fz={10}
                c="dimmed"
              >
                {developerInfo.phone}
              </Anchor>
            </Stack>
          </Group>
        </Group>

        <Group gap="sm" mt="sm">
          <Text size="xs" c="dimmed">
            Copyright {currentYear} {clientInfo.companyName}.
          </Text>
        </Group>
      </Container>
    </Box>
  );
}
