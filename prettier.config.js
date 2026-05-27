module.exports = {
  semi: false,
  singleQuote: true,
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  trailingComma: 'es5',
  bracketSpacing: true,
  plugins: ['prettier-plugin-tailwindcss', 'prettier-plugin-sh'],
  overrides: [
    {
      // 匹配 .yaml 和 .yml 文件
      files: ['*.yaml', '*.yml'],
      options: {
        // YAML 社区习惯使用单引号，保持 true 即可
        singleQuote: true,
        // 强制 YAML 的缩进为 2（有些项目全局是 4，但 YAML 必须是 2）
        tabWidth: 2,
      },
    },
    {
      // 匹配 Shell 脚本文件
      files: ['*.sh', '.*shrc', '.bash*'],
      options: {
        // Shell 脚本通常推荐保持 100 宽度，或者根据需要调整
        printWidth: 100,
        // 针对 sh 插件的特殊配置（可选）：
        keepComments: true, // 是否保留注释的原始缩进
        // variant: 0,         // 0: Standard Sh, 1: Bash, 2: Posix, 3: MkSh
      },
    },
  ],
}
