'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { supabaseServer } from '@/lib/supabaseServer';
import { TemplateSchema } from '@/lib/schema/template';
import type { TemplateModel, TemplateItem } from '@/types/template';
import type { Tables, Json } from '@/lib/database.types';

const TemplateId = z.string().uuid();

const parseTemplateItems = (items: Tables<'templates'>['items']): TemplateItem[] => {
  if (Array.isArray(items)) {
    return items as unknown as TemplateItem[];
  }
  return [];
};

const toTemplateModel = (row: Tables<'templates'>): TemplateModel => ({
  id: row.id,
  name: row.name,
  trade_type: row.trade_type,
  is_public: !!row.is_public,
  created_by: row.created_by ?? null,
  created_at: row.created_at ?? null,
  items: parseTemplateItems(row.items),
});

export async function listVisibleTemplates(trade: string = 'plumbing'): Promise<TemplateModel[]> {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();

  const { data, error } = await sb
    .from('templates')
    .select('id, name, trade_type, is_public, created_by, created_at, items')
    .eq('trade_type', trade)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter((row) => row.is_public || row.created_by === user?.id)
    .map(toTemplateModel);
}

export async function getTemplate(id: string): Promise<TemplateModel> {
  TemplateId.parse(id);
  const sb = await supabaseServer();

  const { data, error } = await sb
    .from('templates')
    .select('id, name, trade_type, is_public, created_by, created_at, items')
    .eq('id', id)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Template not found');
  }

  return toTemplateModel(data);
}

export async function createTemplate(payload: unknown) {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const body = TemplateSchema.parse(payload);
  const items = body.items.map((item) => ({
    ...item,
    id: item.id ?? randomUUID(),
  }));

  const { data, error } = await sb
    .from('templates')
    .insert({
      name: body.name,
      trade_type: body.trade_type,
      is_public: false,
      items: items as unknown as Json,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to create template');

  revalidatePath('/templates');
  return { id: data.id as string };
}

export async function duplicateTemplate(id: string) {
  TemplateId.parse(id);
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: source, error: srcErr } = await sb
    .from('templates')
    .select('name, trade_type, items')
    .eq('id', id)
    .single();

  if (srcErr || !source) throw new Error(srcErr?.message ?? 'Template not found');

  const sourceItems = parseTemplateItems(source.items);
  const items = sourceItems.map((item) => ({ ...item, id: randomUUID() }));

  const cloneName = `${source.name} (Copy)`;

  const { data, error } = await sb
    .from('templates')
    .insert({
      name: cloneName,
      trade_type: source.trade_type,
      is_public: false,
      items: items as unknown as Json,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to duplicate template');

  revalidatePath('/templates');
  return { id: data.id as string };
}

export async function updateTemplateMeta(id: string, meta: { name: string; trade_type: string }) {
  TemplateId.parse(id);
  const sb = await supabaseServer();

  const { error } = await sb.from('templates').update({ name: meta.name, trade_type: meta.trade_type }).eq('id', id);

  if (error) throw new Error(error.message);
  revalidatePath(`/templates/${id}`);
}

export async function updateTemplateItems(id: string, items: unknown) {
  TemplateId.parse(id);
  const sb = await supabaseServer();

  const parsed = TemplateSchema.shape.items.parse(items);
  const normalized = parsed.map((item) => ({
    ...item,
    id: item.id ?? randomUUID(),
  }));

  const { error } = await sb
    .from('templates')
    .update({ items: normalized as unknown as Json })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath(`/templates/${id}`);
}

export async function deleteTemplate(id: string) {
  TemplateId.parse(id);
  const sb = await supabaseServer();

  const { error } = await sb.from('templates').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/templates');
}
