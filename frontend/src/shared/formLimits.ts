export const NAME_FIELD_MAX_LENGTH = 150;
export const TEXT_FIELD_MAX_LENGTH = 500;

export function formatCharacterCounter(
  value: string | null | undefined,
  maxLength = TEXT_FIELD_MAX_LENGTH
) {
  return `${value?.length ?? 0}/${maxLength}`;
}
