"use client";

import { useEffect } from "react";
import { useDesk } from "@/lib/store";

/** "Note saved · Undo", tucked in the corner for a few seconds after each change. */
export function UndoToast() {
  const undo = useDesk((s) => s.undo);
  const takeBack = useDesk((s) => s.takeBack);
  const dismiss = useDesk((s) => s.dismissUndo);

  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(dismiss, 8000);
    return () => clearTimeout(timer);
  }, [undo, dismiss]);

  if (!undo) return null;
  return (
    <div role="status" className="card-in fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-sm items-center justify-between gap-4 rounded-full bg-ink px-5 py-2.5 text-card shadow-lg sm:inset-x-auto sm:right-6 sm:mx-0">
      <span className="font-hand text-[1.25rem] leading-none">{undo.label}</span>
      <button type="button" onClick={() => void takeBack()} className="text-[0.85rem] font-bold underline-offset-2 hover:underline">
        Undo
      </button>
    </div>
  );
}
