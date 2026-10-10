"""Require the public build to match the already-published 0.1.0 artifact."""
import hashlib
import json
from pathlib import Path
import sys
import tarfile

artifact = Path(sys.argv[1])
expected = 'ffe00edb7a6ba3f2c69c577e60cab68338db4902'
assert hashlib.sha1(artifact.read_bytes()).hexdigest() == expected, 'Unexpected npm artifact checksum'
with tarfile.open(artifact) as package:
    files = [member for member in package.getmembers() if member.isfile() and member.name.startswith('package/dist/')]
    expected_paths = {member.name.removeprefix('package/') for member in files}
    actual_paths = {str(path) for path in Path('dist').rglob('*') if path.is_file()}
    assert actual_paths == expected_paths, 'Built file inventory differs from npm'
    for member in files:
        path = Path(member.name.removeprefix('package/'))
        assert path.read_bytes() == package.extractfile(member).read(), f'Published artifact differs: {path}'
print(json.dumps({'version': '0.1.0', 'npm_sha1': expected, 'identical_compiled_files': len(files)}))
