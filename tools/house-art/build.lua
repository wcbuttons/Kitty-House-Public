-- Native Aseprite production pipeline: matte cleanup, sprite cutting, coordinate
-- alignment, independently editable room/furniture layers, slices and PNG export.
local root = assert(app.params.root, "Pass --script-param root=/path/to/project")
local pc = app.pixelColor
local function read(path)
  local file = assert(io.open(root .. '/' .. path, 'r'))
  local text = file:read('*a'); file:close(); return text
end
local manifest = json.decode(read('tools/house-art/manifest.json'))
local function saveJson(path, value)
  local file = assert(io.open(root .. '/' .. path, 'w'))
  file:write(json.encode(value)); file:close()
end
local function load(name) return Image{fromFile=root .. '/art/house-themes/source/' .. name .. '.png'} end
local function layer(sprite, name, image, position, parent)
  local item = sprite:newLayer(); item.name = name
  if parent then item.parent = parent end
  sprite:newCel(item, 1, image, position or Point(0,0))
  return item
end
local sources = { cabin=load('cabin-furniture'), ramen=load('ramen-furniture'),
  crateSide=load('crate-side'), boxSide=load('box-side') }
-- Reviewed image-space selections, rather than assuming the generated grid is exact.
local selections = {
  couch={28,105,300,183}, bed={358,163,310,125},
  box={290,126,1195,600,'boxSide'},
  crate={0,0,sources.crateSide.width,sources.crateSide.height,'crateSide'},
  shelf={37,427,292,91}, table={365,422,280,168}, bookcase={691,335,212,258}, scratcher={977,345,211,245},
  ['cat-tree']={42,581,255,307}, cushion={354,745,258,120}, cabinet={649,717,263,146}, tunnel={939,703,274,159},
  stairs={37,950,271,185}, books={374,971,205,161}, armchair={625,920,272,226}, hammock={941,948,296,145},
  ['ramen-counter']={25,206,600,247,'ramen'}, ['ramen-stool']={711,159,185,313,'ramen'},
  ['bowl-rack']={997,172,515,271,'ramen'}, futon={24,677,553,172,'ramen'},
  ['noodle-table']={633,621,387,230,'ramen'}, planter={1138,512,262,346,'ramen'},
}
local cleanup=dofile(root .. '/tools/house-art/cleanup.lua')
local interiorMatte=dofile(root .. '/tools/house-art/interior-matte.lua')
local cutouts, report = {}, {furniture={}, themes={},cleanupFamilies={}}
for name, bounds in pairs(selections) do
  local src = sources[bounds[5] or 'cabin']
  local image = Image(src, Rectangle(bounds[1],bounds[2],bounds[3],bounds[4]))
  local removed = 0
  for it in image:pixels() do
    local value = it(); local r,g,b = pc.rgbaR(value),pc.rgbaG(value),pc.rgbaB(value)
    -- Generated sheets contain a pale neutral checker matte. Remove that matte
    -- in Aseprite, including enclosed holes, while retaining warm cloth highlights.
    if pc.rgbaA(value)<=12 then
      it(0); removed=removed+1
    elseif math.min(r,g,b) >= 185 and math.max(r,g,b)-math.min(r,g,b) <= 20 then
      it(0); removed=removed+1
    end
  end
  local interiorRemoved=interiorMatte(image,name)
  local trimmed = image:shrinkBounds()
  assert(trimmed.width > 4 and trimmed.height > 4 and removed > 0, name .. ' has invalid matte/crop')
  local clean,stats=cleanup(Image(image,trimmed),name)
  local _,debris=cleanup(clean,name,false)
  stats.removedPixels=stats.removedPixels+debris.removedPixels
  stats.removedFragments=stats.removedFragments+debris.removedFragments
  stats.interiorMattePixels=interiorRemoved
  cutouts[name] = Image(clean,clean:shrinkBounds())
  report.cleanupFamilies[name]=stats
end
local library = Sprite(2496,2496,ColorMode.RGB)
library:deleteLayer(library.layers[1]); library.filename = 'Furniture library'
local sprites, definitions = {}, {}
-- Dedicated shapes replace stretched source-family variants. These clean RGBA
-- masters retain their generated texture; raw images and the reproducible
-- Aseprite matte-removal script live alongside them in source/v0942.
local refinedSources = {
  ['crate']='crate-small-clean',
  ['large-crate']='crate-tall-clean',
  ['toy-chest']='crate-toy-chest-clean',
  ['noodle-table']='noodle-table-clean',
}
report.refinedSources=refinedSources
for index,definition in ipairs(manifest.catalog) do
  local key = selections[definition.id] and definition.id or definition.art
  local replacement=refinedSources[definition.id]
  local image = replacement and load('v0942/'..replacement)
    or assert(cutouts[key], 'Missing art family ' .. tostring(key)):clone()
  image:resize{width=definition.width*26*3,height=definition.height*26*3,method='bilinear'}
  if definition.id=='cat-tree' then
    -- The generated drawing's intermediate cushions were too high for the
    -- existing 1/3/5-cell landings. Retain its material and silhouette while
    -- aligning those cushion tops exactly with the playable support heights.
    local aligned=Image(image.width,image.height,ColorMode.RGB)
    local target={0,156,312,362,389}; local source={0,120,240,340,389}
    for y=0,image.height-1 do
      local sy=source[#source]
      for i=1,#target-1 do
        if y<=target[i+1] then
          sy=source[i]+(y-target[i])/(target[i+1]-target[i])*(source[i+1]-source[i]); break
        end
      end
      for x=0,image.width-1 do aligned:drawPixel(x,y,image:getPixel(x,math.floor(sy))) end
    end
    image=aligned
  end
  local filename = root .. '/public/assets/houses/furniture/' .. definition.id .. '.png'
  image:saveAs(filename)
  sprites[definition.id] = image; definitions[definition.id] = definition
  local x = ((index-1)%6)*416 + math.floor((416-image.width)/2)
  local y = math.floor((index-1)/6)*416 + 400-image.height
  layer(library, definition.name .. ' [' .. definition.id .. ']', image, Point(x,y))
  local slice = library:newSlice(Rectangle(x,y,image.width,image.height)); slice.name=definition.id
  slice.data=json.encode({widthCells=definition.width,heightCells=definition.height,anchor=definition.anchor})
  local clear,opaque=0,0
  for it in image:pixels() do if pc.rgbaA(it())==0 then clear=clear+1 else opaque=opaque+1 end end
  assert(opaque>20, definition.id .. ' empty sprite')
  report.furniture[#report.furniture+1]={id=definition.id,width=image.width,height=image.height,transparentPixels=clear,paintedPixels=opaque}
end
library.data='Separate RGBA furniture layers; slices and exported sprites use the catalog IDs. Furniture bodies are sized at 3 pixels per world pixel.'
library:saveAs(root .. '/art/house-themes/furniture-library.aseprite')
library:saveCopyAs(root .. '/art/house-themes/furniture-library.png'); library:close()

local function remap(value, target, source)
  for index=1,#target-1 do
    if value <= target[index+1] then
      return source[index] + (value-target[index])/(target[index+1]-target[index])*(source[index+1]-source[index])
    end
  end
  return source[#source]
end
local function mappedPlate(theme)
  local src=load(theme.id .. '-shell'); local result=Image(1120,790,ColorMode.RGB)
  for y=0,789 do
    local sy
    if theme.id=='cabin' then
      sy=remap(y,{0,93,313,329,511,527,709,725,790},{0,55,377,408,654,691,929,955,1024})
    else
      sy=remap(y,{0,22,341,379,691,714,790},{0,0,440,493,915,947,1024})
    end
    sy=math.max(0,math.min(src.height-1,math.floor(sy)))
    for x=0,1119 do
      local sx
      if theme.id=='cabin' then
        sx=remap(x,{0,130,546,562,978,1120},{0,200,747,780,1323,1536})
      else sx=x*1536/1120 end
      sx=math.max(0,math.min(src.width-1,math.floor(sx)))
      result:drawPixel(x,y,src:getPixel(sx,sy))
    end
  end
  return result
end
local function inside(room,x,y)
  local gx=(x-room.x)/26; local gy=(room.floor-y)/26
  return gx>=0 and gx<=room.width and gy>=0 and gy<=room.height and
    (not room.attic or (gx>=gy*2 and gx<=room.width-gy*2))
end
local function entrancePoint(theme,entrance)
  for _,room in ipairs(theme.rooms) do
    if room.id==entrance.roomId then return {x=room.x+entrance.x*26,y=room.floor} end
  end
end
local function doorSection(theme,passage)
  local a,b=entrancePoint(theme,passage.a),entrancePoint(theme,passage.b)
  -- A side elevation sees the thickness of the partition, not the door's face.
  local cx=(a.x+b.x)/2
  return {cx=cx,floor=a.y,left=theme.id=='cabin' and 546 or 651,
    width=theme.id=='cabin' and 16 or 41,height=52}
end
local function mix(a,b,t)
  return pc.rgba(math.floor(pc.rgbaR(a)*(1-t)+pc.rgbaR(b)*t),
    math.floor(pc.rgbaG(a)*(1-t)+pc.rgbaG(b)*t),
    math.floor(pc.rgbaB(a)*(1-t)+pc.rgbaB(b)*t),255)
end
local function openingPlate(theme,source)
  local plate=source:clone()
  for _,passage in ipairs(theme.passages) do
    if passage.kind=='stairs' then
      local a,b=entrancePoint(theme,passage.a),entrancePoint(theme,passage.b)
      local lower=a.y>b.y and a or b; local upper=a.y>b.y and b or a
      -- Refit the architectural flight to the upstairs walking floor. The
      -- source flight stopped at the underside of a 38px cutaway beam; moving
      -- its upper end preserves full wooden treads through an actual opening.
      -- This replaces the former miniature ladder drawn over that beam.
      local originalTop=upper.y+38
      for y=upper.y,lower.y do
        local t=(lower.y-y)/(lower.y-upper.y)
        local fullShift=lower.y-t*(lower.y-originalTop)-y
        local left=math.min(246,lower.x-34+(upper.x-20-(lower.x-34))*t)
        -- Include the entire railing up to the right-hand timber post. A narrow
        -- polygon cut through its balusters and pasted two different heights
        -- together. Deform source coordinates smoothly through the adjacent
        -- plaster/post instead; each output pixel has exactly one source.
        for x=math.floor(left-28),326 do
          local blend=math.max(0,math.min(1,(x-(left-28))/28))
          blend=blend*blend*(3-2*blend)
          local edge=math.max(0,math.min(1,(326-x)/11))
          edge=edge*edge*(3-2*edge)
          local sy=math.floor(y+fullShift*blend*edge)
          plate:drawPixel(x,y,source:getPixel(x,sy))
        end
      end
      -- Keep the cutaway floor beam straight. Only the rectangular stairwell
      -- opening interrupts it; the soft plaster deformation must not bend
      -- that architectural edge into a diagonal or curve.
      for y=upper.y,originalTop-1 do
        for x=180,326 do
          if x<math.floor(upper.x-20) or x>math.ceil(upper.x+19) then
            plate:drawPixel(x,y,source:getPixel(x,y))
          end
        end
      end
    end
  end
  for _,passage in ipairs(theme.passages) do
    if passage.kind=='door' then
      local door=doorSection(theme,passage)
      local left,right=math.floor(door.cx-32),math.ceil(door.cx+32)
      -- Restore rear-wall texture over the old painted arch/post. The opening
      -- now continues horizontally between rooms beneath a cut partition.
      for y=door.floor-64,door.floor+8 do for x=left,right do
        local blend=math.max(0,math.min(1,(x-door.left)/door.width))
        local replacement=mix(source:getPixel(x-76,y),source:getPixel(x+76,y),blend)
        local feather=math.min(1,(x-left+1)/4,(right-x+1)/4,(y-(door.floor-64)+1)/4)
        plate:drawPixel(x,y,mix(source:getPixel(x,y),replacement,feather))
      end end
    end
  end
  return plate
end
local function fixturesFor(theme,source)
  local image=Image(1120,790,ColorMode.RGB)
  local function color(x,y,shade)
    local grain=((x*13+y*7)%17)-8
    return pc.rgba(math.min(255,math.floor((139+grain)*shade)),math.min(255,math.floor((88+grain*0.7)*shade)),math.min(255,math.floor((42+grain*0.4)*shade)),255)
  end
  local function rect(x,y,w,h,paint)
    for py=math.floor(y),math.ceil(y+h)-1 do for px=math.floor(x),math.ceil(x+w)-1 do
      if px>=0 and py>=0 and px<1120 and py<790 then image:drawPixel(px,py,type(paint)=='function' and paint(px,py) or paint) end
    end end
  end
  local function stroke(ax,ay,bx,by,width)
    local length=(bx-ax)^2+(by-ay)^2
    for y=math.floor(math.min(ay,by)-width),math.ceil(math.max(ay,by)+width) do
      for x=math.floor(math.min(ax,bx)-width),math.ceil(math.max(ax,bx)+width) do
        local t=math.max(0,math.min(1,((x-ax)*(bx-ax)+(y-ay)*(by-ay))/length))
        local distance=math.sqrt((x-ax-(bx-ax)*t)^2+(y-ay-(by-ay)*t)^2)
        if distance<=width/2 and x>=0 and y>=0 and x<1120 and y<790 then
          image:drawPixel(x,y,color(x,y,distance>width/2-1 and 0.58 or 1.18))
        end
      end
    end
  end
  for _,passage in ipairs(theme.passages) do
    local a,b=entrancePoint(theme,passage.a),entrancePoint(theme,passage.b)
    if passage.kind=='door' then
      local door=doorSection(theme,passage)
      local top=door.floor-door.height
      rect(door.left,door.floor-64,door.width,64-door.height,function(x,y)
        return source:getPixel(x,y-28)
      end)
      -- Only the cut end of the partition is visible: a shallow timber lintel
      -- and underside shadow. No arch, front-facing jambs or black door panel.
      rect(door.left-2,top-5,door.width+4,5,function(x,y) return color(x,y,0.9) end)
      rect(door.left,top,door.width,3,pc.rgba(33,27,22,150))
      rect(door.left-1,top-5,door.width+2,1,function(x,y) return color(x,y,1.25) end)
    elseif passage.kind=='ladder' then
      local lower=a.y>b.y and a or b; local upper=a.y>b.y and b or a
      local gap=16
      rect(upper.x-17,upper.y,34,gap,pc.rgba(30,23,17,255))
      rect(upper.x-21,upper.y,5,gap,function(x,y) return color(x,y,1.1) end)
      rect(upper.x+16,upper.y,5,gap,function(x,y) return color(x,y,0.8) end)
      stroke(lower.x-11,lower.y,upper.x-11,upper.y-6,6)
      stroke(lower.x+11,lower.y,upper.x+11,upper.y-6,6)
      local count=math.floor((lower.y-upper.y)/15)
      for step=1,count-1 do
        local t=step/count; local x=lower.x+(upper.x-lower.x)*t; local y=lower.y+(upper.y-lower.y)*t
        stroke(x-11,y,x+11,y,4)
      end
    end
  end
  return image
end
for _,theme in ipairs(manifest.themes) do
  local offset=Point(144,1)
  local sprite=Sprite(1408,792,ColorMode.RGB); sprite:deleteLayer(sprite.layers[1])
  local sourcePlate=mappedPlate(theme)
  local plate=openingPlate(theme,sourcePlate); local shell=plate:clone()
  local architecture=sprite:newGroup(); architecture.name='Architecture — rooms and exterior'
  local scenery=load(theme.id .. '-widescreen')
  scenery:resize{width=1408,height=792,method='bilinear'}
  -- Feather the outer scenery into the extension. The ramen neighbor's upper
  -- facade uses a separate seam below to keep its complete window coherent.
  for y=0,789 do for x=0,1119 do
    local original=math.min(1,(x+1)/48,(1120-x)/48)
    if theme.id=='ramen' then
      -- The outpaint and core have different window-mullion positions. Move
      -- this seam left onto the plain wall so the whole neighboring upper
      -- facade comes from one plate, never two translucent window drawings.
      local top=math.max(0,math.min(1,(y-88)/22))
      local bottom=math.max(0,math.min(1,(370-y)/30))
      local facade=math.max(0,math.min(1,(x-1020)/5))*top*bottom
      original=original*(1-facade)
    end
    if original<1 then
      local value=mix(scenery:getPixel(x+144,y+1),plate:getPixel(x,y),original)
      plate:drawPixel(x,y,value); shell:drawPixel(x,y,value)
    end
  end end
  -- Use generated scenery only outside the existing world. Keeping this hole
  -- transparent also preserves independent room-wall layers in the native file.
  for y=1,790 do for x=144,1263 do scenery:drawPixel(x,y,0) end end
  layer(sprite,'Widescreen scenery — forest or neighboring street',scenery,nil,architecture)
  local roomImages={}
  for _,room in ipairs(theme.rooms) do roomImages[room.id]=Image(1120,790,ColorMode.RGB) end
  for y=0,789 do for x=0,1119 do
    for _,room in ipairs(theme.rooms) do
      if inside(room,x,y) then
        roomImages[room.id]:drawPixel(x,y,plate:getPixel(x,y)); shell:drawPixel(x,y,0); break
      end
    end
  end end
  layer(sprite,'Exterior, roof, beams and floor edges',shell,offset,architecture)
  for _,room in ipairs(theme.rooms) do
    layer(sprite,room.name .. ' — wall and fixed details',roomImages[room.id],offset,architecture)
    local slice=sprite:newSlice(Rectangle(room.x+144,math.floor(room.floor-room.height*26)+1,math.floor(room.width*26),math.ceil(room.height*26)))
    slice.name='room-' .. room.id; slice.data=json.encode(room)
  end
  local guides=sprite:newLayer(); guides.name='Movement guide — toggle for floor coordinates'
  local guideImage=Image(1120,790,ColorMode.RGB)
  for _,room in ipairs(theme.rooms) do
    for x=math.floor(room.x),math.floor(room.x+room.width*26) do guideImage:drawPixel(x,room.floor,pc.rgba(255,206,100,200)) end
  end
  sprite:newCel(guides,1,guideImage,offset); guides.isVisible=false
  sprite:saveCopyAs(root .. '/public/assets/houses/' .. theme.id .. '/background.png')
  local exported=Image{fromFile=root .. '/public/assets/houses/' .. theme.id .. '/background.png'}
  for y=0,789 do for x=0,1119 do
    assert(exported:getPixel(x+144,y+1)==plate:getPixel(x,y),'Widescreen changed the existing house plate')
  end end
  local fixtures=fixturesFor(theme,sourcePlate)
  fixtures:saveAs(root .. '/public/assets/houses/' .. theme.id .. '/fixtures.png')
  layer(sprite,'Passages — partition cut ends, rails and landing openings',fixtures,offset)
  local furniture=sprite:newGroup(); furniture.name='Movable furniture — each instance is separate'
  for index,item in ipairs(theme.defaultFurniture) do
    local def=assert(definitions[item[1]]); local room
    for _,r in ipairs(theme.rooms) do if r.id==item[2] then room=r; break end end
    local image=sprites[item[1]]:clone(); image:resize{width=def.width*26,height=def.height*26,method='bilinear'}
    local position=Point(math.floor(room.x+item[3]*26)+144,math.floor(room.floor-((item[4] or 0)+def.height)*26)+1)
    layer(sprite,string.format('%02d %s — %s',index,def.name,room.id),image,position,furniture)
  end
  sprite.data=json.encode({theme=theme.id,worldWidth=1120,worldHeight=790,canvasWidth=1408,canvasHeight=792,worldOffsetX=144,worldOffsetY=1,cell=26,defaultCats=theme.defaultCatCount,notes='The original world remains at offset144,1 in the16:9canvas. Architecture and each furniture instance are separate editable layers. Live cats and passage indicators are rendered by the game.'})
  sprite:saveAs(root .. '/art/house-themes/' .. theme.id .. '.aseprite')
  sprite:saveCopyAs(root .. '/art/house-themes/' .. theme.id .. '-preview.png')
  report.themes[#report.themes+1]={id=theme.id,rooms=#theme.rooms,furniture=#theme.defaultFurniture,defaultCats=theme.defaultCatCount,layers=#sprite.layers,backgroundWidth=1408,backgroundHeight=792,worldOffsetX=144,worldOffsetY=1,originalHousePreserved=true,sceneryBlendWidth=48}
  sprite:close()
end
saveJson('art/house-themes/export-report.json',report)
print('Aseprite exported ' .. #report.furniture .. ' RGBA sprites and two layered worlds.')
