import base64,hashlib,json,pathlib,urllib.request
for asset in json.loads(pathlib.Path("sites-assets-manifest.json").read_text()):
    path=pathlib.Path(asset["path"])
    if path.is_absolute() or ".." in path.parts: raise ValueError("Invalid asset path")
    if path.exists() and hashlib.sha256(path.read_bytes()).hexdigest()==asset["sha256"]: continue
    data=base64.b64decode(asset["base64"]) if "base64" in asset else urllib.request.urlopen(asset["url"],timeout=90).read()
    if hashlib.sha256(data).hexdigest()!=asset["sha256"]: raise ValueError("Asset checksum changed: "+str(path))
    path.parent.mkdir(parents=True,exist_ok=True); path.write_bytes(data)
print("Assets restored and checksums verified")
