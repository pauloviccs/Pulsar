import fs from 'fs';

let svg = fs.readFileSync('.agent/assets/svg/PulsarLogo_Icon.svg', 'utf8');
svg = svg.replace('viewBox="0 0 1250.64 1251.43"', 'viewBox="0 0 1251 1251" width="1251" height="1251"');
svg = svg.replace('width="1250.64" height="1251.43"', 'width="1251" height="1251"');

fs.writeFileSync('src-tauri/icon_square.svg', svg);
fs.writeFileSync('static/pulsar-logo.svg', svg);
console.log('Successfully generated square SVG icon and updated static/pulsar-logo.svg');
