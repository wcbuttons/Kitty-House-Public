-- Moonwhisker Tower: native Aseprite assembly, matte removal, geometric alignment
-- and separate editable day/night architecture, fixtures and furniture layers.
local root=assert(app.params.root,'Pass --script-param root=/path/to/project')
local pc=app.pixelColor
local function read(path)
  local file=assert(io.open(root..'/'..path,'r')); local value=file:read('*a'); file:close(); return value
end
local function exists(path)
  local file=io.open(root..'/'..path,'rb'); if file then file:close(); return true end; return false
end
local function saveJson(path,value)
  local file=assert(io.open(root..'/'..path,'w')); file:write(json.encode(value)); file:close()
end
local function load(name) return Image{fromFile=root..'/art/house-themes/source/'..name..'.png'} end
local manifest=json.decode(read('tools/house-art/tower-manifest.json'))
local theme=manifest.theme
local W,H=792,1408
local function layer(sprite,name,image,position,parent)
  local item=sprite:newLayer(); item.name=name; if parent then item.parent=parent end
  sprite:newCel(item,1,image,position or Point(0,0)); return item
end
local function remap(value,target,source)
  for i=1,#target-1 do
    if value<=target[i+1] then return source[i]+(value-target[i])/(target[i+1]-target[i])*(source[i+1]-source[i]) end
  end
  return source[#source]
end
local function mix(a,b,t)
  return pc.rgba(math.floor(pc.rgbaR(a)*(1-t)+pc.rgbaR(b)*t),math.floor(pc.rgbaG(a)*(1-t)+pc.rgbaG(b)*t),math.floor(pc.rgbaB(a)*(1-t)+pc.rgbaB(b)*t),255)
end
-- The roof/eaves end above the entire rectangular observatory. Timber beam
-- thickness has its own anchors, independently of each playable room height.
local xt={0,164,188,604,630,791}
local xs={0,218,306,636,724,940}
local yt={0,70,242,424,462,644,682,864,902,1084,1122,1304,1320,1407}
local ys={0,160,555,614,653,835,871,1070,1105,1306,1344,1532,1549,1671}
local lamps={{358,518},{362,706},{338,933},{343,1162},{342,1389}}
local report={world={width=W,height=H},mapping={worldX=xt,sourceX=xs,worldY=yt,sourceY=ys},lamps={},furniture={}}
for i=1,#lamps do report.lamps[#report.lamps+1]={x=270,y=289+(i-1)*220} end
local observatory=load('v0942/tower-observatory-material')
observatory:resize{width=515,height=350,method='bilinear'}

local function refineObservatory(result,night)
  -- One generated material underlay serves both plates. Accepted pixels stop
  -- inside the original timber outline; fixtures are composited afterward.
  -- This avoids importing generated geometry or an old dark wall matte.
  local changed=0
  for y=164,421 do for x=189,603 do
    local ceiling=240-(1-math.abs(x-396)/208)*76
    local alpha=math.max(0,math.min(1,(x-188)/5,(604-x)/5,(y-ceiling-5)/6,(422-y)/5))
    if alpha>0 then
      local material=observatory:getPixel(x-140,y-115)
      if night then
        local r,g,b=pc.rgbaR(material),pc.rgbaG(material),pc.rgbaB(material)
        local dark=pc.rgba(math.floor(r*0.17),math.floor(g*0.30),math.floor(b*0.60),255)
        local dx,dy=(x-270)/68,(y-302)/75
        -- Smooth restrained wall bounce; no separate generated night texture
        -- whose pattern could shift as the real-time lighting blend moves.
        material=mix(dark,pc.rgba(145,85,32,255),0.40*math.exp(-2*(dx*dx+dy*dy)))
      end
      result:drawPixel(x,y,mix(result:getPixel(x,y),material,alpha))
      changed=changed+1
    end
  end end
  report.observatoryRefinement={source='v0942/tower-observatory-material.png',
    crop={x=140,y=115,width=515,height=350},wallPixels=changed,
    sharedTextureForDayAndNight=true,originalGeometryAndFixturesPreserved=true}
end

local function windowCutout(source)
  return Image(source,Rectangle(410,427,140,140))
end
local function removeOldWindow(source)
  local clean=source:clone()
  for y=427,566 do for x=410,549 do
    local dx=(x-480)/70; local dy=(y-497)/70
    local distance=math.sqrt(dx*dx+dy*dy)
    if distance<1 then
      local sample=source:getPixel(562+(x-410)%35,569+(y-427)%35)
      clean:drawPixel(x,y,mix(source:getPixel(x,y),sample,math.min(1,(1-distance)*12)))
    end
  end end
  return clean
end
local function removeDayFlames(source)
  local clean=source:clone()
  for _,lamp in ipairs(lamps) do
    for y=lamp[2]-4,lamp[2]+3 do for x=lamp[1]-3,lamp[1]+3 do
      clean:drawPixel(x,y,source:getPixel(x+10,y))
    end end
  end
  return clean
end
local function removeOldLamps(source)
  local clean=source:clone()
  for index,lamp in ipairs(lamps) do
    for y=lamp[2]-13,lamp[2]+66 do for x=lamp[1]-23,lamp[1]+23 do
      -- Match each scanline's local wall colour, including the diffuse glow.
      -- Copying a remote dark wall patch leaves a conspicuous oval at night.
      local amount=(x-(lamp[1]-24))/48
      local baseline=mix(source:getPixel(lamp[1]-25,y),source:getPixel(lamp[1]+25,y),amount)
      local grain=source:getPixel(x+48,y)
      local average={0,0,0}; local count=0
      for gy=-3,3 do for gx=-3,3 do
        local value=source:getPixel(x+48+gx,y+gy)
        average[1]=average[1]+pc.rgbaR(value); average[2]=average[2]+pc.rgbaG(value); average[3]=average[3]+pc.rgbaB(value); count=count+1
      end end
      local function channel(base,value,mean) return math.max(0,math.min(255,math.floor(base+(value-mean/count)*0.8))) end
      local sample=pc.rgba(channel(pc.rgbaR(baseline),pc.rgbaR(grain),average[1]),channel(pc.rgbaG(baseline),pc.rgbaG(grain),average[2]),channel(pc.rgbaB(baseline),pc.rgbaB(grain),average[3]),255)
      local alpha=math.min(1,(24-math.abs(x-lamp[1]))/7,(y-(lamp[2]-14))/7,((lamp[2]+67)-y)/7)
      clean:drawPixel(x,y,mix(source:getPixel(x,y),sample,alpha))
    end end
  end
  return clean
end
local function entrancePoint(entrance)
  for _,room in ipairs(theme.rooms) do
    if room.id==entrance.roomId then return {x=room.x+entrance.x*26,y=room.floor} end
  end
end
local observatoryWindowMask
local function windowForeground(image)
  -- Trace only the connected cool wallpaper around the daylight window. The
  -- continuous brass rim encloses the sky, so its pane and metalwork remain
  -- untouched. Share this silhouette with the night plate to avoid drift.
  local outside,queue={},{}
  local function add(x,y)
    if x<0 or y<0 or x>=image.width or y>=image.height then return end
    local index=y*image.width+x+1; if outside[index] then return end
    local value=image:getPixel(x,y)
    local r,g,b=pc.rgbaR(value),pc.rgbaG(value),pc.rgbaB(value)
    if g<=r*1.12 or b<=r*1.10 then return end
    outside[index]=true; queue[#queue+1]={x,y}
  end
  for x=0,image.width-1 do add(x,0); add(x,image.height-1) end
  for y=0,image.height-1 do add(0,y); add(image.width-1,y) end
  local cursor=1
  while cursor<=#queue do
    local point=queue[cursor]; cursor=cursor+1
    add(point[1]-1,point[2]); add(point[1]+1,point[2]); add(point[1],point[2]-1); add(point[1],point[2]+1)
  end
  report.observatoryWindowMatte={removedPixels=#queue,sharedDayNightSilhouette=true}
  return outside
end
local function alignPlate(source,night)
  local window=windowCutout(source)
  local lampSource=night and source or removeDayFlames(source)
  local clean=removeOldWindow(removeOldLamps(source))
  local result=Image(W,H,ColorMode.RGB)
  for y=0,H-1 do for x=0,W-1 do
    local bodyX=remap(x,xt,xs)
    local roofX=x*940/791
    local body=math.max(0,math.min(1,(y-70)/(242-70)))
    local sx=roofX*(1-body)+bodyX*body
    result:drawPixel(x,y,clean:getPixel(math.floor(sx),math.floor(remap(y,yt,ys))))
  end end
  -- Keep the astrolabe delicate while giving the wizard's hat most of the
  -- roof height. Its isolated cutout preserves the original circle's aspect.
  for y=0,74 do for x=357,455 do
    local sky=mix(result:getPixel(349,y),result:getPixel(463,y),(x-357)/98)
    local alpha=math.min(1,(x-356)/4,(456-x)/4,(75-y)/4)
    result:drawPixel(x,y,mix(result:getPixel(x,y),sky,alpha))
  end end
  local finial=Image(99,154,ColorMode.RGB)
  for y=0,153 do for x=0,98 do
    local value=source:getPixel(436+x,8+y)
    local r,g,b=pc.rgbaR(value),pc.rgbaG(value),pc.rgbaB(value)
    if r>g*1.03 and g>b*1.05 then finial:drawPixel(x,y,value) end
  end end
  finial:resize{width=50,height=78,method='bilinear'}
  result:drawImage(finial,Point(385,0))
  -- The generated attic supplies only a shallow strip of rectangular wallpaper.
  -- Mirror its uninterrupted damask texture at a natural scale to create the
  -- taller observatory without stretched brush marks or a squeezed old window.
  local function mirror(value,size)
    local position=value%(size*2); return math.floor(position>size and size*2-position or position)
  end
  for y=164,423 do for x=188,604 do
    local ceiling=240-(1-math.abs(x-396)/208)*76
    if y>ceiling then
      local first=source:getPixel(550+mirror((x-188)/1.5,43),566+mirror((y-164)/1.5,40))
      local second=source:getPixel(550+mirror((x-188)/1.2+21,43),566+mirror((y-164)/1.8+17,40))
      local sample=mix(first,second,0.5)
      local alpha=math.min(1,(x-187)/5,(605-x)/5,(y-ceiling)/5,(424-y)/4)
      result:drawPixel(x,y,mix(result:getPixel(x,y),sample,alpha))
    end
  end end
  refineObservatory(result,night)
  -- The round window remains a separate architectural detail, centered in the
  -- now-taller observatory wall instead of being squeezed into the roof.
  window:resize{width=96,height=96,method='bilinear'}
  if not night then observatoryWindowMask=windowForeground(window) end
  local left,top=348,270
  for y=0,95 do for x=0,95 do
    local dx=(x-48)/48; local dy=(y-48)/48; local distance=math.sqrt(dx*dx+dy*dy)
    if distance<1 and not observatoryWindowMask[y*96+x+1] then
      local alpha=math.min(1,(1-distance)*14)
      result:drawPixel(left+x,top+y,mix(result:getPixel(left+x,top+y),window:getPixel(x,y),alpha))
    end
  end end
  for index,lamp in ipairs(lamps) do
    local image=Image(lampSource,Rectangle(lamp[1]-22,lamp[2]-7,44,72))
    image:resize{width=35,height=58,method='bilinear'}
    local target=report.lamps[index]
    local left,top=math.floor(target.x-17),math.floor(target.y-6)
    for y=0,57 do for x=0,34 do
      -- A feathered rectangle still leaves straight glow edges on dark blue
      -- wallpaper. Keep a narrow fixture-shaped core and an elliptical halo.
      local dx=(x-17)/18; local dy=(y-27)/31
      local halo=math.max(0,1-dx*dx-dy*dy)^2
      local halfWidth=y<18 and 3.2 or y<25 and 8 or y<41 and 8.5 or y<50 and 3.5 or 2
      local core=math.max(0,math.min(1,halfWidth+1.5-math.abs(x-17)))
      core=core*math.min(1,(y+1)/5,(58-y)/5)
      local pixel=image:getPixel(x,y)
      local gold=math.max(0,math.min(1,(pc.rgbaR(pixel)-pc.rgbaB(pixel)*1.8-15)/50))
      local candle=y<22 and math.max(0,math.min(1,(math.min(pc.rgbaR(pixel),pc.rgbaG(pixel),pc.rgbaB(pixel))-140)/60)) or 0
      -- The observatory has a new continuous material surface and its own
      -- diffuse bounce. A broad brass/neutral mask retains the dark fixture
      -- contour and unlit wax, while rejecting the old teal wall and halo.
      local foreground=math.max(0,math.min(1,(pc.rgbaR(pixel)-pc.rgbaB(pixel)*0.78)/5))
      local alpha=index==1 and core*math.max(foreground,candle) or math.max(halo,core*math.max(gold,candle))
      result:drawPixel(left+x,top+y,mix(result:getPixel(left+x,top+y),image:getPixel(x,y),alpha))
    end end
  end
  for _,passage in ipairs(theme.passages) do
    local a,b=entrancePoint(passage.a),entrancePoint(passage.b)
    local upper=a.y<b.y and a or b
    for y=upper.y,upper.y+37 do for x=math.floor(upper.x-18),math.floor(upper.x+18) do
      result:drawPixel(x,y,night and pc.rgba(15,18,22,255) or pc.rgba(47,43,35,255))
    end end
  end
  return result
end
local daySource=load('tower-day-generated')
local nightSource=load('tower-night-generated')
local day,night=alignPlate(daySource,false),alignPlate(nightSource,true)
day:saveAs(root..'/public/assets/houses/tower/background-day.png')
night:saveAs(root..'/public/assets/houses/tower/background-night.png')
night:saveAs(root..'/public/assets/houses/tower/background.png')
local function skyMask(includeClouds)
  local sky=Image(W,H,ColorMode.RGB)
  local skyVisited,skyQueue={},{}
  local function addSky(x,y)
  if x<0 or y<0 or x>=W or y>=H then return end
  local index=y*W+x+1; if skyVisited[index] then return end
  skyVisited[index]=true
  local value=day:getPixel(x,y); local r,g,b=pc.rgbaR(value),pc.rgbaG(value),pc.rgbaB(value)
  -- The brown roof outline separates its blue tiles from connected exterior
  -- sky. Flooding follows that actual silhouette instead of a geometric box.
  local outside=(y<242 or x<164 or x>630)
  -- Clouds belong to the same continuous atmosphere as blue sky. Excluding
  -- their pale RGB values makes the twilight gradient cut around blue islands.
  local blue=b>g*0.98 and b>r*1.15 and b>115
  local cloud=math.min(r,g,b)>150 and b>=r*0.95 and b>=g*0.98
  if outside and (blue or (includeClouds and cloud)) then
    sky:drawPixel(x,y,pc.rgba(255,255,255,255)); skyQueue[#skyQueue+1]=index
  end
  end
  for x=0,W-1 do addSky(x,0) end
  for y=0,900 do addSky(0,y); addSky(W-1,y) end
  local skyCursor=1
  while skyCursor<=#skyQueue do
    local at=skyQueue[skyCursor]-1; local x=at%W; local y=math.floor(at/W)
    addSky(x-1,y); addSky(x+1,y); addSky(x,y-1); addSky(x,y+1); skyCursor=skyCursor+1
  end
  return sky
end
local sky,atmosphere=skyMask(false),skyMask(true)
-- The far hills are blue, just like sky. These native silhouette anchors trace
-- their visible ridge in the aligned day plate; colour thresholds alone cut
-- into their blue faces and turn the distant landscape into posterized islands.
local leftRidgeX={0,21,41,56,72,88,100,105,112,116,122,127,139,144,164}
local leftRidgeY={899,896.5,896.3,898.3,902.3,908.8,911.8,907.5,907,910.3,911.5,916.8,917.5,918,922}
local rightRidgeX={630,640,646.5,649,653,659.3,663,667,669,671,674.3,680,690,701.5,712.5,719.8,728,740.8,752,763,772.3,780.8,791}
local rightRidgeY={949,945,940.8,935.8,937,933.5,930,925.8,930.5,926,929.8,928.3,922.3,916,911.3,910.8,907,905.8,905.8,907.3,908,910,910.8}
for x=0,W-1 do
  if x<164 or x>630 then
    local top=x<164 and remap(x,leftRidgeX,leftRidgeY) or remap(x,rightRidgeX,rightRidgeY)
    for y=math.floor(top)-2,H-1 do
      local alpha=math.max(0,math.min(1,(top-y)/2))
      for _,mask in ipairs({sky,atmosphere}) do
        local old=mask:getPixel(x,y)
        local opacity=math.floor(pc.rgbaA(old)*alpha)
        mask:drawPixel(x,y,opacity>0 and pc.rgba(255,255,255,opacity) or 0)
      end
    end
  end
end
sky:saveAs(root..'/public/assets/houses/tower/sky-mask.png')
atmosphere:saveAs(root..'/public/assets/houses/tower/atmosphere-mask.png')
local blend=Image(W,H,ColorMode.RGB)
for y=0,H-1 do for x=0,W-1 do blend:drawPixel(x,y,mix(day:getPixel(x,y),night:getPixel(x,y),0.5)) end end
blend:saveAs(root..'/art/house-themes/tower-day-night-blend.png')

local fixtures=Image(W,H,ColorMode.RGB)
local function timber(x,y,shade)
  local value=daySource:getPixel(330+(x%31),619+(y%12))
  return pc.rgba(math.min(255,math.floor(pc.rgbaR(value)*shade)),math.min(255,math.floor(pc.rgbaG(value)*shade)),math.min(255,math.floor(pc.rgbaB(value)*shade)),255)
end
local function rect(image,x,y,w,h,paint)
  for py=math.floor(y),math.ceil(y+h)-1 do for px=math.floor(x),math.ceil(x+w)-1 do
    if px>=0 and px<W and py>=0 and py<H then image:drawPixel(px,py,type(paint)=='function' and paint(px,py) or paint) end
  end end
end
for _,passage in ipairs(theme.passages) do
  local a,b=entrancePoint(passage.a),entrancePoint(passage.b)
  local lower=a.y>b.y and a or b; local upper=a.y>b.y and b or a
  for _,side in ipairs({-1,1}) do
    rect(fixtures,upper.x+side*20-2,upper.y,4,38,function(x,y) return timber(x,y,0.76) end)
    rect(fixtures,upper.x+side*20-3,upper.y-1,6,3,function(x,y) return timber(x,y,1.05) end)
    rect(fixtures,lower.x+side*11-3,upper.y-4,6,lower.y-upper.y+4,function(x,y) return timber(x,y,0.78) end)
    rect(fixtures,lower.x+side*11-3,upper.y-4,1,lower.y-upper.y+4,function(x,y) return timber(x,y,1.02) end)
  end
  local count=math.floor((lower.y-upper.y)/15)
  for step=1,count-1 do
    local y=lower.y-step/count*(lower.y-upper.y)
    rect(fixtures,lower.x-11,y,22,4,function(x,y) return timber(x,y,0.72) end)
    rect(fixtures,lower.x-11,y-1,22,1,function(x,y) return timber(x,y,1.08) end)
  end
end
fixtures:saveAs(root..'/public/assets/houses/tower/fixtures.png')

local sprite=Sprite(W,H,ColorMode.RGB); sprite:deleteLayer(sprite.layers[1])
local function architecture(name,plate,visible)
  local group=sprite:newGroup(); group.name=name
  local exterior=plate:clone()
  for _,room in ipairs(theme.rooms) do
    local walls=Image(W,H,ColorMode.RGB)
    for y=room.floor-room.height*26,room.floor do for x=room.x,room.x+room.width*26 do
      walls:drawPixel(x,y,plate:getPixel(x,y)); exterior:drawPixel(x,y,0)
    end end
    layer(sprite,room.name..' — back wall and window',walls,nil,group)
  end
  layer(sprite,'Roof, stonework, beams and landscape',exterior,nil,group)
  group.isVisible=visible
  return group
end
architecture('Daylight architecture',day,false)
architecture('Night architecture',night,true)
layer(sprite,'Fixed ladders — alternating sides and open floor hatches',fixtures)
local lightingMasks=sprite:newGroup(); lightingMasks.name='Lighting masks — hidden authoring guides'
layer(sprite,'Celestial mask — cloud-aware sky',sky,nil,lightingMasks)
layer(sprite,'Atmosphere mask — continuous sky and clouds',atmosphere,nil,lightingMasks)
lightingMasks.isVisible=false
for _,room in ipairs(theme.rooms) do
  local slice=sprite:newSlice(Rectangle(room.x,room.floor-room.height*26,room.width*26,room.height*26))
  slice.name='room-'..room.id; slice.data=json.encode(room)
end

if app.params.backgroundOnly~='true' then
  local sheet=load('tower-furniture-generated')
  local books=load('tower-books-generated')
  local selections={
    ['tower-travel-chest']={20,156,365,195},
    ['tower-potion-desk']={397,126,385,220},
    ['tower-alchemy-cabinet']={810,73,241,275},
    ['tower-herb-shelf']={20,490,385,164},
    ['tower-arcane-bookcase']={429,389,328,390},
    ['tower-book-stack']={780,465,288,284},
    ['tower-reading-chair']={34,746,265,309},
    ['tower-moon-bed']={322,864,443,193},
    ['tower-star-cushion']={797,865,278,172},
    ['tower-crystal-plinth']={65,1088,175,303},
    ['tower-observatory-perch']={318,1274,452,132},
    ['tower-spiral-scratcher']={845,1080,166,310},
  }
  local cleanup=dofile(root..'/tools/house-art/cleanup.lua')
  local function matteCut(image)
    local seen,queue={},{}
    local function add(x,y)
      if x<0 or y<0 or x>=image.width or y>=image.height then return end
      local index=y*image.width+x+1; if seen[index] then return end
      local value=image:getPixel(x,y); local r,g,b=pc.rgbaR(value),pc.rgbaG(value),pc.rgbaB(value)
      if pc.rgbaA(value)>12 and (math.min(r,g,b)<215 or math.max(r,g,b)-math.min(r,g,b)>22) then return end
      seen[index]=true; queue[#queue+1]=index
    end
    for x=0,image.width-1 do add(x,0); add(x,image.height-1) end
    for y=0,image.height-1 do add(0,y); add(image.width-1,y) end
    local cursor=1
    while cursor<=#queue do
      local at=queue[cursor]-1; local x=at%image.width; local y=math.floor(at/image.width)
      image:drawPixel(x,y,0); add(x-1,y); add(x+1,y); add(x,y-1); add(x,y+1); cursor=cursor+1
    end
    return #queue
  end
  local library=Sprite(1152,1536,ColorMode.RGB); library:deleteLayer(library.layers[1])
  local function clearEnclosedMatte(image,id)
    -- Only these manufactured openings contain enclosed checker matte. Crystal
    -- facets and pale rope highlights must never use a blanket white removal.
    local regions=id=='tower-spiral-scratcher' and {
      {seed={40,100},bounds={30,84,49,117}},
    } or id=='tower-observatory-perch' and {
      {seed={29,26},bounds={25,23,61,42}},
      {seed={54,27},bounds={25,23,61,42}},
      {seed={50,35},bounds={25,23,61,42}},
      {seed={179,27},bounds={173,23,207,42}},
      {seed={184,35},bounds={173,23,207,42}},
      {seed={204,30},bounds={173,23,207,42}},
    } or {}
    local removed=0
    for _,region in ipairs(regions) do
      local seen,queue={},{}
      local function add(x,y)
        local bounds=region.bounds
        if x<bounds[1] or y<bounds[2] or x>bounds[3] or y>bounds[4] then return end
        local key=y*image.width+x; if seen[key] then return end; seen[key]=true
        local value=image:getPixel(x,y)
        local r,g,b=pc.rgbaR(value),pc.rgbaG(value),pc.rgbaB(value)
        if pc.rgbaA(value)>0 and math.min(r,g,b)>=170 and math.max(r,g,b)-math.min(r,g,b)<=45 then
          queue[#queue+1]={x,y}; image:drawPixel(x,y,0); removed=removed+1
        end
      end
      add(region.seed[1],region.seed[2])
      local cursor=1
      while cursor<=#queue do
        local point=queue[cursor]; add(point[1]-1,point[2]); add(point[1]+1,point[2]); add(point[1],point[2]-1); add(point[1],point[2]+1); cursor=cursor+1
      end
    end
    return removed
  end
  local images,definitions={},{}
  local supportGuides=Image(library.width,library.height,ColorMode.RGB)
  for index,definition in ipairs(manifest.catalog) do
    local box=assert(selections[definition.id]); local image=definition.id=='tower-book-stack' and books:clone() or Image(sheet,Rectangle(box[1],box[2],box[3],box[4]))
    if definition.id=='tower-potion-desk' then
      -- Keep the tabletop, not the bottle necks, at the physical landing height.
      for y=0,13 do for x=249,373 do image:drawPixel(x,y,image:getPixel(115+x%58,y)) end end
    end
    local removed=matteCut(image)
    local trimmed=image:shrinkBounds(); assert(trimmed.width>8 and trimmed.height>8,definition.id..' empty cutout')
    local clean,stats=cleanup(Image(image,trimmed),definition.id)
    image=Image(clean,clean:shrinkBounds())
    if definition.id=='tower-reading-chair' then
      -- The velvet seat is the one-cell-high logical surface; the tall back is
      -- decorative. Preserve the silhouette while aligning that actual seat.
      local adjusted=Image(image.width,image.height,ColorMode.RGB)
      for y=0,image.height-1 do for x=0,image.width-1 do
        local sy=remap(y,{0,image.height*2/3,image.height-1},{0,image.height*0.66,image.height-1})
        adjusted:drawPixel(x,y,image:getPixel(x,math.floor(sy)))
      end end
      image=adjusted
    end
    image:resize{width=definition.width*26*3,height=definition.height*26*3,method='bilinear'}
    if definition.id=='tower-moon-bed' then
      -- Raise the quilt's clear landing plane to the bedposts. The generated
      -- pillow and posts protruded above it, which otherwise leaves paws in air.
      local quilt=image:clone()
      for y=3,31 do for x=23,image.width-27 do
        local old=image:getPixel(x,y)
        if pc.rgbaA(old)<255 then
          local grain=((x*17+y*31+x*y*3)%11)-5
          local shine=math.floor((31-y)*0.13)
          local sample=pc.rgba(51+grain+shine,73+grain+shine,95+grain+shine,255)
          image:drawPixel(x,y,mix(sample,old,pc.rgbaA(old)/255))
        end
      end end
    end
    local enclosedRemoved=clearEnclosedMatte(image,definition.id)
    if enclosedRemoved>0 then
      -- Newly opened holes expose their antialiased matte rims. Recolour those
      -- edges from adjacent wood/rope now that transparency identifies them.
      local edgeStats
      image,edgeStats=cleanup(image,definition.id)
      stats.enclosedEdgeCleanup=edgeStats
    end
    image:saveAs(root..'/public/assets/houses/furniture/'..definition.id..'.png')
    images[definition.id]=image; definitions[definition.id]=definition
    local x=((index-1)%3)*384+math.floor((384-image.width)/2)
    local y=math.floor((index-1)/3)*384+366-image.height
    layer(library,definition.name..' ['..definition.id..']',image,Point(x,y))
    for _,surface in ipairs(definition.surfaces) do
      local top=y+image.height-surface.y*78
      for sx=math.floor(x+surface.x*78),math.ceil(x+(surface.x+surface.width)*78)-1 do supportGuides:drawPixel(sx,top,pc.rgba(82,255,233,255)) end
    end
    local slice=library:newSlice(Rectangle(x,y,image.width,image.height)); slice.name=definition.id; slice.data=json.encode(definition)
    report.furniture[#report.furniture+1]={id=definition.id,width=image.width,height=image.height,mattePixelsRemoved=removed,enclosedMatteRemoved=enclosedRemoved,cleanup=stats}
  end
  library:saveAs(root..'/art/house-themes/tower-furniture-library.aseprite')
  library:saveCopyAs(root..'/art/house-themes/tower-furniture-library.png')
  layer(library,'QA only — logical support surfaces',supportGuides)
  library:saveCopyAs(root..'/art/house-themes/tower-furniture-support-guides.png'); library:close()
  local furniture=sprite:newGroup(); furniture.name='Movable furniture — each default instance is separate'
  for index,item in ipairs(theme.defaultFurniture) do
    local definition=definitions[item[1]]; local room
    for _,candidate in ipairs(theme.rooms) do if candidate.id==item[2] then room=candidate; break end end
    local image=images[item[1]]:clone(); image:resize{width=definition.width*26,height=definition.height*26,method='bilinear'}
    layer(sprite,string.format('%02d %s — %s',index,definition.name,room.id),image,Point(room.x+item[3]*26,room.floor-((item[4] or 0)+definition.height)*26),furniture)
  end
end
sprite.data=json.encode({theme='tower',worldWidth=W,worldHeight=H,worldOffsetX=0,worldOffsetY=0,cell=26,defaultCats=8,notes='Day and night architecture are separate editable groups. The world and art share the same portrait coordinates.'})
sprite:saveAs(root..'/art/house-themes/tower.aseprite')
sprite:saveCopyAs(root..'/art/house-themes/tower-preview.png'); sprite:close()
saveJson('art/house-themes/tower-export-report.json',report)
print('Aseprite exported Moonwhisker Tower: aligned day/night plates, four ladders, '..#report.furniture..' furniture sprites and a layered master.')
