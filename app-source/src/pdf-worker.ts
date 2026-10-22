/* pdf.js worker wrapper: install polyfills first, then start the real (legacy) pdf.js worker. */
import "./polyfills";
import "pdfjs-dist/legacy/build/pdf.worker.min.mjs";
