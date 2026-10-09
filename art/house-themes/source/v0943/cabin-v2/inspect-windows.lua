local root=assert(app.params.root)
local im=Image{fromFile=root..'/public/assets/houses/cabin-v2/background-day.png'}
for i,q in ipairs({{650,280,170,80},{650,491,170,88}})do local cut=Image(im,Rectangle(q[1],q[2],q[3],q[4]));cut:resize{width=q[3]*5,height=q[4]*5,method='nearest'};cut:saveAs(root..'/art/house-themes/source/v0943/cabin-v2/window-'..i..'-inspect.png')end
