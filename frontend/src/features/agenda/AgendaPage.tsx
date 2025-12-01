import { Button, Container, Group, Modal, MultiSelect, Select, TextInput, Title } from "@mantine/core";
import { DateInput, TimeInput, type DateValue } from "@mantine/dates";
import { IconCalendar, IconPlus } from "@tabler/icons-react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateSelectArg, EventClickArg, DatesSetArg, EventInput } from "@fullcalendar/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { fetchMembers } from "../lunch/membersApi";
import { createAgendaEntry, deleteAgendaEntry, fetchAgenda, updateAgendaEntry, type AgendaEntry } from "./api";
import { fetchDuties } from "../duties/api";

const statusColors: Record<string, string> = {
  PLANEJADO: "blue",
  CONCLUIDO: "green",
  CANCELADO: "red",
};

const toIsoDateLocal = (val: DateValue) => {
  if (!val) return undefined;
  if (typeof val === "string") return val;
  const offset = val.getTimezoneOffset() * 60000;
  return new Date(val.getTime() - offset).toISOString().slice(0, 10);
};

const parseIsoAsLocalDate = (value?: string | null) => {
  if (!value) return null;
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

export function AgendaPage() {
  const calendarToolbarStyles = `
    .agenda-calendar .fc-toolbar {
      gap: 8px;
    }

    @media (max-width: 640px) {
      .agenda-calendar .fc-toolbar {
        flex-wrap: wrap;
      }

      .agenda-calendar .fc-toolbar-chunk {
        width: 100%;
        justify-content: center;
      }

      .agenda-calendar .fc-toolbar-chunk:nth-child(1) {
        order: 1;
      }

      .agenda-calendar .fc-toolbar-chunk:nth-child(2) {
        order: 2;
      }

      .agenda-calendar .fc-toolbar-chunk:nth-child(3) {
        order: 3;
      }
    }
  `;
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpened, modalHandlers] = useDisclosure(false);
  const [selectedDate, setSelectedDate] = useState<DateValue>(new Date());
  const [viewRange, setViewRange] = useState<{ from?: string; to?: string }>(() => {
    const base = new Date();
    const day = base.getDay();
    const diffToMonday = (day + 6) % 7;
    const monday = new Date(base);
    monday.setDate(base.getDate() - diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { from: toIsoDateLocal(monday), to: toIsoDateLocal(sunday) };
  });
  const [editing, setEditing] = useState<AgendaEntry | null>(null);
  const [formState, setFormState] = useState<Partial<AgendaEntry> & { member_ids?: number[] }>({
    date: toIsoDateLocal(new Date()),
    start_time: "09:00",
    end_time: "",
    duty: undefined as unknown as number,
    status: "PLANEJADO",
    notes: "",
    member_ids: [],
  });

  const agendaQuery = useQuery({
    queryKey: ["agenda", viewRange.from, viewRange.to],
    queryFn: () =>
      fetchAgenda({
        date_from: viewRange.from,
        date_to: viewRange.to,
      }),
  });

  const membersQuery = useQuery({
    queryKey: ["members-for-agenda"],
    queryFn: () => fetchMembers(),
    enabled: isAuthenticated,
  });

  const dutiesQuery = useQuery({
    queryKey: ["duties-for-agenda"],
    queryFn: () => fetchDuties(),
    enabled: isAuthenticated,
  });

  const invalidateAgenda = () =>
    queryClient.invalidateQueries({
      predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "agenda",
    });

  const createMutation = useMutation({
    mutationFn: (payload: Partial<AgendaEntry> & { member_ids?: number[] }) => createAgendaEntry(payload),
    onSuccess: () => {
      invalidateAgenda();
      notifications.show({ message: "Registro criado na agenda.", color: "green" });
      modalHandlers.close();
    },
    onError: (err: unknown) => {
      const data = (err as { response?: { data?: unknown } })?.response?.data;
      const msg = data ? JSON.stringify(data) : "Erro ao criar registro.";
      notifications.show({ message: msg, color: "red" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<AgendaEntry> & { member_ids?: number[] } }) =>
      updateAgendaEntry(id, payload),
    onSuccess: () => {
      invalidateAgenda();
      notifications.show({ message: "Registro atualizado.", color: "green" });
      modalHandlers.close();
    },
    onError: (err: unknown) => {
      const data = (err as { response?: { data?: unknown } })?.response?.data;
      const msg = data ? JSON.stringify(data) : "Erro ao atualizar registro.";
      notifications.show({ message: msg, color: "red" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAgendaEntry(id),
    onSuccess: () => {
      invalidateAgenda();
      notifications.show({ message: "Registro removido.", color: "green" });
    },
    onError: (err: unknown) => {
      const data = (err as { response?: { data?: unknown } })?.response?.data;
      const msg = data ? JSON.stringify(data) : "Erro ao remover registro.";
      notifications.show({ message: msg, color: "red" });
    },
  });

  const openNew = () => {
    setEditing(null);
    setFormState({
      date: toIsoDateLocal(selectedDate) || toIsoDateLocal(new Date()),
      start_time: "09:00",
      end_time: "",
      duty: undefined as unknown as number,
      status: "PLANEJADO",
      notes: "",
      member_ids: [],
    });
    modalHandlers.open();
  };

  const openEdit = (entry: AgendaEntry) => {
    setEditing(entry);
    setFormState({
      date: entry.date,
      start_time: entry.start_time,
      end_time: entry.end_time || "",
      duty: entry.duty,
      status: entry.status,
      notes: entry.notes || "",
      member_ids: entry.members?.map((m) => m.id) ?? [],
    });
    modalHandlers.open();
  };

  const handleSubmit = () => {
    if (!formState.date || !formState.start_time || !formState.duty) {
      notifications.show({ message: "Preencha data, horário e função.", color: "red" });
      return;
    }
    const payload = {
      ...formState,
      member_ids: formState.member_ids ?? [],
      end_time: formState.end_time || null,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const events: EventInput[] = useMemo(
    () =>
      (agendaQuery.data || []).map((entry) => ({
        id: entry.id.toString(),
        title: `${entry.duty_name || `Função #${entry.duty}`} • ${
          entry.members?.map((m) => m.full_name).join(", ") || "Sem integrantes"
        }`,
        start: `${entry.date}T${entry.start_time}`,
        end: entry.end_time ? `${entry.date}T${entry.end_time}` : undefined,
        color: statusColors[entry.status] || undefined,
        extendedProps: { entry },
      })),
    [agendaQuery.data]
  );

  const handleSelect = (info: DateSelectArg) => {
    const startDate = toIsoDateLocal(info.start);
    const startTime = info.startStr.split("T")[1]?.slice(0, 5) || "09:00";
    const endTime = info.endStr && info.endStr.includes("T") ? info.endStr.split("T")[1]?.slice(0, 5) : "";
    setEditing(null);
    setFormState((prev) => ({
      ...prev,
      date: startDate,
      start_time: startTime,
      end_time: endTime,
      duty: undefined as unknown as number,
      member_ids: [],
    }));
    modalHandlers.open();
  };

  const handleEventClick = (arg: EventClickArg) => {
    const entry = (arg.event.extendedProps as { entry?: AgendaEntry }).entry;
    if (!entry) return;
    openEdit(entry);
  };

  const handleDatesSet = (arg: DatesSetArg) => {
    // FullCalendar fornece end exclusivo; subtrair 1 dia para incluir o último dia visível
    const endInclusive = new Date(arg.end);
    endInclusive.setDate(endInclusive.getDate() - 1);
    setSelectedDate(arg.start);
    setViewRange({ from: toIsoDateLocal(arg.start), to: toIsoDateLocal(endInclusive) });
  };

  return (
    <Container size="xl" py="md">
      <style>{calendarToolbarStyles}</style>
      <Group mb="md" justify="space-between">
        <Group>
          <IconCalendar size={20} />
          <Title order={3}>Agenda</Title>
        </Group>
        {isAuthenticated && (
          <Button onClick={openNew} leftSection={<IconPlus size={16} />}>
            Novo
          </Button>
        )}
      </Group>

      <div className="agenda-calendar">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          locale="pt-br"
          height="auto"
          selectable={isAuthenticated}
          selectMirror
          events={events}
          select={isAuthenticated ? handleSelect : undefined}
          eventClick={isAuthenticated ? handleEventClick : undefined}
          datesSet={handleDatesSet}
          nowIndicator
          slotMinTime="07:00:00"
          slotMaxTime="22:00:00"
          eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        />
      </div>

      <Modal
        opened={modalOpened}
        onClose={modalHandlers.close}
        title={editing ? "Editar registro" : "Novo registro"}
        size="lg"
      >
        <div className="flex flex-col gap-3">
          <DateInput
            label="Data"
            value={formState.date ? parseIsoAsLocalDate(formState.date) : null}
            onChange={(val) =>
              setFormState((prev) => ({ ...prev, date: val ? toIsoDateLocal(val) : undefined }))
            }
            valueFormat="DD/MM/YYYY"
            locale="pt-br"
          />
          <Group grow>
            <TimeInput
              label="Início"
              value={formState.start_time ?? ""}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, start_time: event.currentTarget.value || "" }))
              }
              withSeconds={false}
              placeholder="09:00"
            />
            <TimeInput
              label="Término"
              value={formState.end_time ?? ""}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, end_time: event.currentTarget.value || "" }))
              }
              withSeconds={false}
              placeholder="Opcional"
            />
          </Group>
          <Select
            label="Função"
            data={(dutiesQuery.data || []).map((d) => ({ value: d.id.toString(), label: d.name }))}
            value={formState.duty ? formState.duty.toString() : null}
            onChange={(val) => setFormState((prev) => ({ ...prev, duty: val ? Number(val) : undefined }))}
            placeholder="Selecione"
          />
          <MultiSelect
            label="Integrantes"
            data={(membersQuery.data || []).map((m) => ({ value: m.id.toString(), label: m.full_name }))}
            value={(formState.member_ids || []).map((id) => id.toString())}
            onChange={(vals) => setFormState((prev) => ({ ...prev, member_ids: vals.map((v) => Number(v)) }))}
            searchable
            placeholder="Escolha integrantes"
          />
          <Select
            label="Status"
            data={[
              { value: "PLANEJADO", label: "Planejado" },
              { value: "CONCLUIDO", label: "Concluído" },
              { value: "CANCELADO", label: "Cancelado" },
            ]}
            value={formState.status ?? undefined}
            onChange={(val) => setFormState((prev) => ({ ...prev, status: val || "PLANEJADO" }))}
          />
          <TextInput
            label="Notas"
            value={formState.notes ?? ""}
            onChange={(e) => setFormState((prev) => ({ ...prev, notes: e.currentTarget.value }))}
            placeholder="Observações adicionais"
          />
          <Group justify="space-between" mt="sm">
            {editing ? (
              <Button
                variant="outline"
                color="red"
                onClick={() => {
                  if (editing) deleteMutation.mutate(editing.id);
                }}
                loading={deleteMutation.isPending}
              >
                Remover
              </Button>
            ) : (
              <span />
            )}
            <Button onClick={handleSubmit} loading={createMutation.isPending || updateMutation.isPending}>
              {editing ? "Salvar" : "Criar"}
            </Button>
          </Group>
        </div>
      </Modal>
    </Container>
  );
}
