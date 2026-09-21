import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/* Pulls plain text out of the document types the description field accepts.
   The PDF and Word parsers are heavy, so they are imported on demand — a plain
   .txt or .md import never pays for them. */

export const DESCRIPTION_ACCEPT =
  '.txt,.md,.markdown,.pdf,.docx,.doc,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const extensionOf = (name) => (name.includes('.') ? name.split('.').pop().toLowerCase() : '');

const readAsText = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsText(file);
  });

const readPdf = async (file) => {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
  const doc = await task.promise;
  const pages = [];
  for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
    const page = await doc.getPage(pageNo);
    const content = await page.getTextContent();
    /* pdf.js hands back positioned runs, so rebuild line breaks from its own
       end-of-line markers rather than gluing every run together. */
    const text = content.items
      .map((item) => (item.str || '') + (item.hasEOL ? '\n' : ''))
      .join('')
      .replace(/[ \t]+\n/g, '\n');
    pages.push(text.trim());
  }
  await task.destroy(); // the loading task owns teardown; PDFDocumentProxy has no destroy()
  return pages.filter(Boolean).join('\n\n');
};

const readDocx = async (file) => {
  const mammoth = await import('mammoth');
  const result = await (mammoth.default || mammoth).extractRawText({
    arrayBuffer: await file.arrayBuffer()
  });
  return result.value || '';
};

/* Returns the file's text, or throws an Error whose message is safe to show. */
export async function extractTextFromFile(file) {
  const ext = extensionOf(file.name);

  if (ext === 'doc') {
    throw new Error('Legacy .doc files are not supported — save it as .docx and try again.');
  }

  let text = '';
  try {
    if (ext === 'pdf' || file.type === 'application/pdf') {
      text = await readPdf(file);
    } else if (ext === 'docx') {
      text = await readDocx(file);
    } else {
      text = await readAsText(file);
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Legacy')) throw err;
    throw new Error(`Could not read ${file.name}. The file may be corrupted or password protected.`);
  }

  const cleaned = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!cleaned) {
    throw new Error(
      ext === 'pdf'
        ? `No selectable text found in ${file.name}. Scanned PDFs need OCR first.`
        : `${file.name} appears to be empty.`
    );
  }
  return cleaned;
}
