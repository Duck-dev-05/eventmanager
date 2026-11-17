"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createTemplate, type TemplateFormState } from "@/lib/template-actions";
import { eventCategories } from "@/lib/event-types";
import { primaryButton, secondaryButton } from "@/components/ui";

const inputClass =
  "h-11 w-full rounded-xl border border-zinc-200 px-3.5 text-[13.5px] outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100";

export function TemplateForm() {
  const [state, formAction, pending] = useActionState<TemplateFormState, FormData>(
    createTemplate,
    undefined,
  );
  const values = state?.values;

  const [description, setDescription] = useState(values?.description ?? "");
  const [category, setCategory] = useState(values?.category ?? "Conference");

  return (
    <form action={formAction} className="space-y-6">
      <section className="rounded-3xl border border-zinc-200/70 bg-white p-6 shadow-sm">
        <h2 className="text-[15px] font-semibold text-zinc-900">
          Template Information
        </h2>
        <p className="mt-0.5 text-[12.5px] text-zinc-500">
          Basic attributes that identify this structure.
        </p>

        <div className="mt-5 space-y-5">
          <div>
            <label
              htmlFor="name"
              className="mb-1.5 block text-[12.5px] font-medium text-zinc-700"
            >
              Template name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              maxLength={80}
              defaultValue={values?.name}
              placeholder="Quarterly Town Hall"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-zinc-700">
              Category
            </label>
            <div className="flex flex-wrap gap-2">
              {eventCategories.map((option) => (
                <label key={option} className="cursor-pointer">
                  <input
                    type="radio"
                    name="category"
                    value={option}
                    checked={category === option}
                    onChange={() => setCategory(option)}
                    className="peer sr-only"
                  />
                  <span className="inline-flex items-center rounded-full border border-zinc-200 px-3.5 py-1.5 text-[12px] font-medium text-zinc-600 transition hover:bg-zinc-50 peer-checked:border-indigo-600 peer-checked:bg-indigo-600 peer-checked:text-white">
                    {option}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-zinc-200/70 bg-white p-6 shadow-sm">
        <h2 className="text-[15px] font-semibold text-zinc-900">
          Default Event Settings
        </h2>
        <p className="mt-0.5 text-[12.5px] text-zinc-500">
          Values automatically pre-filled when teammates use this template.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="venue"
              className="mb-1.5 block text-[12.5px] font-medium text-zinc-700"
            >
              Recommended venue
            </label>
            <input
              id="venue"
              name="venue"
              type="text"
              defaultValue={values?.venue}
              placeholder="Main Auditorium or Virtual"
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="capacity"
              className="mb-1.5 block text-[12.5px] font-medium text-zinc-700"
            >
              Suggested capacity
            </label>
            <input
              id="capacity"
              name="capacity"
              type="number"
              min={1}
              max={100000}
              defaultValue={values?.capacity}
              placeholder="100"
              className={inputClass}
            />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-zinc-200/70 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-zinc-900">
              Description &amp; guidelines
            </h2>
            <p className="mt-0.5 text-[12.5px] text-zinc-500">
              Explain when and how this template should be used.
            </p>
          </div>
        </div>

        <textarea
          id="description"
          name="description"
          rows={4}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Explain when and how this template should be used."
          className="mt-4 w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-[13.5px] outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
        />
      </section>

      {state?.error ? (
        <p
          role="alert"
          className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-[12.5px] font-medium text-rose-600"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
        <Link href="/templates" className={secondaryButton}>
          Cancel
        </Link>
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Saving…" : "Save template"}
        </button>
      </div>
    </form>
  );
}
