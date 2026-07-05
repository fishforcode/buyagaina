// pages/index/index.js - 修复统计问题版本
const config = require('../../config.js');

Page({

  data: {
    isLoading: true,
    isFirstUser: false,
    locationList: [],
    sharedLocations: [],
    showShareModal: false,
    shareToken: '',
    // 订阅消息相关
    showSubscribeModal: false,
    reminderEnabled: false
  },

  onLoad: function (options) {
    if (options.shareToken) {
      this.handleShareLink(options.shareToken);
    }
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

  // 分享给朋友
  onShareAppMessage: function () {
    return {
      title: '又买啊 - 帮你记住物品保质期',
      path: '/pages/index/index',
      imageUrl: '/images/share.png' // 可以换成你的分享图
    };
  },

  // 分享到朋友圈
  onShareTimeline: function () {
    return {
      title: '又买啊 - 帮你记住物品保质期',
      query: '',
      imageUrl: '/images/share.png'
    };
  },

  // 加载空间列表并统计物品数量
  loadLocationsWithStats: function () {
    var that = this;
    this.setData({ isLoading: true });
    console.log('开始加载空间列表和统计...');
    
    var db = wx.cloud.database();
    
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: { type: 'getOpenId' },
      success: function (openIdRes) {
        var openid = openIdRes.result && openIdRes.result.openid ? openIdRes.result.openid : '';
        
        db.collection('locations')
          .orderBy('createTime', 'desc')
          .get()
          .then(function (locationRes) {
            var allLocations = locationRes.data;
            console.log('获取到空间数量:', allLocations.length);
            
            if (allLocations.length === 0) {
              that.setData({
                isLoading: false,
                isFirstUser: true,
                locationList: [],
                sharedLocations: []
              });
              return;
            }
            
            var myLocations = [];
            var sharedLocations = [];
            
            allLocations.forEach(function (location) {
              var isCreator = !location.createdBy || location.createdBy === openid;
              var isShared = location.sharedWith && location.sharedWith.some(function (item) {
                return item.openid === openid;
              });
              
              if (isCreator) {
                myLocations.push(location);
              } else if (isShared) {
                sharedLocations.push(location);
              }
            });
            
            return Promise.all([
              that._loadLocationStats(myLocations),
              that._loadLocationStats(sharedLocations)
            ]);
          })
          .then(function (results) {
            var myStats = results[0] || [];
            var sharedStats = results[1] || [];
            
            that.setData({
              locationList: myStats,
              sharedLocations: sharedStats,
              isLoading: false,
              isFirstUser: myStats.length === 0 && sharedStats.length === 0
            });
          })
          .catch(function (err) {
            console.error('加载空间列表失败:', err);
            wx.showToast({ title: '加载失败', icon: 'none' });
            that.setData({ isLoading: false });
          });
      },
      fail: function () {
        db.collection('locations')
          .orderBy('createTime', 'desc')
          .get()
          .then(function (locationRes) {
            var locations = locationRes.data;
            return that._loadLocationStats(locations);
          })
          .then(function (stats) {
            that.setData({
              locationList: stats,
              sharedLocations: [],
              isLoading: false,
              isFirstUser: stats.length === 0
            });
          })
          .catch(function (err) {
            console.error('加载空间列表失败:', err);
            wx.showToast({ title: '加载失败', icon: 'none' });
            that.setData({ isLoading: false });
          });
      }
    });
  },

  _loadLocationStats: function (locations) {
    var db = wx.cloud.database();
    var that = this;
    
    if (locations.length === 0) {
      return Promise.resolve([]);
    }
    
    var statsPromises = locations.map(function (location, index) {
      return db.collection('items')
        .where({ locationId: location._id })
        .count()
        .then(function (countRes) {
          return {
            _id: location._id,
            name: location.name,
            icon: location.icon || '📦',
            remark: location.remark || '',
            createTime: location.createTime,
            itemCount: countRes.total,
            isShared: !!location.createdBy
          };
        })
        .catch(function () {
          return {
            _id: location._id,
            name: location.name,
            icon: location.icon || '📦',
            remark: location.remark || '',
            createTime: location.createTime,
            itemCount: 0,
            isShared: !!location.createdBy
          };
        });
    });
    
    return Promise.all(statsPromises);
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

    var templateId = config.templateId;

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

    var templateId = config.templateId;

    wx.requestSubscribeMessage({
      tmplIds: [templateId],
      success: function (res) {
        console.log('订阅消息授权结果:', res);

        if (res[templateId] === 'accept') {
          // 保存到云端
          wx.cloud.callFunction({
            name: 'initUserSettings',
            data: {
              reminderEnabled: true,
              reminderDays: 3
            },
            success: function () {
              wx.showToast({
                title: '授权成功',
                icon: 'success'
              });
              that.setData({
                showSubscribeModal: false,
                reminderEnabled: true
              });
            },
            fail: function (err) {
              console.error('保存设置失败:', err);
              wx.showToast({
                title: '授权成功但保存失败',
                icon: 'none'
              });
            }
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
   * 处理分享链接
   */
  handleShareLink: function (shareToken) {
    var that = this;
    wx.showModal({
      title: '收到空间分享',
      content: '是否接受这个空间分享？',
      success: function (res) {
        if (res.confirm) {
          wx.cloud.callFunction({
            name: 'acceptShare',
            data: { shareToken: shareToken },
            success: function (result) {
              if (result.result.code === 0) {
                wx.showToast({
                  title: '接受成功',
                  icon: 'success'
                });
                that.loadLocationsWithStats();
              } else {
                wx.showToast({
                  title: result.result.message,
                  icon: 'none'
                });
              }
            },
            fail: function (err) {
              console.error('接受分享失败:', err);
              wx.showToast({
                title: '接受失败',
                icon: 'none'
              });
            }
          });
        }
      }
    });
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
        sendNotification: true,  // 手动点击也发送提醒
        skipDailyLimit: true  // 跳过每日限制，允许重复点击
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
          var isManualCheck = data.manualCheck === true;
          var message = result.message || '';
          
          // 没有临期物品的情况
          if (message === '没有临期物品需要提醒') {
            wx.showModal({
              title: '检查结果',
              content: '✅ 恭喜！没有临期物品需要提醒',
              showCancel: false,
              confirmText: '知道了'
            });
            return;
          }
          
          var displayMessage = '';
          
          if (success > 0) {
            // 提醒发送成功
            displayMessage += '✅ 提醒已发送！\n\n';
            displayMessage += '📦 共 ' + total + ' 件临期物品:\n';
            
            if (data.items && data.items.length > 0) {
              data.items.forEach(function (item) {
                var level = item.reminderLevel === 'expired' ? '🔴' : '🟡';
                var daysText = item.daysLeft <= 0 ? '已过期' : ('还剩' + item.daysLeft + '天');
                displayMessage += level + ' ' + item.name + ' (' + daysText + ')\n';
              });
            }
            displayMessage += '\n💡 手动提醒可随时发送';
          } else if (fail > 0) {
            displayMessage += '❌ 提醒发送失败\n';
            displayMessage += '错误: ' + (data.error || '未知错误') + '\n\n';
            displayMessage += '请检查:\n';
            displayMessage += '1. 是否已授权订阅消息\n';
            displayMessage += '2. 重新点击临期提醒授权';
          } else if (isManualCheck) {
            // 仅查看模式
            displayMessage += '📦 共 ' + total + ' 件临期物品:\n\n';
            
            if (data.items && data.items.length > 0) {
              data.items.forEach(function (item) {
                var level = item.reminderLevel === 'expired' ? '🔴' : '🟡';
                var daysText = item.daysLeft <= 0 ? '已过期' : ('还剩' + item.daysLeft + '天');
                displayMessage += level + ' ' + item.name + ' (' + daysText + ')\n';
              });
            }
          } else if (message === '今天已提醒过') {
            displayMessage += '⏭️ 今天已提醒过\n';
            displayMessage += '共 ' + total + ' 件物品，今天不再重复提醒';
          } else {
            displayMessage = message || '检查完成';
          }

          wx.showModal({
            title: '检查结果',
            content: displayMessage,
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
        wx.showModal({
          title: '执行失败',
          content: '错误: ' + (err.errMsg || err.message || JSON.stringify(err)) + '\n\n请检查云函数是否正确部署',
          showCancel: false
        });
      }
    });
  }

});