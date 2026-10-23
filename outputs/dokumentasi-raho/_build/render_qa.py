from pathlib import Path
import sys,json
base=Path(__file__).resolve().parent
sys.path.insert(0,str(base/'deps'))
import fitz
from PIL import Image,ImageDraw
pdf=fitz.open(base/'qa.pdf')
out=base/'render';out.mkdir(exist_ok=True)
report=[]
for i,page in enumerate(pdf):
    pix=page.get_pixmap(matrix=fitz.Matrix(1.5,1.5));pix.save(out/f'page-{i+1}.png')
    txt=page.get_text();report.append({'page':i+1,'chars':len(txt),'first':txt[:130],'last':txt[-170:]})
for start in range(0,len(pdf),4):
    sheet=Image.new('RGB',(1020,1380),'#D9E1E7');draw=ImageDraw.Draw(sheet)
    for j in range(4):
        n=start+j
        if n>=len(pdf):break
        im=Image.open(out/f'page-{n+1}.png');im.thumbnail((495,650));x=10+(j%2)*510;y=25+(j//2)*690
        sheet.paste(im,(x,y));draw.text((x,y-18),f'PAGE {n+1}',fill='black')
    sheet.save(out/f'sheet-{start//4+1}.png')
(base/'page_qa.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
