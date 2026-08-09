import '../vendor/jszip.min.js';

const JSZip = globalThis.JSZip;

if (!JSZip) {
  throw new Error('JSZip failed to load.');
}

export default JSZip;
