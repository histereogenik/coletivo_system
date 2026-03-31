import type { ComboboxItem, ComboboxParsedItem, OptionsFilter } from "@mantine/core";

type ComboboxGroup = {
  group: string;
  items: ComboboxItem[];
};

export function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isComboboxGroup(option: ComboboxParsedItem): option is ComboboxGroup {
  return "group" in option;
}

function optionMatchesSearch(option: ComboboxItem, normalizedSearch: string) {
  return normalizeSearchText(option.label).includes(normalizedSearch);
}

export const accentInsensitiveOptionsFilter: OptionsFilter = ({ options, search, limit }) => {
  const normalizedSearch = normalizeSearchText(search);

  if (!normalizedSearch) {
    return options.slice(0, limit);
  }

  const filtered: ComboboxParsedItem[] = [];
  let matchedItems = 0;

  for (const option of options) {
    if (matchedItems >= limit) break;

    if (isComboboxGroup(option)) {
      const remaining = limit - matchedItems;
      const matchingItems = option.items
        .filter((item) => optionMatchesSearch(item, normalizedSearch))
        .slice(0, remaining);

      if (matchingItems.length > 0) {
        filtered.push({
          group: option.group,
          items: matchingItems,
        });
        matchedItems += matchingItems.length;
      }
      continue;
    }

    if (optionMatchesSearch(option, normalizedSearch)) {
      filtered.push(option);
      matchedItems += 1;
    }
  }

  return filtered;
};
