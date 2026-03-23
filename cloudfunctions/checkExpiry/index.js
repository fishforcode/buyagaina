const cloud = require("wx-server-sdk");
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
 * 获取 N 天后的日期字符串
 */
function getDateAfterDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
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
 */
async function getExpiringItems(openid, reminderDays) {
  const today = getTodayDateString();
  const targetDate = getDateAfterDays(reminderDays);

  console.log('查询参数:', { openid, today, targetDate, reminderDays });

  try {
    // 查询该用户创建的所有物品
    const res = await db.collection('items')
      .where({
        _openid: openid
      })
      .get();

    console.log('查询到的物品数量:', res.data.length);
    console.log('物品列表:', res.data.map(item => ({ name: item.name, expiryDate: item.expiryDate, _openid: item._openid })));

    const items = res.data || [];
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
 * 发送订阅消息
 * @param {string} openid - 用户的 openid
 * @param {object} item - 物品信息
 * @param {string} templateId - 模板ID
 */
async function sendSubscribeMessage(openid, item, templateId) {
  try {
    const now = new Date();
    const expiryDate = item.expiryDate;

    // 确定提醒类型
    const reminderType = item.reminderLevel === 'expired' ? '紧急提醒' : '临期提醒';

    // 格式化过期时间
    const formattedDate = typeof expiryDate === 'string'
      ? expiryDate.substring(0, 10)
      : new Date(expiryDate).toISOString().substring(0, 10);

    // 计算剩余天数
    const daysLeft = item.daysLeft <= 0 ? 0 : item.daysLeft;

    // 查询所属空间名称
    let locationName = '未知空间';
    if (item.locationId) {
      try {
        const locationRes = await db.collection('locations').doc(item.locationId).get();
        if (locationRes.data) {
          locationName = locationRes.data.name || '未知空间';
        }
      } catch (err) {
        console.error('查询空间名称失败:', err);
      }
    }

    // 获取备注
    const remark = item.remark || '无';

    // 发送订阅消息
    // 注意：开发测试时 miniprogramState 用 'trial'，正式上线后改为 'formal'
    await cloud.openapi.subscribeMessage.send({
      touser: openid,
      page: `pages/item_detail/item_detail?id=${item._id}`,
      data: {
        thing5: { value: item.name },         // 物品名称
        date1: { value: formattedDate },     // 有效期至
        time8: { value: item.createTime ? new Date(item.createTime).toISOString().substring(0, 10) : formattedDate }, // 生产日期（用创建时间代替）
        thing10: { value: locationName },    // 位置
        thing3: { value: remark }            // 备注
      },
      templateId: templateId,
      miniprogramState: 'formal'  // 正式版
    });

    console.log('发送订阅消息成功:', item.name);
    return { success: true };
  } catch (err) {
    console.error('发送订阅消息失败:', err);
    // 提取详细的错误信息
    let errorMessage = '未知错误';
    if (err && typeof err === 'object') {
      errorMessage = err.message || err.errMsg || err.errMessage || JSON.stringify(err);
    } else if (typeof err === 'string') {
      errorMessage = err;
    }
    console.error('错误详情:', errorMessage);
    return { success: false, errorMessage: errorMessage };
  }
}

/**
 * 执行临期检查（核心逻辑）
 * @param {string} openid - 用户openid
 * @param {boolean} skipReminderCheck - 是否跳过提醒日期检查（测试用）
 */
async function runExpiryCheck(openid, skipReminderCheck = false) {
  // 订阅消息模板ID（保质期到期提醒）
  const TEMPLATE_ID = 'kjNYfJVcrdGMfxi9HmS21AHgQdV_GCJP3BRE92UQlio';

  // 获取用户设置
  const settings = await getUserSettings(openid);

  console.log('用户设置:', settings);

  if (!settings.reminderEnabled) {
    console.log('用户已关闭提醒，跳过');
    return {
      code: 0,
      message: '用户已关闭提醒'
    };
  }

  // 查询临期物品
  const expiringItems = await getExpiringItems(openid, settings.reminderDays);

  console.log(`找到 ${expiringItems.length} 个临期物品`);

  if (expiringItems.length === 0) {
    return {
      code: 0,
      message: '没有临期物品需要提醒',
      debug: {
        openid: openid,
        today: today,
        targetDate: targetDate,
        allItems: res.data.map(item => ({ 
          name: item.name, 
          expiryDate: item.expiryDate, 
          _openid: item._openid 
        }))
      }
    };
  }

  // 发送订阅消息（聚合消息）
  const today = getTodayDateString();
  
  // 检查今天是否已经发送过聚合提醒
  const hasRemindedToday = expiringItems.some(item => item.lastRemindedDate === today);
  if (!skipReminderCheck && hasRemindedToday) {
    console.log('今天已经发送过聚合提醒，跳过');
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

  // 构建聚合消息内容
  const expiredCount = expiringItems.filter(item => item.reminderLevel === 'expired').length;
  const expiringCount = expiringItems.filter(item => item.reminderLevel === 'expiring').length;
  
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

  console.log('发送聚合消息:', aggregateData);

  // 发送聚合消息
  let success = false;
  let errorMessage = '';
  
  try {
    await cloud.openapi.subscribeMessage.send({
      touser: openid,
      page: 'pages/index/index',  // 跳转到首页
      data: aggregateData,
      templateId: TEMPLATE_ID,
      miniprogramState: 'developer'
    });
    
    success = true;
    console.log('✅ 聚合消息发送成功');
    
    // 更新所有物品的最后提醒日期
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
  } catch (err) {
    success = false;
    errorMessage = err.message || err.errMsg || '未知错误';
    console.error('❌ 聚合消息发送失败:', errorMessage);
  }

  console.log(`=== 临期检查完成 ===`);
  console.log(`聚合消息: ${success ? '成功' : '失败'}`);

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
  console.log('=== 开始执行临期检查 ===');
  console.log('触发时间:', new Date().toISOString());
  console.log('触发方式:', event.type || '自动触发');

  const wxContext = cloud.getWXContext();
  const currentOpenid = wxContext.OPENID;

  console.log('获取到的openid:', currentOpenid);
  console.log('完整wxContext:', JSON.stringify(wxContext));

  // 如果没有获取到 openid，返回错误
  if (!currentOpenid) {
    console.error('无法获取用户openid');
    return {
      code: -1,
      message: '无法获取用户身份信息',
      debug: { wxContext: wxContext }
    };
  }

  console.log('当前用户:', currentOpenid);

  try {
    // 判断是否跳过提醒检查（测试模式）
    const skipReminderCheck = event.skipReminderCheck === true;
    
    return await runExpiryCheck(currentOpenid, skipReminderCheck);

  } catch (err) {
    console.error('临期检查执行失败:', err);
    return {
      code: -1,
      message: '执行失败',
      error: err.message
    };
  }
};
