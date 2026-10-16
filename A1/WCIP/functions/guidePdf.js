import PDFDocument from 'pdfkit'

// Runtime PDF generation stays inside the Node.js Cloud Function, with no remote assets.
export function guidePdf(guide) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 48,
      bufferPages: true,
      info: {
        Title: guide.subject,
        Author: 'WCIP',
        CreationDate: new Date(`${guide.issueId}-01T00:00:00Z`),
      },
    })
    const chunks = []
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('error', reject)
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    const title = (text) =>
      doc.fillColor('#24563f').font('Helvetica-Bold').fontSize(19).text(text).moveDown(0.6)
    const body = (text) =>
      doc
        .fillColor('#243b30')
        .font('Helvetica')
        .fontSize(11)
        .text(text, { lineGap: 4 })
        .moveDown(0.7)
    doc
      .fillColor('#24563f')
      .font('Helvetica-Bold')
      .fontSize(12)
      .text('WCIP  /  WHAT CAN I PLANT?')
      .moveDown(1)
    title(`${guide.season} in Melbourne`)
    doc.font('Helvetica').fontSize(12).fillColor('#52655b').text(guide.edition).moveDown(1.2)
    body(guide.introduction)
    title('Your seasonal checklist')
    guide.tasks.forEach((task, index) => body(`${index + 1}. ${task}`))
    doc.moveDown(0.5)
    title('Plan for your own garden')
    body(guide.note)
    body(
      'Autumn and spring are generally useful planting windows for indigenous gardens in Melbourne. Winter growth is slower; summer heat makes establishment harder. The seasonal guidance is general, and the plant shortlist is curated by WCIP.',
    )
    body(
      'Use the following page to explore four plants in the WCIP catalogue, then confirm their suitability before buying or planting.',
    )
    doc.addPage()
    title('Plants to explore')
    guide.recommendations.forEach((plant) => {
      doc.fillColor('#24563f').font('Helvetica-Bold').fontSize(13).text(plant.name)
      doc
        .font('Helvetica-Oblique')
        .fontSize(10)
        .fillColor('#52655b')
        .text(plant.scientificName)
        .moveDown(0.4)
      body(plant.conditions)
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#244a96')
        .text('View plant details on WCIP', { link: plant.url, underline: true })
        .moveDown(1)
    })
    doc.moveDown(0.3)
    doc
      .fillColor('#24563f')
      .font('Helvetica-Bold')
      .fontSize(13)
      .text('Gardening references')
      .moveDown(0.5)
    guide.sources.forEach((source) =>
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#244a96')
        .text(source.title, { link: source.url, underline: true })
        .moveDown(0.5),
    )
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#243b30')
      .text(
        'Seasonal guidance draws on these references; plant facts come from the WCIP catalogue.',
      )
      .moveDown(0.7)
    doc.fillColor('#244a96').text('Manage your seasonal email subscription in My account', {
      link: guide.accountUrl,
      underline: true,
    })
    const { count } = doc.bufferedPageRange()
    for (let index = 0; index < count; index++) {
      doc.switchToPage(index)
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#52655b')
        .text(`WCIP | ${guide.edition} | ${index + 1} / ${count}`, 48, 790, { lineBreak: false })
    }
    doc.end()
  })
}
