const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

async function main() {
  const templatePath = path.join(process.cwd(), 'src/assets/templates/gas-warning-notice.pdf');
  const outputDir = path.join(process.cwd(), 'tmp');
  const outputPath = path.join(outputDir, 'gas-warning-field-map.pdf');

  const bytes = await fs.promises.readFile(templatePath);
  const pdfDoc = await PDFDocument.load(bytes);
  const form = pdfDoc.getForm();
  const fields = form.getFields();

  fields.forEach((field) => {
    const name = field.getName();
    try {
      const textField = form.getTextField(name);
      textField.setText(name);
    } catch {
      try {
        const checkbox = form.getCheckBox(name);
        checkbox.check();
      } catch {
        // Ignore non-text fields.
      }
    }
  });

  form.updateFieldAppearances();

  await fs.promises.mkdir(outputDir, { recursive: true });
  const outputBytes = await pdfDoc.save();
  await fs.promises.writeFile(outputPath, outputBytes);

  console.log(`Field map PDF written to ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
