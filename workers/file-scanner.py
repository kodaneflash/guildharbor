"""Isolated scanner service. Run behind authenticated HTTPS ingress with no public storage access.
Requires a reachable ClamAV daemon. Never returns clean when ClamAV is unavailable.
"""
import hashlib
import hmac
import io
import json
import os
import socket
import struct
import zipfile
from http.server import BaseHTTPRequestHandler, HTTPServer

MAX_BYTES = 10 * 1024 * 1024
MAX_EXPANDED = 50 * 1024 * 1024
TOKEN = os.environ['FILE_SCANNER_TOKEN']
if len(TOKEN) < 32:
    raise RuntimeError('Scanner token must contain at least 32 characters')


def inspect_archive(data, depth=0, budget=None):
    if budget is None:
        budget = {'bytes': 0, 'entries': 0}
    if depth > 3:
        raise ValueError('Archive nesting exceeds limit')
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        for entry in archive.infolist():
            budget['entries'] += 1
            budget['bytes'] += entry.file_size
            if budget['entries'] > 500 or budget['bytes'] > MAX_EXPANDED:
                raise ValueError('Archive expansion exceeds limit')
            if entry.flag_bits & 1 or entry.filename.startswith(('/', '\\')) or '..' in entry.filename.replace('\\', '/').split('/'):
                raise ValueError('Encrypted or unsafe archive')
            if (entry.external_attr >> 16) & 0o170000 == 0o120000:
                raise ValueError('Archive links are not supported')
            if entry.is_dir():
                continue
            with archive.open(entry) as stream:
                content = stream.read(MAX_EXPANDED + 1)
            if len(content) != entry.file_size or len(content) > MAX_EXPANDED:
                raise ValueError('Archive size mismatch')
            if content.startswith(b'PK\x03\x04'):
                inspect_archive(content, depth + 1, budget)
            elif entry.filename.lower().endswith(('.zip', '.7z', '.rar', '.gz', '.tar', '.bz2', '.xz')):
                raise ValueError('Uninspectable nested archive')


def validate_type(data, media):
    if media == 'application/zip':
        inspect_archive(data)
    elif media == 'text/plain':
        text = data.decode('utf-8', errors='strict')
        if '\x00' in text:
            raise ValueError('Binary content in text file')
    elif media == 'application/pdf' and data.startswith(b'%PDF-'):
        if b'%%EOF' not in data[-2048:]:
            raise ValueError('Incomplete PDF')
    elif media == 'image/jpeg' and data.startswith(b'\xff\xd8\xff'):
        pass
    elif media == 'image/png' and data.startswith(b'\x89PNG\r\n\x1a\n'):
        pass
    elif media == 'image/webp' and data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        pass
    else:
        raise ValueError('Content type mismatch')


def malware_clean(data):
    with socket.create_connection((os.environ['CLAMAV_HOST'], int(os.environ.get('CLAMAV_PORT', '3310'))), timeout=40) as connection:
        connection.sendall(b'zINSTREAM\0')
        for start in range(0, len(data), 65536):
            chunk = data[start:start + 65536]
            connection.sendall(struct.pack('!I', len(chunk)) + chunk)
        connection.sendall(struct.pack('!I', 0))
        result = bytearray()
        while len(result) < 4096:
            chunk = connection.recv(1024)
            if not chunk:
                break
            result.extend(chunk)
            if b'\0' in chunk:
                break
        return bytes(result).rstrip(b'\0\n') == b'stream: OK'


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if not hmac.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + TOKEN):
            self.send_error(401)
            return
        size = int(self.headers.get('Content-Length', '0'))
        if size < 1 or size > MAX_BYTES:
            self.send_error(413)
            return
        self.connection.settimeout(60)
        data = self.rfile.read(size)
        media = self.headers.get('Content-Type', '')
        clean = False
        try:
            if len(data) != size:
                raise ValueError('Incomplete request')
            validate_type(data, media)
            clean = malware_clean(data)
        except (ValueError, UnicodeError, zipfile.BadZipFile, RuntimeError, NotImplementedError):
            clean = False
        except (OSError, TimeoutError):
            self.send_error(503, 'Scanner unavailable')
            return
        body = json.dumps({'clean': clean, 'sha256': hashlib.sha256(data).hexdigest(), 'mediaType': media}).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        return  # Never log request bodies or authorization headers.


if __name__ == '__main__':
    HTTPServer(('0.0.0.0', int(os.environ.get('PORT', '8080'))), Handler).serve_forever()
