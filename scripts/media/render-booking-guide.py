"""Render the original Avenyn Taxi ten-second silent booking guide (Pillow + ffmpeg)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import subprocess, math
ROOT=Path(__file__).resolve().parents[2]
W,H=720,1280
NAVY='#07394e'; TEAL='#087d95'; YELLOW='#ffdf35'; LIGHT='#eef8fa'; INK='#153d4b'
def font(n,bold=False):return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans'+('-Bold' if bold else '')+'.ttf',n)
logo=Image.open(ROOT/'public/avenyn-logo-optimized.webp').convert('RGBA');logo.thumbnail((128,118))
def text(d,xy,s,size=30,fill=INK,bold=False,anchor=None):d.text(xy,s,font=font(size,bold),fill=fill,anchor=anchor,spacing=10)
def box(d,xy,fill='white',radius=22,outline=None,width=2):d.rounded_rectangle(xy,radius=radius,fill=fill,outline=outline,width=width)
def field(d,y,label,value,active=False):
 box(d,(90,y,630,y+112),LIGHT,20,TEAL if active else '#cedfe4',3)
 text(d,(112,y+14),label,20,TEAL,True);text(d,(112,y+49),value,27,INK,True)
def button(d,y,label,fill=YELLOW):
 box(d,(90,y,630,y+80),fill,22);text(d,(360,y+40),label,27,INK if fill in (YELLOW,'#dcf6e1') else 'white',True,'mm')
def frame(t):
 im=Image.new('RGB',(W,H),NAVY);d=ImageDraw.Draw(im)
 # Own brand frame, with no copied map or third-party UI.
 d.ellipse((475,-130,875,270),fill='#0b465a')
 box(d,(42,35,188,169),'white',28);im.paste(logo,(115-logo.width//2,102-logo.height//2),logo)
 text(d,(218,64),'AVENYN TAXI',31,'white',True)
 text(d,(218,113),'Hemsida & kundapp',23,'#b9e3e8')
 cuts=[0,2.5,4.5,7.5,10];scene=next(i for i in range(4) if t<cuts[i+1]);local=t-cuts[scene]
 titles=['Vart vill du åka?','Nu eller senare?','Vad är tillval?','Kontrollera & boka']
 subtitles=['Välj adresser i förslagslistan.','Välj när du vill bli hämtad.','Anpassa resan efter dina behov.','Fyll i kontaktuppgifter och betalsätt.']
 text(d,(48,208),f'0{scene+1}',24,YELLOW,True)
 text(d,(48,250),titles[scene],41,'white',True)
 text(d,(48,315),subtitles[scene],25,'#d2edf0')
 # Slide the illustrated booking card into place.
 offset=int(52*(1-min(local/.35,1))**3)
 card=Image.new('RGB',(W,710),NAVY);c=ImageDraw.Draw(card)
 box(c,(48,0,672,694),'white',36)
 text(c,(90,34),'BOKA DIN TAXI',21,TEAL,True)
 if scene==0:
  field(c,88,'Hämtning','Göteborg Central',True)
  field(c,218,'Destination','Landvetter Airport',local>.7)
  # A simple original route illustration.
  c.line([(120,414),(250,414),(330,495),(585,495)],fill=TEAL,width=8)
  for x,y,l in [(120,414,'A'),(585,495,'B')]:
   c.ellipse((x-25,y-25,x+25,y+25),fill=YELLOW);text(c,(x,y),l,24,INK,True,'mm')
  text(c,(90,578),'Från din dörr till ditt mål.',26,INK,True)
 elif scene==1:
  field(c,88,'Din resa','Hämtning → destination')
  box(c,(90,240,350,330),YELLOW,24);text(c,(220,285),'Åk nu',31,INK,True,'mm')
  box(c,(370,240,630,330),TEAL,24);text(c,(500,285),'Förboka',29,'white',True,'mm')
  text(c,(90,380),'Åk nu: så snart som möjligt.',26,INK)
  text(c,(90,433),'Förboka: välj datum och tid.',26,INK)
  box(c,(90,507,630,615),LIGHT,22)
  text(c,(360,560),'Du väljer tiden.',31,TEAL,True,'mm')
 elif scene==2:
  button(c,88,'Tillval & fler val','#dcf6e1')
  text(c,(90,196),'Extra val för din resa',28,INK,True)
  for n,(label,desc) in enumerate([('Barnstol','För de små resenärerna'),('Storbil','När ni behöver fler platser')]):
   y=255+n*145;box(c,(90,y,630,y+125),LIGHT,22)
   box(c,(110,y+30,154,y+74),TEAL,12)
   text(c,(132,y+52),'✓',29,'white',True,'mm')
   text(c,(176,y+20),label,31,INK,True);text(c,(176,y+65),desc,22,TEAL)
  text(c,(90,585),'Välj det som passar dig.',27,INK,True)
 else:
  field(c,88,'Kontaktuppgifter','Namn + mobilnummer')
  field(c,218,'Betalsätt','Välj hur du vill betala')
  text(c,(90,374),'Kontrollera resa och pris.',29,INK,True)
  button(c,446,'Bekräfta bokningen')
  text(c,(360,602),'Välkommen ombord!',29,TEAL,True,'mm')
 # Gentle touch ripple highlights the relevant control.
 pos=[(585,274),(500,285),(132,307),(565,486)][scene]
 phase=max(0,local-.6)
 if 0<phase<.7:
  r=int(13+phase*24);c.ellipse((pos[0]-r,pos[1]-r,pos[0]+r,pos[1]+r),outline=TEAL,width=max(1,int(5*(1-phase/.7))))
 im.paste(card,(0,390+offset))
 d=ImageDraw.Draw(im)
 text(d,(360,1143),'avenyntaxi.se',38,YELLOW,True,'mm')
 text(d,(360,1193),'Boka på hemsidan eller i appen',24,'white',False,'mm')
 for i in range(4):
  x=48+i*159;box(d,(x,1233,x+143,1240),'#376273',3)
  progress=max(0,min(1,(t-cuts[i])/(cuts[i+1]-cuts[i])))
  if progress>0:box(d,(x,1233,x+max(7,int(143*progress)),1240),YELLOW,3)
 return im
out=ROOT/'public/avenyn-bokningsguide-10s.mp4'
p=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','rawvideo','-vcodec','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r','24','-i','-','-an','-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',str(out)],stdin=subprocess.PIPE)
for n in range(240):p.stdin.write(frame(n/24).tobytes())
p.stdin.close();assert p.wait()==0
frame(0.8).save(ROOT/'public/booking-guide-poster.jpg',quality=90)
# Representative storyboard for internal visual review.
preview=Image.new('RGB',(W*4,H))
for i,t in enumerate([1.5,3.5,6.3,9.3]):preview.paste(frame(t),(W*i,0))
preview.resize((1440,640)).save('/workspace/scratch/ad973f0ddf5d/booking-storyboard.jpg')
print(out)
