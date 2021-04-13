
//
exports.activate = function(context) {
    console.log('恭喜，您的扩展“vscode-plugin-demo”已被激活！');
    //vscode.window.showInformationMessage('恭喜，您的扩展“vscode-plugin-demo”已被激活！')
    require('./handler')(context)

    
};

/**
 * 插件被释放时触发
 */
exports.deactivate = function() {
    console.log('您的扩展“vscode-plugin-demo”已被释放！')
};