-- Aseprite native matte cleanup, reproducible without changing shared build.lua.
-- Optional input/output params make this usable for other isolated brown assets.
-- A flood from the outside removes neutral checker matte while retaining
-- enclosed neutral nail highlights and dark interior backgrounds.
local root=assert(app.params.root)
local dir=root..'/art/house-themes/source/v0942/'
local pc=app.pixelColor
local definitions={
  {id='crate',name='crate-small-corrected',out='crate-small-clean',w=156,h=78},
  {id='large-crate',name='crate-tall',out='crate-tall-clean',w=156,h=156},
  {id='toy-chest',name='crate-toy-chest-corrected',out='crate-toy-chest-clean',w=234,h=78},
}
if app.params.input then
  definitions={{id='custom',path=app.params.input,outPath=assert(app.params.output),w=tonumber(app.params.width),h=tonumber(app.params.height)}}
end
local report={tool='Aseprite',assets={}}
for _,d in ipairs(definitions) do
  local input=d.path or dir..d.name..'.png'
  local im=Image{fromFile=input}
  local w,h=im.width,im.height
  local opaque,clear,partial=0,0,0
  for it in im:pixels() do
    local a=pc.rgbaA(it())
    if a==255 then opaque=opaque+1 elseif a==0 then clear=clear+1 else partial=partial+1 end
  end
  local seen,queue={},{}
  local function add(x,y)
    if x<0 or y<0 or x>=w or y>=h then return end
    local key=y*w+x
    if seen[key] then return end
    seen[key]=true
    local c=im:getPixel(x,y)
    local r,g,b=pc.rgbaR(c),pc.rgbaG(c),pc.rgbaB(c)
    if pc.rgbaA(c)<=12 or (math.min(r,g,b)>=70 and math.max(r,g,b)-math.min(r,g,b)<=30) then
      queue[#queue+1]=key
    end
  end
  for x=0,w-1 do add(x,0);add(x,h-1) end
  for y=0,h-1 do add(0,y);add(w-1,y) end
  local head=1
  while head<=#queue do
    local key=queue[head];head=head+1
    local x,y=key%w,math.floor(key/w)
    im:drawPixel(x,y,0)
    add(x-1,y);add(x+1,y);add(x,y-1);add(x,y+1)
  end
  local bounds=im:shrinkBounds()
  assert(bounds.width>4 and bounds.height>4,'Empty sprite '..d.id)
  local cut=Image(im,bounds)
  -- Gentle neutralization of warm sources keeps the source compatible with
  -- changing daylight, while retaining all texture and dark wooden boundaries.
  local sat=tonumber(app.params.saturation) or 0.84
  for it in cut:pixels() do
    local c=it();local a=pc.rgbaA(c)
    if a>0 then
      local r,g,b=pc.rgbaR(c),pc.rgbaG(c),pc.rgbaB(c)
      local lum=.2126*r+.7152*g+.0722*b
      it(pc.rgba(math.floor(lum+(r-lum)*sat+.5),math.floor(lum+(g-lum)*sat+.5),math.floor(lum+(b-lum)*sat+.5),a))
    end
  end
  local output=d.outPath or dir..d.out..'.png'
  cut:saveAs(output)
  local runtime
  if d.w and d.h then
    local resized=cut:clone();resized:resize{width=d.w,height=d.h,method='bilinear'}
    runtime=d.outPath and (d.outPath:gsub('%.png$','-runtime.png')) or dir..d.out..'-runtime.png'
    resized:saveAs(runtime)
  end
  report.assets[#report.assets+1]={id=d.id,input=input,sourceWidth=w,sourceHeight=h,sourceOpaquePixels=opaque,sourceTransparentPixels=clear,sourcePartialAlphaPixels=partial,mattePixelsRemoved=#queue,crop={x=bounds.x,y=bounds.y,width=bounds.width,height=bounds.height},clean=output,runtime=runtime,saturation=sat}
end
local reportPath=app.params.report or dir..'crate-clean-report.json'
local f=assert(io.open(reportPath,'w'));f:write(json.encode(report));f:close()
print(json.encode(report))
