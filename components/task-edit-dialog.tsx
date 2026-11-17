"use client";

import { useEffect, useTransition } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { EditIcon } from "@/components/icons";
import { primaryButton } from "@/components/ui";
import { updateTask, type TaskState } from "@/lib/task-actions";

type TaskEditDialogProps = {
  eventId: string;
  task: import("@/lib/tasks").EventTask;
  team: Array<{ id: string; name: string }>;
  onClose: () => void;
};

export function TaskEditDialog({
  eventId,
  task,
  team,
  onClose,
}: TaskEditDialogProps) {
  const [, startTransition] = useTransition();
  const router = useRouter();

  const [state, formAction, saving] = useActionState<TaskState, FormData>(
    updateTask,
    undefined,
  );

  useEffect(() => {
    if (!state?.success) return;

    router.refresh();
    const timer = setTimeout(onClose, 600);
    return () => clearTimeout(timer);
  }, [state?.success, onClose, router]);

  function handleClose() {
    startTransition(() => {
      onClose();
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-task-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/35 px-4 py-8 backdrop-blur-sm"
    >
      <form
        action={formAction}
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl shadow-zinc-950/20 sm:p-7"
      >
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="taskId" value={task.id} />

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fdf0e4] text-[#c96532]">
              <EditIcon className="h-[19px] w-[19px]" />
            </span>
            <div>
              <h3
                id="edit-task-title"
                className="text-[16px] font-semibold tracking-tight text-zinc-900"
              >
                Edit task
              </h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-500">
                Update the task details.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close task dialog"
            className="rounded-lg px-2 py-1 text-lg leading-none text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            ×
          </button>
        </div>

        <label htmlFor="task-title" className="mb-1.5 block text-[12.5px] font-medium text-zinc-700">
          Title
        </label>
        <input
          id="task-title"
          name="title"
          type="text"
          required
          maxLength={140}
          defaultValue={task.title}
          className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-[13.5px] text-zinc-900 outline-none transition focus:border-[#d9773e] focus:ring-2 focus:ring-[#f6e3d2] disabled:cursor-not-allowed disabled:opacity-50"
        />

        <label htmlFor="task-notes" className="mb-1.5 mt-4 block text-[12.5px] font-medium text-zinc-700">
          Notes <span className="font-normal text-zinc-400">(optional)</span>
        </label>
        <textarea
          id="task-notes"
          name="notes"
          rows={3}
          placeholder="Anything the owner of this task should know."
          className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-[13.5px] text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-[#d9773e] focus:ring-2 focus:ring-[#f6e3d2]"
        >
          {task.notes ?? ""}
        </textarea>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 space-y-1">
          <div className="space-y-1">
            <label htmlFor="task-due" className="block text-[12.5px] font-medium text-zinc-700">
              Due date
            </label>
            <input
              id="task-due"
              name="dueDate"
              type="date"
              defaultValue={task.dueAt ? new Date(task.dueAt).toISOString().split("T")[0] : ""}
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-[13.5px] text-zinc-900 outline-none transition focus:border-[#d9773e] focus:ring-2 focus:ring-[#f6e3d2] disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="task-assignee" className="block text-[12.5px] font-medium text-zinc-700">
              Assignee
            </label>
            <select
              id="task-assignee"
              name="assigneeId"
              defaultValue={task.assigneeId ?? ""}
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-[13.5px] text-zinc-900 outline-none transition focus:border-[#d9773e] focus:ring-2 focus:ring-[#f6e3d2] disabled:cursor-not-allowed disabled:opacity-50"
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
            onClick={handleClose}
            className="rounded-xl px-3.5 py-2.5 text-[13px] font-semibold text-zinc-600 transition-colors hover:bg-zinc-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className={primaryButton}
          >
            <EditIcon className="h-4 w-4" />
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}