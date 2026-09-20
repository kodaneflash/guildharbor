"""Offline parser and fail-closed checks; these do not verify deployed ClamAV."""
import importlib.util
import io
import os
from pathlib import Path
import unittest
from unittest.mock import patch
import zipfile

os.environ.setdefault('FILE_SCANNER_TOKEN', 'isolated-unit-test-token-' * 2)
os.environ.setdefault('CLAMAV_HOST', 'scanner.example.test')
spec = importlib.util.spec_from_file_location('scanner', Path(__file__).with_name('file-scanner.py'))
scanner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scanner)


def archive(name, content=b'hello'):
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, 'w') as file:
        file.writestr(name, content)
    return stream.getvalue()


class ScannerTests(unittest.TestCase):
    def test_plain_text_and_zip(self):
        scanner.validate_type(b'Hello', 'text/plain')
        scanner.validate_type(archive('document.txt'), 'application/zip')

    def test_spoofed_and_active_types(self):
        for media in ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'image/svg+xml', 'text/html']:
            with self.subTest(media=media), self.assertRaises(ValueError):
                scanner.validate_type(b'<script>alert(1)</script>', media)
        with self.assertRaises(ValueError):
            scanner.validate_type(b'hello\0world', 'text/plain')

    def test_path_traversal_and_symlinks(self):
        for name in ['../secret', '/secret', 'folder/../../secret', '..\\secret']:
            with self.subTest(name=name), self.assertRaises(ValueError):
                scanner.inspect_archive(archive(name))
        entry = zipfile.ZipInfo('link')
        entry.external_attr = 0o120777 << 16
        with self.assertRaises(ValueError):
            scanner.inspect_archive(archive(entry))

    def test_nested_and_uninspectable_archives(self):
        with self.assertRaises(ValueError):
            scanner.inspect_archive(archive('nested.rar'))
        data = archive('text.txt')
        for _ in range(5):
            data = archive('nested.zip', data)
        with self.assertRaises(ValueError):
            scanner.inspect_archive(data)

    def test_entry_and_expansion_bounds(self):
        stream = io.BytesIO()
        with zipfile.ZipFile(stream, 'w') as file:
            for index in range(501):
                file.writestr(str(index), b'')
        with self.assertRaises(ValueError):
            scanner.inspect_archive(stream.getvalue())
        with patch.object(scanner, 'MAX_EXPANDED', 3), self.assertRaises(ValueError):
            scanner.inspect_archive(archive('too-large.txt', b'1234'))

    def test_scanner_outage_never_returns_clean(self):
        with patch.object(scanner.socket, 'create_connection', side_effect=OSError('unavailable')):
            with self.assertRaises(OSError):
                scanner.malware_clean(b'hello')


if __name__ == '__main__':
    unittest.main()
