'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';

import { TemplateItemSchema } from '@/lib/schema/template';
import { duplicateTemplate, updateTemplateItems, updateTemplateMeta, deleteTemplate } from '@/server/templates';
import type { TemplateItem, TemplateModel } from '@/types/template';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

interface TemplateEditorProps {
  template: TemplateModel;
}

export default function TemplateEditor({ template }: TemplateEditorProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const isPublic = template.is_public;
  const canEdit = !isPublic;

  const [name, setName] = useState(template.name);
  const [trade, setTrade] = useState(template.trade_type);
  const [items, setItems] = useState<TemplateItem[]>(template.items ?? []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [isSavingMeta, startSavingMeta] = useTransition();
  const [isSavingItems, startSavingItems] = useTransition();
  const [isDuplicating, startDuplicating] = useTransition();
  const [isDeleting, startDeleting] = useTransition();

  const handleAddItem = () => {
    if (!canEdit) return;
    setItems((prev) => [
      ...prev,
      { id: uuid(), label: 'New item', type: 'toggle', required: false, photo: false },
    ]);
  };

  const handleUpdateItem = (id: string, patch: Partial<TemplateItem>) => {
    if (!canEdit) return;
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const handleRemoveItem = (id: string) => {
    if (!canEdit) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!canEdit) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    setItems((prev) => arrayMove(prev, oldIndex, newIndex));
  };

  const handleSaveMeta = () => {
    if (!canEdit) return;
    startSavingMeta(async () => {
      try {
        await updateTemplateMeta(template.id, { name, trade_type: trade });
        pushToast({ title: 'Template details saved', variant: 'success' });
      } catch (error) {
        pushToast({
          title: 'Unable to save settings',
          description: error instanceof Error ? error.message : 'Try again later.',
          variant: 'error',
        });
      }
    });
  };

  const handleSaveItems = () => {
    if (!canEdit) return;
    startSavingItems(async () => {
      try {
        const parsed = z.array(TemplateItemSchema).parse(items);
        await updateTemplateItems(template.id, parsed);
        pushToast({ title: 'Items updated', variant: 'success' });
      } catch (error) {
        pushToast({
          title: 'Unable to save items',
          description: error instanceof Error ? error.message : 'Check item details and try again.',
          variant: 'error',
        });
      }
    });
  };

  const handleDuplicate = () => {
    startDuplicating(async () => {
      try {
        const { id } = await duplicateTemplate(template.id);
        pushToast({ title: 'Template duplicated', variant: 'success' });
        router.push(`/templates/${id}`);
      } catch (error) {
        pushToast({
          title: 'Unable to duplicate template',
          description: error instanceof Error ? error.message : 'Try again later.',
          variant: 'error',
        });
      }
    });
  };

  const handleDelete = () => {
    if (!canEdit) return;
    startDeleting(async () => {
      try {
        await deleteTemplate(template.id);
        pushToast({ title: 'Template deleted', variant: 'success' });
        router.push('/templates');
      } catch (error) {
        pushToast({
          title: 'Unable to delete template',
          description: error instanceof Error ? error.message : 'Try again later.',
          variant: 'error',
        });
      }
    });
  };

  const itemIds = useMemo(() => items.map((item) => item.id), [items]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Edit Template</h1>
        <div className="flex gap-2">
          {canEdit ? (
            <Button variant="outline" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          ) : null}
          <Button variant="outline" onClick={handleDuplicate} disabled={isDuplicating}>
            {isDuplicating ? 'Duplicating…' : 'Duplicate'}
          </Button>
        </div>
      </div>

      {isPublic ? (
        <p className="rounded border border-dashed bg-emerald-50 p-3 text-sm text-emerald-700">
          This is a public template. Duplicate it to make your own editable copy.
        </p>
      ) : null}

      <section className="rounded border p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Template Details</h2>
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium">Template name</label>
            <Input value={name} onChange={(event) => setName(event.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <label className="block text-sm font-medium">Trade</label>
            <Select
              value={trade}
              onChange={(event) => setTrade(event.target.value)}
              disabled={!canEdit}
              className="mt-1"
            >
              <option value="plumbing">Plumbing</option>
              <option value="hvac">HVAC</option>
              <option value="electrical">Electrical</option>
            </Select>
          </div>
          {canEdit ? (
            <div>
              <Button onClick={handleSaveMeta} disabled={isSavingMeta}>
                {isSavingMeta ? 'Saving…' : 'Save Settings'}
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Items</h2>
          {canEdit ? (
            <Button variant="outline" onClick={handleAddItem}>
              Add Item
            </Button>
          ) : null}
        </div>

        {items.length === 0 ? (
          <p className="rounded border border-dashed p-4 text-sm text-gray-500">No items yet.</p>
        ) : canEdit ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
              <div className="grid gap-2">
                {items.map((item) => (
                  <SortableItem
                    key={item.id}
                    item={item}
                    onChange={handleUpdateItem}
                    onRemove={handleRemoveItem}
                    disabled={!canEdit}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="grid gap-2">
            {items.map((item) => (
              <ItemPreview key={item.id} item={item} />
            ))}
          </div>
        )}

        {canEdit ? (
          <div className="mt-4">
            <Button onClick={handleSaveItems} disabled={isSavingItems}>
              {isSavingItems ? 'Saving…' : 'Save Items'}
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function SortableItem({
  item,
  onChange,
  onRemove,
  disabled,
}: {
  item: TemplateItem;
  onChange: (id: string, patch: Partial<TemplateItem>) => void;
  onRemove: (id: string) => void;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="rounded border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label="Drag handle"
            className="cursor-grab rounded border px-2 py-1 text-xs"
            disabled={disabled}
          >
            ↕
          </button>
          <Input
            value={item.label}
            onChange={(event) => onChange(item.id, { label: event.target.value })}
            disabled={disabled}
            className="w-64"
          />
        </div>
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="text-sm text-red-600"
          disabled={disabled}
        >
          Remove
        </button>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div>
          <label className="block text-xs text-gray-600">Type</label>
          <Select
            value={item.type}
            onChange={(event) => onChange(item.id, { type: event.target.value as TemplateItem['type'] })}
            disabled={disabled}
            className="mt-1"
          >
            <option value="toggle">Toggle</option>
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="note">Note</option>
          </Select>
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-gray-600 md:items-end">
          <input
            type="checkbox"
            checked={!!item.required}
            onChange={(event) => onChange(item.id, { required: event.target.checked })}
            disabled={disabled}
          />
          Required
        </label>
        <label className="inline-flex items-center gap-2 text-xs text-gray-600 md:items-end">
          <input
            type="checkbox"
            checked={!!item.photo}
            onChange={(event) => onChange(item.id, { photo: event.target.checked })}
            disabled={disabled}
          />
          Photo expected
        </label>
      </div>
    </div>
  );
}

function ItemPreview({ item }: { item: TemplateItem }) {
  return (
    <div className="rounded border p-3">
      <div className="flex items-center justify-between">
        <span className="font-medium">{item.label}</span>
        <span className="text-xs text-gray-500">{item.type}</span>
      </div>
      <div className="mt-2 flex gap-3 text-xs text-gray-500">
        {item.required ? <span>Required</span> : null}
        {item.photo ? <span>Photo expected</span> : null}
      </div>
    </div>
  );
}
