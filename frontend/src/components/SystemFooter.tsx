import { Anchor, Box, Container, Group, Image, Stack, Text } from "@mantine/core";

const currentYear = new Date().getFullYear();

const clientInfo = {
  companyName: "Alimento Imperativo™",
  email: "alimentoimperativo@gmail.com",
  phone: "+55 62 93618-0116",
};

const developerInfo = {
  companyName: "TUSK Sistemas™",
  email: "humberto.nacif@icloud.com",
  phone: "+55 62 93618-0408",
};

export function SystemFooter() {
  return (
    <Box
      component="footer"
      style={{
        borderTop: "1px solid var(--mantine-color-gray-3)",
        backgroundColor: "var(--mantine-color-body)",
      }}
    >
      <Container size="xl" py="md">
        <Group justify="space-between" align="center" gap="lg">
          <Stack gap={2}>
            <Text size="sm">{clientInfo.companyName}</Text>
            <Group gap="sm">
              <Anchor href={`mailto:${clientInfo.email}`} size="sm" c="dimmed">
                {clientInfo.email}
              </Anchor>
              <Text size="sm" c="dimmed">
                /
              </Text>
              <Anchor href={`tel:${clientInfo.phone.replace(/\s+/g, "")}`} size="sm" c="dimmed">
                {clientInfo.phone}
              </Anchor>
            </Group>
          </Stack>

          <Group gap="sm" wrap="nowrap">
            <Box
              p={4}
              style={{
                backgroundColor: "white",
                flexShrink: 0,
              }}
            >
              <Image
                src="/tusklogo.png"
                alt="Logo da TUSK Sistemas"
                w={106}
                h={106}
              />
            </Box>
            <Stack gap={2}>
              <Text size="sm" c="dimmed">
                desenvolvido por {developerInfo.companyName}
              </Text>
              <Group gap="sm">
                <Anchor href={`mailto:${developerInfo.email}`} size="sm" c="dimmed">
                  {developerInfo.email}
                </Anchor>
                <Text size="sm" c="dimmed">
                  /
                </Text>
                <Anchor
                  href={`tel:${developerInfo.phone.replace(/\s+/g, "")}`}
                  size="sm"
                  c="dimmed"
                >
                  {developerInfo.phone}
                </Anchor>
              </Group>
            </Stack>
          </Group>
        </Group>

        <Text size="xs" c="dimmed" mt="sm">
          Copyright {currentYear} {clientInfo.companyName}.
        </Text>
      </Container>
    </Box>
  );
}
