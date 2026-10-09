-- Reproducible day/night plates and a separate sky silhouette for moving celestial objects.
-- The approved night backgrounds remain intact; this pipeline writes sibling variants.
local root=assert(app.params.root)
local pc=app.pixelColor
local function clamp(v,a,b) return math.max(a,math.min(b,v)) end
local function mix(a,b,t)
  return pc.rgba(math.floor(pc.rgbaR(a)*(1-t)+pc.rgbaR(b)*t),
    math.floor(pc.rgbaG(a)*(1-t)+pc.rgbaG(b)*t),
    math.floor(pc.rgbaB(a)*(1-t)+pc.rgbaB(b)*t),255)
end
local function layer(sprite,name,img)
  local l=sprite:newLayer(); l.name=name; sprite:newCel(l,1,img,Point(0,0)); return l
end
local function skyAlpha(c)
  local r,g,b=pc.rgbaR(c),pc.rgbaG(c),pc.rgbaB(c)
  return clamp((b-r-36)/25,0,1)*clamp((b-g-12)/16,0,1)*clamp((g-105)/45,0,1)
end
local function ramenRoof(x,y)
  return y>=48 and y<158 and x>=366-(y-48)*0.87 and x<=886+(y-48)*0.25
end
local function connectRamenExteriorSky(mask,day)
  -- The conservative roof polygon also encloses sky between ridge posts and
  -- beside the sloping tiles. Restore only blue pixels connected to the
  -- existing exterior mask; isolated blue reflections on the tiles stay excluded.
  -- Continue through the conservative wall and height exclusions too: the sky
  -- beneath the right eave remains visible between tree branches below y220.
  -- Seeding from every existing exterior edge preserves pockets split by wires.
  local candidates,queue={},{}
  for y=0,791 do for x=0,1407 do
    if pc.rgbaA(mask:getPixel(x,y))==0 then
      local alpha=math.floor(skyAlpha(day:getPixel(x,y))*255)
      if alpha>0 then candidates[y*1408+x]=alpha end
    end
  end end
  local function visit(key)
    local alpha=candidates[key]
    if not alpha then return end
    local x,y=key%1408,math.floor(key/1408)
    if pc.rgbaA(mask:getPixel(x,y))>0 then return end
    mask:drawPixel(x,y,pc.rgba(255,255,255,alpha))
    queue[#queue+1]=key
  end
  for key in pairs(candidates) do
    local x,y=key%1408,math.floor(key/1408)
    for _,step in ipairs({{1,0},{-1,0},{0,1},{0,-1}}) do
      local nx,ny=x+step[1],y+step[2]
      if nx>=0 and nx<1408 and ny>=0 and ny<792 and pc.rgbaA(mask:getPixel(nx,ny))>0 then
        visit(key)
        break
      end
    end
  end
  local head=1
  while head<=#queue do
    local key=queue[head]; head=head+1
    local x,y=key%1408,math.floor(key/1408)
    if x>0 then visit(key-1) end
    if x<1407 then visit(key+1) end
    if y>0 then visit(key-1408) end
    if y<791 then visit(key+1408) end
  end
  print('Restored '..#queue..' connected exterior sky pixels around the ramen roof and trees.')
end
local function alignCabinChimney(day)
  local source=day:clone()
  -- The generated daylight chimney drifts right of the approved night plate:
  -- shaft +6px, pipe +5px, and a slightly wider cap +3..5px. Remap the
  -- source scanlines locally so twilight blends show one stone silhouette.
  for y=122,258 do for x=938,1043 do
    local cap=3+clamp((x-952)/72,0,1)*2
    local shift=y<146 and 5 or y<150 and 5+(cap-5)*(y-146)/4
      or y<165 and cap or y<169 and cap+(6-cap)*(y-165)/4 or 6
    local border=clamp((x-938)/10,0,1)*clamp((1043-x)/12,0,1)*clamp((y-122)/7,0,1)
    -- Stop above the existing daytime roof; its tiles, floor geometry and
    -- all scenery outside this small sky patch keep their original pixels.
    local roof=210+(x-954)*0.52
    local alpha=border*clamp((roof-y)/2,0,1)
    if alpha>0 then
      local sx=x+shift
      local left=math.floor(sx)
      local sample=mix(source:getPixel(left,y),source:getPixel(left+1,y),sx-left)
      day:drawPixel(x,y,mix(source:getPixel(x,y),sample,alpha))
    end
  end end
end
for _,id in ipairs({'cabin','ramen'}) do
  local out=root..'/public/assets/houses/'..id..'/'
  local night=Image{fromFile=out..'background.png'}
  local day=Image{fromFile=root..'/art/house-themes/source/'..id..'-day-generated.png'}
  day:resize{width=1408,height=792,method='bilinear'}
  if id=='cabin' then
    alignCabinChimney(day)
    -- Remove the old baked crescent: a live moon will travel across the sky.
    -- Nearby empty sky at the same height supplies texture; feather into the original.
    local source=night:clone()
    for y=80,164 do for x=1100,1182 do
      local distance=math.sqrt(((x-1140)/38)^2+((y-122)/38)^2)
      if distance<1 then
        night:drawPixel(x,y,mix(source:getPixel(x,y),source:getPixel(x+72,y),clamp((1-distance)*7,0,1)))
      end
    end end
  end
  -- Generated daylight keeps the sky's blue separate from wood, stone and vegetation.
  -- The mask permits sun/moon rendering behind roofs, branches and overhead wires.
  local mask=Image(1408,792,ColorMode.RGB)
  for y=0,791 do for x=0,1407 do
    local alpha=skyAlpha(day:getPixel(x,y))
    if id=='cabin' then
      if y>350 or (y>80 and x>704-(y-80)*1.97 and x<704+(y-80)*1.97) then alpha=0 end
    else
      if y>220 or ramenRoof(x,y) or (x>267 and x<918 and y>=158) then alpha=0 end
    end
    mask:drawPixel(x,y,pc.rgba(255,255,255,math.floor(alpha*255)))
  end end
  if id=='ramen' then connectRamenExteriorSky(mask,day) end
  day:saveAs(out..'background-day.png')
  night:saveAs(out..'background-night.png')
  mask:saveAs(out..'sky-mask.png')
  local sprite=Sprite(1408,792,ColorMode.RGB); sprite:deleteLayer(sprite.layers[1])
  layer(sprite,'Night — warm lamps and cool scenery',night)
  local daylight=layer(sprite,'Day — unlit lamps and natural daylight',day); daylight.isVisible=false
  local sky=layer(sprite,'Sky silhouette — live sun and moon occlusion',mask); sky.isVisible=false
  sprite.data='Lighting variants share the existing 1408x792 frame. Runtime blends continuously; original sources stay untouched. Sky silhouette is exported separately for moving sun/moon occlusion.'
  sprite:saveAs(root..'/art/house-themes/'..id..'-lighting.aseprite'); sprite:close()
  print('Exported '..id..' day/night plates and sky silhouette.')
end
