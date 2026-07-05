const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event, context) => {
  const { locationId } = event;
  const { OPENID } = cloud.getWXContext();

  if (!locationId) {
    return {
      code: -1,
      message: '缺少空间ID'
    };
  }

  try {
    const locationRes = await db.collection('locations').doc(locationId).get();
    const location = locationRes.data;

    if (!location) {
      return {
        code: -1,
        message: '空间不存在'
      };
    }

    if (location.createdBy && location.createdBy !== OPENID) {
      return {
        code: -1,
        message: '只有创建者才能分享空间'
      };
    }

    if (!location.createdBy) {
      await db.collection('locations').doc(locationId).update({
        data: { createdBy: OPENID }
      });
    }

    const shareToken = generateToken();

    await db.collection('location_shares').add({
      data: {
        locationId: locationId,
        locationName: location.name,
        creatorOpenId: OPENID,
        shareToken: shareToken,
        shareStatus: 'pending',
        shareTime: new Date()
      }
    });

    return {
      code: 0,
      data: {
        shareToken: shareToken,
        shareUrl: `pages/index/index?shareToken=${shareToken}`
      },
      message: '分享链接生成成功'
    };
  } catch (error) {
    console.error('生成分享链接失败:', error);
    return {
      code: -1,
      message: '生成分享链接失败'
    };
  }
};

function generateToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 16; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}