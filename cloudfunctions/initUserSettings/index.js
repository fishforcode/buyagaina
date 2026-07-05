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
  
  // 获取传入的参数（如果有）
  const { reminderEnabled, reminderDays } = event;

  try {
    // 检查是否已存在设置
    const existing = await db.collection('user_settings').where({
      _openid: openid
    }).get();

    const now = new Date();

    if (existing.data && existing.data.length > 0) {
      // 已存在，更新设置
      const docId = existing.data[0]._id;
      const updateData = {
        updateTime: now
      };
      
      // 只更新传入的参数
      if (reminderEnabled !== undefined) {
        updateData.reminderEnabled = reminderEnabled;
      }
      if (reminderDays !== undefined) {
        updateData.reminderDays = reminderDays;
      }
      
      await db.collection('user_settings').doc(docId).update({
        data: updateData
      });

      return {
        code: 0,
        message: '设置已更新',
        data: {
          _id: docId,
          reminderEnabled: reminderEnabled !== undefined ? reminderEnabled : existing.data[0].reminderEnabled,
          reminderDays: reminderDays !== undefined ? reminderDays : existing.data[0].reminderDays
        }
      };
    }

    // 创建默认设置
    const res = await db.collection('user_settings').add({
      data: {
        _openid: openid,
        reminderDays: reminderDays || 3,           // 默认提前3天提醒
        reminderEnabled: reminderEnabled !== undefined ? reminderEnabled : true,     // 默认开启提醒
        createTime: now,
        updateTime: now
      }
    });

    return {
      code: 0,
      message: '初始化成功',
      data: {
        _id: res._id,
        reminderDays: reminderDays || 3,
        reminderEnabled: reminderEnabled !== undefined ? reminderEnabled : true
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
