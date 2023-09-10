import hashlib
import base64
import sys

def hash(s):
    hash = hashlib.sha256(s.encode()).digest()
    encoded = base64.b64encode(hash)
    return encoded

contents = sys.argv[0]
print(hash(contents))