local root=assert(app.params.root)
local im=Image{fromFile=root..'/public/assets/houses/cabin-v2/background-day.png'}
local mask=Image{fromFile=root..'/public/assets/houses/cabin-v2/atmosphere-mask.png'}
local cut=Image(im,Rectangle(285,8,205,125));cut:resize{width=820,height=500,method='nearest'};cut:saveAs(root..'/art/house-themes/source/v0943/cabin-v2/cloud-inspect.png')
local c=Image(im,Rectangle(220,40,100,205));c:resize{width=400,height=820,method='nearest'};c:saveAs(root..'/art/house-themes/source/v0943/cabin-v2/chimney-inspect.png')
local m=Image(im,Rectangle(1100,90,308,330));m:resize{width=616,height=660,method='nearest'};m:saveAs(root..'/art/house-themes/source/v0943/cabin-v2/mountain-inspect.png')
local pc=app.pixelColor;local cloudColors={}
for y=25,123 do for x=325,440 do local c=im:getPixel(x,y);local r,g,b=pc.rgbaR(c),pc.rgbaG(c),pc.rgbaB(c);if r>150 and g>150 and b>150 and pc.rgbaA(mask:getPixel(x,y))==0 then local k=math.floor(r/8)..','..math.floor(g/8)..','..math.floor(b/8);cloudColors[k]=(cloudColors[k]or 0)+1 end end end
print(json.encode(cloudColors))
local samples={}
for _,q in ipairs({{258,95},{254,148},{1230,220},{1280,260},{360,56},{700,305}})do local c=im:getPixel(q[1],q[2]);samples[#samples+1]={x=q[1],y=q[2],day={pc.rgbaR(c),pc.rgbaG(c),pc.rgbaB(c)},maskAlpha=pc.rgbaA(mask:getPixel(q[1],q[2]))}end
print(json.encode(samples))
