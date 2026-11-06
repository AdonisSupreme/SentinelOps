const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root,name));
const json = name => JSON.parse(read(name));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const catalog = json('src/content/operatorGuides.json');
const registry = json('src/policies/modules.json');
const manifest = json('public/manual/operator-guides-manifest.json');
const fail = message => { throw new Error(message + ' Run scripts/build_operator_guides.py after updating the reviewed catalog.'); };
if (hash(read('src/content/operatorGuides.json')) !== manifest.catalog_sha256) fail('The downloadable guides are stale.');
if (hash(read('src/policies/modules.json')) !== manifest.registry_sha256) fail('Module names or navigation have changed since documentation generation.');
const keys = catalog.guides.map(guide=>guide.key).sort();
if (new Set(keys).size !== keys.length || JSON.stringify(keys)!==JSON.stringify(registry.map(module=>module.module_key).sort())) fail('Guide coverage does not match the access module registry.');
for (const guide of catalog.guides) {
  const file = `modules/${guide.key}.pdf`;
  if (!manifest.files[file]) fail(`Missing module PDF: ${guide.key}.`);
  if (!guide.tasks.length || !guide.access || !guide.sources.length) fail(`Incomplete guide: ${guide.key}.`);
  for (const source of guide.sources) if (!fs.existsSync(path.resolve(root,source))) fail(`Missing reviewed source: ${source}.`);
}
for (const [file, expected] of Object.entries(manifest.files)) {
  if(hash(read(`public/manual/${file}`)) !== expected) fail(`Download no longer matches the generated edition: ${file}.`);
}
console.log(`Operator documentation verified: ${keys.length} modules, ${manifest.procedures} procedures, ${Object.keys(manifest.files).length} PDFs.`);
