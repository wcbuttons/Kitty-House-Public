-- Side-wall entrance for Neko Ramen V2. Load with dofile(...), then call the
-- returned function with the unlit daytime architecture. The returned full-size
-- transparent image belongs in the architecture BEFORE deriving the night plate.
-- All geometry follows the existing left wall's oblique elevation. It does not
-- occupy the front cutaway, alter the walkable floor, or contain movable props.
return function(source)
  local pc=app.pixelColor
  local image=Image(source.width,source.height,ColorMode.RGB)
  local function rgba(r,g,b,a)
    return pc.rgba(math.floor(math.max(0,math.min(255,r))),math.floor(math.max(0,math.min(255,g))),math.floor(math.max(0,math.min(255,b))),a or 255)
  end
  local function dot(x,y,c)
    x=math.floor(x);y=math.floor(y)
    if x>=0 and y>=0 and x<image.width and y<image.height then image:drawPixel(x,y,c) end
  end
  local function line(x0,y0,x1,y1,c,width)
    local n=math.max(math.abs(x1-x0),math.abs(y1-y0));width=width or 1
    for i=0,n do
      local t=n==0 and 0 or i/n
      for oy=0,width-1 do for ox=0,width-1 do dot(x0+(x1-x0)*t+ox,y0+(y1-y0)*t+oy,c) end end
    end
  end
  local function polygon(points,pixel)
    local minX,maxX,minY,maxY=1e9,-1e9,1e9,-1e9
    for _,p in ipairs(points) do minX=math.min(minX,p[1]);maxX=math.max(maxX,p[1]);minY=math.min(minY,p[2]);maxY=math.max(maxY,p[2]) end
    for y=math.floor(minY),math.ceil(maxY) do for x=math.floor(minX),math.ceil(maxX) do
      local inside=false;local j=#points
      for i=1,#points do
        local a,b=points[i],points[j]
        if (a[2]>y+.5)~=(b[2]>y+.5) and x+.5<(b[1]-a[1])*(y+.5-a[2])/(b[2]-a[2])+a[1] then inside=not inside end
        j=i
      end
      if inside then dot(x,y,pixel(x,y)) end
    end end
  end
  local function wood(shade,vertical)
    return function(x,y)
      -- Texture comes from this V2 building's own cedar front post, preserving
      -- its irregular grain and the source illustration's tonal variation.
      local sx=247+((vertical and x or y)%15)
      local sy=447+((vertical and y or x)%127)
      local c=source:getPixel(sx,sy)
      local variation=math.sin((vertical and x or y)*1.8)*2
      return rgba(pc.rgbaR(c)*shade+variation,pc.rgbaG(c)*shade+variation*.8,pc.rgbaB(c)*shade+variation*.6)
    end
  end
  local function solid(r,g,b) return function() return rgba(r,g,b) end end

  -- A threshold occupies the base of the doorway in the side-wall plane. The
  -- farther stone edge recedes toward the back wall instead of reading as a
  -- front-facing porch glued to the elevation. The existing front post remains.
  polygon({{279,642},{320,620},{323,625},{280,650}},function(x,y)
    local c=source:getPixel(300+(x%16),674+(y%5))
    return rgba(pc.rgbaR(c)*.79,pc.rgbaG(c)*.79,pc.rgbaB(c)*.78)
  end)
  polygon({{279,648},{323,623},{324,630},{279,656}},function(x,y)
    local grain=((x*19+y*11)%9)-4
    return rgba(107+grain,104+grain,87+grain)
  end)
  line(279,648,322,624,rgba(161,154,125))
  line(280,655,323,630,rgba(70,70,60))
  line(299,638,300,643,rgba(82,82,68))

  -- Outer casing is a trapezoid: the far jamb is shorter, matching the wall.
  polygon({{280,458},{322,478},{322,628},{280,652}},wood(.90,true))
  polygon({{286,469},{316,483},{316,626},{286,643}},function(x,y)
    local vertical=(y-469)/176
    local noise=((x*11+y*17)%7-3)*.6
    return rgba(31+vertical*10+noise,36+vertical*9+noise,34+vertical*5+noise)
  end)
  -- The recessed inner reveal is lit only along its exposed edge.
  polygon({{286,469},{289,474},{289,641},{286,643}},wood(.67,true))
  polygon({{286,469},{316,483},{316,488},{289,474}},wood(.54,false))
  polygon({{289,637},{316,623},{316,628},{286,645}},wood(.61,false))

  -- The far half holds a slid-back walnut lattice door. Its bottom solid panel
  -- and a brass finger pull make the opening read as an entrance, not a window.
  local function panelY(x,t)
    local upper=478+(x-299)*.45
    local lower=637-(x-299)*.56
    return upper+(lower-upper)*t
  end
  local function panelRect(x0,x1,t0,t1,pixel)
    polygon({{x0,panelY(x0,t0)},{x1,panelY(x1,t0)},{x1,panelY(x1,t1)},{x0,panelY(x0,t1)}},pixel)
  end
  panelRect(299,316,0,1,wood(.82,true))
  panelRect(302,314,.055,.66,function(x,y)
    local fleck=((x*3+y*7)%5-2)*1.3
    return rgba(48+fleck,52+fleck,44+fleck)
  end)
  for _,x in ipairs({304,309,313}) do line(x,panelY(x,.06),x,panelY(x,.65),rgba(103,76,47)) end
  for _,t in ipairs({.17,.31,.45,.59}) do line(302,panelY(302,t),314,panelY(314,t),rgba(112,83,50),2) end
  panelRect(302,314,.71,.96,wood(.73,true))
  line(301,panelY(301,.69),314,panelY(314,.69),rgba(139,104,64))
  line(300,panelY(300,.01),300,panelY(300,.99),rgba(154,119,74))
  line(298,478,298,637,rgba(33,34,29))
  line(300,560,300,574,rgba(48,45,32),3)
  line(301,562,301,571,rgba(166,137,81))
  dot(302,562,rgba(201,175,112));dot(302,572,rgba(87,76,49))

  -- Four substantial jambs/lintel/sill retain the original timber material.
  polygon({{279,456},{324,477},{324,485},{279,464}},wood(1.03,false))
  polygon({{279,463},{285,466},{285,649},{279,652}},wood(.92,true))
  polygon({{316,482},{322,485},{322,628},{316,632}},wood(.81,true))
  line(279,457,323,478,rgba(156,124,81))
  line(280,466,280,650,rgba(132,101,65))
  line(284,469,284,646,rgba(71,54,37))
  line(321,486,321,628,rgba(62,50,36))
  line(287,644,315,628,rgba(126,99,63))
  line(287,646,315,630,rgba(49,44,34))
  -- Small iron joinery points keep the casing from looking digitally smooth.
  for _,p in ipairs({{281,471},{281,637},{319,489},{319,620}}) do
    dot(p[1],p[2],rgba(49,46,36));dot(p[1]+1,p[2],rgba(151,130,92))
  end
  return image
end
