// pages/create_location/create_location.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    locationName: '', // 用于绑定输入框的空间名称
    remark: '',       // 空间备注
    selectedIcon: '📦', // 选中的图标
    icons: ['📦', '🏠', '🧊', '📺', '🛋️', '🚪', '🗄️', '📚', '👕', '🍽️', '🛁', '🚗'], // 可选图标
    isSaving: false   // 用于控制保存按钮的加载状态
  },

  /**
   * 监听输入框输入事件
   */
  onNameInput(e) {
    // 将输入框的值更新到 data 中
    this.setData({
      locationName: e.detail.value
    });
  },

  /**
   * 监听备注输入
   */
  onRemarkInput(e) {
    this.setData({
      remark: e.detail.value
    });
  },

  /**
   * 选择图标
   */
  selectIcon(e) {
    const icon = e.currentTarget.dataset.icon;
    this.setData({
      selectedIcon: icon
    });
  },

  /**
   * 点击保存按钮
   */
  onSubmit() {
    const name = this.data.locationName.trim(); // 去除首尾空格
    // 1. 简单验证
    if (!name) {
      wx.showToast({
        title: '请填写空间名称',
        icon: 'none'
      });
      return;
    }
    // 2. 防止重复点击
    if (this.data.isSaving) return;
    // 3. 开始保存
    this.saveLocationToCloud(name);
  },

  /**
   * 将数据保存到云端（记录创建者 openid，仅创建者可删）
   */
  async saveLocationToCloud(name) {
    this.setData({ isSaving: true });
    const db = wx.cloud.database();
    const createTime = new Date().toISOString();

    try {
      let createdBy = '';
      try {
        const openRes = await wx.cloud.callFunction({ name: 'quickstartFunctions', data: { type: 'getOpenId' } });
        if (openRes.result && openRes.result.openid) createdBy = openRes.result.openid;
      } catch (e) {
        console.warn('获取 openid 失败，空间将无创建者标记', e);
      }

      const res = await db.collection('locations').add({
        data: {
          name: name,
          icon: this.data.selectedIcon,
          remark: this.data.remark || '',
          itemCount: 0,
          createTime: createTime,
          createdBy: createdBy
        }
      });
      console.log('保存成功，记录ID：', res._id);
      wx.showToast({ title: '创建成功！', icon: 'success', duration: 1500 });
      setTimeout(() => wx.navigateBack(), 1600);
    } catch (err) {
      console.error('保存失败：', err);
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
      this.setData({ isSaving: false });
    }
  }
});