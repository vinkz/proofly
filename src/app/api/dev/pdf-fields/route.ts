import { NextResponse } from 'next/server';
import { listCommissioningPdfFields, listGasBreakdownPdfFields } from '@/server/pdf/debugListPdfFields';

const isDev = process.env.NODE_ENV !== 'production';

export async function GET(request: Request) {
  if (!isDev) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const template = searchParams.get('template');

  if (template !== 'gas-breakdown' && template !== 'commissioning') {
    return NextResponse.json({ error: 'Unknown template' }, { status: 400 });
  }

  const fields =
    template === 'commissioning' ? await listCommissioningPdfFields() : await listGasBreakdownPdfFields();
  return NextResponse.json({ template, fields });
}
