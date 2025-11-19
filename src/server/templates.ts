'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { supabaseServerReadOnly, supabaseServerAction, supabaseServerServiceRole } from '@/lib/supabaseServer';
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
  is_general: !!row.is_general,
  user_id: (row as { user_id?: string | null }).user_id ?? (row as { created_by?: string | null }).created_by ?? null,
  description: (row as { description?: string | null }).description ?? null,
  created_at: row.created_at ?? null,
  updated_at: row.updated_at ?? null,
  items: parseTemplateItems(row.items),
});

export async function listVisibleTemplates(trade: string | string[] = 'plumbing'): Promise<TemplateModel[]> {
  const sb = await supabaseServerReadOnly();
  const {
    data: { user },
  } = await sb.auth.getUser();

  const selectVariants = [
    'id, name, trade_type, description, is_public, is_general, user_id, created_at, updated_at, items',
    'id, name, trade_type, description, is_public, is_general, user_id, created_at, items',
  ];

  const fallbackTrades = Array.isArray(trade) ? trade : [trade];
  const tradeFilters =
    fallbackTrades && fallbackTrades.length
      ? fallbackTrades
      : [];

  let data: Tables<'templates'>[] | null = null;
  let lastError: Error | null = null;

  let profileTrades: string[] = [];
  if (user) {
    const { data: profile, error: profileErr } = await sb
      .from('profiles')
      .select('trade_types, certifications')
      .eq('id', user.id)
      .maybeSingle();
    if (profileErr && profileErr.code !== 'PGRST116') {
      throw new Error(profileErr.message);
    }
    profileTrades = (profile?.trade_types as string[]) ?? [];
  }

  const effectiveTrades = profileTrades.length ? profileTrades : tradeFilters;
  const orClauses = ['is_general.eq.true'];
  if (effectiveTrades.length) {
    const quoted = effectiveTrades.map((t) => `"${t.replace(/"/g, '""')}"`).join(',');
    orClauses.push(`trade_type.in.(${quoted})`);
  }

  for (const columns of selectVariants) {
    const response = await sb
      .from('templates')
      .select(columns)
      .or(orClauses.join(','))
      .order('created_at', { ascending: false });
    if (response.error) {
      lastError = new Error(response.error.message);
      if (response.error.code === '42703') continue;
      throw lastError;
    }
    data = response.data as unknown as Tables<'templates'>[];
    break;
  }

  if (!data && lastError) throw lastError;

  return (data ?? [])
    .filter((row) => row.is_public || (row as { user_id?: string | null }).user_id === user?.id)
    .filter((row) => row.is_general || effectiveTrades.includes(row.trade_type))
    .map(toTemplateModel);
}

export async function getTemplate(id: string): Promise<TemplateModel> {
  TemplateId.parse(id);
  const sb = await supabaseServerReadOnly();

  const selectVariants = [
    'id, name, trade_type, description, is_public, is_general, user_id, created_at, updated_at, items',
    'id, name, trade_type, description, is_public, is_general, user_id, created_at, items',
  ];

  for (const columns of selectVariants) {
    const response = await sb
      .from('templates')
      .select(columns)
      .eq('id', id)
      .maybeSingle();
    if (response.error) {
      if (response.error.code === '42703') continue;
      throw new Error(response.error.message);
    }
    if (!response.data) {
      continue;
    }
    return toTemplateModel(response.data as unknown as Tables<'templates'>);
  }

  throw new Error('Template not found');
}

export async function createTemplate(payload: unknown) {
  const sb = await supabaseServerServiceRole();
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
      description: body.description ?? null,
      is_public: body.is_public ?? false,
      is_general: body.is_general ?? false,
      items: items as unknown as Json,
      user_id: user.id,
    })
    .select('id')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to create template');

  revalidatePath('/templates');
  return { id: data.id as string };
}

export async function duplicateTemplate(id: string) {
  TemplateId.parse(id);
  const sb = await supabaseServerServiceRole();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: source, error: srcErr } = await sb
    .from('templates')
    .select('name, trade_type, description, items, is_general')
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
      description: source.description ?? null,
      is_public: false,
      is_general: source.is_general ?? false,
      items: items as unknown as Json,
      user_id: user.id,
    })
    .select('id')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to duplicate template');

  revalidatePath('/templates');
  return { id: data.id as string };
}

export async function updateTemplateMeta(
  id: string,
  meta: { name: string; trade_type: string; is_general?: boolean; description?: string | null },
) {
  TemplateId.parse(id);
  const sb = await supabaseServerServiceRole();

  const payload: Partial<Tables<'templates'>> = {
    name: meta.name,
    trade_type: meta.trade_type,
  };
  if (typeof meta.is_general === 'boolean') {
    payload.is_general = meta.is_general;
  }
  if ('description' in meta) {
    payload.description = meta.description ?? null;
  }

  const { error } = await sb.from('templates').update(payload).eq('id', id);

  if (error) throw new Error(error.message);
  revalidatePath(`/templates/${id}`);
}

export async function updateTemplateItems(id: string, items: unknown) {
  TemplateId.parse(id);
  const sb = await supabaseServerServiceRole();

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
  const sb = await supabaseServerAction();

  const { error } = await sb.from('templates').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/templates');
}
