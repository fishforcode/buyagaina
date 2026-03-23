// app.js
// 注意：云环境ID已移至 config.js，请复制 config.example.js 为 config.js 并填入你的环境ID
const config = require('./config.js');

App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        env: config.envId,
        traceUser: true,
      });
    }
  },
});
