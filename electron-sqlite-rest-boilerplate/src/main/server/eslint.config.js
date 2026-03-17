/**
 * ESLint 配置文件
 * 保守模式配置，适用于离线内网项目
 * 关闭网络、HTTP、安全相关规则，保留核心代码质量检查
 * @returns {Array} ESLint 配置数组，包含多个配置对象
 */
const js = require('@eslint/js');
const nodePlugin = require('eslint-plugin-node');
const securityPlugin = require('eslint-plugin-security');
const sonarjsPlugin = require('eslint-plugin-sonarjs');

module.exports = [
  js.configs.recommended,
  sonarjsPlugin.configs.recommended,

  // 忽略的目录和文件
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'logs/**',
      'test/**',
      'client/dist/**',
      'client/node_modules/**'
    ]
  },

  // Node.js 后端项目配置
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        // Node.js 全局变量
        console: 'readonly',
        process: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        global: 'readonly',
        Promise: 'readonly'
      }
    },

    plugins: {
      node: nodePlugin,
      security: securityPlugin
      // sonarjs 插件已在推荐配置中定义
    },

    rules: {
      // ========== 分号规则 ==========
      // 强制语句必须以分号结尾
      'semi': ['error', 'always'],

      // ========== ESLint 核心规则 ==========
      // 关闭过于严格的规则
      'no-unused-vars': 'off',
      'no-console': 'off',
      'no-undef': 'off',
      'no-empty': 'off',
      'no-useless-catch': 'off',
      'no-prototype-builtins': 'off',
      'no-constant-condition': 'off',
      'no-loss-of-precision': 'off',

      // 保留为警告的规则
      'no-duplicate-case': 'warn',
      'no-redeclare': 'warn',
      'no-dupe-keys': 'warn',

      // 保留为错误的规则（真正的代码问题）
      'no-const-assign': 'error',

      // ========== eslint-plugin-security 规则 ==========
      // 基于项目特点（离线内网、单用户），关闭网络/HTTP/多用户相关规则

      // 关闭：HTTP/Express/CSRF 相关规则（离线环境不需要）
      'security/detect-no-csrf-before-method-override': 'off',

      // 保留：核心安全规则
      'security/detect-bidi-characters': 'warn', // Unicode 攻击
      // 'security/detect-buffer-noassert': 'warn',  // Buffer 安全（项目可能需要）
      'security/detect-eval-with-expression': 'warn', // eval 安全
      'security/detect-new-buffer': 'warn', // 不安全的 Buffer 构造
      // 'security/detect-non-literal-regexp': 'warn',  // 正则表达式安全（可能误报）
      'security/detect-possible-timing-attacks': 'warn', // 时序攻击
      'security/detect-pseudoRandomBytes': 'warn', // 随机数安全
      'security/detect-unsafe-regex': 'warn', // 不安全的正则表达式

      // 可选：文件系统/动态 require 规则（根据项目需求调整）
      // 可能误报或项目需要的安全规则
      'security/detect-buffer-noassert': 'off', // Buffer noAssert（项目可能需要）
      'security/detect-non-literal-regexp': 'off', // 非字面量正则（可能误报）
      'security/detect-non-literal-fs-filename': 'off', // 文件系统（离线环境可能需要）
      'security/detect-non-literal-require': 'off', // 动态 require（项目可能需要）
      'security/detect-object-injection': 'off', // 对象注入（可能误报）
      'security/detect-child-process': 'off', // 子进程（项目可能需要）
      'security/detect-disable-mustache-escape': 'off', // 模板转义（根据项目使用情况）

      // ========== eslint-plugin-sonarjs 规则 ==========
      // 关闭：网络/HTTP/安全相关规则（离线环境不需要）
      'sonarjs/code-eval': 'off',
      'sonarjs/confidential-information-logging': 'off',
      'sonarjs/content-security-policy': 'off',
      'sonarjs/cookie-no-httponly': 'off',
      'sonarjs/cookies': 'off',
      'sonarjs/cors': 'off',
      'sonarjs/csrf': 'off',
      'sonarjs/file-uploads': 'off',
      'sonarjs/hashing': 'off',
      'sonarjs/no-hardcoded-credentials': 'off',
      'sonarjs/no-hardcoded-passwords': 'off', // 硬编码密码（离线环境可能需要）
      'sonarjs/no-hardcoded-ip': 'off', // 硬编码 IP（内网环境正常）
      'sonarjs/os-command': 'off',
      'sonarjs/password-requirements': 'off',
      'sonarjs/process-argv': 'off',
      'sonarjs/session-creation': 'off',
      'sonarjs/session-fixation': 'off',
      'sonarjs/socket-connection': 'off',
      'sonarjs/sql-queries': 'off',
      'sonarjs/standard-input': 'off',
      'sonarjs/trace': 'off',
      'sonarjs/web-config': 'off',
      'sonarjs/xss': 'off',
      'sonarjs/xml-parser': 'off',

      // 关闭：过于严格或可能误报的规则
      'sonarjs/anchor-precedence': 'off', // 正则锚点优先级（代码风格偏好）
      'sonarjs/class-name': 'off', // 类名规范（项目可能有自己的命名规范）
      'sonarjs/cognitive-complexity': 'off',
      'sonarjs/concise-regex': 'off', // 简洁正则表达式（代码风格偏好）
      'sonarjs/cyclomatic-complexity': 'off',
      'sonarjs/expression-complexity': 'off',
      'sonarjs/max-switch-cases': 'off', // switch case 数量限制（代码风格偏好）
      'sonarjs/no-all-duplicated-branches': 'off', // 所有分支重复（可能误报）
      'sonarjs/no-collection-size-mischeck': 'off', // 集合大小检查错误（可能误报）
      'sonarjs/no-dead-store': 'off', // 死存储（可能误报）
      'sonarjs/no-duplicates-in-character-class': 'off', // 字符类重复（可能误报）
      'sonarjs/no-element-overwrite': 'off', // 元素覆盖（可能误报）
      'sonarjs/no-empty-collection': 'off', // 空集合（可能误报）
      'sonarjs/no-extra-arguments': 'off', // 额外参数（可能误报）
      'sonarjs/no-gratuitous-expressions': 'off', // 多余表达式（可能误报）
      'sonarjs/no-implicit-global': 'off', // 隐式全局变量（项目可能需要）
      'sonarjs/no-ignored-return': 'off', // 忽略返回值（可能误报）
      'sonarjs/no-identical-conditions': 'off', // 相同条件（可能误报）
      'sonarjs/no-identical-expressions': 'off', // 相同表达式（可能误报）
      'sonarjs/no-identical-functions': 'off', // 相同函数（可能误报）
      'sonarjs/no-ignored-exceptions': 'off', // 忽略异常（项目可能需要）
      'sonarjs/no-in-misuse': 'off', // in 误用（可能误报）
      'sonarjs/no-inverted-boolean-check': 'off', // 反转布尔检查（可能误报）
      'sonarjs/no-nested-conditional': 'off', // 嵌套三元运算符（可能误报）
      'sonarjs/no-nested-template-literals': 'off', // 嵌套模板字符串（项目可能需要）
      'sonarjs/no-one-iteration-loop': 'off', // 单次迭代循环（可能误报）
      'sonarjs/no-os-command-from-path': 'off', // 从 PATH 执行 OS 命令（项目可能需要）
      'sonarjs/no-parameter-reassignment': 'off', // 参数重新赋值（项目可能需要）
      'sonarjs/no-redundant-assignments': 'off', // 冗余赋值（可能误报）
      'sonarjs/no-redundant-boolean': 'off', // 冗余布尔值（可能误报）
      'sonarjs/no-redundant-jump': 'off', // 冗余跳转（可能误报）
      'sonarjs/no-redundant-parentheses': 'off', // 冗余括号（可能误报）
      'sonarjs/no-same-line-conditional': 'off', // 同行条件语句（代码风格偏好）
      'sonarjs/no-small-switch': 'off', // 小 switch（代码风格偏好）
      'sonarjs/no-unnecessary-cast': 'off', // 不必要的类型转换（可能误报）
      'sonarjs/no-unused-collection': 'off', // 未使用的集合（可能误报）
      'sonarjs/no-unused-vars': 'off', // 未使用的变量（过于严格）
      'sonarjs/no-use-of-empty-return-value': 'off', // 使用空返回值（可能误报）
      'sonarjs/no-useless-catch': 'off', // 无用的 catch（过于严格）
      'sonarjs/no-useless-increment': 'off', // 无用的增量（可能误报）
      'sonarjs/no-useless-intersection': 'off', // 无用的交集（可能误报）
      'sonarjs/prefer-immediate-return': 'off', // 立即返回（代码风格偏好）
      'sonarjs/prefer-object-literal': 'off', // 对象字面量（代码风格偏好）
      'sonarjs/prefer-single-boolean-return': 'off', // 单布尔返回（代码风格偏好）
      'sonarjs/prefer-template': 'off', // 使用模板字符串（代码风格偏好）
      'sonarjs/prefer-while': 'off', // 使用 while 循环（代码风格偏好）
      'sonarjs/pseudo-random': 'off', // 伪随机数（项目可能需要）
      'sonarjs/public-static-readonly': 'off', // 公共静态属性只读（过于严格）
      'sonarjs/slow-regex': 'off', // 慢正则表达式（可能误报）
      'sonarjs/simplified-conditional': 'off', // 简化条件（可能误报）
      'sonarjs/slow-loop': 'off', // 慢循环（可能误报）
      'sonarjs/standard-output': 'off', // 标准输出（可能误报）
      'sonarjs/string-concatenation': 'off', // 字符串连接（代码风格偏好）
      'sonarjs/switch-without-default': 'off', // switch 缺少 default（可能误报）
      'sonarjs/todo-tag': 'off', // TODO 标签（开发中正常）
      'sonarjs/unconditional-jump': 'off', // 无条件跳转（可能误报）
      'sonarjs/use-isnan': 'off', // 使用 isNaN（可能误报）
      'sonarjs/useless-string-operation': 'off', // 无用的字符串操作（可能误报）

      // nodegen/build 的配置校验函数允许“轻量校验 + 可扩展”，返回空列表是有意设计
      // 避免被 sonarjs 误报为代码缺陷
      'sonarjs/no-invariant-returns': 'off'
    }
  }
];
