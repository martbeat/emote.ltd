"""Independently inspect browser-generated release.pdf using pypdf and Pillow."""
import sys,json,hashlib,math,io
from pathlib import Path
from pypdf import PdfReader
from PIL import Image
root=Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/emote-pdf-qa')
s=PdfReader(root/'source.pdf');out=PdfReader(root/'release.pdf');record=json.loads((root/'record.json').read_text())
assert len(out.pages)==len(s.pages)==2
assert record['sourceSha256']==hashlib.sha256((root/'source.pdf').read_bytes()).hexdigest()
assert record['outputSha256']==hashlib.sha256((root/'release.pdf').read_bytes()).hexdigest()
assert out.metadata.title is None and out.metadata.author is None
assert b'ORIGINAL-METADATA-SECRET' not in (root/'release.pdf').read_bytes()
assert '/Names' not in out.trailer['/Root'] and '/AcroForm' not in out.trailer['/Root']
for i,(before,after) in enumerate(zip(s.pages,out.pages)):
    assert list(before.mediabox)==list(after.mediabox)
    assert not after.extract_text() and '/Annots' not in after
    assert len(after.images)==1
    im=Image.open(io.BytesIO(after.images[0].data)).convert('RGB');im.save(root/f'embedded-page-{i+1}.png')
    sx=im.width/float(after.mediabox.width);sy=im.height/float(after.mediabox.height)
    for mark in record['decisions']:
        if mark['page']!=i+1 or mark['status']!='redact':continue
        r=mark['rect'];area=im.crop((math.ceil(r['x']*sx),math.ceil(r['y']*sy),math.floor((r['x']+r['width'])*sx),math.floor((r['y']+r['height'])*sy)))
        assert area.getextrema()==((0,0),(0,0),(0,0)),(i,area.getextrema())
    assert sum(1 for pixel in im.get_flattened_data() if pixel==(255,255,255))>im.width*im.height//2
    if i==0:
        # This fixture contains only the withheld email in this band. Look for
        # fragments outside the black mask, including descenders and overhangs.
        mark=record['decisions'][0]['rect'];left=math.floor((mark['x']-1)*sx);top=math.floor((mark['y']-1)*sy)
        right=math.ceil((mark['x']+mark['width']+1)*sx);bottom=math.ceil((mark['y']+mark['height']+1)*sy)
        for y in range(math.floor(82*sy),math.ceil(118*sy)):
            for x in range(math.floor(60*sx),math.ceil(280*sx)):
                if not(left<=x<right and top<=y<bottom):assert im.getpixel((x,y))==(255,255,255),(x,y,im.getpixel((x,y)))
print('PASS: page sizes and hashes; no extracted text, source metadata, attachments or annotations; fresh images; all approved pixels black; no withheld-text fragments outside the mask.')
