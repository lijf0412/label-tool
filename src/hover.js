const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const util = require('./util')
const readline = require('readline');
const ts = require('typescript')
const { transform, createProgram } = ts
/**
 * 鼠标悬停提示，当鼠标停在package.json的dependencies或者devDependencies时，
 * 自动显示对应包的名称、版本号和许可协议
 */
 function tsScan(fileList) {
    const cmd = ts.parseCommandLine(fileList); // replace with target file
    // Create the program
    const program = createProgram(cmd.fileNames, { ...cmd.options, allowJs: true });
    const typeChecker = program.getTypeChecker();
  
    const assignNodeList = [];
  
    const scanWord = (typeChecker) => (context) => (sourceFile) => {
      const visitor = (node) => {
        if (ts.SyntaxKind.PropertyAssignment === node.kind) {
          assignNodeList.push(node);
          return node;
        }
        // 继续深度搜索
        if (node && node.getChildCount() > 0) {
          return ts.visitEachChild(node, visitor, context);
        }
        return node;
      };
  
      return visitor(sourceFile)
    }
    const sourceFiles = program.getSourceFiles();
    sourceFiles.forEach(sourceFile => {
      const { fileName } = sourceFile
      if (fileList.includes(path.normalize(fileName))) {
        transform(sourceFile, [scanWord(typeChecker)])
      }
    })
    return getSharkInfoFromNode(assignNodeList);
  }

  const getNodeComment = (node) => {
    const fullStart = node.getFullStart();
    let range = ts.getLeadingCommentRanges(node.getSourceFile().text, fullStart)
    if (range && range.length > 0) {
      let { pos, end } = range[0]
      return node.getFullText()
        .slice(pos - fullStart, end - fullStart)
        .replace('//', '').trim()
    }
    return '';
  }
  
  const getLastComment = (node) => {
    const fullText = node.getSourceFile().getFullText();
    const endPos = node.getEnd();
    const leftText = fullText.slice(endPos);
    const trivia = leftText.slice(leftText.indexOf('//') + 2, leftText.search(/\r\n|\r|\n/));
    return trivia.trim();
  }
  
  
  const getSharkInfoFromNode = (nodeList) => {
    const ret = [];
    for (let i = 0; i < nodeList.length; i++) {
      const node = nodeList[i];
      const sharkKey = getSharkKey(node);
      const varIdentityText = getVarIdentityText(node)
      if (!sharkKey) {
        continue;
      }
      let origin = getNodeComment(node);
      if (!origin) {
        origin = getLastComment(node);
      }

      const sharkInfo = {
        varIdentityText,
        transKey: sharkKey,
        origin
      };
      ret.push(sharkInfo);
    }
    return ret;
  }

  const getVarIdentityText = (node) => {
    for (const childNode of node.getChildren()) {
        if (ts.SyntaxKind.Identifier === childNode.kind) {
          return childNode.getText();
        }
      }
      return '';
  }
  
  const getSharkKey = (node) => {
    for (const childNode of node.getChildren()) {
      if (ts.SyntaxKind.StringLiteral === childNode.kind) {
        const text = childNode.getText();
        return text.slice(1, text.length - 1);
      }
    }
    return '';
  }
  

const readNthLine = (filePath, n) => {
    return new Promise((resolve, reject) => {
        const fRead = fs.createReadStream(filePath)
        let index = 0
        const fReadLine = readline.createInterface({
            input: fRead
        })
        fReadLine.on('line', line => {
            if(n == index) {
                resolve(line)
                fReadLine.close()
            }
            index++
        })
    })
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
    const cont = tsScan([filePath])
    return cont
}

const getLabelFilePath = async (document) => {
  const fileName    = document.fileName;
  const workDir = path.dirname(fileName);
  const { row } = util.findStrInFile(fileName, COMMON_LABEL)
  const data = await readNthLine(fileName, row)
  const filePath = data.split(' ').pop().replace(/;/,'').replace(/'(.*?)'/,'$1')
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

        const len = initialDataList? initialDataList.length: 0

        const textNode = initialDataList.find(item=> item.varIdentityText == word)

        if(textNode) {
            return new vscode.Hover('当前值为：'+textNode.origin)
        }


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
        if(doing) return
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
        doing = true
        return
    }
}

const insertTextFun = (position, text) => {
  vscode.commands.executeCommand('extension.useEditorCommand', position, text).then(result=> {
    console.log('command res', result)
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
        insertTextFun(position, insertText)
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