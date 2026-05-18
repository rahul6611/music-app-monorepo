const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

// Internal server to handle Expo's absolute paths (/_expo/...)
const server = http.createServer((req, res) => {
    const urlPath = req.url.split('?')[0].split('#')[0];
    // Clean path and handle root
    const cleanPath = urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, '');
    const filePath = path.join(__dirname, 'dist', cleanPath);

    console.log(`[Server] Request: ${urlPath} -> ${filePath}`);

    fs.readFile(filePath, (err, data) => {
        if (err) {
            // Only fallback to index.html for navigation requests (no extension or .html)
            const ext = path.extname(cleanPath).toLowerCase();
            if (ext === '' || ext === '.html') {
                console.log(`[Server] Falling back to index.html for: ${urlPath}`);
                fs.readFile(path.join(__dirname, 'dist/index.html'), (indexErr, indexData) => {
                    if (indexErr) {
                        res.writeHead(404);
                        res.end("Critical Error: dist/index.html not found.");
                        return;
                    }
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(indexData);
                });
            } else {
                console.error(`[Server] 404 Not Found: ${urlPath}`);
                res.writeHead(404);
                res.end("File not found");
            }
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.html': 'text/html',
            '.js': 'text/javascript', // Use text/javascript for modern Chromium
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.ico': 'image/x-icon',
            '.svg': 'image/svg+xml'
        };
        
        res.writeHead(200, { 
            'Content-Type': mimeTypes[ext] || 'application/octet-stream',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache'
        });

        // Patch index.html to support modern ES modules (fixes import.meta error)
        if (ext === '.html') {
            let html = data.toString();
            if (!html.includes('type="module"')) {
                console.log('[Server] Patching index.html: Adding type="module" to scripts');
                html = html.replace(/<script /g, '<script type="module" ');
            }
            res.end(html);
        } else {
            res.end(data);
        }
    });
});

function createWindow() {
    server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        const win = new BrowserWindow({
            width: 1200,
            height: 800,
            backgroundColor: '#121212',
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
            },
            icon: path.join(__dirname, 'assets/desktop-icon.png')
        });

        console.log(`[Electron] Loading app at http://127.0.0.1:${port}`);

        // Load from our internal server
        win.loadURL(`http://127.0.0.1:${port}`);
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
