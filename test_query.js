// 在 vConsole 中执行这个查询，查看数据库字段
wx.cloud.database().collection('items').get({
  success: function(res) {
    console.log('所有物品:', res.data);
    res.data.forEach(function(item, index) {
      console.log('物品' + index + ':', {
        name: item.name,
        expiryDate: item.expiryDate,
        _openid: item._openid,
        createdBy: item.createdBy,
        creatorId: item.creatorId
      });
    });
  },
  fail: function(err) {
    console.error('查询失败:', err);
  }
});
