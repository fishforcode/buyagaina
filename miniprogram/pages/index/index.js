// pages/index/index.js - 修复统计问题版本
Page({

  data: {
    isLoading: true,
    isFirstUser: false,
    locationList: [],
    // 订阅消息相关
    showSubscribeModal: false,
    reminderEnabled: false
  },

  onLoad: function (options) {
    this.loadLocationsWithStats();
    // 初始化用户设置
    this.initUserSettings();
  },

  onShow: function () {
    // 每次显示页面都刷新数据
    if (!this.data.isLoading) {
      this.loadLocationsWithStats();
    }
  },

  // 加载空间列表并统计物品数量
  loadLocationsWithStats: function () {
    var that = this;
    this.setData({ isLoading: true });
    console.log('开始加载空间列表和统计...');
    
    var db = wx.cloud.database();
    
    // 1. 先获取所有空间
    db.collection('locations')
      .orderBy('createTime', 'desc')
      .get()
      .then(function (locationRes) {
        var locations = locationRes.data;
        console.log('获取到空间数量:', locations.length);
        
        if (locations.length === 0) {
          // 没有空间，显示引导页
          that.setData({
            isLoading: false,
            isFirstUser: true,
            locationList: []
          });
          return;
        }
        
        // 2. 为每个空间统计物品数量
        var locationStats = [];
        var statsPromises = [];
        
        // 创建所有统计请求
        for (var i = 0; i < locations.length; i++) {
          (function (index) {
            var location = locations[index];
            var promise = db.collection('items')
              .where({ locationId: location._id })
              .count()
              .then(function (countRes) {
                return {
                  index: index,
                  location: location,
                  count: countRes.total
                };
              })
              .catch(function (err) {
                console.error('统计空间失败:', location.name, err);
                return {
                  index: index,
                  location: location,
                  count: 0
                };
              });
            
            statsPromises.push(promise);
          })(i);
        }
        
        // 3. 等待所有统计完成
        return Promise.all(statsPromises);
      })
      .then(function (statsResults) {
        if (!statsResults) return; // 没有空间的情况
        
        // 按原始顺序排序并构建最终列表
        statsResults.sort(function (a, b) {
          return a.index - b.index;
        });
        
        var finalList = [];
        var totalItems = 0;
        
        for (var j = 0; j < statsResults.length; j++) {
          var result = statsResults[j];
          var location = result.location;
          
          finalList.push({
            _id: location._id,
            name: location.name,
            icon: location.icon || '📦',
            remark: location.remark || '',
            createTime: location.createTime,
            itemCount: result.count
          });
          
          totalItems += result.count;
          console.log('空间统计:', location.name, '->', result.count, '件物品');
        }
        
        console.log('总计:', finalList.length, '个空间,', totalItems, '件物品');
        
        // 4. 更新页面数据
        that.setData({
          locationList: finalList,
          isLoading: false,
          isFirstUser: false
        });
      })
      .catch(function (err) {
        console.error('加载空间列表失败:', err);
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        });
        that.setData({ isLoading: false });
      });
  },

  // 跳转到空间详情
  goToLocation: function (e) {
    var locationId = e.currentTarget.dataset.id;
    console.log('跳转到空间详情，ID:', locationId);
    wx.navigateTo({
      url: '/pages/location/location?id=' + locationId
    });
  },

  // 跳转到创建空间
  goToCreateFirstLocation: function () {
    console.log('跳转到创建空间');
    wx.navigateTo({
      url: '/pages/create_location/create_location'
    });
  },

  // 下拉刷新
  onPullDownRefresh: function () {
    var that = this;
    console.log('手动刷新');

    this.loadLocationsWithStats();

    // 停止刷新动画
    setTimeout(function () {
      wx.stopPullDownRefresh();
      wx.showToast({
        title: '已刷新',
        icon: 'success',
        duration: 800
      });
    }, 1000);
  },

  /**
   * 初始化用户提醒设置
   */
  initUserSettings: function () {
    var that = this;
    wx.cloud.callFunction({
      name: 'initUserSettings',
      success: function (res) {
        console.log('用户设置初始化成功:', res);
        // 延迟检查订阅权限，确保页面已加载
        setTimeout(function() {
          that.checkSubscribePermission();
        }, 1000);
      },
      fail: function (err) {
        console.error('初始化用户设置失败:', err);
      }
    });
  },

  /**
   * 检查订阅消息授权状态
   */
  checkSubscribePermission: function () {
    var that = this;

    var templateId = 'kjNYfJVcrdGMfxi9HmS21AHgQdV_GCJP3BRE92UQlio';

    // 获取订阅消息授权状态
    wx.getSetting({
      withSubscriptions: true,
      success: function (res) {
        var subscriptions = res.subscriptionsSetting;
        var itemSettings = subscriptions.itemSettings || {};

        // 检查该模板是否已授权
        var isEnabled = itemSettings[templateId] === 'accept';
        that.setData({
          reminderEnabled: isEnabled
        });

        if (!isEnabled) {
          console.log('模板未授权，显示授权弹窗');
          // 未授权或已拒绝，显示授权引导
          that.setData({
            showSubscribeModal: true
          });
        }
      },
      fail: function (err) {
        console.error('获取授权状态失败:', err);
      }
    });
  },

  /**
   * 打开临期提醒设置
   */
  openReminderSettings: function () {
    this.setData({
      showSubscribeModal: true
    });
  },

  /**
   * 请求订阅消息授权
   */
  requestSubscribeMessage: function () {
    var that = this;

    var templateId = 'kjNYfJVcrdGMfxi9HmS21AHgQdV_GCJP3BRE92UQlio';

    wx.requestSubscribeMessage({
      tmplIds: [templateId],
      success: function (res) {
        console.log('订阅消息授权结果:', res);

        if (res[templateId] === 'accept') {
          wx.showToast({
            title: '授权成功',
            icon: 'success'
          });
          that.setData({
            showSubscribeModal: false,
            reminderEnabled: true
          });
        } else {
          wx.showToast({
            title: '已拒绝授权',
            icon: 'none'
          });
        }
      },
      fail: function (err) {
        console.error('请求订阅消息失败:', err);
        wx.showToast({
          title: '授权失败',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 关闭订阅授权弹窗
   */
  closeSubscribeModal: function () {
    this.setData({
      showSubscribeModal: false
    });
  },

  /**
   * 阻止弹窗卡片点击穿透
   */
  onSubscribeCardTap: function () {
    // 空函数，用于阻止事件冒泡
  },

  /**
   * 测试临期提醒云函数（临时测试用）
   */
  testCheckExpiry: function () {
    var that = this;
    wx.showLoading({ title: '检查中...' });

    wx.cloud.callFunction({
      name: 'checkExpiry',
      data: {
        skipReminderCheck: true
      },
      success: function (res) {
        wx.hideLoading();
        console.log('云函数完整返回:', res);
        console.log('云函数result:', res.result);

        var result = res.result;
        
        // 检查返回结果是否有效
        if (!result) {
          wx.showModal({
            title: '错误',
            content: '云函数返回为空，请检查云函数是否正确部署',
            showCancel: false
          });
          return;
        }
        
        if (result.code === 0) {
          var data = result.data || {};
          var total = data.total || 0;
          var success = data.success || 0;
          var fail = data.fail || 0;
          
          var message = '';
          
          // 聚合消息模式
          if (success > 0) {
            message += '✅ 聚合提醒已发送！\n\n';
            message += '📦 共 ' + total + ' 件临期物品:\n';
            
            if (data.items && data.items.length > 0) {
              data.items.forEach(function (item) {
                var level = item.reminderLevel === 'expired' ? '🔴' : '🟡';
                var daysText = item.daysLeft <= 0 ? '已过期' : ('还剩' + item.daysLeft + '天');
                message += level + ' ' + item.name + ' (' + daysText + ')\n';
              });
            }
            message += '\n💡 一天只提醒一次，避免打扰';
          } else if (fail > 0) {
            message += '❌ 提醒发送失败\n';
            message += '错误: ' + (data.error || '未知错误') + '\n\n';
            message += '请检查:\n';
            message += '1. 是否已授权订阅消息\n';
            message += '2. 重新点击临期提醒授权';
          } else {
            message += '⏭️ 今天已提醒过\n';
            message += '共 ' + total + ' 件物品，今天不再重复提醒';
          }

          wx.showModal({
            title: '检查结果',
            content: message,
            showCancel: false,
            confirmText: '知道了'
          });
        } else {
          wx.showModal({
            title: '检查失败',
            content: result.message || '未知错误',
            showCancel: false
          });
        }
      },
      fail: function (err) {
        wx.hideLoading();
        console.error('云函数调用失败:', err);
        wx.showToast({
          title: '调用失败',
          icon: 'none'
        });
      }
    });
  }

});