-- Floor/post registration has sharp scale changes, appropriate inside timber
-- joints but visible as squeezed stripes in trees. Smooth source COORDINATES
-- in the right-hand forest, never pixel colors: the texture stays crisp and
-- single-imaged. The building, sky, windows and playable veranda stay exact.
return function(source, day, xt, xs, yt, ys)
 local function remap(v,t,s)
  for i=1,#t-1 do if v<=t[i+1] then return s[i]+(v-t[i])/(t[i+1]-t[i])*(s[i+1]-s[i]) end end
  local n=#t
  return s[n]+(v-t[n])/(t[n]-t[n-1])*(s[n]-s[n-1])
 end
 local function smoothMap(t,s,size)
  local out={}
  for v=0,size-1 do
   local total,weight=0,0
   -- Linear extrapolation avoids dragging edge trees into the image when the
   -- filter straddles a map endpoint. A 32px sigma softens both narrow bands.
   for offset=-96,96 do
    local w=math.exp(-offset*offset/(2*32*32))
    total=total+w*remap(v+offset,t,s);weight=weight+w
   end
   out[v]=math.max(0,math.min(s[#s],total/weight))
  end
  return out
 end
 local mx,my=smoothMap(xt,xs,day.width),smoothMap(yt,ys,day.height)
 local function smoothstep(v)local t=math.max(0,math.min(1,v));return t*t*(3-2*t)end
 -- Conservative silhouette, including the projecting tile edges, complete
 -- veranda, posts, lantern, rails and deck. No furniture support moves.
 local boundary={{884,240},{944,265},{944,299},{924,319},{924,337},
  {940,337},{1000,352},{1065,373},{1138,401},{1166,414},{1188,432},
  {1204,440},{1222,447},{1222,469},{1207,480},{1205,501},
  {1194,706},{884,706}}
 local function distanceOutside(x,y)
  local inside=false;local distance=math.huge
  local a=boundary[#boundary]
  for _,b in ipairs(boundary)do
   if (a[2]>y)~=(b[2]>y) and x<(b[1]-a[1])*(y-a[2])/(b[2]-a[2])+a[1]then inside=not inside end
   local dx,dy=b[1]-a[1],b[2]-a[2]
   local t=math.max(0,math.min(1,((x-a[1])*dx+(y-a[2])*dy)/(dx*dx+dy*dy)))
   distance=math.min(distance,math.sqrt((x-a[1]-t*dx)^2+(y-a[2]-t*dy)^2));a=b
  end
  return inside and 0 or distance
 end
 local repair=Image(day.width,day.height,ColorMode.RGB)
 local changed=0
 for y=271,day.height-1 do for x=885,day.width-1 do
  -- Four untouched pixels around the silhouette, followed by a 48px smooth
  -- coordinate transition, prevent cracks and sampling timber into foliage.
  local w=smoothstep((y-270)/60)*smoothstep((x-884)/48)*smoothstep((distanceOutside(x,y)-4)/48)
  if w>0 then
   local ox,oy=remap(x,xt,xs),remap(y,yt,ys)
   local sx,sy=ox+(mx[x]-ox)*w,oy+(my[y]-oy)*w
   local c=source:getPixel(math.floor(sx),math.floor(sy))
   if c~=day:getPixel(x,y)then day:drawPixel(x,y,c);repair:drawPixel(x,y,c);changed=changed+1 end
  end
 end end
 -- Regression guard on the actual sampling field: the 20px band formerly
 -- squeezed 56px of trees. Neither axis may retain that abrupt compression.
 local peakX,peakY=0,0
 for x=1150,1220 do peakX=math.max(peakX,mx[x+1]-mx[x])end
 for y=390,490 do peakY=math.max(peakY,my[y+1]-my[y])end
 assert(peakX<1.65 and peakY<1.3,'Exterior registration retains a compressed texture band')
 return repair,{method='Smooth exterior source coordinates; exact protected architecture',
  changedPixels=changed,sigma=32,fade=48,protectedBoundary=boundary,
  peakSourceStepX=peakX,peakSourceStepY=peakY,skyPreservedThroughY=270}
end
