-- Reviewed interior negative spaces from the ramen furniture source sheet.
-- The pale material in these regions is warm-tinted backdrop, not ceramic or
-- leaf texture, so a neutral edge-only cleanup cannot safely identify it.
local pc=app.pixelColor
return function(image,family)
  local bounds
  if family=='planter' then
    -- Only the foliage: preserve all of the light ceramic pot below it.
    bounds={0,0,image.width,198}
  elseif family=='bowl-rack' then
    -- Gap between the third cream stack and red stack on the lower shelf.
    bounds={276,204,26,27}
  else return 0 end
  local removed=0
  local minimum=family=='planter' and 100 or 85
  for y=bounds[2],bounds[2]+bounds[4]-1 do
    for x=bounds[1],bounds[1]+bounds[3]-1 do
      local c=image:getPixel(x,y)
      local r,g,b=pc.rgbaR(c),pc.rgbaG(c),pc.rgbaB(c)
      if pc.rgbaA(c)>0 and math.min(r,g,b)>=minimum and math.max(r,g,b)-math.min(r,g,b)<110 then
        image:drawPixel(x,y,0); removed=removed+1
      end
    end
  end
  assert(removed>0,'Interior matte selection no longer matches ' .. family)
  return removed
end
