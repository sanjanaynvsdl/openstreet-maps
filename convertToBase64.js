const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'osm.html');
const html = fs.readFileSync(filePath, 'utf-8');
const base64 = Buffer.from(html).toString('base64');
console.log(`data:text/html;base64,${base64}`); 