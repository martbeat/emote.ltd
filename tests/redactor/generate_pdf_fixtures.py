"""Generate synthetic PDF fixtures. Requires reportlab, Pillow and pypdf."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader, PdfWriter
from pypdf.generic import DictionaryObject, NameObject, ArrayObject, FloatObject, TextStringObject
root=Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/emote-pdf-qa');root.mkdir(parents=True,exist_ok=True)
c=canvas.Canvas(str(root/'source.pdf'),pagesize=(612,792));c.setTitle('ORIGINAL-METADATA-SECRET');c.setAuthor('ORIGINAL-AUTHOR-SECRET')
c.setFont('Helvetica-Bold',20);c.drawString(80,730,'Synthetic disclosure test')
c.setFont('Helvetica',12);c.drawString(80,690,'secret.person@example.org');c.drawString(80,660,'Disclose this retained line')
c.setStrokeColorRGB(.1,.4,.2);c.setFillColorRGB(.93,.97,.93);c.rect(80,490,450,130,stroke=1,fill=1);c.setFillColorRGB(0,0,0);c.drawString(95,590,'Table heading remains');c.drawString(95,550,'A retained row with original position');c.line(80,570,530,570)
c.showPage();c.setPageSize((792,612));c.setFont('Helvetica-Bold',20);c.drawString(80,565,'Landscape page')
image=Image.new('RGB',(540,240),'white');ImageDraw.Draw(image).text((25,80),'IMAGE SECRET',fill='black',stroke_width=2)
c.drawImage(ImageReader(image),80,450,width=180,height=80);c.setFont('Helvetica',12);c.drawString(80,380,'Landscape retained text');c.save()
r=PdfReader(root/'source.pdf')
w=PdfWriter();w.append(r);w.add_attachment('embedded-secret.txt',b'ATTACHMENT SECRET');w.write(root/'attachment.pdf')
w=PdfWriter();w.append(r);w.add_js("app.alert('SCRIPT SECRET')");w.write(root/'script.pdf')
w=PdfWriter();w.append(r);w.encrypt('test-password');w.write(root/'encrypted.pdf')
w=PdfWriter();w.append(r);w.add_annotation(0,DictionaryObject({NameObject('/Type'):NameObject('/Annot'),NameObject('/Subtype'):NameObject('/Text'),NameObject('/Rect'):ArrayObject([FloatObject(20),FloatObject(20),FloatObject(50),FloatObject(50)]),NameObject('/Contents'):TextStringObject('ANNOTATION SECRET')}));w.write(root/'annotation.pdf')
w=PdfWriter();w.add_page(r.pages[0]);w.pages[0].rotate(90);w.pages[0].cropbox.lower_left=(20,30);w.pages[0].cropbox.upper_right=(580,750);w.write(root/'rotated-cropped.pdf')
print(root)
for filename,width in [('passive-link.pdf',0),('visible-link.pdf',1)]:
    w=PdfWriter();w.append(r);w.add_annotation(0,DictionaryObject({NameObject('/Type'):NameObject('/Annot'),NameObject('/Subtype'):NameObject('/Link'),NameObject('/Rect'):ArrayObject([FloatObject(80),FloatObject(650),FloatObject(260),FloatObject(673)]),NameObject('/Border'):ArrayObject([FloatObject(0),FloatObject(0),FloatObject(width)]),NameObject('/A'):DictionaryObject({NameObject('/S'):NameObject('/URI'),NameObject('/URI'):TextStringObject('https://example.test/private-target')})}));w.write(root/filename)
w=PdfWriter();w.append(r)
group=w._add_object(DictionaryObject({NameObject('/Type'):NameObject('/OCG'),NameObject('/Name'):TextStringObject('Optional layer')}))
w._root_object[NameObject('/OCProperties')]=DictionaryObject({NameObject('/OCGs'):ArrayObject([group]),NameObject('/D'):DictionaryObject({NameObject('/Order'):ArrayObject([group]),NameObject('/ON'):ArrayObject([group]),NameObject('/BaseState'):NameObject('/ON')})})
w.write(root/'layered.pdf')
