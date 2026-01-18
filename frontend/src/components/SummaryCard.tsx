import { Card, Group, Text, Title } from "@mantine/core";
import React from "react";

type SummaryCardProps = {
  title: string;
  value: string;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
};

export function SummaryCard({ title, value, subtitle, icon }: SummaryCardProps) {
  return (
    <Card withBorder shadow="sm" padding="lg" radius="md">
      <Group justify="space-between" mb="sm">
        <Text size="sm" c="dimmed">
          {title}
        </Text>
        {icon}
      </Group>
      <Title order={3}>{value}</Title>
      {subtitle && (
        <Text size="sm" c="dimmed" mt="xs" component="div">
          {subtitle}
        </Text>
      )}
    </Card>
  );
}
