// pages/item_detail/item_detail.js - 物品详情页（查看 + 跳转编辑）
Page({
  data: {
    itemId: '',
    locationId: '',
    item: null,
    isLoading: true
  },

  onLoad: function (options) {
    var itemId = options.id;
    var locationId = options.locationId || '';
    if (!itemId) {
      wx.showToast({ title: '物品信息错误', icon: 'none' });
      setTimeout(function () { wx.navigateBack(); }, 1500);
      return;
    }
    this.setData({ itemId: itemId, locationId: locationId });
    this.loadItem(itemId);
  },

  loadItem: function (itemId) {
    var that = this;
    this.setData({ isLoading: true });
    var db = wx.cloud.database();
    db.collection('items').doc(itemId).get({
      success: function (res) {
        var item = res.data;
        item.createTimeDisplay = that._formatCreateTime(item);
        that.setData({
          item: item,
          isLoading: false
        });
      },
      fail: function (err) {
        console.error('加载物品详情失败', err);
        wx.showToast({ title: '加载失败', icon: 'none' });
        that.setData({ isLoading: false });
        setTimeout(function () { wx.navigateBack(); }, 1500);
      }
    });
  },

  _formatCreateTime: function (item) {
    var raw = '-';
    if (!item) return raw;
    if (item.createTimeStr && typeof item.createTimeStr === 'string') raw = item.createTimeStr;
    else {
      var ct = item.createTime;
      if (!ct) return raw;
      if (typeof ct === 'string') raw = ct.substring(0, 16);
      else if (ct instanceof Date) raw = ct.toISOString().substring(0, 16);
      else if (ct.$date !== undefined) {
        var d = ct.$date;
        if (typeof d === 'string') raw = d.substring(0, 16);
        else if (typeof d === 'number') raw = new Date(d).toISOString().substring(0, 16);
      } else {
        try {
          var p = new Date(ct);
          if (!isNaN(p.getTime())) raw = p.toISOString().substring(0, 16);
        } catch (e) {}
      }
    }
    return raw.indexOf('T') !== -1 ? raw.replace('T', ' ') : raw;
  },

  onEditTap: function () {
    var itemId = this.data.itemId;
    var locationId = this.data.locationId;
    if (!itemId || !locationId) {
      wx.showToast({ title: '信息不完整', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: '/pages/create_item/create_item?mode=edit&itemId=' + itemId + '&locationId=' + locationId
    });
  }
});
