const cloud = require("wx-server-sdk");
const config = require("./config.js");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;

/**
 * 智能临期提醒云函数
 * 触发方式：定时触发器（每天 11:00 和 17:00）
 *
 * 功能：
 * 1. 扫描所有用户的临期物品
 * 2. 按用户分组发送订阅消息
 * 3. 记录提醒状态，避免重复提醒
 */

/**
 * 获取当前日期字符串（YYYY-MM-DD）
 */
function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 计算两个日期之间的天数差
 */
function getDaysDiff(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = d2 - d1;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * 获取用户提醒设置
 * @param {string} openid - 用户的 openid
 */
async function getUserSettings(openid) {
  try {
    const res = await db.collection('user_settings').where({
      _openid: openid
    }).get();

    if (res.data && res.data.length > 0) {
      const settings = res.data[0];
      return {
        reminderDays: settings.reminderDays || 3,
        reminderEnabled: settings.reminderEnabled !== false
      };
    }

    // 默认设置
    return {
      reminderDays: 3,
      reminderEnabled: true
    };
  } catch (err) {
    console.error('获取用户设置失败:', err);
    // 出错时返回默认设置
    return {
      reminderDays: 3,
      reminderEnabled: true
    };
  }
}

/**
 * 查询用户的临期物品
 * @param {string} openid - 用户的 openid
 * @param {number} reminderDays - 提醒天数
 * @param {string} locationId - 可选：指定空间ID，只查询该空间的物品
 */
async function getExpiringItems(openid, reminderDays, locationId = null) {
  const today = getTodayDateString();

  try {
    // 构建查询条件 - 必须有关联的空间（排除孤儿物品）
    const whereCondition = {
      _openid: openid,
      locationId: locationId ? locationId : _.neq(null)  // 指定空间 或 有任意空间
    };
    
    // 查询该用户的物品（可指定特定空间）
    const res = await db.collection('items')
      .where(whereCondition)
      .get();
    
    // 获取所有物品关联的空间ID
    const locationIds = [...new Set(res.data.map(item => item.locationId).filter(id => id))];
    
    // 批量查询这些空间是否还存在
    const validLocationIds = new Set();
    if (locationIds.length > 0) {
      // 分批查询，每次最多100个
      const batchSize = 100;
      for (let i = 0; i < locationIds.length; i += batchSize) {
        const batch = locationIds.slice(i, i + batchSize);
        const locationRes = await db.collection('locations')
          .where({ _id: _.in(batch) })
          .field({ _id: true })
          .get();
        locationRes.data.forEach(loc => validLocationIds.add(loc._id));
      }
    }

    // 过滤掉空间已删除的物品
    const items = res.data.filter(item => validLocationIds.has(item.locationId)) || [];
    
    const expiringItems = [];

    items.forEach(item => {
      if (!item.expiryDate) return;

      const expiryDate = item.expiryDate;
      const daysDiff = getDaysDiff(today, expiryDate);

      // 分类判断
      if (daysDiff <= 0) {
        // 已过期（当天或之前）
        expiringItems.push({
          ...item,
          reminderLevel: 'expired',  // 红色：已过期
          daysLeft: daysDiff
        });
      } else if (daysDiff <= reminderDays) {
        // 临期（3天内）
        expiringItems.push({
          ...item,
          reminderLevel: 'expiring',  // 黄色：临期
          daysLeft: daysDiff
        });
      }
    });

    return expiringItems;
  } catch (err) {
    console.error('查询临期物品失败:', err);
    return [];
  }
}

/**
 * 执行临期检查（核心逻辑）
 * @param {string} openid - 用户openid
 * @param {boolean} sendNotification - 是否发送订阅消息
 * @param {string} locationId - 可选：指定空间ID，只检查该空间
 * @param {boolean} recordReminderDate - 是否记录提醒日期（用于限制重复提醒）
 */
async function runExpiryCheck(openid, sendNotification = true, locationId = null, recordReminderDate = false) {
  // 从配置文件读取模板ID
  const TEMPLATE_ID = config.templateId;

  // 获取用户设置
  const settings = await getUserSettings(openid);

  if (!settings.reminderEnabled) {
    return {
      code: 0,
      message: '用户已关闭提醒'
    };
  }

  // 查询临期物品
  const expiringItems = await getExpiringItems(openid, settings.reminderDays, locationId);

  if (expiringItems.length === 0) {
    return {
      code: 0,
      message: '没有临期物品需要提醒'
    };
  }

  // 发送订阅消息（聚合消息）
  const today = getTodayDateString();
  
  // 只有自动触发且需要记录日期时，才检查今天是否已经提醒过
  if (recordReminderDate) {
    const hasRemindedToday = expiringItems.some(item => item.lastRemindedDate === today);
    if (hasRemindedToday) {
      return {
        code: 0,
        message: '今天已提醒过',
        data: {
          total: expiringItems.length,
          success: 0,
          fail: 0,
          skipped: expiringItems.length,
          items: expiringItems.map(item => ({
            name: item.name,
            daysLeft: item.daysLeft,
            reminderLevel: item.reminderLevel
          }))
        }
      };
    }
  }

  // 构建聚合消息内容
  const expiredCount = expiringItems.filter(item => item.reminderLevel === 'expired').length;
  
  // 物品名称列表（最多显示3个，超出显示"等"）
  const itemNames = expiringItems.map(item => item.name);
  const displayNames = itemNames.slice(0, 3).join('、') + (itemNames.length > 3 ? '等' : '');
  
  // 找出最早过期的日期
  const earliestExpiry = expiringItems.reduce((earliest, item) => {
    return new Date(item.expiryDate) < new Date(earliest) ? item.expiryDate : earliest;
  }, expiringItems[0].expiryDate);

  // 构建聚合数据
  const aggregateData = {
    thing5: { value: `您有${expiringItems.length}件物品即将过期` },  // 物品名称汇总
    thing3: { value: displayNames },  // 物品列表
    date1: { value: earliestExpiry.substring(0, 10) },  // 最早过期日期
    time8: { value: today },  // 提醒日期（今天）
    thing10: { value: expiredCount > 0 ? `🔴 ${expiredCount}件已过期` : `🟡 即将过期` }  // 位置字段显示状态
  };

  // 发送聚合消息
  let success = false;
  let errorMessage = '';
  
  // 如果需要发送订阅消息
  if (sendNotification) {
    try {
      await cloud.openapi.subscribeMessage.send({
        touser: openid,
        page: 'pages/index/index',  // 跳转到首页
        data: aggregateData,
        templateId: TEMPLATE_ID,
        miniprogramState: 'trial'  // 体验版（测试用）
      });
      
      success = true;
      
      // 只有需要记录日期时才更新
      if (recordReminderDate) {
        for (const item of expiringItems) {
          try {
            await db.collection('items').doc(item._id).update({
              data: {
                lastRemindedDate: today
              }
            });
          } catch (err) {
            console.error(`更新 ${item.name} 提醒日期失败:`, err);
          }
        }
      }
    } catch (err) {
      success = false;
      errorMessage = err.message || err.errMsg || '未知错误';
      console.error('聚合消息发送失败:', errorMessage);
    }
  } else {
    // 不发送订阅消息，只返回列表
    return {
      code: 0,
      message: '检查完成',
      data: {
        total: expiringItems.length,
        success: 0,
        fail: 0,
        skipped: 0,
        manualCheck: true,
        items: expiringItems.map(item => ({
          name: item.name,
          daysLeft: item.daysLeft,
          reminderLevel: item.reminderLevel
        }))
      }
    };
  }

  return {
    code: 0,
    message: success ? '发送成功' : '发送失败',
    data: {
      total: expiringItems.length,
      success: success ? 1 : 0,
      fail: success ? 0 : 1,
      error: errorMessage,
      items: expiringItems.map(item => ({
        name: item.name,
        daysLeft: item.daysLeft,
        reminderLevel: item.reminderLevel
      }))
    }
  };
}

/**
 * 主入口函数
 * 支持两种调用方式：
 * 1. 定时触发器调用（自动）
 * 2. 手动调用（测试用）
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const currentOpenid = wxContext.OPENID;

  // 如果没有获取到 openid，返回错误
  if (!currentOpenid) {
    console.error('无法获取用户openid');
    return {
      code: -1,
      message: '无法获取用户身份信息',
      debug: { wxContext: wxContext }
    };
  }

  try {
    // 是否发送订阅消息（默认发送）
    const sendNotification = event.sendNotification !== false;
    // 获取指定空间ID（可选）
    const locationId = event.locationId || null;
    // 是否跳过每日限制（手动点击时跳过，允许重复发送）
    const skipDailyLimit = event.skipDailyLimit === true;
    // 触发类型：'timer' = 定时触发，'manual' = 手动点击
    const triggerType = event.type || 'manual';
    
    // 关键逻辑：
    // - 手动点击（skipDailyLimit=true 或 type=manual）：不记录日期，不限制重复
    // - 定时触发（type=timer）：记录日期，限制重复
    const isManualClick = skipDailyLimit || triggerType === 'manual';
    const recordReminderDate = !isManualClick;
    
    return await runExpiryCheck(currentOpenid, sendNotification, locationId, recordReminderDate);

  } catch (err) {
    console.error('临期检查执行失败:', err);
    return {
      code: -1,
      message: '执行失败',
      error: err.message
    };
  }
};
