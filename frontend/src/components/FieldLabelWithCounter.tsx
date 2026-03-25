import { Text } from "@mantine/core";

type FieldLabelWithCounterProps = {
  label: string;
  counter: string;
};

export function FieldLabelWithCounter({
  label,
  counter,
}: FieldLabelWithCounterProps) {
  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.5rem",
        width: "100%",
      }}
    >
      <span>{label}</span>
      <Text component="span" size="xs" c="dimmed">
        {counter}
      </Text>
    </span>
  );
}
