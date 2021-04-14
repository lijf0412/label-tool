const fs = require('fs');
const os = require('os');

const util = {
    /**
     * 从某个文件里面查找某个字符串，返回第一个匹配处的行与列，未找到返回第一行第一列
     * @param filePath 要查找的文件
     * @param reg 正则对象，最好不要带g，也可以是字符串
     */
    findStrInFile: function(filePath, reg) {
        const content = fs.readFileSync(filePath, 'utf-8');
        reg = typeof reg === 'string' ? new RegExp(reg, 'm') : reg;
        // 没找到直接返回
        if (content.search(reg) < 0) return {row: 0, col: 0};
        const rows = content.split(os.EOL);
        // 分行查找只为了拿到行
        for(let i = 0; i < rows.length; i++) {
            let col = rows[i].search(reg);
            if(col >= 0) {
                return {row: i, col, content: rows[i]};
            }
        }
        return {row: 0, col: 0, content: ''};
    }
};

module.exports = util;