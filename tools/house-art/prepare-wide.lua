local root=assert(app.params.root)
for _,id in ipairs({'cabin','ramen'}) do
  local source=Image{fromFile=root .. '/public/assets/houses/' .. id .. '/background.png'}
  if source.width==1408 and source.height==792 then source=Image(source,Rectangle(144,1,1120,790)) end
  assert(source.width==1120 and source.height==790)
  local canvas=Image(1408,792,ColorMode.RGB)
  canvas:drawImage(source,Point(144,1))
  canvas:saveAs(root .. '/art/house-themes/source/' .. id .. '-outpaint-target.png')
end
