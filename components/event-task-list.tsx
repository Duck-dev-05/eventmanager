"use client";

import { useEffect, useState, useTransition } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  createTask,
  deleteTask,
  toggleTask,
  type TaskState,
} from "@/lib/task-actions";
import type { EventTask } from "@/lib/tasks";
import { shortDate } from "@/lib/event-format";
import { CheckCircleSolidIcon, EditIcon, PlusIcon } from "@/components/icons";
import { Avatar } from "./avatar";
import { primaryButton } from "@/components/ui";
import { TaskEditDialog } from "./task-edit-dialog";
import { InlineNotice } from "./inline-notice";

const inputClass =
  "h-11 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-[13.5px] text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-[#d9773e] focus:ring-2 focus:ring-[#f6e3d2] disabled:cursor-not-allowed disabled:opacity-50";

export function EventTaskList({
  eventId,
  tasks,
  team,
  canEdit,
  canDelete,
}: {
  eventId: string;
  tasks: EventTask[];
  team: Array<{ id: string; name: string }>;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [openCreate, setOpenCreate] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [openEdit, setOpenEdit] = useState<EventTask | null>(null);
  const [notice, setNotice] = useState<
    { tone: "error" | "success"; text: string } | null
  >(null);

  const doneCount = tasks.filter((t) => t.status === "done").length;
  const progressPercent =
    tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;

  function handleCreate() {
    setOpenCreate(true);
  }

  function handleCloseCreate() {
    setOpenCreate(false);
  }

  function handleDelete(task: EventTask) {
    setBusy(task.id);
    startTransition(async () => {
      const result = await deleteTask(eventId, task.id);
      setBusy(null);
      setConfirmDelete(null);
      if (result.success) {
        setNotice(null);
        router.refresh();
      } else {
        setNotice({ tone: "error", text: result.error });
      }
    });
  }

  function handleToggle(task: EventTask) {
    setBusy(task.id);
    startTransition(async () => {
      const result = await toggleTask(
        eventId,
        task.id,
        task.status === "done" ? "open" : "done",
      );
      setBusy(null);
      if (result.success) {
        setNotice(null);
        router.refresh();
      } else {
        setNotice({ tone: "error", text: result.error });
      }
    });
  }

  function handleEdit(task: EventTask) {
    setOpenEdit(task);
  }

  function handleCloseEdit() {
    setOpenEdit(null);
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[#e8e6de] bg-white shadow-sm shadow-zinc-900/[0.025]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f0ede5] bg-[#fcfbf8]/70 px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">
            Task list
          </h2>
          <p className="mt-0.5 text-[13px] text-zinc-500">
            Work assigned to the event team.
          </p>
        </div>
        {canEdit ? (
          <button type="button" onClick={handleCreate} className={primaryButton}>
            <PlusIcon className="h-4 w-4" />
            Create task
          </button>
        ) : (
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[12px] font-medium text-zinc-500">
            Read-only
          </span>
        )}
      </div>

      {notice ? (
        <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice>
      ) : null}

      {tasks.length > 0 ? (
        <div className="border-b border-[#f0ede5] bg-[#fdfcf9] px-5 py-3">
          <div className="mb-1.5 flex items-center justify-between text-[12px]">
            <span className="font-medium text-zinc-600">Completion rate</span>
            <span className="font-semibold text-zinc-800">
              {doneCount} of {tasks.length} done ({progressPercent}%)
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#f0ede5]">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      ) : null}

      <ul className="divide-y divide-[#f2efe8]">
        {tasks.map((task) => (
          <li key={task.id} className="flex items-start gap-3 px-5 py-4">
            <button
              type="button"
              onClick={() => handleToggle(task)}
              disabled={!canEdit || (pending && busy === task.id)}
              aria-label={
                task.status === "done"
                  ? `Reopen ${task.title}`
                  : `Mark ${task.title} done`
              }
              className={
                task.status === "done"
                  ? "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-500 text-white transition disabled:opacity-50"
                  : "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-[#e5e2d9] bg-white text-transparent transition hover:border-emerald-400 disabled:opacity-50"
              }
            >
              <CheckCircleSolidIcon className="h-3 w-3" />
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p
                    className={
                      task.status === "done"
                        ? "text-[13.5px] font-medium text-zinc-400 line-through"
                        : "text-[13.5px] font-medium text-zinc-900"
                    }
                  >
                    {task.title}
                  </p>
                  {task.notes ? (
                    <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-500">
                      {task.notes}
                    </p>
                  ) : null}
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11.5px] text-zinc-400">
                    {task.assigneeName ? (
                      <Avatar
                        src={task.assigneeAvatarUrl}
                        initials={task.assigneeName.slice(0, 2).toUpperCase()}
                        size="xs"
                      />
                    ) : null}
                    <span>{task.assigneeName ?? "Unassigned"}</span>
                    {task.dueAt ? (
                      <>
                        <span className="h-1 w-1 rounded-full bg-zinc-300" />
                        <span>Due {shortDate.format(new Date(task.dueAt))}</span>
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="flex flex-col gap-1 justify-end">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleEdit(task)}
                      className="inline-flex items-center gap-1 rounded-lg border border-transparent px-1.5 py-0.5 text-[11px] font-medium text-zinc-400 transition-colors hover:border-zinc-200 hover:bg-zinc-50 hover:text-zinc-600"
                    >
                      <EditIcon className="h-3 w-3" />
                      Edit
                    </button>
                  )}
                </div>
              </div>
            </div>

            <span
              className={
                task.status === "done"
                  ? "rounded-full bg-emerald-50 px-2.5 py-1 text-[11.5px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-100"
                  : "rounded-full bg-zinc-100 px-2.5 py-1 text-[11.5px] font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200"
              }
            >
              {task.status === "done" ? "Done" : "Open"}
            </span>

            {canDelete ? (
              confirmDelete === task.id ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleDelete(task)}
                    disabled={pending && busy === task.id}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50"
                  >
                    {pending && busy === task.id ? "Deleting…" : "Yes, delete"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(null)}
                    className="rounded-lg px-2 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(task.id)}
                  disabled={pending && busy === task.id}
                  aria-label={`Delete ${task.title}`}
                  className="rounded-lg border border-transparent px-2 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                >
                  Delete
                </button>
              )
            ) : null}
          </li>
        ))}
      </ul>

      {tasks.length === 0 ? (
        <div className="border-t border-[#f0ede5] px-5 py-10 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f7f4ee] text-zinc-400">
            <CheckCircleSolidIcon className="h-6 w-6" />
          </span>
          <p className="text-[13px] font-medium text-zinc-600">
            {canEdit ? "No tasks created yet" : "No tasks assigned"}
          </p>
          <p className="mt-1 text-[12px] text-zinc-400">
            {canEdit
              ? "Use “Create task” above to start breaking down the work."
              : "Check back later as tasks are added to the event."}
          </p>
        </div>
      ) : null}

      {openCreate ? (
        <TaskCreateDialog
          eventId={eventId}
          team={team}
          onClose={handleCloseCreate}
        />
      ) : null}

      {openEdit ? (
        <TaskEditDialog
          eventId={eventId}
          task={openEdit}
          team={team}
          onClose={handleCloseEdit}
        />
      ) : null}
    </section>
  );
}

function TaskCreateDialog({
  eventId,
  team,
  onClose,
}: {
  eventId: string;
  team: Array<{ id: string; name: string }>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction, saving] = useActionState<TaskState, FormData>(
    createTask,
    undefined,
  );

  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state?.success, router]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-task-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/35 px-4 py-8 backdrop-blur-sm"
    >
      <form
        action={formAction}
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl shadow-zinc-950/20 sm:p-7"
      >
        <input type="hidden" name="eventId" value={eventId} />

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fdf0e4] text-[#c96532]">
              <PlusIcon className="h-[19px] w-[19px]" />
            </span>
            <div>
              <h3
                id="create-task-title"
                className="text-[16px] font-semibold tracking-tight text-zinc-900"
              >
                Create a task
              </h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-500">
                Assign it to a teammate and set a deadline.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close task dialog"
            className="rounded-lg px-2 py-1 text-lg leading-none text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            ×
          </button>
        </div>

        <label
          htmlFor="task-title"
          className="mb-1.5 mt-6 block text-[12.5px] font-medium text-zinc-700"
        >
          Title
        </label>
        <input
          id="task-title"
          name="title"
          type="text"
          required
          maxLength={140}
          placeholder="Confirm the venue deposit"
          className={inputClass}
        />

        <label
          htmlFor="task-notes"
          className="mb-1.5 mt-4 block text-[12.5px] font-medium text-zinc-700"
        >
          Notes <span className="font-normal text-zinc-400">(optional)</span>
        </label>
        <textarea
          id="task-notes"
          name="notes"
          rows={3}
          placeholder="Anything the owner of this task should know."
          className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-[13.5px] text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-[#d9773e] focus:ring-2 focus:ring-[#f6e3d2]"
        />

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 space-y-1">
          <div className="space-y-1">
            <label
              htmlFor="task-due"
              className="block text-[12.5px] font-medium text-zinc-700"
            >
              Due date
            </label>
            <input
              id="task-due"
              name="dueDate"
              type="date"
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="task-assignee"
              className="block text-[12.5px] font-medium text-zinc-700"
            >
              Assignee
            </label>
            <select
              id="task-assignee"
              name="assigneeId"
              defaultValue=""
              className={inputClass}
            >
              <option value="">Unassigned</option>
              {team.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {state?.error ? (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-[12.5px] font-medium text-rose-600"
          >
            {state.error}
          </p>
        ) : null}

        {state?.success ? (
          <p
            role="status"
            className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-[12.5px] font-medium text-emerald-700"
          >
            {state.success}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3.5 py-2.5 text-[13px] font-semibold text-zinc-600 transition-colors hover:bg-zinc-100"
          >
            {state?.success ? "Close" : "Cancel"}
          </button>
          <button type="submit" disabled={saving} className={primaryButton}>
            <PlusIcon className="h-4 w-4" />
            {saving ? "Creating…" : "Create task"}
          </button>
        </div>
      </form>
    </div>
  );
}
