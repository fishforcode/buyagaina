const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event, context) => {
  const { shareToken } = event;
  const { OPENID } = cloud.getWXContext();

  if (!shareToken) {
    return {
      code: -1,
      message: '缺少分享链接'
    };
  }

  try {
    const shareRes = await db.collection('location_shares').where({
      shareToken: shareToken
    }).get();

    if (shareRes.data.length === 0) {
      return {
        code: -1,
        message: '分享链接无效或已过期'
      };
    }

    const shareRecord = shareRes.data[0];

    if (shareRecord.shareStatus !== 'pending') {
      return {
        code: -1,
        message: '分享链接已被处理'
      };
    }

    if (shareRecord.creatorOpenId === OPENID) {
      return {
        code: -1,
        message: '不能分享给自己'
      };
    }

    const locationRes = await db.collection('locations').doc(shareRecord.locationId).get();
    const location = locationRes.data;

    if (!location.sharedWith) {
      location.sharedWith = [];
    }

    const alreadyShared = location.sharedWith.some(item => item.openid === OPENID);
    if (alreadyShared) {
      return {
        code: 0,
        message: '你已经是该空间的协作者'
      };
    }

    await db.collection('locations').doc(shareRecord.locationId).update({
      data: {
        sharedWith: db.command.push({
          openid: OPENID,
          joinTime: new Date()
        })
      }
    });

    await db.collection('location_shares').doc(shareRecord._id).update({
      data: {
        shareStatus: 'accepted',
        sharedWithOpenId: OPENID,
        acceptTime: new Date()
      }
    });

    return {
      code: 0,
      data: {
        locationId: shareRecord.locationId,
        locationName: shareRecord.locationName
      },
      message: '接受分享成功'
    };
  } catch (error) {
    console.error('接受分享失败:', error);
    return {
      code: -1,
      message: '接受分享失败'
    };
  }
};