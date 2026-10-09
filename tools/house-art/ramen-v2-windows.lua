-- Stable rice-paper panes and complete wooden lattices. Lighting masks are
-- authored from the geometry itself, never inferred from material RGB values.
return function(source)
  local pc=app.pixelColor
  local repairs=Image(source.width,source.height,ColorMode.RGB)
  local mask=Image(source.width,source.height,ColorMode.RGB)
  local function rgba(r,g,b,a)
    return pc.rgba(math.floor(r+.5),math.floor(g+.5),math.floor(b+.5),a or 255)
  end
  local vertical={777,779,803,804,829,831,856,857,882,884,909,910,935,937,962,963,988,990}
  local horizontal={248,250,272,273,295,296,317,318,338,340}
  local function paper(x,y,top,bottom,distance)
    local fiber=((x*19+y*31)%13-6)*.25+math.sin(x*.47+y*.69)*.65
    local light=6*(y-top)/(bottom-top)-8*math.exp(-distance/2.7)+fiber
    repairs:drawPixel(x,y,rgba(193+light,179+light,154+light))
    -- Shoji diffuses a little sky warmth; it is not an unobstructed sky hole.
    mask:drawPixel(x,y,rgba(255,255,255,51))
  end
  local function timber(x,y,edge)
    local grain=math.sin(y*.25+x*.51)*1.6+((x*7+y*3)%5-2)*.5
    local highlight=edge and 7 or 0
    repairs:drawPixel(x,y,rgba(94+grain+highlight,76+grain+highlight*.8,54+grain+highlight*.6))
    mask:drawPixel(x,y,0)
  end
  for y=248,340 do for x=777,990 do
    local nearest=100
    for _,v in ipairs(vertical) do nearest=math.min(nearest,math.abs(x-v)) end
    for _,v in ipairs(horizontal) do nearest=math.min(nearest,math.abs(y-v)) end
    paper(x,y,248,340,nearest)
  end end
  local function bar(x,y,w,h,verticalBar)
    for py=y,y+h-1 do for px=x,x+w-1 do
      timber(px,py,verticalBar and px==x or not verticalBar and py==y)
    end end
  end
  bar(777,248,3,93,true);bar(988,248,3,93,true)
  bar(777,248,214,3,false);bar(777,338,214,3,false)
  for _,x in ipairs({829,882,935}) do bar(x,251,3,87,true) end
  for _,x in ipairs({803,856,909,962}) do bar(x,251,2,87,true) end
  for _,y in ipairs({272,295,317}) do bar(780,y,208,2,false) end
  -- Keep the generated thick circular surround, replace only its inner paper
  -- and lattice with a single geometrically registered material surface.
  local cx,cy,r=1084.5,278.5,17.8
  for y=261,296 do for x=1067,1102 do
    local dx,dy=x-cx,y-cy
    local radius=math.sqrt(dx*dx+dy*dy)
    if radius<=r then
      local gridX=math.min(math.abs(dx+9),math.abs(dx),math.abs(dx-9))
      local gridY=math.min(math.abs(dy+8),math.abs(dy-8))
      if gridX<=.7 or gridY<=.7 then timber(x,y,false)
      else paper(x,y,261,296,math.min(r-radius,gridX,gridY)) end
    end
  end end
  return repairs,mask
end
