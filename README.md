# Label Tool
## 功能
目前sharkKey是放在label.js文件中，便于复用，统一管理。增加一条key时，需要先搜索label.js里已有的key是否符合要求，没有则要搜索变量名是否存在，然后，手动在label.js中加上变量名，key，注释；这个过程可能需要在当前工作文件和label.js中来回切换。该工具可以在新增key时也可以专注于当前文件，不用管label.js文件
## 使用
1. 启用插件
ctrl+shift+p打开命令窗口，输入"label"关键字，找到“启用 Label Tool”命令

2. 输入Key补全（这里是查询已有值和新增key）
输入"COMMON_LABEL.",会出下拉筛选框，可使用翻译文本或者变量名搜索，（如：“供应商”,可以筛出所有包含供应商的key），选中某一条会自动补上对应变量名称；如果没有找到所需，则输入新的变量名新增一条

3. Label中写入新key
在上一步之后，鼠标hover上COMMON_LABEL.newKey的“newKey”上，会出输入框，依次填入sharkKey和翻译文本即可在label.js中末尾增加一条

4. 重置数据源
数据源即Label.js中内容，在插件启动之初会读取其中内容，如果中途手动修改了label.js则需要重置数据源，以便重新读取，快捷键为=> win: alt+f5; mac: cmd+f5

5. 其他
· 本插件只适用于使用COMMON_LABEL作为关键字的情形
· 首先需保证COMMON_LABEL的引用正确，否则无法读取label.js（.ts）中的内容
· 如果COMMON_LABEL的地址不正确，需要用重置数据源命令重置其地址