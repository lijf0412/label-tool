const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const util = require('./util')
const parser = require('@babel/parser')

const getAstInfo  = (path) => {
  const conts = fs.readFileSync(path,'utf-8')
  const ast = parser.parse(conts, {
    sourceType: "module"
  });
  return {
    comments: ast.comments,
    body: ast.program.body
  }
}

const formatDataList = ({ comments, body }) => {
    const curNode = body.find(item=> {
      return item.type == 'VariableDeclaration' && item.declarations.some(i => {
        return i.id.name == COMMON_LABEL && i.id.type == 'Identifier'
      })
    })
    const properties = curNode.declarations.reduce((ret, item) => {
      if(item.id.name == COMMON_LABEL && item.id.type == 'Identifier' && item.init.type == 'ObjectExpression') {
        ret = ret.concat(item.init.properties)
      }
      return ret
    },[])

    let retValList = []

    properties.map(item=> {
      const key = item.key.name, value = item.value.value, end = item.value.end

      const comment = comments.find(item=> item.start > end)
      retValList.push({
        varIdentityText: key,
        transKey: value,
        origin: comment.value
      })

    })
    return retValList
  }

const getPreffix = str => {
    if(!str) return str
    const items = str.split('.')
    items[items.length-1] = ''
    return items.join('.')
}

const saveKey = (varIdentityText, transKey, origin, filePath) => {
    console.log('transKey', transKey, 'origin', origin)
    const content = fs.readFileSync(filePath, 'utf-8')
    console.log('content', content)
    const index = content.lastIndexOf('}')
    const preCont = content.slice(0, index)
    const newContent =  preCont + `    ${varIdentityText}: '${transKey}',//${origin}\r\n` + content.slice(index)
    initialDataList.push({
        varIdentityText,
        transKey,
        origin
    })
    fs.writeFileSync(filePath, newContent)
}

const getInitialData = async (filePath) => {
    if(!filePath) {
      vscode.window.showErrorMessage('初始化数据失败！')
      return []
    }
    console.log('path', filePath)
    
    const cont = formatDataList(getAstInfo(filePath))
    return cont
}



const getLabelFilePath = async (document) => {
  const fileName    = document.fileName;
  const workDir = path.dirname(fileName);
  const { content } = util.findStrInFile(fileName, COMMON_LABEL)
  const filePath = content.split(' ').pop().replace(/;/,'').replace(/'(.*?)'/,'$1')
  const pathT = path.resolve(workDir, filePath)
  const ext = ['ts','js', 'tsx', 'jsx'].find(item=> fs.existsSync(pathT+'.'+item))
  if(!ext) return
  return pathT + '.'+ ext
}

let doing = false
let initialDataList,labelFilePath
const COMMON_LABEL = 'COMMON_LABEL'

const checkFileExt = document => {
  const [name, ext] = document.fileName.split('.')
  if(['js','jsx','ts','tsx'].includes(ext)) return true
}

const createKey = (word) => {
  const len = initialDataList? initialDataList.length: 0
  const props = {
    1: {
        title: 'sharkKey',
        prompt: '(如: key.proivderCommon.test)'
    },
    2: {
        title: '原始文本',
        prompt: '(如: 测试)'
    }
  }
  let transKey='', origin = ''
  const inputBox = vscode.window.createInputBox()
  //初始参数
  inputBox.step = 1
  inputBox.totalSteps = 2
  inputBox.title = props[inputBox.step].title
  inputBox.prompt = props[inputBox.step].prompt
  inputBox.value = (len? getPreffix(initialDataList[len-1].transKey): 'key.common.')+word

  inputBox.onDidHide(() => doing = false)
  inputBox.onDidAccept(() => {
      inputBox.step == 1? transKey = inputBox.value: origin = inputBox.value
      inputBox.value = ''
      if(inputBox.step >= 2) {
          saveKey(word, transKey, origin, labelFilePath)
          inputBox.hide()
      }
      inputBox.step = inputBox.step+1
      inputBox.title = props[inputBox.step].title
      inputBox.prompt = props[inputBox.step].prompt
      
  })
  inputBox.show()
}

const provideHover = async (document, position, token) => {
    if(!checkFileExt(document)) return

    const line = document.lineAt(position);
    // 只截取到光标位置为止，防止一些特殊情况
    const lineText = line.text.substring(0, position.character);
    const word = document.getText(document.getWordRangeAtPosition(position));
    console.log('lineText', lineText, 'word', word)
    if(new RegExp(`${COMMON_LABEL}\.`).test(lineText)) {//如果包含“COMMON_LABEL.”
        if(!labelFilePath) {
            labelFilePath = await getLabelFilePath(document)
        }
        if(!initialDataList) {
            initialDataList = await getInitialData(labelFilePath)
        }
        if(!initialDataList) return

        const textNode = initialDataList.find(item=> item.varIdentityText == word)
        if(textNode) {
            return new vscode.Hover('当前值为：'+textNode.origin)
        }
        if(doing) return
        
        createKey(word)

        doing = true
        return
    }
}

const insertTextFun = (position, text, isNew) => {
  vscode.commands.executeCommand('extension.useEditorCommand', position, text).then(()=> {
    isNew && createKey(text)
  })
}

const provideCompletionItems = async (document, position, token, context) => {
    if(!checkFileExt(document)) return
    
    const line = document.lineAt(position);
    // 只截取到光标位置为止，防止一些特殊情况
    const lineText = line.text.substring(0, position.character);
    if(/COMMON_LABEL\.$/g.test(lineText)) {
      if(!labelFilePath) {
        labelFilePath = await getLabelFilePath(document)
      }
      if(!initialDataList) {
          initialDataList = await getInitialData(labelFilePath)
      }
      if(!initialDataList) {
        return
      }

      const quickPicker = vscode.window.createQuickPick()
      quickPicker.placeholder = '请输入关键字（如：测试）查询，或新增条目（如：test）'
      quickPicker.show()
      quickPicker.onDidAccept(()=> {
        const value = quickPicker.value.trim(),
          selectedItems = quickPicker.selectedItems
        console.log('accept:', value, selectedItems)

        const insertText = selectedItems.length? selectedItems[0].label: value

        console.log('to insert val:', insertText)
        if(!insertText) return
        insertTextFun(position, insertText, !selectedItems.length)
        quickPicker.hide()
      })
      quickPicker.matchOnDetail = true
      quickPicker.items = initialDataList.map(item=> {
        const { varIdentityText, origin, transKey:sharkKey } = item
        return {
          label: varIdentityText,
          description: sharkKey,
          detail: origin
        }
      })
      return
    }
}

const init = (context) => {
  context.subscriptions.push(vscode.languages.registerHoverProvider('*', {
      provideHover
  }));
  //补全
  context.subscriptions.push(vscode.languages.registerCompletionItemProvider({ scheme: 'file'}, {
      provideCompletionItems
  }, '.'));

  //启用编辑器
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('extension.useEditorCommand', (textEditor, edit, position, text) => {
    console.log('您正在执行编辑器命令！');
    console.log('position arg', position, 'text arg', text)
    edit.insert(position, text)
  }));

  //重置初始值
  context.subscriptions.push(vscode.commands.registerCommand('extension.resetInitialData', () => {
    vscode.window.showInformationMessage('重置数据！')
    labelFilePath = undefined
    initialDataList = undefined
  }))
}

module.exports = function(context) {
  context.subscriptions.push(vscode.commands.registerCommand('extension.enableLabelTool', () => {
    vscode.window.showInformationMessage('Enable Label Tool！')
    init(context)
  }))
};