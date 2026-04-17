const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8999;
const DIR = path.join(__dirname, 'out');

http.createServer((req, res) => {
    let rawPath = req.url.split('?')[0];
    let filePath = path.join(DIR, rawPath === '/' ? 'index.html' : rawPath);
    
    if (!fs.existsSync(filePath)) {
        if (fs.existsSync(filePath + '.html')) {
            filePath += '.html';
        } else if (fs.existsSync(path.join(filePath, 'index.html'))) {
            filePath = path.join(filePath, 'index.html');
        } else {
            filePath = path.join(DIR, 'index.html');
        }
    }
    
    const ext = path.extname(filePath);
    let contentType = 'text/html';
    if (ext === '.js' || ext === '.mjs') contentType = 'text/javascript';
    else if (ext === '.css') contentType = 'text/css';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.svg') contentType = 'image/svg+xml';
    else if (ext === '.woff' || ext === '.woff2') contentType = 'font/woff2';
    
    if (fs.existsSync(filePath)) {
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
    } else {
        res.writeHead(404);
        res.end("404");
    }
}).listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`   PEGASUS OPERASYONEL ANALIZ (AI) MOTORU DEVREDE!`);
    console.log(`   Lutfen sistemi kullanirken bu ekrani KAPATMAYINIZ.`);
    console.log(`   `);
    console.log(`   Tarayiciniz otomatik olarak yonlendiriliyor...`);
    console.log(`   Manule erisim: http://localhost:${PORT}`);
    console.log(`======================================================\n`);
});
