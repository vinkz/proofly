const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

async function loadTemplateBytes(templatePath) {
  const absolute = path.isAbsolute(templatePath)
    ? templatePath
    : path.join(process.cwd(), templatePath);
  return fs.promises.readFile(absolute);
}

function getFieldRect(field) {
  try {
    const widgets = field.acroField?.getWidgets?.();
    const rect = widgets?.[0]?.getRectangle?.();
    if (!rect) return null;
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  } catch {
    return null;
  }
}

async function main() {
  const defaultTemplate = 'src/assets/templates/gas-warning-notice.pdf';
  const templatePath = process.argv[2] || defaultTemplate;
  const bytes = await loadTemplateBytes(templatePath);
  const pdfDoc = await PDFDocument.load(bytes);
  const form = pdfDoc.getForm();
  const fields = form.getFields();

  const results = fields.map((field) => ({
    name: field.getName(),
    type: field.constructor?.name ?? 'UnknownField',
    page: 0,
    rect: getFieldRect(field),
  }));

  const sorted = [...results].sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    const ay = a.rect?.y ?? -1;
    const by = b.rect?.y ?? -1;
    if (by !== ay) return by - ay;
    const ax = a.rect?.x ?? -1;
    const bx = b.rect?.x ?? -1;
    return ax - bx;
  });

  const outputDir = path.join(process.cwd(), 'tmp');
  await fs.promises.mkdir(outputDir, { recursive: true });
  await fs.promises.writeFile(
    path.join(outputDir, 'gas-warning-fields.json'),
    JSON.stringify(results, null, 2),
  );
  await fs.promises.writeFile(
    path.join(outputDir, 'gas-warning-fields-sorted.json'),
    JSON.stringify(sorted, null, 2),
  );

  console.log(`Wrote ${results.length} fields to tmp/gas-warning-fields.json`);
  console.log('Sorted list written to tmp/gas-warning-fields-sorted.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
