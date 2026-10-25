// Prints export print documents to PDF the way the app does (Chromium printToPDF
// with the page size and margins from the document's @page CSS).
//
//   electron scripts/print_pdf.js <file.print.html> [more.print.html ...]
//
// Each <name>.print.html becomes <name>.pdf next to it. Used by the export
// review (backend/tools/export_review.py); the app itself prints in
// src/main/index.ts.
const { app, BrowserWindow } = require('electron')
const fs = require('fs')

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { javascript: false } })
  for (const file of process.argv.slice(2).filter((a) => a.endsWith('.print.html'))) {
    await win.loadFile(file)
    const pdf = await win.webContents.printToPDF({
      preferCSSPageSize: true,
      printBackground: true,
      generateDocumentOutline: true,
      generateTaggedPDF: true
    })
    fs.writeFileSync(file.replace(/\.print\.html$/, '.pdf'), pdf)
    console.log('printed', file)
  }
  app.quit()
})
