const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

/**
 * 初始化用户提醒设置
 * 在用户首次使用时调用
 *
 * 用法：
 * wx.cloud.callFunction({
 *   name: 'initUserSettings'
 * })
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  try {
    // 检查是否已存在设置
    const existing = await db.collection('user_settings').where({
      _openid: openid
    }).get();

    if (existing.data && existing.data.length > 0) {
      return {
        code: 0,
        message: '设置已存在',
        data: existing.data[0]
      };
    }

    // 创建默认设置
    const now = new Date();
    const res = await db.collection('user_settings').add({
      data: {
        _openid: openid,
        reminderDays: 3,           // 默认提前3天提醒
        reminderEnabled: true,     // 默认开启提醒
        createTime: now,
        updateTime: now
      }
    });

    return {
      code: 0,
      message: '初始化成功',
      data: {
        _id: res._id,
        reminderDays: 3,
        reminderEnabled: true
      }
    };

  } catch (err) {
    console.error('初始化用户设置失败:', err);
    return {
      code: -1,
      message: '初始化失败',
      error: err.message
    };
  }
};
