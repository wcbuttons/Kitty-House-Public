local dir=assert(app.params.root)..'/art/house-themes/source/v0943/cabin-v2/'
local names={'architecture','fern-sofa','quilt-bed','reading-chair','trestle-table','stump-stool','blanket-chest','bookcase','wall-shelf','birch-scratcher','wicker-hide'}
local report={}
for _,id in ipairs(names) do
 local im=Image{fromFile=dir..id..'-generated.png'}; local counts={};for i=1,16 do counts[i]=0 end
 for p in im:pixels() do local a=app.pixelColor.rgbaA(p());local i=math.floor(a/16)+1;counts[i]=counts[i]+1 end
 local b=im:shrinkBounds();local samples={};for _,q in ipairs({{.5,.05},{.5,.5},{.5,.88},{.05,.5},{.2,.5}})do local c=im:getPixel(math.floor(im.width*q[1]),math.floor(im.height*q[2]));samples[#samples+1]={app.pixelColor.rgbaR(c),app.pixelColor.rgbaG(c),app.pixelColor.rgbaB(c),app.pixelColor.rgbaA(c)}end;report[#report+1]={id=id,w=im.width,h=im.height,alpha=counts,bounds={b.x,b.y,b.width,b.height},samples=samples}
end
print(json.encode(report))
