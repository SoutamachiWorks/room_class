import { NextResponse } from 'next/server';
import JSZip from 'jszip';

export const dynamic = 'force-dynamic';

function escapeXml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function paragraph(text = '') {
  return `<w:p><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function buildDocumentXml() {
  const lines = [
    'Template Import Soal RoomClass',
    '',
    'PETUNJUK',
    '1. Simpan file ini sebagai .docx setelah diedit.',
    '2. Setiap soal diawali nomor, misalnya 1. atau 11.',
    '3. Pilihan ganda boleh memakai A. B. C. atau simbol checkbox.',
    '4. Multi-jawaban memakai Kunci: A,C,E.',
    '5. Esai tidak memakai opsi dan tidak memakai Kunci.',
    '',
    'CONTOH PILIHAN GANDA',
    '1. Seseorang menerima informasi viral di media sosial. Sikap yang tepat adalah...',
    'A. Langsung membagikan informasi',
    'B. Memverifikasi informasi dari sumber terpercaya',
    'C. Mengabaikan semua informasi',
    'D. Hanya percaya pada teman',
    'E. Menyebarkan dengan opini pribadi',
    'Kunci: B',
    'Pembahasan: Informasi perlu dicek sebelum disebarkan.',
    '',
    'CONTOH MULTI-JAWABAN',
    '2. Pernyataan yang benar tentang literasi digital adalah...',
    '□ Perlu verifikasi informasi sebelum menyebarkan',
    '□ Semua informasi di internet pasti benar',
    '□ Berpikir kritis membantu menghindari hoaks',
    '□ Informasi viral pasti benar',
    '□ Literasi digital penting dalam penggunaan teknologi',
    'Kunci: A,C,E',
    'Pembahasan: Jawaban benar dapat lebih dari satu. Siswa tidak boleh memilih lebih dari jumlah kunci.',
    '',
    'CONTOH BENAR/SALAH',
    '3. Semua informasi di internet dapat dipercaya tanpa verifikasi. (B/S)',
    'A. Benar (B)',
    'B. Salah (S)',
    'Kunci: B',
    'Pembahasan: Informasi tetap perlu diverifikasi.',
    '',
    'CONTOH ESAI',
    '4. Jelaskan dampak teknologi digital terhadap interaksi sosial manusia.',
    'Pembahasan: Pedoman koreksi atau catatan guru dapat ditulis di sini.',
  ];

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${lines.map(paragraph).join('\n    ')}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

export async function GET() {
  const zip = new JSZip();

  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

  zip.folder('_rels').file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  zip.folder('word').file('document.xml', buildDocumentXml());

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': 'attachment; filename="Template_Import_Soal_RoomClass.docx"',
      'Cache-Control': 'no-store',
    },
  });
}
