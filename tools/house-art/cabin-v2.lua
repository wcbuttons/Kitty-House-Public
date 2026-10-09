-- Woodland Cabin V2. All materials and furniture are freshly generated for this
-- package. Native Aseprite owns clean alpha, geometry, registered lighting,
-- architecture layers, the functional ladder and every runtime export.
local root=assert(app.params.root)
local pc=app.pixelColor
local dir=root..'/art/house-themes/source/v0943/cabin-v2/'
local function read(path) local f=assert(io.open(root..'/'..path));local s=f:read('*a');f:close();return s end
local manifest=json.decode(read('tools/house-art/cabin-v2-manifest.json'))
local function saveJson(path,value)local f=assert(io.open(root..'/'..path,'w'));f:write(json.encode(value));f:close()end
local function layer(sprite,name,image,point)local l=sprite:newLayer();l.name=name;sprite:newCel(l,1,image,point or Point(0,0));return l end
local function rgba(r,g,b,a)return pc.rgba(math.floor(math.max(0,math.min(255,r))),math.floor(math.max(0,math.min(255,g))),math.floor(math.max(0,math.min(255,b))),a or 255)end
local function mix(a,b,t)return rgba(pc.rgbaR(a)*(1-t)+pc.rgbaR(b)*t,pc.rgbaG(a)*(1-t)+pc.rgbaG(b)*t,pc.rgbaB(a)*(1-t)+pc.rgbaB(b)*t,255)end
local function remap(v,target,source)for i=1,#target-1 do if v<=target[i+1] then return source[i]+(v-target[i])/(target[i+1]-target[i])*(source[i+1]-source[i])end end;return source[#source]end
local function rect(im,x,y,w,h,c) for py=y,y+h-1 do for px=x,x+w-1 do if px>=0 and py>=0 and px<im.width and py<im.height then im:drawPixel(px,py,c)end end end end
local report={generator='Built-in image_gen; exact backend model is not exposed',editor='Native Aseprite',world={width=1408,height=792},furniture={},registration='Night plate derives from the exact daylight pixels; no generated geometry interpolation.'}

-- Generated source coordinates are fitted to the independently authored layout,
-- including exact floor fronts, an unobstructed ladder strip and open veranda.
local xt={0,184,210,234,858,884,1170,1190,1407}
local xs={0,191,216,257,970,1014,1361,1417,1671}
local yt={0,25,236,266,414,422,452,474,674,682,699,744,791}
local ys={0,30,253,277,440,458,489,503,711,725,743,800,940}
local source=Image{fromFile=dir..'architecture-generated.png'}
local day=Image(1408,792,ColorMode.RGB)
for y=0,791 do for x=0,1407 do day:drawPixel(x,y,source:getPixel(math.floor(remap(x,xt,xs)),math.floor(remap(y,yt,ys))))end end
local shell=day:clone()
local repairExterior=assert(loadfile(root..'/tools/house-art/cabin-v2-exterior.lua'))()
local exteriorRepair,exteriorReport=repairExterior(source,day,xt,xs,yt,ys)
report.exteriorRegistration=exteriorReport
local buildHearth=assert(loadfile(root..'/tools/house-art/cabin-v2-hearth.lua'))()
local hearth=buildHearth(day)
report.hearth=hearth.report
local construction=Image(1408,792,ColorMode.RGB)
local fixtures=Image(1408,792,ColorMode.RGB)
local ladder
for _,p in ipairs(manifest.theme.passages)do if p.id=='cedar-ladder'then ladder=p end end
assert(ladder and ladder.a.x==ladder.b.x,'The cabin ladder must be vertical')
local ladderX=234+26*ladder.a.x
local ladderShift=ladderX-286

-- A real open loft hatch. Reconstruct the small opening with adjoining wall
-- material from this same new shell, then fit a dark inner edge and flush top.
for y=414,451 do for x=267+ladderShift,305+ladderShift do
 local sample=day:getPixel(x,474+(y-414)%24)
 day:drawPixel(x,y,mix(sample,rgba(17,19,15),.34))
 construction:drawPixel(x,y,day:getPixel(x,y))
end end
rect(day,265+ladderShift,416,3,37,rgba(63,44,24));rect(day,305+ladderShift,416,3,37,rgba(63,44,24))
rect(construction,265+ladderShift,416,3,37,rgba(63,44,24));rect(construction,305+ladderShift,416,3,37,rgba(63,44,24))

-- The ladder is drawn at the passage x-coordinate, not inferred from artwork.
-- Knots and distinct lit edges keep its wood material consistent with the cabin.
local function timber(im,x,y,w,h)
 for py=y,y+h-1 do for px=x,x+w-1 do
  local edge=(px-x==0 or px-x==w-1) and -38 or (px-x==1 and 30 or 0)
  local grain=((math.floor((py-y)/5)+px*3)%7-3)*2
  im:drawPixel(px,py,rgba(143+edge+grain,97+edge*.66+grain*.7,49+edge*.4+grain*.35))
 end end
end
for _,im in ipairs({day,construction})do
 timber(im,267+ladderShift,400,6,282);timber(im,300+ladderShift,400,6,282)
 for y=418,676,18 do timber(im,273+ladderShift,y,27,5);rect(im,274+ladderShift,y,25,1,rgba(203,148,80))end
end
-- Only the near rail sits in front of climbing cats. This is a physical
-- cutaway support, not a second ladder or a background-colored cover patch.
for y=400,681 do for x=300+ladderShift,305+ladderShift do fixtures:drawPixel(x,y,day:getPixel(x,y))end end
-- The central timber is at the front of the cutaway. Cats cross through the
-- open bay BEHIND it, rather than appearing to walk across painted wood.
for y=474,681 do for x=860,881 do fixtures:drawPixel(x,y,day:getPixel(x,y))end end

-- Trace sky by its cool colors; trees, roof and timber remain unmasked. The
-- dedicated window mask additionally protects each pane's wooden mullions.
local sky=Image(1408,792,ColorMode.RGB)
local atmosphere=Image(1408,792,ColorMode.RGB)
local windowMask=Image(1408,792,ColorMode.RGB)
-- Individually measured glass panes protect the amber mullions while keeping
-- forest and cloud highlights in the same continuous twilight window view.
local panes={}
for _,column in ipairs({{669,30},{703,30},{737,30},{771,29}})do
 for _,row in ipairs({{294,23},{320,26},{505,27},{536,28}})do
  panes[#panes+1]={column[1],row[1],column[2],row[2]}
 end
end
local function inGlass(x,y)
 for _,p in ipairs(panes)do if x>=p[1] and x<p[1]+p[3] and y>=p[2] and y<p[2]+p[4] then return true end end
 return false
end
-- Measured skyline excludes every mountain face and the lake from the sky
-- wash. Masking terrain by blue hue alone produces orange rock with blue holes.
local mountainX={1100,1120,1136,1155,1170,1181,1194,1204,1218,1224,1233,1242,1258,1269,1275,1291,1312,1320,1340,1407}
local mountainY={260,224,199,186,175,158,173,180,185,180,179,190,205,204,200,213,219,227,233,265}
local function chimney(x,y)
 if x<228 or x>300 or y<51 or y>225 then return false end
 if y>=92 then return x>=229 and x<=299 end
 if y>=68 and y<=80 then return x>=232 and x<=294 end
 if y>80 then return (x>=236 and x<=246) or (x>=273 and x<=289) end
 return x>=254 and x<=272
end
for y=0,791 do for x=0,1407 do
 local c=day:getPixel(x,y);local r,g,b=pc.rgbaR(c),pc.rgbaG(c),pc.rgbaB(c)
 local skyPixel=b-r>30 and b-g>12 and b>190 and g>140
 -- Bright cloud centers are warm-neutral (e.g.235,234,230), not blue.
 -- Include their continuous neutral texture as well as cool cloud shadows.
 local neutralCloud=math.min(r,g,b)>150 and math.max(r,g,b)-math.min(r,g,b)<76
 local skyOrCloud=(b-r>8 and b-g>1 and b>135) or neutralCloud
 local exterior=y<270 or x<185 and y<330 or x>1192 and y<350
 local aboveMountain=x<1100 or y<remap(x,mountainX,mountainY)-.5
 local mainRoof=x>=116 and x<=936 and y>=25+math.abs(x-540)*.60
 local porchRoof=x>=880 and x<=1210 and y>=319+(x-880)*.43
 local allowed=exterior and aboveMountain and not mainRoof and not porchRoof and not chimney(x,y)
 if allowed and skyOrCloud then atmosphere:drawPixel(x,y,rgba(255,255,255,255))end
 if allowed and skyPixel then sky:drawPixel(x,y,rgba(255,255,255,255))end
 -- A restrained whole-pane wash keeps the trees visible through the glass.
 if inGlass(x,y)then windowMask:drawPixel(x,y,rgba(255,255,255,89))end
end end

-- Structural lamp coordinates are measured after registration, their copper
-- frames retained. Candle light is a smooth material-space falloff at night.
local night=day:clone()
for y=0,791 do for x=0,1407 do
 local c=day:getPixel(x,y);local r,g,b=pc.rgbaR(c),pc.rgbaG(c),pc.rgbaB(c)
 local glass=inGlass(x,y)
 local indoors=not glass and x>=234 and x<858 and ((y>=266 and y<422) or (y>=474 and y<682))
 local factor=indoors and .36 or .17
 local nr,ng,nb=r*factor+5,g*(factor+.04)+8,b*(factor+.10)+12
 for _,l in ipairs(manifest.art.lamps)do
   local dx,dy=(x-l.x)/118,(y-l.y)/92
   local glow=glass and 0 or .47*math.exp(-1.5*(dx*dx+dy*dy))
   nr=nr+(r*.45+48)*glow;ng=ng+(g*.25+20)*glow;nb=nb+(b*.07+2)*glow
 end
 night:drawPixel(x,y,rgba(nr,ng,nb))
end end
for _,l in ipairs(manifest.art.lamps)do
 if l.x~=hearth.x or l.y~=hearth.y then
  rect(night,l.x-2,l.y-4,5,10,rgba(242,177,70));rect(night,l.x-1,l.y-3,3,7,rgba(255,235,161))
 end
end
hearth.illuminate(night)
local flameAnimation=hearth.animate(manifest.art.fireplace)
flameAnimation.sheet:saveAs(root..'/public/assets/houses/cabin-v2/fireplace-flames.png')
flameAnimation.master:saveAs(root..'/art/house-themes/cabin-v2-fireplace.aseprite')
report.hearth.animation=flameAnimation.report
local nightFixtures=Image(1408,792,ColorMode.RGB)
for y=0,791 do for x=0,1407 do if pc.rgbaA(fixtures:getPixel(x,y))>0 then nightFixtures:drawPixel(x,y,night:getPixel(x,y))end end end
local backgroundAlphaErrors,fixtureAlphaErrors=0,0
for y=0,791 do for x=0,1407 do
 if pc.rgbaA(day:getPixel(x,y))~=255 or pc.rgbaA(night:getPixel(x,y))~=255 then backgroundAlphaErrors=backgroundAlphaErrors+1 end
 if pc.rgbaA(fixtures:getPixel(x,y))~=pc.rgbaA(nightFixtures:getPixel(x,y))then fixtureAlphaErrors=fixtureAlphaErrors+1 end
end end
assert(backgroundAlphaErrors==0,'A background must be fully opaque')
assert(fixtureAlphaErrors==0,'Fixture day/night silhouettes must match')
report.validation={backgroundAlphaErrors=backgroundAlphaErrors,fixtureAlphaErrors=fixtureAlphaErrors,glassUsesExteriorNightShade=true}
local master=Sprite(1408,792,ColorMode.RGB)
layer(master,'01 Original generated empty architecture',shell)
layer(master,'01b Continuous forest registration',exteriorRepair)
layer(master,'01c Recessed stone hearth and connected flue',hearth.layer)
layer(master,'02 Native hatch and traversable ladder',construction)
layer(master,'03 Registered daylight shell',day)
layer(master,'03b All-day fireplace | first frame; full loop in fireplace master',flameAnimation.first,Point(manifest.art.fireplace.x,manifest.art.fireplace.y))
local n=layer(master,'04 Registered candlelit night shell',night);n.isVisible=false
local f=layer(master,'05 Foreground near ladder rail',fixtures);f.isVisible=false
local nf=layer(master,'05b Matched night foreground trim',nightFixtures);nf.isVisible=false
local sm=layer(master,'06 Celestial sky mask',sky);sm.isVisible=false
local am=layer(master,'07 Twilight atmosphere mask',atmosphere);am.isVisible=false
local wm=layer(master,'08 Glass-only window mask',windowMask);wm.isVisible=false
master:saveAs(root..'/art/house-themes/cabin-v2.aseprite')
day:saveAs(root..'/public/assets/houses/cabin-v2/background-day.png')
night:saveAs(root..'/public/assets/houses/cabin-v2/background-night.png')
night:saveAs(root..'/public/assets/houses/cabin-v2/background.png')
sky:saveAs(root..'/public/assets/houses/cabin-v2/sky-mask.png')
atmosphere:saveAs(root..'/public/assets/houses/cabin-v2/atmosphere-mask.png')
windowMask:saveAs(root..'/public/assets/houses/cabin-v2/window-mask.png')
fixtures:saveAs(root..'/public/assets/houses/cabin-v2/fixtures.png')
nightFixtures:saveAs(root..'/public/assets/houses/cabin-v2/fixtures-night.png')
report.mapping={targetX=xt,sourceX=xs,targetY=yt,sourceY=ys}
report.glassPanes=panes

-- Snap the real alpha to clean pixel silhouettes before downsampling. The raw
-- generation's nearly transparent colored pixels must never become a halo.
local function clean(im)
 local w,h=im.width,im.height
 for p in im:pixels()do local c=p();local a=pc.rgbaA(c);if a<200 then p(0)else p(rgba(pc.rgbaR(c),pc.rgbaG(c),pc.rgbaB(c),255))end end
 local seen={};local largest={}
 for y=0,h-1 do for x=0,w-1 do local index=y*w+x
  if not seen[index] and pc.rgbaA(im:getPixel(x,y))>0 then
   local q={index};seen[index]=true;local cursor=1
   while cursor<=#q do local k=q[cursor];cursor=cursor+1;local px,py=k%w,math.floor(k/w)
    for _,v in ipairs({{px-1,py},{px+1,py},{px,py-1},{px,py+1}})do local xx,yy=v[1],v[2];local key=yy*w+xx
     if xx>=0 and yy>=0 and xx<w and yy<h and not seen[key] and pc.rgbaA(im:getPixel(xx,yy))>0 then seen[key]=true;q[#q+1]=key end
    end
   end
   if #q>#largest then largest=q end
  end
 end end
 local keep={};for _,k in ipairs(largest)do keep[k]=true end
 for y=0,h-1 do for x=0,w-1 do if not keep[y*w+x]then im:drawPixel(x,y,0)end end end
 return im
end
-- Cream glints in this wicker source become chalky gray under the veranda's
-- cool night tint. Keep the weave's warm material while softening only its
-- palest highlights; the silhouette and dark doorway must stay untouched.
local function softenWickerGlints(im)
 local changed=0
 local function smooth(v)local t=math.max(0,math.min(1,v));return t*t*(3-2*t)end
 for p in im:pixels()do
  local c=p();local r,g,b,a=pc.rgbaR(c),pc.rgbaG(c),pc.rgbaB(c),pc.rgbaA(c)
  if a>0 and r>g then
   local strength=smooth((g-180)/50)*smooth((b-125)/60)
   if strength>0 then
    local corrected=rgba(r-20*strength,g-40*strength,b-65*strength,a)
    if corrected~=c then p(corrected);changed=changed+1 end
   end
  end
 end
 return changed
end
local crops={['trestle-table']=315,['stump-stool']=218,['blanket-chest']=116,['bookcase']=160,['wall-shelf']=258,['birch-scratcher']=148,['wicker-hide']=197}
local supports={['fern-sofa']={source=421,height=1.05},['reading-chair']={source=845,height=1.25},['quilt-bed']={source=299,height=1}}
local library=Sprite(1200,920,ColorMode.RGB)
local contactLight=Image(1900,720,ColorMode.RGB)
local contactDark=Image(1900,720,ColorMode.RGB)
rect(contactLight,0,0,1900,720,rgba(242,236,215))
rect(contactDark,0,0,1900,720,rgba(20,35,40))
local preview=day:clone()
preview:drawImage(flameAnimation.first,Point(manifest.art.fireplace.x,manifest.art.fireplace.y))
local sprites={}
for index,d in ipairs(manifest.catalog)do
 local id=d.id:gsub('^cabin%-v2%-','')
 local im=Image{fromFile=dir..id..'-generated.png'}
 local rawW,rawH=im.width,im.height
 clean(im)
 local bounds=im:shrinkBounds()
 if crops[id]then local oldBottom=bounds.y+bounds.height;bounds.y=math.max(bounds.y,crops[id]);bounds.height=oldBottom-bounds.y end
 local cut=Image(im,bounds)
 local outW,outH=d.width*78,d.height*78
 local resized
 if supports[id]then
  local s=supports[id];local supportY=math.max(0,s.source-bounds.y);local targetY=outH-s.height*78
  resized=Image(outW,outH,ColorMode.RGB)
  local topTarget=0
  if id=='quilt-bed'then topTarget=math.max(0,targetY-math.floor(supportY* outW/cut.width))end
  for y=topTarget,outH-1 do for x=0,outW-1 do
   local sy=y<=targetY and (y-topTarget)/math.max(1,targetY-topTarget)*supportY or supportY+(y-targetY)/(outH-targetY)*(cut.height-supportY)
   resized:drawPixel(x,y,cut:getPixel(math.min(cut.width-1,math.floor(x/outW*cut.width)),math.min(cut.height-1,math.floor(sy))))
  end end
 else
  resized=cut:clone();resized:resize{width=outW,height=outH,method='bilinear'}
 end
 -- Keep explicit edge alpha; authored diffuse materials remain neutral enough
 -- for the application to tint continuously from daylight into lanternlight.
 for p in resized:pixels()do local c=p();local a=pc.rgbaA(c);if a<120 then p(0)elseif a>0 then
   local r,g,b=pc.rgbaR(c),pc.rgbaG(c),pc.rgbaB(c);local lum=.2126*r+.7152*g+.0722*b
   p(rgba(lum+(r-lum)*.86,lum+(g-lum)*.86,lum+(b-lum)*.86,255))
 end end
 local softenedHighlights=id=='wicker-hide' and softenWickerGlints(resized) or 0
 resized:saveAs(root..'/public/assets/houses/furniture/'..d.id..'.png')
 resized:saveAs(dir..id..'-clean.png')
 local p=Point(((index-1)%5)*240,math.floor((index-1)/5)*440+390-outH)
 layer(library,d.name..' | independent alpha, feet and supports',resized,p)
 sprites[d.id]=resized
 local transparent,opaque,partial=0,0,0
 for p in resized:pixels()do local a=pc.rgbaA(p());if a==0 then transparent=transparent+1 elseif a==255 then opaque=opaque+1 else partial=partial+1 end end
 assert(partial==0,'Partial alpha '..d.id)
 assert(transparent>50,'Missing transparency '..d.id)
 local cp=Point(((index-1)%5)*380+math.floor((380-outW)/2),math.floor((index-1)/5)*360+330-outH)
 contactLight:drawImage(resized,cp);contactDark:drawImage(resized,cp)
 local supportReport={}
 for _,s in ipairs(d.surfaces)do local actions={};for _,a in ipairs(s.actions)do actions[#actions+1]=a end;supportReport[#supportReport+1]={x=s.x,y=s.y,width=s.width,actions=actions}end
 report.furniture[#report.furniture+1]={id=d.id,raw={width=rawW,height=rawH},crop={x=bounds.x,y=bounds.y,width=bounds.width,height=bounds.height},runtime={width=outW,height=outH},support=supportReport,sourceSupport=supports[id],softenedHighlights=softenedHighlights,alpha={transparent=transparent,opaque=opaque,partial=partial,policy='Largest component only; no baked ground shadow.'}}
end
library:saveAs(root..'/art/house-themes/cabin-v2-furniture.aseprite')
contactLight:saveAs(dir..'furniture-light-validation.png')
contactDark:saveAs(dir..'furniture-dark-validation.png')
for _,placement in ipairs(manifest.theme.defaultFurniture)do
 local d;for _,q in ipairs(manifest.catalog)do if q.id==placement[1]then d=q end end
 local room;for _,q in ipairs(manifest.theme.rooms)do if q.id==placement[2]then room=q end end
 local im=sprites[placement[1]]:clone();im:resize{width=d.width*26,height=d.height*26,method='bilinear'}
 preview:drawImage(im,Point(math.floor(room.x+placement[3]*26),math.floor(room.floor-((placement[4]or 0)+d.height)*26)))
end
preview:drawImage(fixtures)
preview:saveAs(root..'/art/house-themes/cabin-v2-preview.png')
day:saveAs(dir..'empty-day-validation.png');night:saveAs(dir..'empty-night-validation.png')
report.furnitureCount=#manifest.catalog;report.defaultPlacements=#manifest.theme.defaultFurniture
saveJson('art/house-themes/cabin-v2-export-report.json',report)
print('Exported original Cabin V2 plates and '..#manifest.catalog..' independent sprites with native Aseprite.')
