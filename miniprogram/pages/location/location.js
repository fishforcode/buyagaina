// pages/location/location.js - 完整版 (含消耗、删除功能)
Page({

  /**
   * 页面的初始数据
   */
  data: {
    locationId: '',
    locationInfo: null,
    isLoading: true,
    itemList: [],
    isItemLoading: false,
    isCreator: false,
    showRenameModal: false,
    renameInput: '',
    // 消耗弹窗
    showConsumeModal: false,
    consumeItemIndex: -1,
    consumeItemId: '',
    consumeItemName: '',
    consumeItemQuantity: 0,
    consumeInput: '1'
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    console.log('详情页 onLoad 接收参数:', options);
    var locationId = options.id;
    if (locationId) {
      this.setData({ locationId: locationId });
      this.loadAllData(locationId);
    } else {
      this.setData({ isLoading: false });
    }
  },

  /**
   * 生命周期函数--监听页面显示
   * 从添加物品页或其他页面返回时，自动刷新列表
   */
  onShow: function () {
    console.log('详情页 onShow');
    if (this.data.locationId && !this.data.isLoading) {
      this.loadAllData(this.data.locationId);
    }
  },

  /**
   * 加载所有数据（空间信息 + 物品列表）
   */
  loadAllData: function (locationId) {
    var that = this;
    this.setData({ isLoading: true, isItemLoading: true });
    console.log('开始加载所有数据，空间ID:', locationId);

    var db = wx.cloud.database();
    var locationPromise = db.collection('locations').doc(locationId).get();
    var itemsPromise = db.collection('items')
      .where({ locationId: locationId })
      .orderBy('createTime', 'desc')
      .get();

    // 并行加载，使用最基础的 Promise 语法确保兼容性
    Promise.all([locationPromise, itemsPromise])
      .then(function (results) {
        var locationRes = results[0];
        var itemsRes = results[1];
        console.log('数据加载完成，物品数:', itemsRes.data.length);

        // 为每个物品添加状态标记 + 添加日期的显示字符串（优先 createTimeStr，兼容旧数据）
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        
        var expiredCount = 0;
        var expiringCount = 0;
        
        var itemListWithState = itemsRes.data.map(function (item) {
          // 计算保质期状态
          var status = '';
          if (item.expiryDate) {
            var expiry = new Date(item.expiryDate);
            expiry.setHours(0, 0, 0, 0);
            var diffTime = expiry - today;
            var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays < 0) {
              status = 'expired';
              expiredCount++;
            } else if (diffDays <= 3) {
              status = 'expiring';
              expiringCount++;
            }
          }
          
          return {
            ...item,
            isOperating: false,
            status: status,
            daysLeft: item.expiryDate ? Math.ceil((new Date(item.expiryDate) - today) / (1000 * 60 * 60 * 24)) : null,
            createTimeDisplay: that._formatCreateTime(item)
          };
        });

        that.setData({
          locationInfo: locationRes.data,
          itemList: itemListWithState,
          expiredCount: expiredCount,
          expiringCount: expiringCount,
          isLoading: false,
          isItemLoading: false
        });
        that._checkIsCreator(locationRes.data);
      })
      .catch(function (err) {
        console.error('加载数据失败:', err);
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        });
        that.setData({
          isLoading: false,
          isItemLoading: false
        });
      });
  },

  /**
   * 判断当前用户是否为空间创建者（仅创建者可重命名/删除空间）
   */
  _checkIsCreator: function (locationInfo) {
    var that = this;
    if (!locationInfo) return;

    // 如果数据没有createdBy字段（旧数据），默认允许管理
    if (!locationInfo.createdBy) {
      that.setData({ isCreator: true });
      return;
    }

    wx.cloud.callFunction({ name: 'quickstartFunctions', data: { type: 'getOpenId' } })
      .then(function (res) {
        var openid = res.result && res.result.openid ? res.result.openid : '';
        var isCreator = locationInfo.createdBy === openid;
        that.setData({ isCreator: isCreator });
      })
      .catch(function () {
        // 云函数失败时，如果数据没有createdBy，默认允许管理
        that.setData({ isCreator: !locationInfo.createdBy });
      });
  },

  /**
   * 将 createTime 转为「YYYY-MM-DD」显示（优先用 createTimeStr，兼容云库 Date/对象）
   */
  _formatCreateTime: function (item) {
    if (!item) return '';
    if (item.createTimeStr && typeof item.createTimeStr === 'string') return item.createTimeStr.substring(0, 10);
    var createTime = item.createTime;
    if (!createTime) return '';
    if (typeof createTime === 'string') return createTime.substring(0, 10);
    if (createTime instanceof Date) return createTime.toISOString().substring(0, 10);
    if (createTime.$date !== undefined) {
      var d = createTime.$date;
      if (typeof d === 'string') return d.substring(0, 10);
      if (typeof d === 'number') return new Date(d).toISOString().substring(0, 10);
    }
    if (typeof createTime === 'object') {
      try {
        var parsed = new Date(createTime);
        if (!isNaN(parsed.getTime())) return parsed.toISOString().substring(0, 10);
      } catch (e) {}
    }
    return '';
  },

  /**
   * 页面下拉刷新
   */
  onPullDownRefresh: function () {
    console.log('下拉刷新');
    var that = this;
    if (this.data.locationId) {
      this.loadAllData(this.data.locationId);
    }
    setTimeout(function () {
      wx.stopPullDownRefresh();
      wx.showToast({
        title: '刷新成功',
        icon: 'success',
        duration: 1000
      });
    }, 1000);
  },

  /**
   * 跳转到添加物品页面
   */
  goToAddItem: function () {
    var locationId = this.data.locationId;
    if (!locationId) {
      wx.showToast({ title: '空间信息错误', icon: 'none' });
      return;
    }
    console.log('跳转到添加物品页，空间ID:', locationId);
    wx.navigateTo({
      url: '/pages/create_item/create_item?locationId=' + locationId
    });
  },

  /**
   * 点击「消耗」：打开弹窗，可输入本次消耗数量
   */
  onConsumeItem: function (e) {
    var index = e.currentTarget.dataset.index;
    var itemList = this.data.itemList;
    var item = itemList[index];
    if (item.isOperating) return;
    this.setData({
      showConsumeModal: true,
      consumeItemIndex: index,
      consumeItemId: item._id,
      consumeItemName: item.name,
      consumeItemQuantity: item.quantity,
      consumeInput: '1'
    });
  },

  /** 弹窗卡片内点击：仅阻止冒泡，不关闭弹窗 */
  onConsumeCardTap: function () {
    // 空函数，仅用于 catchtap 阻止事件冒泡到蒙层
  },

  /** 关闭消耗弹窗 */
  closeConsumeModal: function () {
    this.setData({
      showConsumeModal: false,
      consumeItemIndex: -1,
      consumeItemId: '',
      consumeItemName: '',
      consumeItemQuantity: 0,
      consumeInput: '1'
    });
  },

  /** 消耗数量输入 / 快捷选择 */
  onConsumeInput: function (e) {
    this.setData({ consumeInput: e.detail.value });
  },
  setConsumeQuick: function (e) {
    var num = e.currentTarget.dataset.num;
    this.setData({ consumeInput: String(num) });
  },

  /** 确认消耗（按输入的数量扣减） */
  confirmConsume: function () {
    var that = this;
    var index = this.data.consumeItemIndex;
    var itemId = this.data.consumeItemId;
    var itemList = this.data.itemList;
    var currentQty = this.data.consumeItemQuantity;
    var input = this.data.consumeInput;

    var num = parseInt(input, 10);
    if (isNaN(num) || num < 1) {
      wx.showToast({ title: '请输入有效数量', icon: 'none' });
      return;
    }
    if (num > currentQty) {
      wx.showToast({ title: '不能超过当前数量 ' + currentQty, icon: 'none' });
      return;
    }

    var newQuantity = currentQty - num;
    var operationKey = 'itemList[' + index + '].isOperating';
    this.setData({
      showConsumeModal: false,
      [operationKey]: true
    });

    var db = wx.cloud.database();
    if (newQuantity <= 0) {
      db.collection('items').doc(itemId).remove({
        success: function () {
          itemList.splice(index, 1);
          that.setData({ itemList: itemList });
          wx.showToast({
            title: num === currentQty ? '已用完' : '已消耗 ' + num + ' 个',
            icon: 'success'
          });
        },
        fail: function (err) {
          console.error('删除失败', err);
          wx.showToast({ title: '操作失败', icon: 'none' });
          that.setData({ [operationKey]: false });
        }
      });
    } else {
      db.collection('items').doc(itemId).update({
        data: { quantity: newQuantity },
        success: function () {
          var updateData = {};
          updateData['itemList[' + index + '].quantity'] = newQuantity;
          updateData['itemList[' + index + '].isOperating'] = false;
          that.setData(updateData);
          wx.showToast({
            title: '已消耗 ' + num + ' 个',
            icon: 'success'
          });
        },
        fail: function (err) {
          console.error('更新失败', err);
          wx.showToast({ title: '操作失败', icon: 'none' });
          that.setData({ [operationKey]: false });
        }
      });
    }
  },

  /**
   * 删除物品（直接删除）
   */
  onDeleteItem: function (e) {
    var that = this;
    var index = e.currentTarget.dataset.index;
    var itemId = e.currentTarget.dataset.id;
    var itemName = this.data.itemList[index].name;

    // 更新本地操作状态
    var operationKey = 'itemList[' + index + '].isOperating';
    this.setData({
      [operationKey]: true
    });

    wx.showModal({
      title: '确认删除',
      content: '确定要删除【' + itemName + '】吗？此操作不可恢复。',
      success: function (res) {
        if (res.confirm) {
          var db = wx.cloud.database();
          db.collection('items').doc(itemId).remove({
            success: function (res) {
              console.log('删除成功', res);
              // 从本地列表中移除该项
              var itemList = that.data.itemList;
              itemList.splice(index, 1);
              that.setData({
                itemList: itemList
              });
              wx.showToast({
                title: '已删除',
                icon: 'success'
              });
            },
            fail: function (err) {
              console.error('删除失败', err);
              wx.showToast({ title: '删除失败', icon: 'none' });
              that.setData({ [operationKey]: false });
            }
          });
        } else {
          // 用户取消，重置操作状态
          that.setData({ [operationKey]: false });
        }
      }
    });
  },
/**
 * 跳转到编辑物品页面
 */
onEditItem: function (e) {
  const itemId = e.currentTarget.dataset.id;
  const locationId = this.data.locationId;
  if (!itemId || !locationId) {
    wx.showToast({ title: '信息错误', icon: 'none' });
    return;
  }
  console.log('跳转编辑物品，物品ID:', itemId, '空间ID:', locationId);
  // 关键：跳转到 create_item 页，同时传递物品ID（用于编辑）和空间ID（用于返回关联）
  wx.navigateTo({
    url: '/pages/create_item/create_item?mode=edit&itemId=' + itemId + '&locationId=' + locationId
  });
},
  /**
   * 物品项点击事件：跳转物品详情页
   */
  onItemTap: function (e) {
    var itemId = e.currentTarget.dataset.id;
    var locationId = this.data.locationId;
    if (!itemId) return;
    wx.navigateTo({
      url: '/pages/item_detail/item_detail?id=' + itemId + '&locationId=' + (locationId || '')
    });
  },

  /** 重命名空间：打开弹窗 */
  onRenameTap: function () {
    var name = this.data.locationInfo && this.data.locationInfo.name ? this.data.locationInfo.name : '';
    this.setData({ showRenameModal: true, renameInput: name });
  },
  onRenameInput: function (e) {
    this.setData({ renameInput: e.detail.value });
  },
  closeRenameModal: function () {
    this.setData({ showRenameModal: false, renameInput: '' });
  },
  onRenameCardTap: function () {},
  /** 确认重命名 */
  confirmRename: function () {
    var that = this;
    var name = (this.data.renameInput || '').trim();
    if (!name) {
      wx.showToast({ title: '请输入空间名称', icon: 'none' });
      return;
    }
    var locationId = this.data.locationId;
    this.setData({ showRenameModal: false, renameInput: '' });
    wx.cloud.database().collection('locations').doc(locationId).update({
      data: { name: name },
      success: function () {
        var loc = that.data.locationInfo;
        if (loc) loc.name = name;
        that.setData({ locationInfo: loc });
        wx.showToast({ title: '已重命名', icon: 'success' });
      },
      fail: function (err) {
        console.error('重命名失败', err);
        wx.showToast({ title: '重命名失败', icon: 'none' });
      }
    });
  },

  /** 删除空间：仅创建者可见，二次确认后删除 */
  onDeleteSpaceTap: function () {
    var that = this;
    var name = this.data.locationInfo && this.data.locationInfo.name ? this.data.locationInfo.name : '该空间';
    wx.showModal({
      title: '确认删除空间',
      content: '确定要删除【' + name + '】吗？空间内的物品不会被删除，但将不再归属此空间。此操作不可恢复。',
      confirmColor: '#f56c6c',
      success: function (res) {
        if (res.confirm) that._doDeleteSpace();
      }
    });
  },
  _doDeleteSpace: function () {
    var that = this;
    var locationId = this.data.locationId;
    wx.cloud.database().collection('locations').doc(locationId).remove({
      success: function () {
        wx.showToast({ title: '已删除空间', icon: 'success' });
        setTimeout(function () {
          wx.navigateBack();
        }, 800);
      },
      fail: function (err) {
        console.error('删除空间失败', err);
        wx.showToast({ title: '删除失败，请重试', icon: 'none' });
      }
    });
  }
});