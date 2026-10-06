export type ExportStudent = {
  uid: string
  displayName: string
  email: string
  phone: string
  status: 'active' | 'suspended'
  createdAt?: Date
  courseNames: string[]
}

type Cell = string | number

function escXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function u16(n: number) { return new Uint8Array([n & 255, (n >>> 8) & 255]) }
function u32(n: number) { return new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]) }
function concat(parts: Uint8Array[]) {
  const size = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(size)
  let offset = 0
  for (const part of parts) { out.set(part, offset); offset += part.length }
  return out
}

function zipStore(entries: Array<{ name: string; content: string }>) {
  const encoder = new TextEncoder()
  const local: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const entry of entries) {
    const name = encoder.encode(entry.name)
    const data = encoder.encode(entry.content)
    const crc = crc32(data)
    const header = concat([
      new Uint8Array([0x50, 0x4b, 0x03, 0x04]), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name,
    ])
    local.push(header, data)
    const centralHeader = concat([
      new Uint8Array([0x50, 0x4b, 0x01, 0x02]), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name,
    ])
    central.push(centralHeader)
    offset += header.length + data.length
  }
  const centralData = concat(central)
  const localData = concat(local)
  const end = concat([new Uint8Array([0x50, 0x4b, 0x05, 0x06]), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(centralData.length), u32(localData.length), u16(0)])
  return new Blob([localData, centralData, end], { type: 'application/zip' })
}

function xlsxXml(students: ExportStudent[]) {
  const headers = ['Étudiant', 'Email', 'Téléphone', 'Concours', 'Membre depuis', 'Statut']
  const rows: Cell[][] = students.map(student => [
    student.displayName,
    student.email,
    student.phone || 'Non renseigné',
    student.courseNames.join(', ') || 'Aucun concours',
    student.createdAt ? student.createdAt.toLocaleDateString('fr-FR') : '',
    student.status === 'active' ? 'Actif' : 'Suspendu',
  ])
  const all = [headers, ...rows]
  const col = (n: number) => { let s = ''; while (n) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26) } return s }
  const sheetRows = all.map((row, r) => `<row r="${r + 1}">${row.map((value, c) => {
    const ref = `${col(c + 1)}${r + 1}`
    return typeof value === 'number' ? `<c r="${ref}"><v>${value}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escXml(String(value))}</t></is></c>`
  }).join('')}</row>`).join('')
  return `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="26" customWidth="1"/><col min="2" max="2" width="34" customWidth="1"/><col min="3" max="3" width="20" customWidth="1"/><col min="4" max="4" width="48" customWidth="1"/><col min="5" max="6" width="18" customWidth="1"/></cols><sheetData>${sheetRows}</sheetData><autoFilter ref="A1:F${all.length}"/></worksheet>`
}

export async function exportStudentsToExcel(students: ExportStudent[]) {
  const workbook = zipStore([
    { name: '[Content_Types].xml', content: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>' },
    { name: '_rels/.rels', content: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', content: '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Étudiants" sheetId="1" r:id="rId1"/></sheets></workbook>' },
    { name: 'xl/_rels/workbook.xml.rels', content: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>' },
    { name: 'xl/worksheets/sheet1.xml', content: xlsxXml(students) },
  ])
  download(workbook, `CAV-Madagascar-Etudiants-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

function wordXml(students: ExportStudent[]) {
  const rows = students.map(student => `<w:tr>${[student.displayName, student.email, student.phone || 'Non renseigné', student.courseNames.join(', ') || 'Aucun concours', student.createdAt ? student.createdAt.toLocaleDateString('fr-FR') : '', student.status === 'active' ? 'Actif' : 'Suspendu'].map(value => `<w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/></w:tcPr><w:p><w:r><w:t xml:space="preserve">${escXml(value)}</w:t></w:r></w:p></w:tc>`).join('')}</w:tr>`).join('')
  const headers = ['Étudiant', 'Email', 'Téléphone', 'Concours', 'Membre depuis', 'Statut'].map(value => `<w:tc><w:tcPr><w:shd w:fill="153E68"/><w:tcW w:w="2400" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>${escXml(value)}</w:t></w:r></w:p></w:tc>`).join('')
  return `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="153E68"/></w:rPr><w:t>CAV Madagascar - Liste des étudiants</w:t></w:r></w:p><w:p><w:r><w:t>Export du ${new Date().toLocaleDateString('fr-FR')} - ${students.length} étudiant(s)</w:t></w:r></w:p><w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="2"/><w:insideV w:val="single" w:sz="2"/></w:tblBorders></w:tblPr><w:tr>${headers}</w:tr>${rows}</w:tbl><w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/></w:sectPr></w:body></w:document>`
}

export async function exportStudentsToWord(students: ExportStudent[]) {
  const docx = zipStore([
    { name: '[Content_Types].xml', content: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
    { name: '_rels/.rels', content: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { name: 'word/document.xml', content: wordXml(students) },
  ])
  download(docx, `CAV-Madagascar-Etudiants-${new Date().toISOString().slice(0, 10)}.docx`)
}

function pdfEscape(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)') }

export async function exportStudentsToPdf(students: ExportStudent[]) {
  const rowsPerPage = 28
  const pages: string[][] = []
  const headers = ['ETUDIANT', 'EMAIL', 'TELEPHONE', 'CONCOURS', 'MEMBRE DEPUIS', 'STATUT']
  for (let i = 0; i < Math.max(students.length, 1); i += rowsPerPage) {
    const chunk = students.slice(i, i + rowsPerPage)
    pages.push([
      'CAV MADAGASCAR - LISTE DES ETUDIANTS',
      `Export du ${new Date().toLocaleDateString('fr-FR')} - ${students.length} etudiant(s)`,
      headers.join(' | '),
      ...chunk.map(s => [s.displayName, s.email, s.phone || 'Non renseigne', s.courseNames.join(', ') || 'Aucun concours', s.createdAt ? s.createdAt.toLocaleDateString('fr-FR') : '-', s.status === 'active' ? 'Actif' : 'Suspendu'].join(' | ')),
    ])
  }

  const objects: string[] = []
  objects.push('<< /Type /Catalog /Pages 2 0 R >>')
  objects.push('')
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  const pageIds: number[] = []
  let nextId = 4
  for (const lines of pages) {
    const pageId = nextId++
    const contentId = nextId++
    const commands: string[] = ['BT /F1 15 Tf 40 790 Td']
    commands.push(`(${pdfEscape(lines[0])}) Tj`)
    commands.push('/F1 8 Tf 0 -20 Td')
    commands.push(`(${pdfEscape(lines[1])}) Tj`)
    commands.push('0 -24 Td')
    lines.slice(2).forEach((line, index) => {
      if (index > 0) commands.push('0 -17 Td')
      commands.push(`(${pdfEscape(line.slice(0, 155))}) Tj`)
    })
    commands.push('ET')
    while (objects.length < pageId - 1) objects.push('')
    objects[pageId - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`
    while (objects.length < contentId - 1) objects.push('')
    objects[contentId - 1] = `<< /Length ${commands.join('\n').length} >>\nstream\n${commands.join('\n')}\nendstream`
    pageIds.push(pageId)
  }
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = [0]
  for (let i = 0; i < objects.length; i++) {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`
  }
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i <= objects.length; i++) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  download(new Blob([pdf], { type: 'application/pdf' }), `CAV-Madagascar-Etudiants-${new Date().toISOString().slice(0, 10)}.pdf`)
}
