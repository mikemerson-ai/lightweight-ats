"use client";

import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragMoveEvent,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useState, type PropsWithChildren } from "react";

export interface DndContextWrapperProps {
  /** The id of the candidate card currently being dragged, if any. */
  activeCardId?: string | null;
  /** Invoked when a drag session begins with the id of the card being dragged. */
  onDragStart?: (cardId: string) => void;
  /** Invoked as the drag moves; use to render live drop indicators. */
  onDragMove?: (event: DragMoveEvent) => void;
  /** Invoked when a drag ends; contains the source and destination stage ids. */
  onDragEnd?: (event: DragEndEvent) => void;
  /** Invoked when a drag is cancelled without completing. */
  onDragCancel?: () => void;
}

/**
 * Client-side wrapper around `DndContext` that isolates drag-and-drop state.
 *
 * The `@dnd-kit` sensors rely on runtime-generated identifiers and transient
 * drag state. Rendering them during Next.js Server-Side Rendering can produce
 * hydration mismatches between the server and client DOM. This wrapper is
 * explicitly marked as a client component and suppresses hydration warnings so
 * drag-and-drop state never leaks into the initial HTML payload.
 */
export function DndContextWrapper({
  activeCardId,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
  children,
}: PropsWithChildren<DndContextWrapperProps>) {
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {}),
  );

  const [dragState, setDragState] = useState({
    activeId: activeCardId ?? null,
    overId: null as string | null,
  });

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    setDragState((state) => ({ ...state, activeId: id }));
    onDragStart?.(id);
  }

  function handleDragMove(event: DragMoveEvent) {
    const overId = event.over ? String(event.over.id) : null;
    setDragState((state) => ({ ...state, overId }));
    onDragMove?.(event);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragState({ activeId: null, overId: null });
    onDragEnd?.(event);
  }

  function handleDragCancel() {
    setDragState({ activeId: null, overId: null });
    onDragCancel?.();
  }

  return (
    <DndContext
      id="kanban-board"
      sensors={sensors}
      autoScroll={false}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div suppressHydrationWarning aria-hidden={Boolean(dragState.activeId)}>
        {children}
      </div>
    </DndContext>
  );
}