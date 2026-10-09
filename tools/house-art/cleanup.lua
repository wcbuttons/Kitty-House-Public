-- Remove disconnected matte debris and recolor light neutral edge contamination.
-- Operates on source cutouts in Aseprite before any catalog resizing.
local pc=app.pixelColor
return function(image,family,fringe)
  local w,h=image.width,image.height
  local function index(x,y) return y*w+x+1 end
  local function visible(x,y)
    return x>=0 and y>=0 and x<w and y<h and pc.rgbaA(image:getPixel(x,y))>12
  end
  local function neutral(value)
    local r,g,b=pc.rgbaR(value),pc.rgbaG(value),pc.rgbaB(value)
    local high,low=math.max(r,g,b),math.min(r,g,b)
    return high>85 and high-low<15+high*0.08
  end
  local seen,components={},{}
  local largest=0
  for y=0,h-1 do for x=0,w-1 do
    local first=index(x,y)
    if visible(x,y) and not seen[first] then
      local component={pixels={first},neutral=0,left=x,right=x,top=y,bottom=y}
      seen[first]=true
      local cursor=1
      while cursor<=#component.pixels do
        local at=component.pixels[cursor]-1
        local px,py=at%w,math.floor(at/w)
        if neutral(image:getPixel(px,py)) then component.neutral=component.neutral+1 end
        component.left=math.min(component.left,px); component.right=math.max(component.right,px)
        component.top=math.min(component.top,py); component.bottom=math.max(component.bottom,py)
        for dy=-1,1 do for dx=-1,1 do
          local nx,ny=px+dx,py+dy; local next=index(nx,ny)
          if visible(nx,ny) and not seen[next] then
            seen[next]=true; component.pixels[#component.pixels+1]=next
          end
        end end
        cursor=cursor+1
      end
      components[#components+1]=component
      largest=math.max(largest,#component.pixels)
    end
  end end
  local stats={removedPixels=0,removedFragments=0,edgePixels=0,removedEdgePixels=0}
  for _,component in ipairs(components) do
    local count=#component.pixels
    local thin=math.min(component.right-component.left+1,component.bottom-component.top+1)<=2
    if count<largest and (count<=5 or component.neutral/count>0.6 or (thin and count<=24)) then
      for _,at in ipairs(component.pixels) do
        image:drawPixel((at-1)%w,math.floor((at-1)/w),0)
      end
      stats.removedPixels=stats.removedPixels+count
      stats.removedFragments=stats.removedFragments+1
    end
  end
  if fringe==false then return image,stats end
  local function interior(x,y)
    if x<1 or y<1 or x>=w-1 or y>=h-1 then return false end
    for dy=-1,1 do for dx=-1,1 do
      if pc.rgbaA(image:getPixel(x+dx,y+dy))<220 then return false end
    end end
    return true
  end
  local corrected=image:clone()
  for y=0,h-1 do for x=0,w-1 do
    local value=image:getPixel(x,y)
    if visible(x,y) and neutral(value) and not interior(x,y) then
      local best,bestDistance=nil,1000
      -- Borrow the nearest solid material color, retaining translucent coverage.
      -- Cream cloth, warm highlights and green foliage keep their own color.
      for dy=-5,5 do for dx=-5,5 do
        local distance=dx*dx+dy*dy
        local nx,ny=x+dx,y+dy
        if distance<bestDistance and interior(nx,ny) then
          local candidate=image:getPixel(nx,ny)
          if not neutral(candidate) then best=candidate; bestDistance=distance end
        end
      end end
      if best then
        corrected:drawPixel(x,y,pc.rgba(pc.rgbaR(best),pc.rgbaG(best),pc.rgbaB(best),math.min(190,pc.rgbaA(value))))
        stats.edgePixels=stats.edgePixels+1
      elseif family~='ramen-stool' then
        -- A neutral rim with no nearby solid material is a leftover matte
        -- thread, including the false line spanning beneath sofa legs.
        corrected:drawPixel(x,y,0)
        stats.removedEdgePixels=stats.removedEdgePixels+1
      end
    end
  end end
  return corrected,stats
end
