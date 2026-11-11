"""Serve only the reviewed preview files and a local metadata snapshot on loopback."""
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--port', type=int, default=17334)
parser.add_argument('--data', type=Path, required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1] / 'previews/library-readability'
files = {'/': (root / 'index.html', 'text/html'), '/app.js': (root / 'app.js', 'text/javascript'),
         '/style.css': (root / 'style.css', 'text/css'), '/data.json': (args.data, 'application/json')}

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.headers.get('Host') not in {f'127.0.0.1:{args.port}', f'localhost:{args.port}'}:
            self.send_error(403)
            return
        item = files.get(self.path.split('?')[0])
        if not item:
            self.send_error(404)
            return
        try:
            data = item[0].read_bytes()
        except OSError:
            self.send_error(503)
            return
        self.send_response(200)
        self.send_header('Content-Type', item[1] + '; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)

ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()
