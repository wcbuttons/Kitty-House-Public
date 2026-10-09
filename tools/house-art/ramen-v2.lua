-- Fresh Neko Ramen V2 production art, drawn and assembled in native Aseprite.
-- This script reads only newly generated v0943 sources. No V1 raster is opened.
local root=assert(app.params.root)
local pc=app.pixelColor
local dir=root..'/art/house-themes/source/v0943/ramen-v2/'
local out=root..'/public/assets/houses/ramen-v2/'
local function read(path) local f=assert(io.open(path,'r'));local s=f:read('*a');f:close();return s end
local manifest=json.decode(read(root..'/tools/house-art/ramen-v2-manifest.json'))
local report={tool='Aseprite native Lua',newSourceOnly=true,width=1408,height=792,furniture={}}
local function saveJson(path,value) local f=assert(io.open(path,'w'));f:write(json.encode(value));f:close() end
local function rgba(r,g,b,a) return pc.rgba(math.floor(math.max(0,math.min(255,r))),math.floor(math.max(0,math.min(255,g))),math.floor(math.max(0,math.min(255,b))),a or 255) end
local function color(hex) return rgba((hex>>16)&255,(hex>>8)&255,hex&255) end
local function dot(im,x,y,c) x=math.floor(x);y=math.floor(y);if x>=0 and y>=0 and x<im.width and y<im.height then im:drawPixel(x,y,c) end end
local function rect(im,x,y,w,h,c) for py=math.floor(y),math.floor(y+h-1) do for px=math.floor(x),math.floor(x+w-1) do dot(im,px,py,c) end end end
local function line(im,x1,y1,x2,y2,c,width)
  local n=math.max(math.abs(x2-x1),math.abs(y2-y1));width=width or 1
  for i=0,n do local t=n==0 and 0 or i/n;rect(im,x1+(x2-x1)*t-width/2,y1+(y2-y1)*t-width/2,width,width,c) end
end
local function ellipse(im,x,y,w,h,c)
  for py=y,y+h-1 do for px=x,x+w-1 do if ((px-x-w/2)/(w/2))^2+((py-y-h/2)/(h/2))^2<=1 then dot(im,px,py,c) end end end
end
local function blend(a,b,t) return rgba(pc.rgbaR(a)*(1-t)+pc.rgbaR(b)*t,pc.rgbaG(a)*(1-t)+pc.rgbaG(b)*t,pc.rgbaB(a)*(1-t)+pc.rgbaB(b)*t,255) end
local function wood(im,x,y,w,h,base,vertical)
  local r,g,b=(base>>16)&255,(base>>8)&255,base&255
  for py=math.floor(y),math.floor(y+h-1) do for px=math.floor(x),math.floor(x+w-1) do
    local a=vertical and px or py;local along=vertical and py or px
    local v=math.sin(a*0.71+math.sin(along*.033+a*.11)*1.8)*6+math.sin(a*.17)*4+((px*17+py*31)%7-3)*.9
    -- Sparse long pores and interrupted lighter fibers prevent large native
    -- panels from reading as uniform vector blocks after 3x downsampling.
    if (math.floor(a)+math.floor(math.sin(along*.023)*2))%11==0 then v=v-7 end
    if (math.floor(a)+3)%17==0 and math.floor(along/23)%3~=0 then v=v+5 end
    dot(im,px,py,rgba(r+v,g+v*.8,b+v*.55))
  end end
  rect(im,x,y,w,2,color(0xc39a68));rect(im,x,y+h-3,w,3,color(0x3c3029))
  rect(im,x,y,2,h,color(0x61452f));rect(im,x+w-2,y,2,h,color(0x322921))
end
local function nail(im,x,y) ellipse(im,x-3,y-3,7,7,color(0x2c2825));dot(im,x-1,y-2,color(0xb2a08a));dot(im,x,y-1,color(0x8e806f)) end
local function layer(sprite,name,image,visible)
  local l=sprite:newLayer();l.name=name;sprite:newCel(l,1,image,Point(0,0));if visible==false then l.isVisible=false end;return l
end
local function saveMaster(path,layers,w,h)
  local s=Sprite(w,h,ColorMode.RGB);s.layers[1].name='Empty transparent base'
  for _,v in ipairs(layers) do layer(s,v[1],v[2],v[3]) end
  s:saveAs(path);s:close()
end

-- Alpha-safe tight crops: only connected neutral background is removed when
-- a generated source is opaque. Existing RGBA is preserved, including gaps.
local function generated(name,w,h)
  local im=Image{fromFile=dir..name..'-generated.png'};local iw,ih=im.width,im.height
  local hasAlpha=false;for it in im:pixels() do if pc.rgbaA(it())<16 then hasAlpha=true;break end end
  local removed=0
  if not hasAlpha then
    local seen,q={},{}
    local function add(x,y)
      if x<0 or y<0 or x>=iw or y>=ih then return end
      local k=y*iw+x;if seen[k] then return end;seen[k]=true
      local c=im:getPixel(x,y);local r,g,b=pc.rgbaR(c),pc.rgbaG(c),pc.rgbaB(c)
      if math.max(r,g,b)-math.min(r,g,b)<22 and math.min(r,g,b)>80 then q[#q+1]=k end
    end
    for x=0,iw-1 do add(x,0);add(x,ih-1) end;for y=0,ih-1 do add(0,y);add(iw-1,y) end
    local n=1;while n<=#q do local k=q[n];n=n+1;local x,y=k%iw,math.floor(k/iw);im:drawPixel(x,y,0);add(x-1,y);add(x+1,y);add(x,y-1);add(x,y+1) end;removed=#q
  end
  -- Tiny faint fringe specks are not material. Keep all visible soft edges.
  for it in im:pixels() do if pc.rgbaA(it())<24 then it(0) end end
  local bounds=im:shrinkBounds();local clean=Image(im,bounds)
  clean:saveAs(dir..name..'-clean.png')
  clean:resize{width=w,height=h,method='bilinear'}
  report.furniture[#report.furniture+1]={id='ramen-v2-'..name,source=name..'-generated.png',sourceAlpha=hasAlpha,matteRemoved=removed,crop={x=bounds.x,y=bounds.y,width=bounds.width,height=bounds.height},width=w,height=h}
  return clean
end

local native={}
native.stool=function(im,w,h)
  wood(im,13,14,13,64,0x745038,true);wood(im,52,14,13,64,0x745038,true)
  wood(im,21,51,38,8,0x775335,false)
  wood(im,0,0,w,14,0x8c463b,false);rect(im,4,2,w-8,2,color(0xc68b66));rect(im,0,10,w,4,color(0x54332d))
  nail(im,18,20);nail(im,59,20)
end
native.shelf=function(im,w,h)
  for _,x in ipairs({28,w-48}) do
    wood(im,x,12,14,61,0x805734,true)
    for y=18,64 do wood(im,x+10,y,math.max(2,37-(y-18)*.7),2,0x865a38,false) end
    nail(im,x+6,23);nail(im,x+6,60)
  end
  wood(im,0,0,w,17,0x986a42,false);rect(im,0,0,w,3,color(0xc5975e));rect(im,3,12,w-6,2,color(0xb0814e))
end
native.bench=function(im,w,h)
  wood(im,12,0,w-24,17,0x785639,false)
  for x=27,w-28,38 do wood(im,x,15,8,65,0x8b6545,true) end
  wood(im,8,68,w-16,10,0x5a4434,false)
  wood(im,6,78,w-12,17,0x9c724b,false);rect(im,12,78,w-24,3,color(0xc59c6f))
  for _,x in ipairs({15,w-30}) do wood(im,x,95,15,61,0x755236,true);nail(im,x+7,109) end
  wood(im,25,134,w-50,8,0x775737,false)
  for _,x in ipairs({0,w-12}) do wood(im,x,54,12,75,0x8e6745,true);wood(im,x,52,15,8,0xa27c54,false) end
end
native.zabuton=function(im,w,h)
  rect(im,8,0,w-16,h,color(0x33495e));rect(im,0,10,w,h-20,color(0x33495e))
  for _,x in ipairs({0,w-20}) do for _,y in ipairs({0,h-20}) do ellipse(im,x,y,20,20,color(0x33495e)) end end
  for y=3,h-5 do for x=4,w-5 do
    if pc.rgbaA(im:getPixel(x,y))>0 then
      local v=16*math.sin(y/h*math.pi)+((x*3+y*5)%9-4)*1.2
      v=v-8*math.exp(-((x-w*.5)^2/80+(y-h*.5)^2/65))
      if y%3==0 then v=v-2 end
      dot(im,x,y,rgba(66+v,86+v,107+v))
    end
  end end
  rect(im,10,0,w-20,3,color(0x8b9ca7));rect(im,10,h-6,w-20,3,color(0x243a4d))
  line(im,6,17,6,h-18,color(0x657f91),2);line(im,w-7,17,w-7,h-18,color(0x263c4e),2)
  line(im,11,5,w-12,5,color(0x728a99),1);line(im,11,h-10,w-12,h-10,color(0x344d62),1)
  for x=14,w-16,10 do line(im,x,9,x+4,13,color(0xc4bda3),1);line(im,x,59,x+4,63,color(0xb2ad97),1) end
  for x=24,w-25,28 do for y=24,46,22 do line(im,x-4,y,x+4,y,color(0xaaa991),1);line(im,x,y-4,x,y+4,color(0xaaa991),1) end end
end
native.scratcher=function(im,w,h)
  wood(im,10,h-17,w-20,17,0x8a6543,false)
  wood(im,57,15,42,h-29,0x7c5c41,true)
  for y=16,h-22,5 do
    line(im,59,y+3,96,y,color(0x75674d),4);line(im,60,y,96,y-3,color(0xc9b58c),2)
  end
  wood(im,0,0,w,18,0x8e6646,false);rect(im,6,0,w-12,4,color(0xb79d72))
  nail(im,19,10);nail(im,w-20,10)
end
native.hide=function(im,w,h)
  wood(im,6,10,w-12,h-10,0x96724c,false)
  for y=26,h-1,26 do rect(im,8,y,w-16,2,color(0x604733)) end
  for _,x in ipairs({8,w-22}) do wood(im,x,12,14,h-14,0x7b5b3e,true);nail(im,x+6,29);nail(im,x+6,h-18) end
  local cx=w/2;ellipse(im,cx-43,51,86,91,color(0x503c2a));rect(im,cx-43,97,86,57,color(0x503c2a))
  ellipse(im,cx-36,57,72,80,color(0x1f2525));rect(im,cx-36,98,72,54,color(0x1f2525))
  rect(im,cx-33,h-16,66,9,color(0x4e4939));rect(im,cx-28,h-16,56,3,color(0x777257))
  wood(im,0,0,w,14,0xaa8155,false);rect(im,0,0,w,3,color(0xd0aa78))
end

native['bowl-rack']=function(im,w,h)
  wood(im,8,8,w-16,h-8,0x513d2e,true)
  for _,x in ipairs({8,w-23}) do wood(im,x,0,15,h,0x7f593a,true) end
  for _,y in ipairs({0,76,151,h-14}) do wood(im,0,y,w,14,0x966b45,false) end
  local tones={0xc4b493,0x79939a,0xb78666,0xbec6b6}
  for row=0,2 do for col=0,3 do
    local cx=38+col*52;local cy=64+row*73;local base=tones[(row+col)%#tones+1]
    local rr,gg,bb=(base>>16)&255,(base>>8)&255,base&255
    for nested=0,2 do
      local topY=cy-24+nested*7
      for y=topY,topY+18 do
        local width=39-(y-topY)*.60;local start=cx-width/2
        for x=math.floor(start),math.ceil(start+width) do
          local light=13*math.sin((x-start)/width*math.pi)+(y-topY)*.1+((x*7+y*11)%5-2)*.75
          dot(im,x,y,rgba(rr+light,gg+light,bb+light))
        end
      end
      line(im,cx-19,topY,cx+19,topY,color(0x4b4940),2)
      line(im,cx-18,topY+2,cx+18,topY+2,rgba(rr+25,gg+25,bb+25),2)
      line(im,cx-12,topY+8,cx-10,topY+13,rgba(rr+19,gg+20,bb+22),1)
    end
  end end
  wood(im,0,0,w,11,0xa87b4d,false)
  for _,x in ipairs({15,w-15}) do for _,y in ipairs({18,143,h-25}) do nail(im,x,y) end end
end

local furniture={};local generatedIds={counter=true,futon=true,tansu=true,table=true,planter=true,noren=true}
for _,d in ipairs(manifest.catalog) do
  local short=d.id:gsub('ramen%-v2%-','');local w,h=d.width*78,d.height*78
  local im
  if generatedIds[short] then im=generated(short,w,h)
  else im=Image(w,h,ColorMode.RGB);assert(native[short],short)(im,w,h);report.furniture[#report.furniture+1]={id=d.id,source='New native Aseprite design',width=w,height=h} end
  -- Main tops are deliberately registered to y=0, not an arbitrary crop/pad.
  -- Flatten the support lip of generated hard furniture only; textile crowns
  -- are separately checked against the same maximum-height contract.
  if short=='counter' or short=='table' or short=='tansu' then
    for x=2,w-3 do
      local yy=0;while yy<math.min(12,h) and pc.rgbaA(im:getPixel(x,yy))<100 do yy=yy+1 end
      if yy<12 then local c=im:getPixel(x,yy);for y=0,yy do im:drawPixel(x,y,c) end end
    end
  end
  local alpha={transparent=0,partial=0,opaque=0}
  for it in im:pixels() do
    local c=it();local a=pc.rgbaA(c)
    -- The generator's solid materials top out at alpha 252-254. Normalize
    -- that tiny systematic attenuation while preserving genuine edge alpha.
    if a>=245 then a=255;it(rgba(pc.rgbaR(c),pc.rgbaG(c),pc.rgbaB(c),255)) end
    if a==0 then alpha.transparent=alpha.transparent+1 elseif a==255 then alpha.opaque=alpha.opaque+1 else alpha.partial=alpha.partial+1 end
  end
  report.furniture[#report.furniture].runtimeAlpha=alpha
  im:saveAs(root..'/public/assets/houses/furniture/'..d.id..'.png')
  saveMaster(root..'/art/house-themes/ramen-v2-'..short..'.aseprite',{{'New '..d.name..' | exact support registration',im}},w,h)
  furniture[d.id]=im
end

local W,H=1408,792
local base=Image{fromFile=dir..'architecture-generated.png'};base:resize{width=W,height=H,method='bilinear'}
-- Generated architecture included an unintended variable alpha channel. A
-- backdrop must be opaque: keep its straight RGB texture and remove only that
-- accidental alpha, otherwise the night plate bleeds through bright noon sky.
local sourcePartialAlpha=0
for it in base:pixels() do local c=it();if pc.rgbaA(c)<255 then sourcePartialAlpha=sourcePartialAlpha+1 end;it(rgba(pc.rgbaR(c),pc.rgbaG(c),pc.rgbaB(c),255)) end
report.architectureAlpha={nonOpaquePixelsCorrected=sourcePartialAlpha,outputFullyOpaque=true}
local repairs=Image(W,H,ColorMode.RGB)
-- A real floor aperture and the last two treads bridge the generated flight
-- through the thickness of the upper beam. No little unrelated ladder.
-- Continue this fresh generation's own tread texture upward, preserving the
-- staircase's perspective and grain instead of inserting a flat ladder box.
for y=373,404 do for x=925,1026 do
  repairs:drawPixel(x,y,base:getPixel(x+10,y+30))
end end
wood(repairs,922,371,5,20,0x78583b,true)
wood(repairs,1024,371,5,19,0x694b34,true)
-- The veranda joins the upstairs home through the cut edge of a side wall.
-- Leave a 48px-tall uninterrupted floor-level opening; only the post end is
-- visible above it, avoiding a front-facing door blocking cross-room travel.
for y=325,372 do for x=649,674 do
  local sample=base:getPixel(690+(x-649)%15,y)
  repairs:drawPixel(x,y,sample)
end end
wood(repairs,649,322,27,5,0x6e513a,false)

local entrance=dofile(root..'/tools/house-art/ramen-v2-entrance.lua')(base)
local windowRepairs,windows=dofile(root..'/tools/house-art/ramen-v2-windows.lua')(base)

local lampLayer=Image(W,H,ColorMode.RGB)
local lampImage=generated('lantern',54,81)
report.fixedLantern=table.remove(report.furniture)
lampImage:resize{width=22,height=33,method='bilinear'}
local function lantern(x,y)
  line(lampLayer,x,y-27,x,y-16,color(0x42362a),2)
  lampLayer:drawImage(lampImage,Point(x-11,y-17))
end
lantern(409,487);lantern(754,487);lantern(1035,231)

local day=base:clone();day:drawImage(repairs,Point(0,0));day:drawImage(entrance,Point(0,0));day:drawImage(windowRepairs,Point(0,0));day:drawImage(lampLayer,Point(0,0))
local sky=Image(W,H,ColorMode.RGB)
local seen,q={},{}
local hillBoundary={{0,170},{64,161},{130,154},{180,133},{213,125},{248,146},{278,164},{326,167},{379,151},{414,160},{463,171},{523,168},{570,162},{615,183}}
local function hillAlpha(x,y)
  if x>615 then return 1 end
  for i=1,#hillBoundary-1 do local a,b=hillBoundary[i],hillBoundary[i+1];if x>=a[1] and x<=b[1] then
    local edge=a[2]+(b[2]-a[2])*(x-a[1])/(b[1]-a[1]);return math.max(0,math.min(1,(edge+8-y)/16))
  end end
  return 1
end
local function visitSky(x,y)
  if x<0 or y<0 or x>=W or y>=360 then return end
  if hillAlpha(x,y)<=0 then return end
  local key=y*W+x;if seen[key] then return end;seen[key]=true
  local c=day:getPixel(x,y);local r,g,b=pc.rgbaR(c),pc.rgbaG(c),pc.rgbaB(c)
  if (b>g*1.055 and b>r*1.16 and b>145) or (r>185 and g>194 and b>205) then q[#q+1]=key end
end
for x=0,W-1 do visitSky(x,0) end
local n=1;while n<=#q do local key=q[n];n=n+1;local x,y=key%W,math.floor(key/W);sky:drawPixel(x,y,rgba(255,255,255,math.floor(hillAlpha(x,y)*255)));visitSky(x-1,y);visitSky(x+1,y);visitSky(x,y-1);visitSky(x,y+1) end
-- The authored paper-only mask excludes every wooden separator, regardless
-- of grain brightness, and limits the strength of the runtime sky wash.
local night=day:clone()
local lamps={{215,443},{1225,443},{409,487},{754,487},{1035,231}}
for y=0,H-1 do for x=0,W-1 do
  local c=day:getPixel(x,y);local r,g,b=pc.rgbaR(c),pc.rgbaG(c),pc.rgbaB(c)
  local indoor=(x>275 and x<1176 and y>414 and y<665) or (x>675 and x<1176 and y>201 and y<374)
  local lr,lg,lb=indoor and .46 or .18,indoor and .45 or .26,indoor and .44 or .42
  local warm=0
  for _,p in ipairs(lamps) do warm=math.max(warm,math.exp(-((x-p[1])^2/10000+(y-p[2])^2/9000))*0.5) end
  if not indoor then warm=warm*.65 end
  night:drawPixel(x,y,rgba(r*(lr+warm*.46),g*(lg+warm*.26),b*(lb+warm*.02)))
end end
-- Opaque material panes glow only on the night plate; frame pixels are never
-- lightened. Crossfade remains perfectly registered, without texture drift.
for y=0,H-1 do for x=0,W-1 do if pc.rgbaA(windows:getPixel(x,y))>0 then
  local c=night:getPixel(x,y);night:drawPixel(x,y,blend(c,color(0xb8884c),.20))
end end end
local fixtures=Image(W,H,ColorMode.RGB)
-- The narrow near-side stringer and its bottom post sit in front of cats.
-- Extract their exact fresh plate pixels, leaving the broad central treads
-- transparent. Rear rails and all walking surfaces stay on the architecture.
local function fixtureAt(x,y) fixtures:drawPixel(x,y,day:getPixel(x,y)) end
for y=402,653 do
  local cx=926+(y-402)*.541
  for x=math.floor(cx-5),math.ceil(cx+6) do fixtureAt(x,y) end
end
for y=643,661 do for x=1058,1070 do fixtureAt(x,y) end end
for y=402,403 do for x=925,1026 do fixtureAt(x,y) end end
local fixturesNight=fixtures:clone()
for y=0,H-1 do for x=0,W-1 do if pc.rgbaA(fixtures:getPixel(x,y))>0 then fixturesNight:drawPixel(x,y,night:getPixel(x,y)) end end end
day:saveAs(out..'background-day.png');night:saveAs(out..'background-night.png');night:saveAs(out..'background.png')
sky:saveAs(out..'sky-mask.png');windows:saveAs(out..'window-mask.png');fixtures:saveAs(out..'fixtures.png');fixturesNight:saveAs(out..'fixtures-night.png')
saveMaster(root..'/art/house-themes/ramen-v2.aseprite',{{'New generated architecture | raw daylight',base},{'Native landing and side opening',repairs},{'Recessed street entrance',entrance},{'Stable shoji paper and wooden lattice',windowRepairs},{'New fixed lanterns',lampLayer},{'Aligned night illumination',night,false},{'Exact sky mask',sky,false},{'Restrained paper-only light mask',windows,false},{'Foreground landing edge',fixtures},{'Night foreground edge',fixturesNight,false}},W,H)

local preview=day:clone()
for _,placement in ipairs(manifest.theme.defaultFurniture) do
  local definition;for _,d in ipairs(manifest.catalog) do if d.id==placement[1] then definition=d;break end end
  local room;for _,r in ipairs(manifest.theme.rooms) do if r.id==placement[2] then room=r;break end end
  local im=furniture[placement[1]]:clone();im:resize{width=definition.width*26,height=definition.height*26,method='bilinear'}
  preview:drawImage(im,Point(room.x+placement[3]*26,room.floor-((placement[4] or 0)+definition.height)*26))
end
preview:drawImage(fixtures,Point(0,0));preview:saveAs(root..'/art/house-themes/ramen-v2-preview.png')
local sheet=Image(1500,920,ColorMode.RGB);rect(sheet,0,0,750,920,color(0xf0e5cd));rect(sheet,750,0,750,920,color(0x15272d))
for i,d in ipairs(manifest.catalog) do
  local im=furniture[d.id]:clone();local scale=math.min(1,226/im.width,166/im.height);im:resize{width=math.floor(im.width*scale),height=math.floor(im.height*scale),method='bilinear'}
  local col=(i-1)%3;local row=math.floor((i-1)/3);sheet:drawImage(im,Point(col*250+10,row*183+6));sheet:drawImage(im,Point(760+col*250,row*183+6))
end
sheet:saveAs(dir..'furniture-light-dark-review.png')
report.floorY={shop=663,studio=373,veranda=373};report.stairs={lower={1102,663},upper={974,373},separateLandingRepair=true};report.dayNightSamePixelGeometry=true;report.exteriorAlphaIsNative=true;report.movablePropsBakedInArchitecture=0
report.shoji={geometryAuthored=true,rectangularPanes=32,paperMaskAlpha=51,woodMaskAlpha=0}
report.streetEntrance={side='left',bounds={279,456,46,201},recessed=true,walkableFloorUnchanged=true}
saveJson(root..'/art/house-themes/ramen-v2-report.json',report)
print('Neko Ramen V2 exported: '..#manifest.catalog..' fresh furniture sprites, 7 world plates/masks, editable Aseprite masters.')
