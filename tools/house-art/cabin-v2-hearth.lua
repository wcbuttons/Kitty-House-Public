-- A recessed masonry fireplace below the existing roof chimney. Native
-- Aseprite construction uses the new cabin's own stone texture and palette.
-- The continuous flue sits in the back wall; floor beams cross in front of it.
return function(day)
 local pc=app.pixelColor
 local original=day:clone()
 local layer=Image(day.width,day.height,ColorMode.RGB)
 local function rgb(r,g,b)return pc.rgba(math.floor(math.max(0,math.min(255,r))),math.floor(math.max(0,math.min(255,g))),math.floor(math.max(0,math.min(255,b))),255)end
 local function mix(a,b,t)return rgb(pc.rgbaR(a)*(1-t)+pc.rgbaR(b)*t,pc.rgbaG(a)*(1-t)+pc.rgbaG(b)*t,pc.rgbaB(a)*(1-t)+pc.rgbaB(b)*t)end
 local function put(x,y,c)day:drawPixel(x,y,c);layer:drawPixel(x,y,c)end
 local function rect(x,y,w,h,c)for py=y,y+h-1 do for px=x,x+w-1 do put(px,py,c)end end end
 local function noise(x,y)local n=math.sin(x*127.1+y*311.7)*43758.5453;return n-math.floor(n)end

 -- Move the two existing iron lanterns clear of the relocated ladder. Feather
 -- wall material at the old mounting points; preserve the original lamp art.
 for _,cy in ipairs({330,545})do
  for y=cy-31,cy+29 do for x=296,336 do
   local d=math.min(x-296,336-x,y-(cy-31),cy+29-y)
   local w=math.min(1,d/7)
   put(x,y,mix(original:getPixel(x,y),original:getPixel(x+64,y),w))
  end end
  for y=cy-31,cy+29 do for x=296,336 do
   local d=math.min(x-296,336-x,y-(cy-31),cy+29-y)
   local w=math.min(1,d/7)
   put(x+68,y,mix(original:getPixel(x+68,y),original:getPixel(x,y),w))
  end end
 end

 local function stoneField(x,y,w,h,inside)
  local function write(px,py,c)
   if px>=x and px<x+w and py>=y and py<y+h and (not inside or inside(px,py))then put(px,py,c)end
  end
  for py=y,y+h-1 do for px=x,x+w-1 do write(px,py,rgb(57,54,43))end end
  local row,top=0,y
  while top<y+h do
   local height=11+math.floor(noise(row,y)*5)
   local left=x-(row%2)*12
   local index=0
   while left<x+w do
    local width=17+math.floor(noise(row+index*13,x)*12)
    local bias=(noise(left,top)-.5)*18
    for py=top+1,top+height-2 do for px=left+1,left+width-2 do
     local edge=math.min(px-left,left+width-1-px,py-top,top+height-1-py)
     if edge>1 or not ((px==left+1 or px==left+width-2) and (py==top+1 or py==top+height-2))then
      local tex=original:getPixel(243+(px-left+row*9)%43,119+(py-top+index*11+row*7)%54)
      local lum=.30*pc.rgbaR(tex)+.48*pc.rgbaG(tex)+.22*pc.rgbaB(tex)
      local shade=(py==top+1 and 19 or 0)+(px==left+1 and 9 or 0)-(py==top+height-2 and 17 or 0)-(px==left+width-2 and 12 or 0)
      local v=87+(lum-95)*.32+bias+shade+(noise(px,py)-.5)*5
      write(px,py,rgb(v+10,v+7,v-3))
     end
    end end
    left=left+width;index=index+1
   end
   top=top+height;row=row+1
  end
 end
 -- Loft and lower flue align directly below the roof chimney (x228–300).
 stoneField(241,266,56,148)
 stoneField(239,474,65,119,function(x,y)
  local spread=math.max(0,y-557)*.17
  return x>=243-spread and x<=296+spread
 end)
 -- Recessed arch, jambs and a flush stone threshold, ending at the floor.
 stoneField(236,599,78,78)
 rect(234,589,82,3,rgb(130,122,98))
 rect(234,592,82,5,rgb(96,87,65))
 rect(237,597,76,3,rgb(49,44,34))
 -- A wide flat lintel in the same rough-cut stone, shaded beneath its lip.
 for x=237,312 do put(x,590,rgb(137+noise(x,590)*12,126+noise(x,590)*10,104+noise(x,590)*8))end
 local function opening(x,y)
  local dx=x-274
  return x>=252 and x<=296 and y<=673 and (y>=630 or (y>=608 and dx*dx+(y-630)^2<=22*22))
 end
 for y=608,673 do for x=252,296 do if opening(x,y)then
  local v=18+noise(x,y)*4+math.max(0,(y-630))*.12
  local mortar=y%9==0 or (x+math.floor(y/9)%2*11)%23==0
  put(x,y,rgb(v+(mortar and 0 or 7),v-1,v-4))
 end end end
 -- Ash, split logs and the grate stay in both backgrounds; live flames are
 -- exported separately so they never disappear with the daylight crossfade.
 for y=665,672 do for x=253,295 do
  local grain=noise(x,y)
  put(x,y,rgb(34+grain*19,31+grain*16,26+grain*12))
 end end
 for x=256,291 do
  local y=664+math.floor((x-256)/13)
  for dy=0,3 do put(x,y+dy,rgb(49+noise(x,y)*16-dy*5,31+noise(x,y)*10-dy*3,18+noise(x,y)*8))end
 end
 rect(254,668,41,1,rgb(30,27,22))
 for x=256,293,9 do rect(x,660,1,11,rgb(34,31,25))end
 rect(234,674,82,3,rgb(123,115,93));rect(234,677,82,5,rgb(76,71,58))
 for x=235,314 do if x%19==3 then rect(x,674,1,7,rgb(55,52,43))end end

 local function illuminate(night)
  -- Only reflected firelight belongs in the night plate. Never bake a fixed
  -- flame silhouette below the loop: that would ghost behind moving tongues.
  for y=611,673 do for x=253,295 do if opening(x,y)then
   local c=night:getPixel(x,y)
   local heat=math.exp(-((x-274)/19)^2-((y-654)/25)^2)
   night:drawPixel(x,y,rgb(pc.rgbaR(c)+44*heat,pc.rgbaG(c)+13*heat,pc.rgbaB(c)+2*heat))
  end end end
 end
 local function animate(config)
  assert(config and config.x==252 and config.y==608 and config.width==45 and config.height==66,'Fire sprite must fit the authored opening')
  local sheet=Image(config.width*config.frameCount,config.height,ColorMode.RGB)
  local master=Sprite(config.width,config.height,ColorMode.RGB)
  master.layers[1].name='Flames and embers | transparent grate openings'
  local frames={}
  local painted=0
  for index=0,config.frameCount-1 do
   local frame=Image(config.width,config.height,ColorMode.RGB)
   local phase=index/config.frameCount*math.pi*2
   local function draw(x,y,c)
    local grate=y==668 and x>=254 and x<=294 or y>=660 and y<=670 and x>=256 and x<=293 and (x-256)%9==0
    if opening(x,y) and not grate then frame:drawPixel(x-config.x,y-config.y,c);painted=painted+1 end
   end
   -- A seamless 1.6s loop: each tongue has its own height, sway and phase,
   -- but all motions use integer harmonics of the same repeating cycle.
   for i,flame in ipairs({{263,639,5},{274,630,7},{286,638,5}})do
    local top=math.floor(flame[2]+math.sin(phase+i*1.8)*3+math.sin(phase*2-i)*1.5)
    for y=top,665 do
     local t=(y-top)/(665-top)
     local center=flame[1]+math.sin(t*5-phase+i*2.1)*(1-t)*3
     local half=flame[3]*math.sin(t*math.pi*.78)*(1+math.sin(phase+i)*.08)
     for x=math.floor(center-half),math.ceil(center+half)do
      local core=math.abs(x-center)/math.max(1,half)
      local c=core<.45 and t>.38 and rgb(255,217,108) or core<.78 and rgb(249,141,39) or rgb(194,73,20)
      draw(x,y,c)
     end
    end
   end
   for x=256,293 do for y=665,670 do
    local coal=noise(x,y)
    if coal>.53 then
     local pulse=.82+.18*math.sin(phase+coal*math.pi*2)
     draw(x,y,rgb((166+coal*75)*pulse,(46+noise(x+3,y)*67)*pulse,12))
    end
   end end
   -- No opaque pixels may escape the opening or fill the fixed iron grate.
   for y=0,config.height-1 do for x=0,config.width-1 do
    local alpha=pc.rgbaA(frame:getPixel(x,y))
    assert(alpha==0 or alpha==255,'A flame frame has halo pixels')
    if alpha>0 then assert(opening(x+config.x,y+config.y),'Fire escaped its firebox')end
   end end
   frames[#frames+1]=frame
   sheet:drawImage(frame,Point(index*config.width,0))
   if index>0 then master:newEmptyFrame()end
   master.frames[index+1].duration=1/config.frameRate
   master:newCel(master.layers[1],index+1,frame,Point(0,0))
  end
  local tag=master:newTag(1,config.frameCount);tag.name='Always burning'
  return {sheet=sheet,master=master,first=frames[1],
   report={frames=config.frameCount,frameRate=config.frameRate,seconds=config.frameCount/config.frameRate,
    bounds={config.x,config.y,config.width,config.height},paintedPixels=painted,
    alpha='Binary; clipped to firebox with fixed grate holes',lighting='Flames remain emissive; reflected light follows daylight'}}
 end
 return {layer=layer,illuminate=illuminate,animate=animate,x=274,y=645,
  report={kind='Recessed stone fireplace',bounds={234,474,82,208},flue={241,266,56,148},fire={274,645},floor=682}}
end
